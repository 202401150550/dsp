#!/usr/bin/env node
/** Verify plain-language shell copy via CDP (do not close an already-open shell). */
import WebSocket from 'ws'

const CDP = (process.env.OW_CDP_URL || 'http://127.0.0.1:9333').replace(/\/$/, '')
const list = await (await fetch(`${CDP}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page?.webSocketDebuggerUrl) {
  console.error('✗ no CDP page')
  process.exit(2)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej) })
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
async function ev(expression) {
  const r = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression,
  })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result?.value
}

const how = await ev(`(async () => {
  if (document.querySelector('.ow-side')) return 'already'
  const t = document.querySelector('.ow-trigger')
  if (t) {
    t.click()
    await new Promise((r) => setTimeout(r, 1200))
    return document.querySelector('.ow-side') ? 'opened' : 'clicked-no-side'
  }
  return 'none'
})()`)

const ui = await ev(`(() => {
  const root = document.querySelector('.ow-root, .ow-overlay, .ow-shell')
  const text = (root && root.innerText) || ''
  const need = ['三步上手', '现在怎样', '连接', '状态', '动作', '事件']
  const hit = Object.fromEntries(need.map((s) => [s, text.includes(s)]))
  return {
    hasSide: !!document.querySelector('.ow-side'),
    guide: document.querySelector('.ow-shell-guide-text')?.innerText || null,
    bridge: document.querySelector('.ow-bridge-label')?.textContent || null,
    titles: [...document.querySelectorAll('.ow-panel-title')]
      .map((e) => (e.innerText || '').replace(/\\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 8),
    ver: document.querySelector('.ow-ver')?.innerText || null,
    brand: document.querySelector('.ow-brand-name')?.innerText || null,
    hit,
    wm: (text.match(/OPEN-WORLD\\s+v2\\.\\d+/) || [])[0] || null,
  }
})()`)

console.log(JSON.stringify({ how, ...ui }, null, 2))
try { ws.close() } catch { /* ignore */ }

if (!ui.hasSide) {
  console.error('✗ 壳左栏未打开')
  process.exit(1)
}
const miss = Object.entries(ui.hit).filter(([, v]) => !v).map(([k]) => k)
if (miss.length) {
  console.error('✗ 缺文案:', miss.join(', '))
  process.exit(1)
}
console.log('✓ 白话首屏文案齐')
process.exit(0)
