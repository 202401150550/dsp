#!/usr/bin/env node
/** CDP shell smoke: left tabs + idea honesty + trigger */
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
if (!page) { console.error('no cdp'); process.exit(2) }
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
    const t = setTimeout(() => { pending.delete(mid); reject(new Error('timeout ' + method)) }, ms)
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
console.log('url', page.url)

await ev(`document.querySelector('.ow-trigger')?.click()`)
await new Promise((r) => setTimeout(r, 800))

const open = await ev(`(() => {
  const o = document.querySelector('.ow-overlay');
  if (!o) return { ok:false };
  const tabs = [...o.querySelectorAll('button,[role=tab]')].map(b => (b.textContent||'').trim()).filter(t => /状态|动作|事件|IDEA|Monitor|ATI|回退|Rewind/i.test(t));
  const metaphor = /隐喻/.test(o.innerText||'');
  const ideaHonesty = /前缀|不是.*预设|prompt|包装|口吻/.test(o.innerText||'');
  const ideaSandbox = /人格|沙箱|SANDBOX|注入对话/.test(o.innerText||'');
  const bridge = /session|Bridge|四灯|能力/.test(o.innerText||'');
  const ver = (o.innerText||'').match(/v2\\.\\d/)?.[0] || null;
  const ideaTa = o.querySelectorAll('textarea.ow-idea-prompt').length;
  const wm = o.getAttribute('data-wm') || '';
  const wmBtns = [...o.querySelectorAll('.ow-wm-btn')].map(b => (b.textContent||'').trim());
  const cls = o.className;
  return { ok:true, tabs: tabs.slice(0,20), metaphor, ideaHonesty, ideaSandbox, bridge, ver, ideaTa, wm, wmBtns, cls };
})()`)
console.log('open', JSON.stringify(open, null, 2))

const clickWm = async (label) => ev(`(() => {
  const b = [...document.querySelectorAll('.ow-wm-btn')].find(x => (x.textContent||'').trim() === ${JSON.stringify(label)});
  if (!b) return false;
  b.click();
  return true;
})()`)

for (const label of ['浮窗', '全屏', '并置', '—']) {
  const ok = await clickWm(label)
  await new Promise((r) => setTimeout(r, 350))
  const st = await ev(`(() => {
    const o = document.querySelector('.ow-overlay');
    return { label:${JSON.stringify(label)}, clicked:${JSON.stringify(!!ok)}, wm: o?.getAttribute('data-wm'), cls: o?.className, dock: !!document.querySelector('.ow-dock') };
  })()`)
  console.log('wm', st)
}

// restore from dock if minimized
await ev(`document.querySelector('.ow-dock-chip')?.click()`)
await new Promise((r) => setTimeout(r, 400))

const clickTab = async (label) => ev(`(() => {
  const o = document.querySelector('.ow-overlay');
  const b = [...(o||document).querySelectorAll('button')].find(x => (x.textContent||'').trim() === ${JSON.stringify(label)});
  if (!b) return false;
  b.click();
  return true;
})()`)

for (const t of ['状态', '动作', '事件']) {
  const ok = await clickTab(t)
  await new Promise((r) => setTimeout(r, 400))
  const body = await ev(`(() => {
    const o = document.querySelector('.ow-overlay');
    const text = (o?.innerText||'').slice(0, 200);
    return { tab:${JSON.stringify(t)}, clicked:${JSON.stringify(!!ok)}, snippet: text.replace(/\\s+/g,' ').slice(0,120) };
  })()`)
  console.log('tab', body)
}

await clickTab('动作')
await new Promise((r) => setTimeout(r, 400))
await ev(`[...document.querySelectorAll('button')].find(b=>/IDEA\\s*Lab/i.test(b.textContent||''))?.click()`)
await new Promise((r) => setTimeout(r, 600))
const idea = await ev(`(() => {
  const o = document.querySelector('.ow-overlay');
  return {
    ideaTa: o ? o.querySelectorAll('textarea.ow-idea-prompt').length : 0,
    visibleTa: o ? [...o.querySelectorAll('textarea.ow-idea-prompt')].filter(t=>t.offsetParent).length : 0,
    honesty: /前缀|不是.*预设|Agent 预设/.test(o?.innerText||''),
    inject: !![...o.querySelectorAll('button')].find(b=>(b.textContent||'').trim()==='注入对话'),
  };
})()`)
console.log('idea', idea)

ws.close()
console.log('done')
