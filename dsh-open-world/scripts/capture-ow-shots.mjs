#!/usr/bin/env node
// OW 三景实拍 v2：自动发现工作区 UI 端口 → CDP 开页签 → 1600x1000 → 园/ATI/聊天坞连拍
import WebSocket from 'ws'
import fs from 'node:fs'
import path from 'node:path'
const CDP = (process.env.OW_CDP_URL || 'http://127.0.0.1:9333').replace(/\/$/, '')
const OUT = process.env.OW_SHOT_DIR || path.resolve('_scratch/shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function listTargets() {
  const res = await fetch(`${CDP}/json/list`)
  return res.json()
}
async function findWorkspacePage() {
  let list = await listTargets()
  let page = list.find((t) => t.type === 'page' && /127\.0\.0\.1:\d+/.test(t.url || '') && !/:9333/.test(t.url || ''))
  if (page) return page
  console.log('no workspace page; probing ports...')
  for (const port of [4310, 4301, 43120, 4040, 4001]) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2500) })
      const text = await res.text()
      if (res.ok && /shuncode|dsh|workspace|开放世界/i.test(text)) {
        console.log('UI port found:', port)
        await fetch(`${CDP}/json/new?url=${encodeURIComponent('http://127.0.0.1:' + port + '/')}`, { method: 'PUT' })
        await sleep(3500)
        list = await listTargets()
        page = list.find((t) => t.type === 'page' && new RegExp('127.0.0.1:' + port).test(t.url || ''))
        if (page) return page
      }
    } catch (e) { /* next port */ }
  }
  return null
}
const target = await findWorkspacePage()
if (!target) { console.error('NO_WORKSPACE_PAGE'); process.exit(1) }
console.log('target:', (target.url || '').slice(0, 70))
const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false })
let seq = 0
const pend = new Map()
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const i = ++seq
    pend.set(i, { res, rej })
    ws.send(JSON.stringify({ id: i, method, params }))
  })
}
ws.on('message', (d) => {
  const m = JSON.parse(d)
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id)
    pend.delete(m.id)
    if (m.error) p.rej(new Error(m.error.message))
    else p.res(m.result)
  }
})
await new Promise((r) => ws.on('open', r))
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true })
await sleep(2500)
await ev("[...document.querySelectorAll('button,[role=button]')].filter((x) => /跳过|Skip/.test(x.textContent || '') && (x.textContent || '').length < 12).forEach((x) => x.click())")
await sleep(600)
await ev("document.querySelector('.ow-trigger')?.click()")
await sleep(1600)
const ov = await ev("!!document.querySelector('.ow-overlay')")
console.log('overlay:', ov && ov.result && ov.result.value)
async function clickThing(re) {
  const expr = "(() => { const els = [...document.querySelectorAll('.ow-overlay button,[role=tab],[role=button],.chip,.ow-hub-card,.card')]; const b = els.find((x) => " + re + ".test((x.textContent || '').trim())); if (b) { b.click(); return (b.textContent || '').trim().slice(0, 14) } return null })()"
  const r = await ev(expr)
  await sleep(2600)
  return r && r.result && r.result.value
}
fs.mkdirSync(OUT, { recursive: true })
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'))
  console.log('saved', name)
}
console.log('garden click:', await clickThing('/进园|园|GARDEN/i'))
await shot('garden')
console.log('ati click:', await clickThing('/ATI|拓扑/i'))
await shot('ati')
console.log('chat click:', await clickThing('/聊天|CHAT/i'))
await shot('chat')
ws.close()
console.log('SHOTS_DONE')
process.exit(0)
