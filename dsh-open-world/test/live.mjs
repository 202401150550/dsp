#!/usr/bin/env node
/** Live DSH API verification — requires running DSH Desktop
 *
 * Desktop 进程外常 403：探测失败时自动回退 CDP（需 --remote-debugging-port=9333）
 *   npm run test:live-cdp
 */
import { connect } from 'node:net'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let BASE = process.env.OW_LIVE_URL?.replace(/\/$/, '') || ''
const CDP = process.env.OW_CDP_URL?.replace(/\/$/, '') || ''
const __dir = dirname(fileURLToPath(import.meta.url))

function tryCdpFallback(reason) {
  const cdp = CDP || 'http://127.0.0.1:9333'
  console.error(`⚠ ${reason}`)
  console.error(`  → 尝试 CDP 页内联调 ${cdp}`)
  const script = join(__dir, 'live-cdp.mjs')
  const r = spawnSync(process.execPath, [script], {
    env: { ...process.env, OW_CDP_URL: cdp },
    stdio: 'inherit',
    windowsHide: true,
  })
  process.exit(r.status == null ? 2 : r.status)
}

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
    if (snap?.ok === true && (snap.framework?.protocol === 'owip/0.1' || snap.framework?.protocol === 'owip/0.2-draft')) {
      return `http://127.0.0.1:${port}`
    }
  } catch { /* next */ }
  return null
}

async function findPort() {
  if (BASE) return BASE
  const known = [19359, 29580, 14322, 1742, 15721, 6060]
  const extra = []
  // Desktop 常把 web 挂在随机高位端口；从 netstat 补扫描（含 0.0.0.0）
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
  // 先扫已知口；再扫高位候选（封顶，避免整表 30s+）
  const cappedExtra = [...new Set(extra)].sort((a, b) => b - a).slice(0, 48)
  const ordered = [...known, ...cappedExtra]
  for (const port of ordered) {
    const hit = await probeOpenWorld(port)
    if (hit) return hit
  }
  return null
}

let passed = 0
let failed = 0
let skipped = 0
let baseUrl = ''

function ok(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

async function get(path) {
  const res = await fetch(`${baseUrl}${path}`)
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 120) } }
  return { res, json }
}

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { res, json }
}

console.log('\n=== Open World LIVE API tests ===\n')

const found = await findPort()
if (!found) {
  tryCdpFallback('DSH HTTP 不可达（未启动或进程外围栏）')
}
baseUrl = found
console.log(`Base: ${baseUrl}\n`)

// 进程外 Desktop 常恒 403：能连上端口但 API 全拒时改走 CDP
{
  const probe = await get('/api/open-world/snapshot')
  if (!probe.res.ok) {
    tryCdpFallback(`snapshot HTTP ${probe.res.status}（进程外常 403）`)
  }
}

// ── snapshot ──
console.log('GET /api/open-world/snapshot')
const { res: snapRes, json: snap } = await get('/api/open-world/snapshot')
ok(snapRes.ok, `status ${snapRes.status}`)
ok(snap.ok === true, 'snapshot.ok')
{
  const ver = String(snap.framework?.version || '')
  const maj = Number((ver.match(/^(\d+)\./) || [])[1] || 0)
  const min = Number((ver.match(/^\d+\.(\d+)/) || [])[1] || 0)
  ok(maj > 2 || (maj === 2 && min >= 14), `framework.version=${ver} (≥2.14)`)
  if (maj === 2 && min < 41) {
    console.log(`  ⚠ live host still on ${ver} — fully quit Desktop to load profile copy of v2.46+`)
  }
}
ok(snap.framework?.protocol === 'owip/0.1' || snap.framework?.protocol === 'owip/0.2-draft', `framework.protocol=${snap.framework?.protocol}`)
ok(snap.config?.integrations != null, 'config.integrations present')
ok(snap.config?.idea != null, 'config.idea present')
ok(snap.space != null && typeof snap.space.hasToken === 'boolean', 'snapshot.space')
ok(snap.fleet != null && snap.fleet.counts != null, 'snapshot.fleet')
ok(snap.lab?.topology?.source === 'metaphor', 'lab.topology.source=metaphor')
ok(['metaphor', 'derived'].includes(snap.lab?.ml?.source), `lab.ml.source=${snap.lab?.ml?.source} (expect metaphor after DSH restart)`)
ok(['metaphor', 'derived'].includes(snap.lab?.dl?.source), `lab.dl.source=${snap.lab?.dl?.source} (expect metaphor after DSH restart)`)
if (snap.lab?.ml?.source !== 'metaphor' || snap.lab?.dl?.source !== 'metaphor') {
  console.log('  ⚠ ml/dl source stale — fully quit DSH Desktop and restart')
}
ok(typeof snap.core?.healthScore === 'number', `core.healthScore=${snap.core?.healthScore}`)
ok(Array.isArray(snap.nodes) && snap.nodes.length >= 10, `nodes count=${snap.nodes?.length}`)
const withAction = (snap.nodes || []).filter((n) => n.action)
ok(withAction.length >= 8, `nodes with action=${withAction.length}`)
ok(Array.isArray(snap.events), 'events array')
ok(snap.integrations != null, 'integrations summary')
if (snap.memory) {
  ok(snap.memory.active != null, 'memory.active present')
  ok(snap.memory.compare != null, 'memory.compare present')
  if (snap.memory.archives) ok(!!snap.memory.archives.hint, 'memory.archives.hint')
  if (snap.memory.compare?.channels) ok(!!snap.memory.compare.channels.events, 'memory.compare.channels.events')
} else {
  console.log('  ⚠ snapshot.memory missing — host bundle may be stale')
}

// ── full memory refresh path ──
console.log('\nGET /api/open-world/memory')
const { res: memoryRes, json: memoryBody } = await get('/api/open-world/memory')
ok(memoryRes.ok, `memory status ${memoryRes.status}`)
ok(memoryBody.ok === true, 'memory.ok')
ok(memoryBody.memory?.meta != null, 'memory.memory.meta')
ok(memoryBody.memory?.compare != null || memoryBody.compare != null, 'memory.compare')
ok(memoryBody.memory?.archives != null, 'memory.archives')
{
  const { res: archRes, json: archBody } = await get('/api/open-world/memory/archives?q=open')
  ok(archRes.ok, `memory/archives status ${archRes.status}`)
  ok(archBody.ok === true, 'memory/archives ok')
  ok(archBody.channels?.events != null, 'memory/archives.channels.events')
}

// ── notifications availability ──
const notifAvail = snap.integrations?.notifications?.available
console.log(`\nnotifications.available = ${notifAvail}`)

// ── rewind ──
console.log('\nGET /api/open-world/rewind/timeline')
const { res: tlRes, json: tl } = await get('/api/open-world/rewind/timeline')
ok(tlRes.ok, `rewind timeline status ${tlRes.status}`)
ok(tl.ok === true, 'rewind timeline ok')
ok(Array.isArray(tl.points), `timeline points=${tl.points?.length ?? 0}`)

// ── actions ──
console.log('\nPOST /api/open-world/action')
const msgBody = `[live-test] ${new Date().toISOString()}`
const { res: sendRes, json: sendJson } = await post('/api/open-world/action', {
  action: 'send-message',
  to: 'broadcast',
  body: msgBody,
  kind: 'live-test',
})
ok(sendRes.ok, `send-message status ${sendRes.status}`)
ok(sendJson.ok === true, 'send-message ok')

const { res: ideaRes, json: ideaJson } = await post('/api/open-world/action', {
  action: 'idea-wrap',
  presetId: (snap.idea?.presets?.[0]?.id) || 'xiaofeiyu',
  body: 'live test ping',
  treatAs: '主人',
})
ok(ideaRes.ok, `idea-wrap status ${ideaRes.status}`)
ok(ideaJson.ok === true, 'idea-wrap ok')
ok(String(ideaJson.wrapped || '').includes('[IDEA Lab'), 'idea-wrap header')

const { res: memRes } = await post('/api/open-world/action', {
  action: 'memory-search',
  query: 'open world',
})
ok(memRes.ok, `memory-search status ${memRes.status}`)

// ── messages ──
console.log('\nGET /api/open-world/messages')
const { res: mbRes, json: mb } = await get('/api/open-world/messages')
ok(mbRes.ok, `messages status ${mbRes.status}`)
const hit = (mb.messages || []).some((m) => String(m.body).includes('[live-test]'))
ok(hit, 'broadcast message visible in mailbox')

// ── SSE hello ──
console.log('\nGET /api/open-world/stream (hello)')
try {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 2500)
  const res = await fetch(`${baseUrl}/api/open-world/stream`, { signal: ctrl.signal })
  ok(res.ok, `stream status ${res.status}`)
  const reader = res.body.getReader()
  const { value } = await reader.read()
  reader.cancel().catch(() => {})
  clearTimeout(t)
  const chunk = new TextDecoder().decode(value || new Uint8Array())
  ok(chunk.includes('data:') && chunk.includes('hello'), 'SSE hello event')
} catch (err) {
  if (err.name === 'AbortError') skipped++
  else ok(false, `stream error: ${err.message}`)
}

// ── client bundle + S1/S2 shell honesty ──
console.log('\nClient bundle / S1+S2 shell honesty')
try {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const clientPath = join(process.env.USERPROFILE || '', '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-open-world', 'client.js')
  const src = readFileSync(clientPath, 'utf8')
  const verMatch = src.match(/CLIENT_VER = ['"](v2\.\d+)['"]/)
  const clientVer = verMatch?.[1] || ''
  const clientMin = Number((clientVer.match(/v2\.(\d+)/) || [])[1] || 0)
  ok(clientMin >= 24, `installed client CLIENT_VER=${clientVer || '?'} (≥ v2.24)`)
  if (clientMin < 41) {
    console.log(`  ⚠ profile client still ${clientVer} — restart Desktop after linking dsh-open-world@2.46`)
  }
  ok(src.includes('MEMORY_URL') || src.includes('/api/open-world/memory'), 'client MEMORY_URL')
  ok(src.includes('搜 Hindsight'), 'client Hindsight search label')
  ok(src.includes('刷新记忆') || src.includes('MEMORY_ARCHIVES_URL'), 'client memory refresh / archives')
  ok(src.includes('chipTone') || (src.includes('probeStale') && src.includes('·陈')), 'client Bridge outcome chips')
  ok(src.includes('BridgeHealthBar'), 'installed client has BridgeHealthBar')
  ok(src.includes('execRewindViaSession'), 'rewind via session.command helper')
  ok(src.includes("'session-api'") || src.includes('"session-api"'), 'rewind-exec capability = session-api')
  ok(!/const cmd = `\/rewind \$\{target\}/.test(src), 'no DOM fill of parameterized /rewind')
  ok(src.includes('LeftSidebarTabs'), 'left status/actions/events tabs')
  ok(src.includes('notif.available &&'), 'notification UI gated on available')
  // S2
  ok(src.includes('sendViaSession') && src.includes('conversation.send'), 'inject prefers conversation.send')
  ok(src.includes('DEEPSEEK_USAGE_URL') && src.includes('formatUsageMoney'), 'usage card helpers present')
  ok(src.includes("data.type === 'snapshot-delta'"), 'SSE reacts to snapshot-delta')
  ok(src.includes('SPACE_VIEW_URL') || src.includes('/api/open-world/space/view'), 'space view URL in client')
  ok(src.includes('FleetPanel') || src.includes('ow-fleet'), 'fleet panel present')
  ok(src.includes('dsh-open-world/bridge'), 'client uses bridge submodule')
  ok(src.includes('dsh-open-world/shell'), 'client uses shell submodule')
  ok(src.includes('dsh-open-world/hooks') || src.includes('useWorldFeed'), 'client uses hooks submodule')
  ok(src.includes('recordBridgeOutcome') || src.includes('probeStale') || src.includes('describeBridgeStrategy'), 'bridge outcome/strategy helpers in bundle')
  ok(src.includes('OpenWorldSummaryTab'), 'better-sidebar summary tab')
  ok(src.includes('createBridge'), 'bridge module has createBridge')
  ok(src.includes('POLL_MS * 6'), 'fallback poll slowed to ~15s')
  const indexPath = join(process.env.USERPROFILE || '', '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-open-world', 'index.js')
  const indexSrc = readFileSync(indexPath, 'utf8')
  ok(indexSrc.includes('ACTION_REGISTRY'), 'installed index has ACTION_REGISTRY')
  ok(indexSrc.includes('probeWorldFingerprint'), 'host proactive fingerprint probe')
  ok(indexSrc.includes('rrm-session-apply'), 'host has rrm-session-apply')
  ok(indexSrc.includes('compareRrmAllChannels') || indexSrc.includes('attachArchiveTails'), 'host has RRM archives/compare')
  ok(indexSrc.includes('searchLocalArchives'), 'host has local archive search')
  ok(indexSrc.includes('dsh-ventus-progress') && indexSrc.includes('dsh-deepseek-usage'), 'PLUGIN_CATALOG has ventus+usage')
  ok(indexSrc.includes("type: 'snapshot-delta'"), 'SSE snapshot-delta payload')
  console.log(`  · notifications.available=${snap.integrations?.notifications?.available} (false → hide empty shell)`)
  const usagePlugin = (snap.plugins || []).find((p) => p.id === 'deepseek-usage' || p.id === 'ventus-progress')
  if (usagePlugin) {
    console.log(`  · plugin ${usagePlugin.id}: installed=${usagePlugin.installed} online=${usagePlugin.online} status=${usagePlugin.status}`)
  }
} catch (err) {
  ok(false, `client bundle read: ${err.message}`)
}

console.log(`\n=== LIVE: ${passed} passed, ${failed} failed, ${skipped} skipped ===`)
console.log(`DSH GUI: ${baseUrl}\n`)
process.exit(failed > 0 ? 1 : 0)
