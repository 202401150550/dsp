#!/usr/bin/env node
/**
 * Open World 冷启验收（CDP 页内 fetch）
 *
 * Desktop 进程外 HTTP 常 403；本脚本在 Electron 页内跑同源 API。
 * 用法：
 *   1) Desktop 加 --remote-debugging-port=9333
 *   2) npm run test:live-cdp
 *   或由 npm run test:live 在探测失败/403 时自动回退
 */
import WebSocket from 'ws'

const CDP = (process.env.OW_CDP_URL || 'http://127.0.0.1:9333').replace(/\/$/, '')

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) {
    passed++
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

async function connectPage() {
  const list = await (await fetch(`${CDP}/json/list`)).json()
  const page = list.find((t) => t.type === 'page' && /127\.0\.0\.1:\d+/.test(t.url || ''))
    || list.find((t) => t.type === 'page')
  if (!page?.webSocketDebuggerUrl) {
    throw new Error(`CDP 无 page target · ${CDP}/json/list`)
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.once('open', res)
    ws.once('error', rej)
  })
  let id = 0
  function send(method, params = {}) {
    const mid = ++id
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout ${method}`)), 20000)
      function onMsg(data) {
        const msg = JSON.parse(data.toString())
        if (msg.id !== mid) return
        clearTimeout(t)
        ws.off('message', onMsg)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
      ws.on('message', onMsg)
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
  }
  return { page, ws, send }
}

console.log('\n=== Open World LIVE (CDP) ===\n')

let page
let ws
let send
try {
  ;({ page, ws, send } = await connectPage())
} catch (err) {
  console.error(`✗ CDP 不可用：${err.message}`)
  console.error('  启动 Desktop 时加 --remote-debugging-port=9333 后重试')
  process.exit(2)
}
console.log(`CDP page: ${page.url}\n`)

const evalJson = async (expression) => {
  const r = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression,
  })
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails))
  }
  return r.result?.value
}

console.log('GET /api/open-world/snapshot')
const snapPack = await evalJson(`(async () => {
  const res = await fetch('/api/open-world/snapshot')
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
})()`)
ok(snapPack.status === 200 && snapPack.json?.ok === true, `snapshot ok · status=${snapPack.status}`)
const snap = snapPack.json || {}
{
  const ver = String(snap.framework?.version || '')
  const maj = Number((ver.match(/^(\d+)\./) || [])[1] || 0)
  const min = Number((ver.match(/^\d+\.(\d+)/) || [])[1] || 0)
  ok(maj > 2 || (maj === 2 && min >= 51), `framework.version=${ver} (≥2.51)`)
}
ok(snap.framework?.protocol === 'owip/0.1' || snap.framework?.protocol === 'owip/0.2-draft',
  `framework.protocol=${snap.framework?.protocol}`)
ok(snap.space != null && typeof snap.space.hasToken === 'boolean', 'snapshot.space')
ok(snap.fleet != null && snap.fleet.counts != null, 'snapshot.fleet')
ok(typeof snap.core?.healthScore === 'number', `core.healthScore=${snap.core?.healthScore}`)
ok(Array.isArray(snap.nodes) && snap.nodes.length >= 8, `nodes count=${snap.nodes?.length}`)
ok(snap.lab?.topology?.source === 'metaphor', 'lab.topology.source=metaphor')

console.log('\nGET /api/open-world/snapshot?view=shell')
const shellPack = await evalJson(`(async () => {
  const res = await fetch('/api/open-world/snapshot?view=shell')
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
})()`)
ok(shellPack.status === 200 && shellPack.json?.ok === true, 'shell snapshot ok')
ok(shellPack.json?.view === 'shell', 'shell view tag')
ok(shellPack.json?.neuralLayers === undefined, 'shell drops neuralLayers')
ok(shellPack.json?.core != null && Array.isArray(shellPack.json?.nodes), 'shell keeps core/nodes')

console.log('\nPOST /api/open-world/action (coreShell)')
const msgBody = `[live-cdp] ${new Date().toISOString()}`
const sendPack = await evalJson(`(async () => {
  const res = await fetch('/api/open-world/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'send-message',
      to: 'broadcast',
      body: ${JSON.stringify(msgBody)},
      kind: 'live-cdp',
    }),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
})()`)
ok(sendPack.status === 200 && sendPack.json?.ok === true, `send-message ok · status=${sendPack.status}`)

const wrapPack = await evalJson(`(async () => {
  const res = await fetch('/api/open-world/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'idea-wrap',
      presetId: 'xiaofeiyu',
      body: 'live cdp ping',
      treatAs: '主人',
    }),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
})()`)
ok(wrapPack.status === 200 && wrapPack.json?.ok === true, 'idea-wrap ok')
ok(String(wrapPack.json?.wrapped || '').includes('[IDEA Lab'), 'idea-wrap header')

const memPack = await evalJson(`(async () => {
  const res = await fetch('/api/open-world/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'memory-search', query: 'open world' }),
  })
  return { status: res.status }
})()`)
ok(memPack.status === 200, `memory-search status ${memPack.status}`)

console.log('\nMailbox + watermark')
const mbPack = await evalJson(`(async () => {
  const res = await fetch('/api/open-world/messages')
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
})()`)
ok(mbPack.status === 200, `messages status ${mbPack.status}`)
const hit = (mbPack.json?.messages || []).some((m) => String(m.body || '').includes('[live-cdp]'))
ok(hit, 'broadcast message visible in mailbox')

const ui = await evalJson(`({
  text: document.body?.innerText || '',
  title: document.title || '',
})`)
const wmOk = /OPEN-WORLD\s+v2\.(5\d|[6-9]\d|\d{3,})/.test(ui.text)
  || String(snap.framework?.clientVer || '').startsWith('v2.5')
ok(wmOk || String(snap.framework?.version || '').startsWith('2.5'),
  `watermark/clientVer aligned (fw=${snap.framework?.version} clientVer=${snap.framework?.clientVer || '?'})`)
if (!wmOk) {
  console.log('  · 提示：打开 ✦ 壳后 DOM 会出现 OPEN-WORLD v2.51；当前以 framework.version 为准')
}

try { ws.close() } catch { /* ignore */ }

console.log(`\n=== LIVE CDP: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
