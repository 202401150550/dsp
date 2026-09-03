#!/usr/bin/env node
import http from 'node:http'
import WebSocket from 'ws'

const MARKER = `CDP注入验证 ${new Date().toISOString()}`

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}

const list = await getJson('http://127.0.0.1:9222/json/list')
const page = list.find((p) => p.type === 'page')
console.log('MARKER', MARKER)
console.log('url', page.url)
const port = new URL(page.url).port
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
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id
  pending.set(mid, { resolve, reject })
  ws.send(JSON.stringify({ id: mid, method, params }))
})
const evaluate = async (expression) => {
  const r = await Promise.race([
    send('Runtime.evaluate', { expression, awaitPromise: false, returnByValue: true, userGesture: true }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
  ])
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result?.value
}
await send('Runtime.enable')

console.log('open', await evaluate(`(() => {
  if (!document.querySelector('.ow-overlay')) document.querySelector('.ow-trigger')?.click();
  return !!document.querySelector('.ow-overlay') || 'clicked';
})()`))
await new Promise((r) => setTimeout(r, 1000))

console.log('idea', await evaluate(`(() => {
  [...document.querySelectorAll('button')].find(b => /IDEA Lab/i.test(b.textContent||''))?.click();
  return true;
})()`))
await new Promise((r) => setTimeout(r, 800))

console.log('fill', await evaluate(`(() => {
  const marker = ${JSON.stringify(MARKER)};
  const o = document.querySelector('.ow-overlay');
  if (!o) return 'no-overlay';
  [...o.querySelectorAll('.ow-idea-card')].find(c => /小肥鱼/.test(c.textContent||''))?.click();
  const ta = [...o.querySelectorAll('textarea.ow-idea-prompt')].find(t => t.offsetWidth) || o.querySelector('textarea.ow-idea-prompt');
  if (!ta) return 'no-ta';
  const key = Object.keys(ta).find(k => k.startsWith('__reactProps$'));
  const native = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  native.set.call(ta, marker);
  const fake = { target: ta, currentTarget: ta };
  Object.defineProperty(ta, 'value', { configurable: true, get: () => marker, set: () => {} });
  if (key && ta[key]?.onChange) ta[key].onChange({ target: { value: marker }, currentTarget: { value: marker } });
  // restore
  delete ta.value;
  native.set.call(ta, marker);
  const btn = [...o.querySelectorAll('button')].find(b => (b.textContent||'').trim() === '注入对话');
  return { hasBtn: !!btn, disabled: btn && btn.disabled, hasOnChange: !!(key && ta[key]?.onChange) };
})()`))

console.log('click', await evaluate(`(() => {
  const btn = [...document.querySelectorAll('.ow-overlay button')].find(b => (b.textContent||'').trim() === '注入对话');
  if (!btn) return 'no-btn';
  btn.click();
  return 'clicked:' + (btn.textContent||'').trim();
})()`))

for (let i = 0; i < 15; i++) {
  await new Promise((r) => setTimeout(r, 500))
  const st = await evaluate(`(() => ({
    toast: document.querySelector('.ow-toast')?.textContent || null,
    btns: [...document.querySelectorAll('button')].map(b => (b.textContent||'').trim()).filter(t => /注入/.test(t)).slice(0,4),
    overlay: !!document.querySelector('.ow-overlay'),
    hasIdea: (document.body.innerText||'').includes('[IDEA Lab'),
    hasMarker: (document.body.innerText||'').includes(${JSON.stringify(MARKER)}),
  }))()`)
  console.log('poll' + i, st)
  if (st.toast && !/正在注入/.test(st.toast)) break
  if (!st.overlay) break
  if (st.hasMarker || st.hasIdea) break
}

const mb = await fetch(`http://127.0.0.1:${port}/api/open-world/messages`).then((r) => r.json())
console.log('mailbox', (mb.messages || []).some((m) => m.body?.includes(MARKER)) ? 'FOUND' : 'missing')
ws.close()
