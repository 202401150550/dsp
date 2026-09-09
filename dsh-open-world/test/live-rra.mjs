#!/usr/bin/env node
/**
 * DSH Desktop 真实联调：Open World RRA 适配器（probe / sketch）
 * 需已启动 DSH Desktop，且 dsh-open-world 已挂载。
 *
 * Desktop 2.x 对进程外 HTTP 常恒 403（Host/连接围栏）；页内同源可用。
 * 若本脚本找不到 OW 或全 403，改用：
 *   Desktop 加 --remote-debugging-port=9333
 *   OW_CDP_URL=http://127.0.0.1:9333 node test/live-rra-cdp.mjs
 */
import { connect } from 'node:net'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let BASE = process.env.OW_LIVE_URL?.replace(/\/$/, '') || ''
const CDP = process.env.OW_CDP_URL?.replace(/\/$/, '') || ''
const __dir = dirname(fileURLToPath(import.meta.url))

async function probeOpenWorld(port) {
  const okTcp = await new Promise((resolve) => {
    const sock = connect({ port, host: '127.0.0.1' })
    const t = setTimeout(() => { sock.destroy(); resolve(false) }, 250)
    sock.on('connect', () => { clearTimeout(t); sock.destroy(); resolve(true) })
    sock.on('error', () => { clearTimeout(t); resolve(false) })
  })
  if (!okTcp) return null
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/open-world/snapshot`, {
      signal: AbortSignal.timeout(800),
    })
    if (!res.ok) return null
    const snap = await res.json().catch(() => null)
    if (snap?.ok === true && (snap.framework?.protocol === 'owip/0.1' || snap.framework?.protocol === 'owip/0.2-draft' || snap.framework?.protocol === 'owip/0.3-draft')) {
      return `http://127.0.0.1:${port}`
    }
  } catch { /* next */ }
  return null
}

async function findPort() {
  if (BASE) return BASE
  const known = [19359, 29580, 14322, 1742, 15721, 6060]
  const extra = []
  try {
    const { execSync } = await import('node:child_process')
    const out = execSync('netstat -ano', { encoding: 'utf8', windowsHide: true })
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue
      const m = line.match(/(?:127\.0\.0\.1|0\.0\.0\.0|\[::1?\])\:(\d+)/)
      if (!m) continue
      const port = Number(m[1])
      if (port > 1024 && !known.includes(port)) extra.push(port)
    }
  } catch { /* ignore */ }
  const cappedExtra = [...new Set(extra)].sort((a, b) => b - a).slice(0, 64)
  for (const port of [...known, ...cappedExtra]) {
    const hit = await probeOpenWorld(port)
    if (hit) return hit
  }
  return null
}

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(8000) })
  const text = await res.text()
  let json = {}
  try { json = JSON.parse(text) } catch { /* plain text 403 etc */ }
  return { res, json, text }
}

console.log('\n=== DSH LIVE · Open World RRA ===\n')

async function tryCdpFallback(reason) {
  const cdp = CDP || 'http://127.0.0.1:9333'
  console.error(`⚠ ${reason}`)
  console.error(`  → 尝试 CDP 页内联调 ${cdp}`)
  const script = join(__dir, 'live-rra-cdp.mjs')
  const r = spawnSync(process.execPath, [script], {
    env: { ...process.env, OW_CDP_URL: cdp },
    stdio: 'inherit',
    windowsHide: true,
  })
  process.exit(r.status == null ? 2 : r.status)
}

let found = await findPort()
if (found) {
  // 校验：进程外 Desktop 常恒 403，不能只信端口探测/OW_LIVE_URL
  try {
    const probe = await fetch(`${found}/api/open-world/snapshot`, { signal: AbortSignal.timeout(2000) })
    if (!probe.ok) {
      found = null
      await tryCdpFallback(`HTTP ${probe.status} from ${found}（进程外不可用）`)
    }
  } catch {
    found = null
  }
}
if (!found) {
  await tryCdpFallback('DSH Open World 外网 HTTP 不可达（常见：Desktop 对进程外恒 403）')
}
BASE = found
console.log(`Base: ${BASE}\n`)

// snapshot 带 neural 诚实字段
{
  console.log('GET /api/open-world/snapshot (neural honesty)')
  const { res, json } = await get('/api/open-world/snapshot')
  ok(res.ok && json.ok === true, `snapshot ok · fw=${json.framework?.version}`)
  const neural = json.memory?.neural ?? json.neural
  const stub = json.memory?.neuralStub || json.neuralStub
  ok(neural !== true, `memory.neural not true (got ${neural})`)
  if (stub) {
    ok(stub.implemented !== true && stub.fullNeuralRra !== true, 'neuralStub stays unimplemented')
    ok(stub.adapter?.sketch === false || stub.sketch === false || stub.adapter != null, `stub adapter present sketch=${stub.adapter?.sketch ?? stub.sketch}`)
  } else {
    console.log('  ⚠ snapshot 无 neuralStub 字段（旧宿主或未挂 memory）')
  }
}

// 默认 /rra（配置默认 probe/sketch 关）
{
  console.log('\nGET /api/open-world/rra')
  const { res, json } = await get('/api/open-world/rra')
  ok(res.ok, `status ${res.status}`)
  ok(json.ok === true || json.adapter != null || json.implemented === false, 'rra payload shape')
  ok(json.implemented !== true && json.fullNeuralRra !== true, 'rra not claiming neural')
  const sketch = json.adapter?.sketch ?? json.sketch
  console.log(`  note: probe=${json.adapter?.probe ?? json.probe} sketch=${sketch} stage=${json.stage || json.adapter?.proto?.stage || '?'}`)
}

// 强制深探测
{
  console.log('\nGET /api/open-world/rra?probe=1')
  const { res, json } = await get('/api/open-world/rra?probe=1')
  ok(res.ok, `status ${res.status}`)
  ok(json.implemented !== true && json.fullNeuralRra !== true, 'probe does not enable neural')
  const ver = json.adapter?.proto?.version || json.proto?.version || json.deepResult?.proto?.version
  const foundProto = !!(ver || json.adapter?.proto || json.deepResult?.ok)
  ok(foundProto, `rra-proto probed (version=${ver || 'via deepResult'})`)
  if (json.adapter?.error) console.log(`  ⚠ adapter.error=${json.adapter.error}`)
}

// sketch 查询参数：只声明可挂，不假装完整 RRA
{
  console.log('\nGET /api/open-world/rra?probe=1&sketch=1')
  const { res, json } = await get('/api/open-world/rra?probe=1&sketch=1')
  ok(res.ok, `status ${res.status}`)
  ok(json.implemented !== true && json.fullNeuralRra !== true, 'sketch query stays honest')
  const sketchOn = json.adapter?.sketch === true || json.sketch === true
  ok(sketchOn, `sketch flag reflected (got ${json.adapter?.sketch ?? json.sketch})`)
}

console.log(`\n=== LIVE RRA: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
