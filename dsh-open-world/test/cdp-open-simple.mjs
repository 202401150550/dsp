#!/usr/bin/env node
import http from 'node:http'
import WebSocket from 'ws'

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    })
    req.on('error', reject)
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('http timeout')) })
  })
}

const list = await getJson('http://127.0.0.1:9222/json/list')
const page = list.find((p) => p.type === 'page')
console.log('connecting', page?.webSocketDebuggerUrl)
const ws = new WebSocket(page.webSocketDebuggerUrl, { handshakeTimeout: 8000 })
await Promise.race([
  new Promise((r, j) => { ws.once('open', r); ws.once('error', j) }),
  new Promise((_, j) => setTimeout(() => j(new Error('ws open timeout')), 10000)),
])
console.log('ws open')
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
function send(method, params = {}, ms = 8000) {
  return new Promise((resolve, reject) => {
    const mid = ++id
    const t = setTimeout(() => {
      pending.delete(mid)
      reject(new Error(`timeout ${method}`))
    }, ms)
    pending.set(mid, {
      resolve: (v) => { clearTimeout(t); resolve(v) },
      reject: (e) => { clearTimeout(t); reject(e) },
    })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
}

await send('Runtime.enable')
console.log('runtime ok')
const v = await send('Runtime.evaluate', {
  expression: `({
    trigger: !!document.querySelector('.ow-trigger'),
    overlay: !!document.querySelector('.ow-overlay'),
    title: document.title,
    ready: document.readyState,
  })`,
  returnByValue: true,
})
console.log('dom', v.result?.value)

const click = await send('Runtime.evaluate', {
  expression: `(() => {
    const t = document.querySelector('.ow-trigger');
    if (t) { t.click(); return 'clicked-trigger'; }
    const alt = [...document.querySelectorAll('button,[role=button]')].find(el => /开放|Open|指挥|✦|世界/i.test(el.textContent||el.getAttribute('aria-label')||''));
    if (alt) { alt.click(); return 'clicked-alt:' + (alt.textContent||'').trim().slice(0,40); }
    return 'missing';
  })()`,
  returnByValue: true,
  userGesture: true,
})
console.log('click', click.result?.value)
await new Promise((r) => setTimeout(r, 1200))
const after = await send('Runtime.evaluate', {
  expression: `({
    overlay: !!document.querySelector('.ow-overlay'),
    ideaBtn: !![...document.querySelectorAll('button')].find(b => /IDEA/i.test(b.textContent||'')),
    watermark: (document.body.innerText||'').match(/v2\\.\\d/)?.[0] || null,
  })`,
  returnByValue: true,
})
console.log('after', after.result?.value)

if (after.result?.value?.ideaBtn || after.result?.value?.overlay) {
  const idea = await send('Runtime.evaluate', {
    expression: `(() => {
      const b = [...document.querySelectorAll('button')].find(x => /IDEA\\s*Lab/i.test(x.textContent||''));
      if (!b) return 'no-idea';
      b.click();
      return 'idea-clicked';
    })()`,
    returnByValue: true,
    userGesture: true,
  })
  console.log('idea', idea.result?.value)
}

ws.close()
console.log('done')
