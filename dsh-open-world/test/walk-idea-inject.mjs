#!/usr/bin/env node
/**
 * 活体走通 IDEA「注入对话」全链路（Host 必测 + Bridge 单测 + 可选 CDP 真注入）
 * Usage: node test/walk-idea-inject.mjs [baseUrl]
 */
import { createBridge } from '../bridge/execute.mjs'
import { connect } from 'node:net'
import http from 'node:http'

const MARKER = `你好·小肥鱼活体走通 ${new Date().toISOString()}`

async function findBase() {
  if (process.argv[2]) return process.argv[2].replace(/\/$/, '')
  const candidates = []
  try {
    const { execSync } = await import('node:child_process')
    const out = execSync('netstat -ano', { encoding: 'utf8', windowsHide: true })
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/127\.0\.0\.1:(\d+).*LISTENING/i)
      if (m) {
        const p = Number(m[1])
        if (p > 2000) candidates.push(p)
      }
    }
  } catch { /* ignore */ }
  for (const port of candidates) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/open-world/snapshot`, {
        signal: AbortSignal.timeout(1500),
      })
      if (!res.ok) continue
      const j = await res.json()
      if (j?.ok && (j.framework?.protocol === 'owip/0.1' || j.framework?.protocol === 'owip/0.2-draft' || j.framework?.protocol === 'owip/0.3-draft')) return `http://127.0.0.1:${port}`
    } catch { /* next */ }
  }
  return null
}

function step(n, title) {
  console.log(`\n── ${n}. ${title} ──`)
}

async function post(base, body) {
  const res = await fetch(`${base}/api/open-world/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { res, json }
}

async function tryCdpInject(wrapped) {
  const ports = [9222, 9229, 9333]
  for (const port of ports) {
    const open = await new Promise((resolve) => {
      const s = connect({ host: '127.0.0.1', port })
      const t = setTimeout(() => { s.destroy(); resolve(false) }, 400)
      s.on('connect', () => { clearTimeout(t); s.destroy(); resolve(true) })
      s.on('error', () => { clearTimeout(t); resolve(false) })
    })
    if (!open) continue
    try {
      const list = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
          let d = ''
          res.on('data', (c) => { d += c })
          res.on('end', () => {
            try { resolve(JSON.parse(d)) } catch (e) { reject(e) }
          })
        }).on('error', reject)
      })
      const page = (Array.isArray(list) ? list : []).find((p) => p.type === 'page' && p.webSocketDebuggerUrl)
      if (!page) {
        console.log(`  CDP :${port} 有端口但无 page target`)
        continue
      }
      // 动态 import ws（可能没有）
      let WebSocket
      try {
        WebSocket = (await import('ws')).default
      } catch {
        console.log('  未安装 ws，跳过 CDP Runtime.evaluate')
        return { ok: false, reason: 'no-ws' }
      }
      const ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((r, j) => { ws.once('open', r); ws.once('error', j) })
      let id = 0
      const pending = new Map()
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString())
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id)
          pending.delete(msg.id)
          if (msg.error) reject(new Error(JSON.stringify(msg.error)))
          else resolve(msg.result)
        }
      })
      const send = (method, params = {}) => {
        const mid = ++id
        return new Promise((resolve, reject) => {
          pending.set(mid, { resolve, reject })
          ws.send(JSON.stringify({ id: mid, method, params }))
        })
      }
      await send('Runtime.enable')
      const expr = `(() => {
        const text = ${JSON.stringify(wrapped)};
        // 复现 Bridge sendViaSession：找 sessions 很难；改走 textarea DOM 路径验证填入
        const ta = document.querySelector('textarea');
        if (!ta) return { ok: false, error: 'textarea-not-found', href: location.href };
        const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        if (desc && desc.set) desc.set.call(ta, text); else ta.value = text;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
        const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        ta.dispatchEvent(new KeyboardEvent('keydown', opts));
        ta.dispatchEvent(new KeyboardEvent('keypress', opts));
        ta.dispatchEvent(new KeyboardEvent('keyup', opts));
        return { ok: true, strategy: 'cdp-dom', href: location.href, len: text.length };
      })()`
      const ev = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      ws.close()
      return ev.result?.value || { ok: false, raw: ev }
    } catch (err) {
      console.log(`  CDP :${port} 失败: ${err.message}`)
    }
  }
  return { ok: false, reason: 'cdp-unavailable' }
}

console.log('\n=== IDEA 注入对话 · 活体走通 ===\n')

step(1, '定位 DSH Open World API')
const base = await findBase()
if (!base) {
  console.error('✗ DSH 未就绪')
  process.exit(2)
}
console.log(`  ✓ ${base}`)

step(2, '读 snapshot.idea（人格列表）')
const snap = await (await fetch(`${base}/api/open-world/snapshot`)).json()
const presets = snap.idea?.presets || []
const patient = presets.find((p) => /耐心|讲师|beginner|初学/i.test(p.title + (p.sub || '') + (p.id || '')))
  || presets.find((p) => p.id === 'patient-tutor' || p.id === 'xiaofeiyu')
  || presets[0]
if (!patient) {
  console.error('✗ 无 IDEA preset')
  process.exit(1)
}
console.log(`  ✓ 选用人格: ${patient.id} · ${patient.title}`)
console.log(`  · idea.enabled=${snap.idea?.enabled}`)

step(3, 'POST idea-inject（Host 包装 + 信箱）')
const { res, json } = await post(base, {
  action: 'idea-inject',
  presetId: patient.id,
  body: MARKER,
  treatAs: '初学者',
  logMailbox: true,
})
console.log(`  · HTTP ${res.status}`)
if (!json.ok || !json.wrapped) {
  console.error('✗ idea-inject 失败', json)
  process.exit(1)
}
console.log(`  ✓ wrapped 长度 ${json.wrapped.length}`)
console.log('  --- wrapped 预览 ---')
console.log(json.wrapped.split('\n').slice(0, 8).join('\n'))
console.log('  ...')
if (!json.wrapped.includes('[IDEA Lab')) {
  console.error('✗ 缺少 IDEA Lab 头')
  process.exit(1)
}
if (!json.wrapped.includes(MARKER)) {
  console.error('✗ 缺少正文 MARKER')
  process.exit(1)
}
if (!json.wrapped.includes('初学者')) {
  console.error('✗ 缺少 Treat me like')
  process.exit(1)
}
console.log('  ✓ 头 / Treat / 正文 齐全')

step(4, '信箱是否记了 idea-inject')
const mb = await (await fetch(`${base}/api/open-world/messages`)).json()
const hit = (mb.messages || []).find((m) => m.body && m.body.includes(MARKER))
if (!hit) {
  console.error('✗ 信箱未找到本条')
  process.exit(1)
}
console.log(`  ✓ mailbox id=${hit.id} kind=${hit.kind} to=${hit.to}`)

step(5, 'Bridge createBridge 模拟 conversation.send')
const sent = []
const toasts = []
const bridge = createBridge({
  getSessionsBridge: () => ({
    list: { getSnapshot: () => ({ current: 'live-walk' }) },
    scope: () => ({
      get: () => ({
        send: async (text) => { sent.push(text) },
      }),
    }),
    binding: () => ({ session: { command: async () => ({ ok: true, value: { matched: true } }) } }),
  }),
  postTaskAction: async () => ({}),
  notifyPulse: () => {},
  storage: { _d: {}, getItem(k) { return this._d[k] || null }, setItem(k, v) { this._d[k] = v } },
  querySelector: () => null,
  querySelectorAll: () => [],
})
await bridge.bridgeExecute(
  { type: 'inject-message', body: json.wrapped },
  { onClose: () => {}, setView: () => {}, setToast: (t) => toasts.push(t) },
)
if (sent[0] !== json.wrapped) {
  console.error('✗ Bridge 未把 wrapped 交给 conversation.send')
  process.exit(1)
}
console.log(`  ✓ session-api 收到全文（toast: ${toasts[0] || '—'}）`)

step(6, '可选：CDP 在真实 DSH 窗口 DOM 注入')
const cdp = await tryCdpInject(json.wrapped)
if (cdp.ok) {
  console.log(`  ✓ CDP 注入成功 strategy=${cdp.strategy}`)
  console.log(`  · href=${cdp.href}`)
} else {
  console.log(`  ⏭ CDP 跳过（${cdp.reason || cdp.error || '不可用'}）`)
  console.log('    说明：DSH Desktop 默认不开 remote debugging；')
  console.log('    Host+信箱+Bridge 逻辑已在上面活体/模拟跑通。')
  console.log('    你在 IDEA 点「注入对话」= 同样走 step3→5，最后一步在真会话里 send。')
}

console.log('\n=== 走通结果：Host+信箱+Bridge ✅ ===')
console.log(`MARKER: ${MARKER}`)
console.log(`GUI: ${base}/?dsh-desktop-mode=compatibility&dsh-desktop-platform=win32\n`)
process.exit(0)
