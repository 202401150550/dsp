#!/usr/bin/env node
/** Open DSH Open World → IDEA Lab via CDP (9222) */
import http from 'node:http'
import WebSocket from 'ws'

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => {
        try { resolve(JSON.parse(d)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

const list = await getJson('http://127.0.0.1:9222/json/list')
const page = list.find((p) => p.type === 'page')
if (!page) {
  console.error('no CDP page')
  process.exit(2)
}
console.log('url', page.url)

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
const evaluate = async (expression, ms = 10000) => {
  const r = await Promise.race([
    send('Runtime.evaluate', { expression, awaitPromise: false, returnByValue: true, userGesture: true }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ])
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result?.value
}

await send('Runtime.enable')
await send('Page.enable')
await send('Page.bringToFront').catch(() => {})

const MARKER = `小肥鱼打开试注入 ${new Date().toISOString()}`
console.log('marker', MARKER)

// soft wait — avoid full reload (CDP evaluate often hangs during reload)
for (let i = 0; i < 15; i++) {
  try {
    const ready = await evaluate(`!!document.querySelector('.ow-trigger') || document.readyState`, 5000)
    console.log('ready', i, ready)
    if (ready === true) break
  } catch (e) {
    console.log('ready-wait', i, e.message)
  }
  await new Promise((r) => setTimeout(r, 1000))
}

let step = await evaluate(`(() => {
  const t = document.querySelector('.ow-trigger');
  if (!t) {
    const hits = [...document.querySelectorAll('button,[role=button],a')].filter(el => /开放世界|Open\\s*World|指挥舱|✦|NEXORA/i.test(el.textContent||el.getAttribute('aria-label')||''));
    if (hits[0]) { hits[0].click(); return { ok:true, via:'text', label:(hits[0].textContent||'').trim().slice(0,40) }; }
    return { ok:false, why:'no-trigger', sample:[...document.querySelectorAll('button')].slice(0,12).map(b=>(b.textContent||'').trim().slice(0,36)) };
  }
  t.click();
  return { ok:true, overlay: !!document.querySelector('.ow-overlay') };
})()`)
console.log('open', step)
await new Promise((r) => setTimeout(r, 1500))

step = await evaluate(`(() => {
  const o = document.querySelector('.ow-overlay');
  if (!o) return { ok:false, why:'no-overlay' };
  const idea = [...o.querySelectorAll('button')].find(b => /IDEA\\s*Lab/i.test(b.textContent||''));
  if (!idea) return { ok:false, why:'no-idea-btn', tabs:[...o.querySelectorAll('button')].slice(0,20).map(b=>(b.textContent||'').trim().slice(0,30)) };
  idea.click();
  return { ok:true };
})()`)
console.log('idea', step)
await new Promise((r) => setTimeout(r, 1000))

step = await evaluate(`(() => {
  const marker = ${JSON.stringify(MARKER)};
  const o = document.querySelector('.ow-overlay');
  if (!o) return { ok:false, why:'no-overlay' };
  [...o.querySelectorAll('.ow-idea-card')].find(c => /小肥鱼/.test(c.textContent||''))?.click();
  const tas = [...o.querySelectorAll('textarea.ow-idea-prompt')].filter(t => t.offsetParent);
  const ta = tas[0] || o.querySelector('textarea.ow-idea-prompt');
  if (!ta) return { ok:false, why:'no-ta', taCount: o.querySelectorAll('textarea').length };
  const key = Object.keys(ta).find(k => k.startsWith('__reactProps$'));
  const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  desc.set.call(ta, marker);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  if (key && ta[key]?.onChange) {
    ta[key].onChange({ target: { value: marker }, currentTarget: { value: marker } });
  }
  const btn = [...o.querySelectorAll('button')].find(b => (b.textContent||'').trim() === '注入对话');
  if (!btn) return { ok:false, why:'no-inject-btn', value: ta.value.slice(0,40) };
  btn.click();
  return { ok:true, disabled: !!btn.disabled, valueLen: (ta.value||'').length, btnText: (btn.textContent||'').trim() };
})()`)
console.log('inject', step)

for (let i = 0; i < 8; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  const poll = await evaluate(`(() => {
    const toast = document.querySelector('.ow-toast, [class*="toast"]');
    const o = document.querySelector('.ow-overlay');
    const btns = o ? [...o.querySelectorAll('button')].filter(b => /注入/.test(b.textContent||'')).map(b => (b.textContent||'').trim()) : [];
    const body = document.body.innerText || '';
    return {
      overlay: !!o,
      toast: toast ? (toast.textContent||'').trim().slice(0,80) : null,
      injectBtns: btns,
      hasMarker: body.includes(${JSON.stringify(MARKER.slice(0, 12))}),
      hasIdeaTag: /\\[IDEA Lab/.test(body),
    };
  })()`)
  console.log('poll' + i, poll)
  if (poll.hasMarker || poll.hasIdeaTag || (!poll.overlay && i > 1)) break
}

// mailbox check via page fetch
const mb = await evaluate(`(async () => {
  try {
    const r = await fetch('/api/open-world/mailbox?limit=5');
    const j = await r.json();
    const items = j.items || j.mailbox || j || [];
    const arr = Array.isArray(items) ? items : (items.items || []);
    return arr.slice(0,3).map(x => ({ kind: x.kind, id: x.id, preview: String(x.body||x.text||'').slice(0,60) }));
  } catch (e) { return { err: String(e) }; }
})()`, 15000).catch((e) => ({ err: e.message }))
console.log('mailbox', mb)

ws.close()
console.log('done')
