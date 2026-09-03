#!/usr/bin/env node
import http from 'node:http'
import WebSocket from 'ws'

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

const list = await getJson('http://127.0.0.1:9222/json/list')
const page = list.find((p) => p.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl, { handshakeTimeout: 8000 })
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
function send(method, params = {}, ms = 10000) {
  return new Promise((resolve, reject) => {
    const mid = ++id
    const t = setTimeout(() => { pending.delete(mid); reject(new Error(`timeout ${method}`)) }, ms)
    pending.set(mid, {
      resolve: (v) => { clearTimeout(t); resolve(v) },
      reject: (e) => { clearTimeout(t); reject(e) },
    })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
}
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, userGesture: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result?.value
}

await send('Runtime.enable')
const MARKER = `你好·打开注入 ${new Date().toISOString()}`
console.log('marker', MARKER)

console.log('prep', await ev(`(() => {
  if (!document.querySelector('.ow-overlay')) document.querySelector('.ow-trigger')?.click();
  return !!document.querySelector('.ow-overlay');
})()`))
await new Promise((r) => setTimeout(r, 600))
console.log('idea', await ev(`(() => {
  [...document.querySelectorAll('button')].find(b => /IDEA\\s*Lab/i.test(b.textContent||''))?.click();
  return true;
})()`))
await new Promise((r) => setTimeout(r, 800))

console.log('fill', await ev(`(() => {
  const marker = ${JSON.stringify(MARKER)};
  const o = document.querySelector('.ow-overlay');
  if (!o) return 'no-overlay';
  [...o.querySelectorAll('.ow-idea-card')].find(c => /小肥鱼/.test(c.textContent||''))?.click();
  const ta = [...o.querySelectorAll('textarea.ow-idea-prompt')].find(t => t.offsetParent) || o.querySelector('textarea.ow-idea-prompt');
  if (!ta) return 'no-ta';
  const key = Object.keys(ta).find(k => k.startsWith('__reactProps$'));
  const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  desc.set.call(ta, marker);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  if (key && ta[key]?.onChange) ta[key].onChange({ target: { value: marker }, currentTarget: { value: marker } });
  const btn = [...o.querySelectorAll('button')].find(b => (b.textContent||'').trim() === '注入对话');
  if (!btn) return { err: 'no-btn', val: ta.value.slice(0,40) };
  const before = (btn.textContent||'').trim();
  btn.click();
  return { before, after: (btn.textContent||'').trim(), disabled: btn.disabled, valLen: (ta.value||'').length };
})()`))

for (let i = 0; i < 6; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  const p = await ev(`(() => {
    const o = document.querySelector('.ow-overlay');
    const toasts = [...document.querySelectorAll('[class*="toast"], .ow-toast, [role=status]')].map(el => (el.textContent||'').trim().slice(0,80)).filter(Boolean);
    const btns = o ? [...o.querySelectorAll('button')].filter(b => /注入/.test(b.textContent||'')).map(b => (b.textContent||'').trim()) : [];
    return { overlay: !!o, toasts, btns, hasIdea: /\\[IDEA Lab/.test(document.body.innerText||'') };
  })()`)
  console.log('poll'+i, p)
  if (!p.overlay || p.hasIdea || (p.toasts && p.toasts.length)) break
}

ws.close()
console.log('done')
