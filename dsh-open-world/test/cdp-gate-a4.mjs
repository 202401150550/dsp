#!/usr/bin/env node
/**
 * A4 gate probe via CDP (stepwise, fail-soft per cell)
 */
import http from 'node:http'
import WebSocket from 'ws'

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => {
        try { resolve(JSON.parse(d)) } catch (e) { reject(new Error(d.slice(0, 200))) }
      })
    }).on('error', reject)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const report = {
  recovery: { pass: false, detail: '' },
  bubbles: { pass: false, detail: '' },
  sanwen: { pass: false, detail: '' },
  taskOnline: { pass: false, detail: '' },
  rrm: { pass: false, detail: '' },
}

const list = await getJson('http://127.0.0.1:9222/json/list')
const page = list.find((p) => p.type === 'page')
if (!page) {
  console.error(JSON.stringify({ error: 'no cdp page' }))
  process.exit(2)
}

const title = page.title || ''
report.recovery.pass = !/Recovery|恢复模式|打开恢复/i.test(title) && /DeepSeek|Harness|鲸鱼/i.test(title)
report.recovery.detail = `title=${JSON.stringify(title)}`

const ws = new WebSocket(page.webSocketDebuggerUrl, { handshakeTimeout: 10000 })
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
    const t = setTimeout(() => {
      pending.delete(mid)
      reject(new Error('timeout ' + method))
    }, ms)
    pending.set(mid, {
      resolve: (v) => { clearTimeout(t); resolve(v) },
      reject: (e) => { clearTimeout(t); reject(e) },
    })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
}
async function ev(expression, { awaitPromise = false, ms = 12000 } = {}) {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    userGesture: true,
    awaitPromise,
  }, ms)
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result?.value
}

await send('Runtime.enable')
await send('Page.enable')
await sleep(500)

// 2 bubbles
try {
  const chat = await ev(`({
    unknown: /未知 surface|unknown surface/i.test(document.body?.innerText || ''),
    hasComposer: !![...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')]
      .find(el => (el.getClientRects?.().length || 0) > 0),
    hasOw: !!document.querySelector('.ow-trigger'),
    bodyLen: (document.body?.innerText || '').length,
  })`)
  report.bubbles.pass = chat && chat.unknown === false
  report.bubbles.detail = JSON.stringify(chat)
} catch (e) {
  report.bubbles.detail = String(e.message || e)
}

// 3 OW 三问
try {
  await ev(`document.querySelector('.ow-trigger')?.click()`)
  await sleep(900)
  const open = await ev(`!!document.querySelector('.ow-overlay')`)
  const tabs = {}
  for (const label of ['状态', '动作', '事件']) {
    const clicked = await ev(`(() => {
      const o = document.querySelector('.ow-overlay') || document;
      const b = [...o.querySelectorAll('button,[role=tab]')]
        .find(x => (x.textContent || '').trim() === ${JSON.stringify(label)});
      if (!b) return false;
      b.click();
      return true;
    })()`)
    await sleep(400)
    const snip = await ev(`(() => {
      const t = (document.querySelector('.ow-overlay')?.innerText || '').replace(/\\s+/g,' ');
      return t.slice(0, 140);
    })()`)
    tabs[label] = { clicked: !!clicked, snip }
  }
  report.sanwen.pass = !!open && tabs['状态']?.clicked && tabs['动作']?.clicked && tabs['事件']?.clicked
  report.sanwen.detail = JSON.stringify({ open, tabs })
} catch (e) {
  report.sanwen.detail = String(e.message || e)
}

// 4+5 snapshot / memory via in-page fetch
let snap = null
let mem = null
try {
  snap = await ev(`(async () => {
    const r = await fetch('/api/open-world/snapshot', { credentials: 'include' });
    const j = await r.json().catch(() => null);
    return { status: r.status, ok: !!(j && j.ok), nodes: (j && j.nodes) || [], taskBoard: j && j.taskBoard, memory: j && j.memory };
  })()`, { awaitPromise: true, ms: 15000 })
} catch (e) {
  report.taskOnline.detail = 'snapshot fetch: ' + (e.message || e)
}

try {
  mem = await ev(`(async () => {
    const r = await fetch('/api/open-world/memory', { credentials: 'include' });
    const j = await r.json().catch(() => null);
    return { status: r.status, keys: j ? Object.keys(j).slice(0, 20) : [], hasCompare: !!(j && (j.compare || j.falsify)), neural: j && j.neural };
  })()`, { awaitPromise: true, ms: 15000 })
} catch (e) {
  report.rrm.detail = 'memory fetch: ' + (e.message || e)
}

if (snap) {
  const nodes = snap.nodes || []
  const taskNode = nodes.find((n) => {
    const blob = [n.id, n.name, n.label, n.featureId, n.kind].map(String).join(' ')
    return /task-board|taskBoard|任务/i.test(blob)
  })
  const tb = snap.taskBoard
  const online = !!(taskNode && (taskNode.online === true || taskNode.available === true
    || /online|在线|available/i.test(String(taskNode.status || ''))))
    || !!(tb && (tb.available === true || tb.online === true))
  report.taskOnline.pass = online
  report.taskOnline.detail = JSON.stringify({
    status: snap.status,
    ok: snap.ok,
    taskNode: taskNode && {
      id: taskNode.id,
      name: taskNode.name || taskNode.label,
      featureId: taskNode.featureId,
      online: taskNode.online,
      available: taskNode.available,
      status: taskNode.status,
    },
    taskBoard: tb && { available: tb.available, online: tb.online, n: (tb.tasks || []).length },
  })
}

try {
  await ev(`(() => {
    const o = document.querySelector('.ow-overlay') || document;
    const b = [...o.querySelectorAll('button,[role=tab]')].find(x => (x.textContent||'').trim() === '事件');
    b?.click();
    return !!b;
  })()`)
  await sleep(500)
  const ui = await ev(`(() => {
    const t = document.querySelector('.ow-overlay')?.innerText || '';
    return {
      memoryUi: /Memory|记忆|RRM|精确|压缩|地标|归档/i.test(t),
      compareUi: /证伪|对照/i.test(t),
      snip: t.replace(/\\s+/g,' ').slice(0, 200),
    };
  })()`)
  const apiOk = !!(mem && mem.status === 200) || !!(snap && snap.memory)
  report.rrm.pass = apiOk && !!(ui.memoryUi || ui.compareUi || (snap && snap.memory))
  report.rrm.detail = JSON.stringify({ ui, mem, memoryInSnap: !!(snap && snap.memory) })
} catch (e) {
  if (!report.rrm.detail) report.rrm.detail = String(e.message || e)
  if (snap?.memory || (mem && mem.status === 200)) {
    report.rrm.pass = true
    report.rrm.detail += ' | api-only pass'
  }
}

ws.close()

const cells = [
  ['Recovery', 'recovery'],
  ['气泡', 'bubbles'],
  ['三问', 'sanwen'],
  ['任务online', 'taskOnline'],
  ['RRM', 'rrm'],
]
const passed = cells.filter(([, k]) => report[k].pass).length
console.log('\n=== A4 Gate ===')
for (const [label, k] of cells) {
  console.log(`${report[k].pass ? 'PASS' : 'FAIL'}  ${label}  —  ${report[k].detail}`)
}
console.log(`\n${passed}/${cells.length}`)
console.log(JSON.stringify(report, null, 2))
process.exit(passed === cells.length ? 0 : 1)
