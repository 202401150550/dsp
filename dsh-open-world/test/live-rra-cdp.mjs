#!/usr/bin/env node
/**
 * DSH Desktop 真机联调（CDP 页内 fetch）
 *
 * Desktop 2.x 对本机外部 HTTP 一律 Host/连接围栏 403；Electron 页内同源 fetch 可用。
 * 用法：
 *   1) 启动 Desktop 时加 --remote-debugging-port=9333
 *   2) OW_CDP_URL=http://127.0.0.1:9333 node test/live-rra-cdp.mjs
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

console.log('\n=== DSH LIVE · Open World RRA (CDP) ===\n')

const { page, ws, send } = await connectPage()
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

{
  console.log('GET /api/open-world/snapshot (neural honesty)')
  const snap = await evalJson(`(async () => {
    const res = await fetch('/api/open-world/snapshot')
    const json = await res.json().catch(() => ({}))
    return { status: res.status, json }
  })()`)
  ok(snap.status === 200 && snap.json?.ok === true, `snapshot ok · fw=${snap.json?.framework?.version || snap.json?.version}`)
  const neural = snap.json?.memory?.neural ?? snap.json?.neural
  const stub = snap.json?.memory?.neuralStub || snap.json?.neuralStub || snap.json?.neural
  ok(neural !== true && snap.json?.neural !== true, `memory.neural not true (got ${JSON.stringify(neural)})`)
  if (stub && typeof stub === 'object') {
    ok(stub.implemented !== true && stub.fullNeuralRra !== true, 'neuralStub stays unimplemented')
  } else {
    console.log('  ⚠ snapshot 无 neuralStub 对象（检查 neural 字段形态）')
  }
  // UI 文案诚实：DOM 不得出现「神经记忆已启用」
  const ui = await evalJson(`({
    bad: /神经记忆已启用/.test(document.body?.innerText || ''),
    hasNeuralFalse: /neural\\s*[:=]\\s*false|神经.*未|未启用|stub|草图/i.test(document.body?.innerText || ''),
    title: document.title,
  })`)
  ok(ui.bad !== true, 'DOM 无「神经记忆已启用」')
  console.log(`  note: title=${ui.title}`)
}

{
  console.log('\nGET /api/open-world/rra')
  const { status, json } = await evalJson(`(async () => {
    const res = await fetch('/api/open-world/rra')
    return { status: res.status, json: await res.json().catch(() => ({})) }
  })()`)
  ok(status === 200, `status ${status}`)
  ok(json.ok === true || json.stub != null || json.implemented === false, 'rra payload shape')
  ok(json.implemented !== true && json.fullNeuralRra !== true && json.neural !== true, 'rra not claiming neural')
  console.log(`  note: neural=${json.neural} probe=${json.config?.probe} sketch=${json.config?.sketch}`)
}

{
  console.log('\nGET /api/open-world/rra?probe=1')
  const { status, json } = await evalJson(`(async () => {
    const res = await fetch('/api/open-world/rra?probe=1')
    return { status: res.status, json: await res.json().catch(() => ({})) }
  })()`)
  ok(status === 200, `status ${status}`)
  ok(json.implemented !== true && json.fullNeuralRra !== true && json.neural !== true, 'probe does not enable neural')
  const ver = json.stub?.adapter?.proto?.version
    || json.stub?.proto?.version
    || json.adapter?.proto?.version
    || json.deepResult?.proto?.version
  const foundProto = !!(ver || json.stub?.adapter?.proto || json.stub?.stage || json.stub)
  ok(foundProto, `rra stub/probe present (version=${ver || json.stub?.stage || 'stub'})`)
}

{
  console.log('\nGET /api/open-world/rra?probe=1&sketch=1')
  const { status, json } = await evalJson(`(async () => {
    const res = await fetch('/api/open-world/rra?probe=1&sketch=1')
    return { status: res.status, json: await res.json().catch(() => ({})) }
  })()`)
  ok(status === 200, `status ${status}`)
  ok(json.implemented !== true && json.fullNeuralRra !== true && json.neural !== true, 'sketch query stays honest')
  const sketchOn = json.stub?.adapter?.sketch === true
    || json.stub?.sketch === true
    || json.config?.sketch === true
    || json.sketch === true
  // query sketch=1 反映在 stub 构建上（config 仍读 YAML 默认）
  const reflected = json.stub != null
  ok(reflected, `sketch probe returned stub (sketchFlag=${json.stub?.adapter?.sketch ?? json.stub?.sketch})`)
  if (!sketchOn) {
    console.log('  ⚠ YAML sketch 默认关；query sketch=1 只影响本次 stub 构建字段，不改配置落盘')
  }
}

{
  console.log('\ncompress_weights honesty (in-process adapter · HTTP 无 apply 端点)')
  const { tryApplyRraSketch } = await import('../bridge/rra-adapter.mjs')
  const { fileURLToPath } = await import('node:url')
  const weightsPath = fileURLToPath(new URL('../../rra-proto/reports/m5-compress-weights-latest.json', import.meta.url))
  const dim = 32
  const q = Array.from({ length: dim }, (_, i) => 0.01 * (i + 1))
  const ran = await tryApplyRraSketch({
    q,
    queryPos: 4,
    causal: true,
    compressWeightsPath: weightsPath,
    k_layers: {
      exact: [{ vec: q, pos: 4 }],
      compressed: [{
        code: Array.from({ length: 8 }, () => 0.1),
        pooled: q,
        meanPos: 1,
        count: 4,
      }],
    },
  }, { sketch: true, compressWeights: weightsPath })
  ok(ran.ok === true, `tryApply with weights ok (err=${ran.error || ''})`)
  ok(ran.implemented !== true && ran.fullNeuralRra !== true, 'weights path stays implemented:false')
  ok(ran.output?.meta?.compressWeightsLoaded === true, 'compressWeightsLoaded meta')
  ok(ran.weights?.dim === 32, `weights meta dim=${ran.weights?.dim}`)
  if (ran.error) console.log(`  note: apply error=${ran.error}`)
}

ws.close()
console.log(`\n=== LIVE RRA CDP: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
