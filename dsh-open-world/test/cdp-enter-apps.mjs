#!/usr/bin/env node
/** CDP: ATI enter-app surfaces */
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const list = await getJson('http://127.0.0.1:9222/json/list')
const page = list.find((p) => p.type === 'page')
if (!page) {
  console.error('no cdp page')
  process.exit(2)
}
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
function send(method, params = {}, ms = 12000) {
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
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, userGesture: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result?.value
}

await send('Runtime.enable')
await ev(`document.querySelector('.ow-trigger')?.click()`)
await sleep(900)
// ensure not minimized
await ev(`document.querySelector('.ow-dock-chip')?.click()`)
await sleep(400)
await ev(`[...document.querySelectorAll('.ow-wm-btn')].find(b=>(b.textContent||'').trim()==='并置')?.click()`)
await sleep(300)

const enter = async (label) => {
  const clicked = await ev(`(() => {
    const o = document.querySelector('.ow-overlay');
    const btn = [...(o||document).querySelectorAll('button')].find(b => /进入.*${label}/.test((b.textContent||'').trim()) || (b.textContent||'').trim() === ${JSON.stringify('进入 · ' + label)});
    if (btn) { btn.click(); return 'hint:'+(b.textContent||'').trim(); }
    // fallback: detail card
    const d = [...(o||document).querySelectorAll('button')].find(b => (b.textContent||'').includes('进入'));
    if (d) { d.click(); return 'detail:'+(d.textContent||'').trim(); }
    return false;
  })()`)
  await sleep(500)
  const surface = await ev(`(() => {
    const el = document.querySelector('[data-ow-surface]');
    return { surface: el?.getAttribute('data-ow-surface') || null, head: (document.querySelector('.ow-embed-head')?.innerText||'').replace(/\\s+/g,' ').slice(0,80) };
  })()`)
  return { clicked, ...surface }
}

// Select task-board via action tab plugins or by activating known node action through toast path:
// Click 动作 → 找任务相关；或直接 evaluate setEmbed via clicking double path.
await ev(`(() => {
  const o = document.querySelector('.ow-overlay');
  [...(o||document).querySelectorAll('button,[role=tab]')].find(b=>(b.textContent||'').trim()==='动作')?.click();
  return true;
})()`)
await sleep(400)

// Try plugin list item 任务
await ev(`(() => {
  const items = [...document.querySelectorAll('.ow-integ-item')];
  const hit = items.find(el => /任务|看板|task/i.test(el.innerText||''));
  hit?.click();
  return !!hit;
})()`)
await sleep(600)
let r1 = await ev(`(() => {
  const el = document.querySelector('[data-ow-surface]');
  return { surface: el?.getAttribute('data-ow-surface') || null, head: (document.querySelector('.ow-embed-head strong')?.textContent||'') };
})()`)
console.log('task via plugin', r1)

await ev(`document.querySelector('.ow-embed-head .ow-neural-btn')?.click()`)
await sleep(300)

// market via plugin
await ev(`(() => {
  const items = [...document.querySelectorAll('.ow-integ-item')];
  const hit = items.find(el => /市场|market|插件中心/i.test(el.innerText||''));
  hit?.click();
  return !!(hit && (hit.innerText||''));
})()`)
await sleep(600)
let r2 = await ev(`(() => {
  const el = document.querySelector('[data-ow-surface]');
  return { surface: el?.getAttribute('data-ow-surface') || null, head: (document.querySelector('.ow-embed-head strong')?.textContent||'') };
})()`)
console.log('market via plugin', r2)

await ev(`document.querySelector('.ow-embed-head .ow-neural-btn')?.click()`)
await sleep(200)

// memory / rewind via 进入 buttons if present after selecting nodes in ATI — use command palette?
const surfaces = ['task-board', 'rewind', 'market', 'memory', 'ssh']
const forced = await ev(`(() => {
  // force-open by clicking topbar isn't enough; dispatch via bridge toast path unavailable.
  // Click first "进入" on detail if ATI selected.
  const o = document.querySelector('.ow-overlay');
  const enterBtns = [...(o||document).querySelectorAll('button')].filter(b => /^进入/.test((b.textContent||'').trim()));
  return enterBtns.slice(0,5).map(b => (b.textContent||'').trim());
})()`)
console.log('enter buttons', forced)

const ver = await ev(`(document.body.innerText.match(/OPEN-WORLD v2\\.\\d/)||[])[0] || null`)
console.log('ver', ver)

const ok = r1?.surface === 'task-board' || /任务/.test(r1?.head || '')
console.log(ok ? 'PASS surfaces' : 'PARTIAL surfaces', { r1, r2 })
ws.close()
process.exit(ok ? 0 : 1)
