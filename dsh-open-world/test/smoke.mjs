#!/usr/bin/env node
/** OWIP smoke tests — no browser, no DSH process required */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { __test } from '../index.js'

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${msg}`)
  } else {
    failed += 1
    console.error(`  ✗ ${msg}`)
  }
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, `${msg} (got ${JSON.stringify(actual)})`)
}

console.log('\n=== OWIP smoke tests ===\n')

// ── parseOpenWorldConfig ──
console.log('parseOpenWorldConfig')
const sampleYaml = `
default_view: monitor
integrations:
  pair: false
  notifications: false
  hindsight_port: 9999
  archify_dirs:
    - open-world/archify
    - custom/dir
idea:
  enabled: false
messaging:
  enabled: true
  max_messages: 50
synapses:
  - [memory, ai-engine]
`
const cfg = __test.parseOpenWorldConfig(sampleYaml)
assertEq(cfg.default_view, 'monitor', 'default_view parsed')
assertEq(cfg.integrations.pair, false, 'integrations.pair')
assertEq(cfg.integrations.notifications, false, 'integrations.notifications')
assertEq(cfg.integrations.hindsight_port, 9999, 'integrations.hindsight_port')
assert(Array.isArray(cfg.integrations.archify_dirs) && cfg.integrations.archify_dirs.length === 2, 'archify_dirs list')
assertEq(cfg.idea.enabled, false, 'idea.enabled')
assertEq(cfg.messaging.max_messages, 50, 'messaging.max_messages')
assertEq(cfg.synapses.length, 1, 'synapses pair')

// ── buildFramework ──
console.log('\nbuildFramework')
const fw = __test.buildFramework(cfg)
assertEq(fw.version, '2.60', 'framework.version')

{
  const { readFileSync, existsSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const plugin = JSON.parse(readFileSync(join(root, 'dsh.plugin.json'), 'utf8'))
  const constantsSrc = readFileSync(join(root, 'client/modules/constants.js'), 'utf8')
  const hubsSrc = readFileSync(join(root, 'client/modules/hubs.js'), 'utf8')
  const shellSrc = readFileSync(join(root, 'client/modules/shell.js'), 'utf8')
  assertEq(pkg.version, '2.60.0', 'package.json version')
  assertEq(plugin.version, '2.60.0', 'dsh.plugin.json version')
  assert(constantsSrc.includes("CLIENT_VER = 'v2.60'"), 'constants CLIENT_VER v2.60')
  assert(constantsSrc.includes("CLIENT_BUILD = 'dev'"), 'constants CLIENT_BUILD placeholder')
  assert(constantsSrc.includes('CLIENT_BUILT_AT'), 'constants CLIENT_BUILT_AT')
  const clientJs = readFileSync(join(root, 'client.js'), 'utf8')
  assert(/^\/\/ CLIENT_BUILD \S+ \S+ v2\.\d+/m.test(clientJs), 'client.js CLIENT_BUILD header')
  assert(!clientJs.includes("CLIENT_BUILD = 'dev'"), 'composed client.js not left as dev')
  const meta = __test.readClientBuildMeta()
  assert(meta && meta.clientBuild && meta.clientBuild !== 'dev', 'Host reads clientBuild from client.js')
  assertEq(meta.clientVer, 'v2.60', 'Host clientVer aligned')
  assert(fw.clientBuild === meta.clientBuild, 'framework.clientBuild matches disk')
  assert(constantsSrc.includes('MEMORY_ARCHIVES_URL'), 'constants MEMORY_ARCHIVES_URL')
  const bridgeSrc = readFileSync(join(root, 'bridge/execute.mjs'), 'utf8')
  assert(bridgeSrc.includes('summarizeBridgeSurface'), 'summarizeBridgeSurface in execute.mjs')
  assert(bridgeSrc.includes('preferChat'), 'rewind-open preferChat path')
  assert(hubsSrc.includes('壳内时间轴') || hubsSrc.includes('preferChat'), 'hubs rewind embed-first')
  assert(hubsSrc.includes('spaceOff') || hubsSrc.includes('space 未启用'), 'hubs space-off disables issue')
  const quickSrc = readFileSync(join(root, 'QUICKSTART.md'), 'utf8')
  assert(quickSrc.includes('OPEN-WORLD v2.60'), 'QUICKSTART watermark aligned')
  assert(hubsSrc.includes('搜 Hindsight'), 'hubs Hindsight search label')
  assert(shellSrc.includes('ShellGuide') || shellSrc.includes('三步上手'), 'shell ShellGuide tip')
  assert(shellSrc.includes('ActionsEmptyState') || shellSrc.includes('还没有可点的扩展'), 'shell ActionsEmptyState')
  assert(shellSrc.includes('EventsEmptyState') || shellSrc.includes('事件还是空的'), 'shell EventsEmptyState')
  assert(shellSrc.includes('MemoryHub') || shellSrc.includes('本地 RRM'), 'shell MemoryHub dual tabs')
  assert(hubsSrc.includes('跨机 · 观察/回写（Space）') || hubsSrc.includes('签发可回写'), 'hubs Space dual-card')
  assert(hubsSrc.includes('跨机 · 手机控工作区（Pair）') || hubsSrc.includes('pair-stop'), 'hubs Pair dual-card')
  assert(hubsSrc.includes('resolveEmbedGate') || existsSync(join(root, 'bridge/capability-registry.mjs')), 'capability-registry present')
  assert(shellSrc.includes('compact') && shellSrc.includes('展开舰队') === false
    ? true
    : shellSrc.includes('摘要 · 点「展开舰队」'), 'shell fleet compact copy')
  assert(hubsSrc.includes('展开回退') || hubsSrc.includes('compact'), 'hubs rewind compact')
  assert(constantsSrc.includes('view=shell'), 'SNAPSHOT_URL shell view')
  assert(existsSync(join(root, 'SHELL_PLAN.md')), 'SHELL_PLAN.md present')
  assert(existsSync(join(root, 'CHECKLIST.md')), 'CHECKLIST.md present')
  const checkSrc = readFileSync(join(root, 'CHECKLIST.md'), 'utf8')
  assert(checkSrc.includes('v2.60') && checkSrc.includes('desktop:cdp'), 'CHECKLIST v2.60 + desktop:cdp')
  assert(checkSrc.includes('0.3-draft') || checkSrc.includes('owip/0.3'), 'CHECKLIST mentions owip/0.3')
  const owipSrc = readFileSync(join(root, 'OWIP_v0.1.md'), 'utf8')
  assert(owipSrc.includes('0.3-draft') && owipSrc.includes('PEER_ACTION_ALLOWLIST'), 'OWIP documents 0.3 ACL')
  const devSrc = readFileSync(join(root, 'DEVELOPER.md'), 'utf8')
  assert(devSrc.includes('CDP') && devSrc.includes('CORE_SHELL_HOST_ACTIONS'), 'DEVELOPER.md CDP + core actions')
  assert(devSrc.includes('view=shell') && devSrc.includes('idea-inject'), 'DEVELOPER.md snapshot + idea-inject')
  assert(devSrc.includes('Space vs Pair') || devSrc.includes('勿混'), 'DEVELOPER Space vs Pair table')
  assert(devSrc.includes('test:live-cdp') || existsSync(join(root, 'test/live-cdp.mjs')), 'live-cdp cold-start path')
  assert(existsSync(join(root, 'test/live-cdp.mjs')), 'test/live-cdp.mjs present')
  assert(existsSync(join(root, 'scripts/launch-desktop-cdp.mjs')), 'launch-desktop-cdp.mjs present')
  assert(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts['desktop:cdp'], 'npm run desktop:cdp')
  assert(shellSrc.includes('chipTone') || shellSrc.includes('probeStale'), 'shell Bridge outcome-aware chips')
  assert(shellSrc.includes('surfaceTitle') || shellSrc.includes('stillDom'), 'shell Bridge surface summary')
  assert(shellSrc.includes('≠ Hindsight') || shellSrc.includes('非本地 RRM'), 'shell MemoryBrief dual-path note')
  assert(shellSrc.includes('rra.probe') || shellSrc.includes('适配器'), 'shell RRA adapter note')
  assert(existsSync(join(root, 'RRA_NEURAL.md')), 'RRA_NEURAL.md present')
  assert(existsSync(join(root, 'bridge/rra-adapter.mjs')), 'rra-adapter.mjs present')
  assert(existsSync(join(root, '../rra-proto/package.json')), 'rra-proto package present')
  assert(existsSync(join(root, '../rra-proto/src/l4-longctx.mjs')), 'rra-proto l4-longctx.mjs')
  const neural = __test.describeNeuralRra()
  assertEq(neural.implemented, false, 'neural still unimplemented')
  assertEq(neural.stage, 'L6-M4', 'neural stage L6-M4')
  assertEq(neural.fullNeuralRra, false, 'fullNeuralRra false')
  assert(typeof __test.buildNeuralStub === 'function', 'buildNeuralStub exported')
  assert(typeof __test.probeRraProtoSync === 'function', 'probeRraProtoSync exported')
  assert(typeof __test.tryApplyRraSketch === 'function', 'tryApplyRraSketch exported')
  const off = __test.buildNeuralStub({ probe: false })
  assert(off.adapter && off.adapter.probe === false, 'adapter probe default off')
  assert(off.adapter.sketch === false, 'adapter sketch default off')
  assert(off.adapter.neuralEnabled === false, 'adapter neuralEnabled false')
  const on = __test.buildNeuralStub({ probe: true })
  assert(on.adapter && on.adapter.probe === true && on.adapter.probed === true, 'adapter probe on')
  assertEq(on.implemented, false, 'probe does not set implemented')
  assertEq(on.fullNeuralRra, false, 'probe does not set fullNeuralRra')
  const parsed = __test.parseOpenWorldConfig('rra:\n  probe: true\n  sketch: true\n  compress_weights: reports/m5-compress-weights-latest.json\n')
  assertEq(parsed.rra.probe, true, 'parse rra.probe true')
  assertEq(parsed.rra.sketch, true, 'parse rra.sketch true')
  assertEq(parsed.rra.compressWeights, 'reports/m5-compress-weights-latest.json', 'parse rra.compress_weights → compressWeights')
  assert(typeof __test.assertShellDoesNotClaimNeural === 'function', 'assertShellDoesNotClaimNeural exported')
}
assert(fw.snapshotSchema === 8, 'framework.snapshotSchema')
assert(fw.actionLayers && fw.actionLayers.host && fw.actionLayers.bridge, 'framework.actionLayers')
assertEq(fw.protocol, 'owip/0.3-draft', 'framework.protocol (space default on)')
assert(fw.space && fw.space.enabled === true, 'framework.space.enabled')
assert(fw.space.sync === true, 'framework.space.sync')
assert(fw.pillars.includes('space'), 'framework.pillars includes space')

const cfgSpaceOff = __test.parseOpenWorldConfig(`
space:
  enabled: false
`)
assertEq(__test.buildFramework(cfgSpaceOff).protocol, 'owip/0.1', 'space off → owip/0.1')
assertEq(cfgSpaceOff.space.enabled, false, 'parse space.enabled false')
assertEq(__test.parseOpenWorldConfig(`
space:
  require_token_for_lan: false
  seal_outbox: false
`).space.seal_outbox, false, 'parse space.seal_outbox')

// ── buildSnapshot (mock ctx) ──
console.log('\nbuildSnapshot')
const mockCtx = {
  sessions: {
    list: () => [{ id: 's1', seq: 1, meta: { cwd: '/tmp' }, header: { createdAt: Date.now() } }],
  },
}
const snap = await __test.buildSnapshot(mockCtx, [], '127.0.0.1:0')
assert(snap.ok === true, 'snapshot.ok')
assert(snap.version === 8, 'snapshot.schema v8')
assert(typeof __test.classifyAction === 'function', 'classifyAction exported')
assert(__test.classifyAction('idea-inject').layer === 'host', 'idea-inject host')
assert(__test.classifyAction('inject-message').layer === 'bridge', 'inject-message bridge')
assert(snap.framework.protocol === 'owip/0.1' || snap.framework.protocol === 'owip/0.2-draft' || snap.framework.protocol === 'owip/0.3-draft', 'snapshot.framework.protocol known')
assert(snap.space && typeof snap.space.hasToken === 'boolean', 'snapshot.space')
assert(snap.config.integrations !== undefined, 'snapshot.config.integrations')
assert(snap.config.idea !== undefined, 'snapshot.config.idea')
assertEq(snap.lab.topology.source, 'metaphor', 'lab.topology.source')
assertEq(snap.lab.ml.source, 'metaphor', 'lab.ml.source')
assertEq(snap.lab.dl.source, 'metaphor', 'lab.dl.source')
assertEq(snap.lab.chemistry.source, 'metaphor', 'lab.chemistry.source')
assert(Array.isArray(snap.nodes) && snap.nodes.length > 0, 'nodes non-empty')
assert(snap.core.healthScore >= 0, 'core.healthScore')
assert(snap.core.healthScoreSource === 'derived', 'core.healthScoreSource')
assert(snap.ati && snap.ati.source === 'derived', 'ati.source derived')

// ── snapshot?view=shell 瘦身 ──
console.log('\nslimSnapshotForShell')
const shellSnap = await __test.buildSnapshot(mockCtx, [], '127.0.0.1:0', { view: 'shell' })
assert(shellSnap.ok === true && shellSnap.view === 'shell', 'shell view tag')
assert(typeof __test.slimSnapshotForShell === 'function', 'slimSnapshotForShell exported')
assert(shellSnap.neuralLayers === undefined, 'shell drops neuralLayers')
assert(shellSnap.sessions === undefined, 'shell drops sessions')
assert(shellSnap.core && shellSnap.nodes && shellSnap.fleet, 'shell keeps core/nodes/fleet')
assert(JSON.stringify(shellSnap).length < JSON.stringify(snap).length, 'shell payload smaller than full')

// ── space-token actions ──
console.log('\nspace-token actions')
const spaceHome = mkdtempSync(join(tmpdir(), 'ow-space-smoke-'))
process.env.DSH_HOME = spaceHome
try {
  const env = {
    home: spaceHome,
    config: { space: __test.defaultSpaceConfig(), messaging: { enabled: true, max_messages: 50, allow_broadcast: true }, idea: { enabled: true } },
    ctx: mockCtx,
    hostHeader: '127.0.0.1:0',
    buildSnapshot: __test.buildSnapshot,
    notifyStream: () => {},
    pushEvent: () => {},
  }
  const issued = await __test.dispatchOpenWorldAction('space-token-issue', { reveal: true }, env)
  assert(issued.status === 200 && issued.body.ok && issued.body.token, 'space-token-issue reveals')
  const status = await __test.dispatchOpenWorldAction('space-token-status', {}, env)
  assert(status.body.space.hasToken === true && !status.body.space.token, 'space-token-status no plaintext')
  const authLan = __test.authorizeSpaceRequest(
    { socket: { remoteAddress: '192.168.0.5' }, headers: { authorization: `Bearer ${issued.body.token}` }, url: '/' },
    spaceHome,
    env.config.space,
  )
  assert(authLan.ok === true && authLan.via === 'bearer', 'authorizeSpaceRequest bearer')
  const payload = __test.buildSecondScreenPayload({
    capturedAt: 't0',
    core: { healthScore: 80, sessionCount: 1 },
    load: { taskRunning: 1, taskQueued: 0, uptimeSec: 9 },
    fleet: { counts: { running: 2 }, processes: [{ kind: 'task', title: 'x', status: 'running' }] },
    mailbox: { unread: 1, total: 3 },
    events: [{ kind: 'system', text: 'hi', ts: 't' }],
    integrations: { taskBoard: true },
  }, { enabled: true, sync: true, hasToken: true })
  assert(payload.role === 'second-screen' && payload.fleet.processes.length === 1, 'buildSecondScreenPayload')
  assert(typeof __test.buildSecondScreenPayload === 'function', 'buildSecondScreenPayload exported')
} finally {
  delete process.env.DSH_HOME
  try { rmSync(spaceHome, { recursive: true, force: true }) } catch { /* ignore */ }
}

// ── action registry ──
console.log('\naction registry')
assert(__test.CORE_ACTION_NAMES.size === 10, 'core actions count = 10')
assert(__test.ACTION_REGISTRY.has('send-message'), 'registry send-message')
assert(__test.ACTION_REGISTRY.has('idea-inject'), 'registry idea-inject')
assert(!__test.CORE_ACTION_NAMES.has('idea-wrap'), 'idea-wrap not in core set')

// ── idea-inject ──
console.log('\nidea-inject')
const tmpHome = mkdtempSync(join(tmpdir(), 'ow-smoke-'))
process.env.DSH_HOME = tmpHome
try {
  const ideaLab = __test.buildIdeaLab(tmpHome, { idea: { enabled: true } })
  assert(ideaLab.presets.length >= 1, 'idea presets loaded')
  const wrapped = __test.wrapIdeaPrompt(ideaLab, ideaLab.presets[0].id, 'hello test', '主人')
  assert(wrapped.ok === true, 'wrapIdeaPrompt ok')
  assert(wrapped.wrapped.includes('[IDEA Lab'), 'wrapped contains header')

  const dispatchResult = await __test.dispatchOpenWorldAction('idea-wrap', {
    presetId: ideaLab.presets[0].id,
    body: 'ping',
    treatAs: '主人',
  }, {
    home: tmpHome,
    config: { idea: { enabled: true }, messaging: { enabled: true, max_messages: 50, allow_broadcast: true } },
    ctx: mockCtx,
    hostHeader: '127.0.0.1:0',
    buildSnapshot: __test.buildSnapshot,
    notifyStream: () => {},
    pushEvent: () => {},
  })
  assert(dispatchResult.status === 200, 'dispatch idea-wrap status 200')
  assert(dispatchResult.body.ok === true, 'dispatch idea-wrap body.ok')
} finally {
  delete process.env.DSH_HOME
  try { rmSync(tmpHome, { recursive: true, force: true }) } catch { /* ignore */ }
}

// ── manifest scan (Windows-safe) ──
console.log('\nscanOpenWorldManifests')
try {
  const manifests = __test.scanOpenWorldManifests(process.env.USERPROFILE
    ? join(process.env.USERPROFILE, '.dsh')
    : join(tmpdir(), '.dsh'))
  assert(Array.isArray(manifests), 'manifests is array')
} catch (err) {
  assert(false, `scanOpenWorldManifests threw: ${err.message}`)
}

// ── fingerprint / SSE delta helpers ──
console.log('\nfingerprint')
assert(typeof __test.commitFingerprint === 'function', 'commitFingerprint exported')
assert(typeof __test.probeWorldFingerprint === 'function', 'probeWorldFingerprint exported')
const fp1 = __test.commitFingerprint({
  sessions: 1, taskRunning: 0, taskTotal: 0, rewindSnapshots: 0,
  hindsightDaemon: false, mailboxUnread: 0, pluginCount: 1,
}, { emitEvents: false })
assert(Array.isArray(fp1), 'first commit returns array')
const fp2 = __test.commitFingerprint({
  sessions: 2, taskRunning: 0, taskTotal: 0, rewindSnapshots: 0,
  hindsightDaemon: false, mailboxUnread: 0, pluginCount: 1,
}, { emitEvents: false })
assert(fp2.includes('sessions'), 'second commit detects sessions change')

// ── manifest merge ──
console.log('\nmanifest merge')
assert(typeof __test.mergePluginResults === 'function', 'mergePluginResults exported')
const merged = __test.mergePluginResults({
  catalog: __test.PLUGIN_CATALOG.slice(0, 2),
  probes: { taskBoard: true, rewind: false },
  deps: new Set(['@linxin666/dsh-client-ui-task-board']),
  manifests: [],
})
assert(merged.length === 2, 'mergePluginResults catalog length')
assert(merged[0].source === 'catalog', 'catalog row tagged')
assert(merged[0].featureId === 'web-ui-task-board', 'task-board featureId')
assert(merged[1].howToEnable && merged[1].howToEnable.includes('web-ui-rewind'), 'offline hint cites plugins.yml id')
assert(typeof __test.howToEnableHint === 'function', 'howToEnableHint exported')
assert(typeof __test.taskBoardMetrics === 'function', 'taskBoardMetrics exported')
assert(typeof __test.projectLiveMemory === 'function', 'projectLiveMemory exported')
assert(__test.describeNeuralRra().implemented === false, 'neural RRA stub off')

const catalogHasFeature = __test.PLUGIN_CATALOG.every((p) => 'featureId' in p)
assert(catalogHasFeature, 'PLUGIN_CATALOG rows declare featureId')

const rrmCfg = __test.parseOpenWorldConfig(`
rrm:
  enabled: true
  alpha: 1.5
  byte_budget: 12000
`)
assert(rrmCfg.rrm.alpha === 1.5, 'parse rrm.alpha')
assert(rrmCfg.rrm.byte_budget === 12000, 'parse rrm.byte_budget')
assert(typeof __test.compareRrmParams === 'function', 'compareRrmParams exported')
assert(typeof __test.defaultCompareVariants === 'function', 'defaultCompareVariants exported')
assert(typeof __test.buildRrmReport === 'function', 'buildRrmReport exported')
assert(__test.defaultCompareVariants({}).length === 4, 'defaultCompareVariants 4 rows')
assert(typeof __test.resolveRrmConfig === 'function', 'resolveRrmConfig exported')
assert(typeof __test.saveRrmSessionOverride === 'function', 'saveRrmSessionOverride exported')
assert(typeof __test.compareRrmAllChannels === 'function', 'compareRrmAllChannels exported')
assert(typeof __test.attachArchiveTails === 'function', 'attachArchiveTails exported')
assert(typeof __test.searchLocalArchives === 'function', 'searchLocalArchives exported')

const rrmHome = mkdtempSync(join(tmpdir(), 'ow-rrm-smoke-'))
try {
  const base = __test.resolveRrmConfig(rrmHome, { alpha: 1, tau_ms: 60_000, byte_budget: 20_000 })
  assertEq(base.source, 'yml', 'resolveRrmConfig default source')
  const applied = __test.saveRrmSessionOverride(rrmHome, {
    alpha: 1.25, tau_ms: 90_000, byte_budget: 9000,
  }, { label: 'smoke-winner' })
  assert(applied.ok === true, 'saveRrmSessionOverride ok')
  const resolved = __test.resolveRrmConfig(rrmHome, { alpha: 1, tau_ms: 60_000, byte_budget: 20_000 })
  assertEq(resolved.source, 'session', 'resolveRrmConfig session source')
  assertEq(resolved.rrm.alpha, 1.25, 'session alpha wins')

  const applyAct = await __test.dispatchOpenWorldAction('rrm-session-apply', {
    alpha: 1.1, tau_ms: 70_000, byte_budget: 10000, label: 'dispatch',
  }, {
    home: rrmHome,
    config: { rrm: { alpha: 1, tau_ms: 60_000, byte_budget: 20_000 } },
    pushEvent: () => {},
    notifyStream: () => {},
  })
  assert(applyAct.status === 200 && applyAct.body.ok === true, 'dispatch rrm-session-apply')
  assertEq(applyAct.body.active.source, 'session', 'apply active.source session')

  const clearAct = await __test.dispatchOpenWorldAction('rrm-session-clear', {}, {
    home: rrmHome,
    config: { rrm: { alpha: 1, tau_ms: 60_000, byte_budget: 20_000 } },
    pushEvent: () => {},
    notifyStream: () => {},
  })
  assert(clearAct.status === 200 && clearAct.body.cleared === true, 'dispatch rrm-session-clear')
  assertEq(clearAct.body.active.source, 'yml', 'clear back to yml')

  const report = __test.buildRrmReport(rrmHome, {
    rrm: { alpha: 1, tau_ms: 60_000, byte_budget: 20_000 },
    messaging: { max_messages: 20 },
  }, [
    { id: 'e1', kind: 'system', title: 'a', ts: Date.now() },
    { id: 'e2', kind: 'system', title: 'b', ts: Date.now() - 120_000 },
  ])
  assert(report.memory && report.memory.compare, 'buildRrmReport memory.compare')
  assert(report.memory.compare.channels, 'compare.channels present')
  assert(report.memory.archives && report.memory.archives.hint, 'memory.archives present')
  assert(report.memory.archives.recent, 'memory.archives.recent present')
  assert(report.memory.active && report.memory.active.source === 'yml', 'memory.active.source yml after clear')
} finally {
  rmSync(rrmHome, { recursive: true, force: true })
}

assert(typeof __test.loadWorldState === 'function', 'loadWorldState exported')
assert(typeof __test.saveWorldState === 'function', 'saveWorldState exported')
const worldHome = mkdtempSync(join(tmpdir(), 'ow-ws-smoke-'))
try {
  const w = __test.saveWorldState(worldHome, { wmMode: 'float', leftTab: 'events', open: true })
  assertEq(w.shell.wmMode, 'float', 'world-state save wmMode')
  assertEq(__test.loadWorldState(worldHome).ui.leftTab, 'events', 'world-state load leftTab')
} finally {
  rmSync(worldHome, { recursive: true, force: true })
}

assert(__test.NODE_ACTIONS['task-board'].type === 'embed', 'task-board action embed')
assert(__test.NODE_ACTIONS['task-board'].panel === 'task-board', 'task-board panel')
assert(__test.NODE_ACTIONS.storage.panel === 'rewind', 'storage → rewind surface')
assert(__test.NODE_ACTIONS.network.panel === 'ssh', 'network → ssh surface')
assert(__test.NODE_ACTIONS.memory.panel === 'memory', 'memory surface')
assert(__test.NODE_ACTIONS['user-hub'].panel === 'market', 'user-hub → market')
assert(__test.NODE_ACTIONS.runtime.panel === 'fleet', 'runtime → fleet surface')
assert(typeof __test.buildFleetView === 'function', 'buildFleetView exported')
const fleetSample = __test.buildFleetView({
  sessions: { activeId: 'a', items: [{ id: 'a', cwd: '/tmp/x' }] },
  taskBoard: { available: true, tasks: [{ id: '1', title: 't', running: true, status: 'running' }] },
  ventus: { available: true, entries: [] },
})
assert(fleetSample.counts.sessions === 1, 'fleet sessions')
assert(fleetSample.counts.tasks === 1, 'fleet tasks')

// M4：sketch 默认关；显式开可跑草图且不宣称 implemented
{
  const skipped = await __test.tryApplyRraSketch({
    q: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    queryPos: 3,
    causal: true,
    k_layers: { exact: [] },
  }, { sketch: false })
  assert(skipped.skipped === true && skipped.ok === false, 'M4 sketch default-off skips')
  const ran = await __test.tryApplyRraSketch({
    q: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    queryPos: 0,
    causal: true,
    k_layers: {
      exact: [{
        vec: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        pos: 0,
      }],
    },
  }, { sketch: true })
  assert(ran.ok === true && ran.sketch === true, 'M4 sketch opt-in runs')
  assert(ran.implemented === false && ran.fullNeuralRra === false, 'M4 sketch stays honest')
  assert(ran.output && ran.output.meta && ran.output.meta.sketch === true, 'M4 sketch meta tag')
  assert(ran.output.meta.compressWeightsLoaded !== true, 'M4 sketch without weights flag')
}

// M5：可选 compressWeights → readAt；dim 不符必拒
{
  const { writeFileSync, mkdtempSync, rmSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')
  const { pathToFileURL } = await import('node:url')
  const dir = __test.resolveRraProtoDir()
  assert(!!dir, 'rra-proto dir for compress weights')
  const compressUrl = pathToFileURL(join(dir, 'src', 'compress.mjs')).href
  const { createCompressModel, snapshotCompressModel, trainToySteps } = await import(compressUrl)
  const model = createCompressModel({ dim: 16, compressedDim: 4, seedScale: 0.05 })
  trainToySteps(model, { steps: 8, lr: 0.08, blockSize: 4, batchBlocks: 2 })
  const tmp = mkdtempSync(join(tmpdir(), 'ow-m5w-'))
  const wpath = join(tmp, 'compress-weights.json')
  writeFileSync(wpath, JSON.stringify(snapshotCompressModel(model)))
  const q16 = Array.from({ length: 16 }, (_, i) => 0.01 * (i + 1))
  const withW = await __test.tryApplyRraSketch({
    q: q16,
    queryPos: 4,
    causal: true,
    k_layers: {
      exact: [{ vec: q16, pos: 4 }],
      compressed: [{
        code: Array.from({ length: 4 }, () => 0.1),
        pooled: q16,
        meanPos: 1,
        count: 4,
      }],
    },
  }, { sketch: true, compressWeights: wpath })
  assert(withW.ok === true, 'M5 compressWeights sketch ok')
  assert(withW.weights && withW.weights.dim === 16, 'M5 weights meta dim')
  assert(withW.output?.meta?.compressWeightsLoaded === true, 'M5 compressWeightsLoaded meta')
  assert(withW.implemented === false && withW.fullNeuralRra === false, 'M5 weights stay honest')

  const badDim = await __test.tryApplyRraSketch({
    q: Array.from({ length: 8 }, (_, i) => 0.01 * (i + 1)),
    queryPos: 2,
    causal: true,
    k_layers: { exact: [] },
  }, { sketch: true, compressWeights: wpath })
  assert(badDim.ok === false, 'M5 dim mismatch rejects')
  assert(String(badDim.error || '').includes('dim'), `M5 dim mismatch message (${badDim.error})`)

  const missing = await __test.tryApplyRraSketch({
    q: q16,
    queryPos: 1,
    causal: true,
    k_layers: { exact: [] },
  }, { sketch: true, compressWeights: join(tmp, 'no-such.json') })
  assert(missing.ok === false && String(missing.error || '').includes('not found'), 'M5 missing weights rejects')

  const fakePath = join(tmp, 'fake-prod.json')
  writeFileSync(fakePath, JSON.stringify({
    protocol: 'rra/1.0-full-neural',
    dim: 16,
    compressedDim: 4,
    implemented: true,
    fullNeuralRra: true,
    Wdown: Array(4 * 16).fill(0),
    Wup: Array(16 * 4).fill(0),
  }))
  const fake = await __test.tryApplyRraSketch({
    q: q16,
    queryPos: 1,
    causal: true,
    k_layers: { exact: [] },
  }, { sketch: true, compressWeights: fakePath })
  assert(fake.ok === false && String(fake.error || '').includes('contract'), `M5-D rejects fake prod (${fake.error})`)

  rmSync(tmp, { recursive: true, force: true })
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
