#!/usr/bin/env node
import {
  projectLiveMemory,
  resolutionDensity,
  assignTier,
  reconcileEvents,
  formatMemoryHint,
  defaultRrmConfig,
  projectMailboxMemory,
  projectTaskMemory,
  compareRrmParams,
  defaultCompareVariants,
  slimMemoryForSnapshot,
  resolveRrmConfig,
  saveRrmSessionOverride,
  loadRrmSessionOverride,
  clampRrmSessionParams,
  compareRrmAllChannels,
  summarizeArchives,
  formatArchiveHint,
  readArchiveTail,
  attachArchiveTails,
  slimArchiveItem,
  searchArchiveFile,
  searchLocalArchives,
} from '../bridge/rrm-memory.mjs'
import { describeNeuralRra, applyReciprocalResolutionAttention, assertShellDoesNotClaimNeural, RRA_INPUT_KEYS, RRA_OUTPUT_KEYS } from '../bridge/rra-neural.stub.mjs'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

console.log('\n=== bridge/rrm-memory.mjs ===\n')

const now = 1_000_000
const mk = (i, title) => ({
  id: `e${i}`,
  kind: 'system',
  title: title || `event-${i}`,
  detail: 'x'.repeat(80),
  ts: now - i * 30_000,
})

const raw = Array.from({ length: 40 }, (_, i) => mk(i))
const cfg = { ...defaultRrmConfig(), exact_window: 5, compressed_max: 10, landmark_max: 5, byte_budget: 20_000 }
const proj = projectLiveMemory(raw, cfg, now)

ok(proj.exact.length === 5, `exact window = 5 (got ${proj.exact.length})`)
ok(proj.exact.every((e) => e.tier === 'exact'), 'exact tier tagged')
ok(proj.compressed.every((e) => e.detail === ''), 'compressed strips detail')
ok(proj.falsify.rrmLiveBytes <= proj.falsify.naiveBytes, 'rrm bytes ≤ naive bytes')
ok(proj.falsify.ratio <= 1, 'falsify ratio ≤ 1')
ok(resolutionDensity(0, cfg) === 1, 'density at 0 is 1')
ok(resolutionDensity(60_000, cfg) < 1, 'density decays with distance')
ok(assignTier(mk(0), 0, cfg, now) === 'exact', 'newest is exact')
ok(formatMemoryHint(proj.meta).includes('精确'), 'hint mentions 精确')

const dir = mkdtempSync(join(tmpdir(), 'ow-rrm-'))
const buf = raw.map((e) => ({ ...e }))
const reconciled = reconcileEvents(buf, dir, cfg, now)
ok(buf.length === reconciled.liveEvents.length, 'reconcile replaces in-place')
ok(reconciled.archiveStats != null, 'archive stats attached')
rmSync(dir, { recursive: true, force: true })

const neural = describeNeuralRra()
ok(neural.implemented === false, 'neural RRA stub not implemented')
ok(neural.stage === 'L6-M4' || neural.stage === 'L6-M2', `neural stage ${neural.stage}`)
ok(neural.protocol === 'rra/0.0-stub', 'neural protocol stub')
ok(neural.protoPackage && String(neural.protoPackage).includes('rra-proto'), 'protoPackage pointed')
ok(neural.fullNeuralRra === false, 'fullNeuralRra false')
ok(Array.isArray(neural.inputKeys) && neural.inputKeys.includes('q'), 'neural inputKeys')
ok(Array.isArray(neural.outputKeys) && neural.outputKeys.includes('context'), 'neural outputKeys')
ok(RRA_INPUT_KEYS.includes('causal'), 'RRA_INPUT_KEYS causal')
ok(RRA_OUTPUT_KEYS.includes('meta'), 'RRA_OUTPUT_KEYS meta')
ok(assertShellDoesNotClaimNeural({ neural: false, neuralStub: neural }) === true, 'honesty ok when false')
let honestyThrew = false
try { assertShellDoesNotClaimNeural({ neural: true }) } catch { honestyThrew = true }
ok(honestyThrew, 'honesty rejects neural:true')
let threw = false
try { applyReciprocalResolutionAttention() } catch { threw = true }
ok(threw, 'neural apply throws (no fake path)')
let causalThrew = false
try { applyReciprocalResolutionAttention({ q: null, causal: false }) } catch (e) {
  causalThrew = String(e.message || e).includes('causal')
}
ok(causalThrew, 'neural rejects causal=false even while stub')

const mail = [
  { id: 'u1', body: 'unread hello', read: false, ts: now, direction: 'in' },
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `r${i}`,
    body: `read-${i}-${'y'.repeat(40)}`,
    read: true,
    ts: now - (i + 1) * 45_000,
    direction: 'out',
    to: 'broadcast',
  })),
]
const mproj = projectMailboxMemory(mail, cfg, now)
ok(mproj.exact.some((m) => m.id === 'u1'), 'unread pinned exact')
ok(mproj.falsify.rrmLiveBytes <= mproj.falsify.naiveBytes, 'mailbox rrm ≤ naive')

const tasks = [
  { id: 'hot', title: 'running job', status: 'running', running: true, updatedAt: now },
  ...Array.from({ length: 25 }, (_, i) => ({
    id: `t${i}`,
    title: `done-${i}-${'z'.repeat(30)}`,
    status: 'done',
    running: false,
    updatedAt: now - (i + 1) * 90_000,
  })),
]
const tproj = projectTaskMemory(tasks, cfg, now)
ok(tproj.exact.some((t) => t.id === 'hot'), 'hot task pinned exact')
ok(tproj.falsify.rrmLiveBytes <= tproj.falsify.naiveBytes, 'task rrm ≤ naive')

const cmp = compareRrmParams(raw, [
  { label: 'reciprocal', alpha: 1, tau_ms: 60_000, byte_budget: 20_000 },
  { label: 'slow-decay', alpha: 0.5, tau_ms: 120_000, byte_budget: 20_000 },
  { label: 'tight-budget', alpha: 1, tau_ms: 60_000, byte_budget: 8_000 },
], now)
ok(cmp.rows.length === 3, 'compareRrmParams 3 rows')
ok(cmp.winner && cmp.winner.ratio <= 1, 'winner has ratio ≤ 1')
ok(cmp.rows.find((r) => r.label === 'tight-budget').liveBytes
  <= cmp.rows.find((r) => r.label === 'slow-decay').liveBytes, 'tight budget ≤ slow-decay bytes')

const variants = defaultCompareVariants({ tau_ms: 60_000, alpha: 1, byte_budget: 20_000 })
ok(variants.length === 4 && variants[0].label === 'current', 'defaultCompareVariants has current')
const cmp2 = compareRrmParams(raw, variants, now)
ok(cmp2.rows.length === 4, 'default compare 4 rows')
const slim = slimMemoryForSnapshot(projectLiveMemory(raw, defaultRrmConfig(), now), defaultRrmConfig())
ok(slim.active && slim.active.tau_ms === 60_000, 'slimMemory active tau')

{
  const home = mkdtempSync(join(tmpdir(), 'ow-rrm-session-'))
  try {
    const base = resolveRrmConfig(home, { alpha: 1, tau_ms: 60_000, byte_budget: 20_000 })
    ok(base.source === 'yml', 'resolve default source yml')
    ok(!base.session, 'resolve default no session')
    const bad = clampRrmSessionParams({})
    ok(!bad.ok, 'clamp empty fails')
    const saved = saveRrmSessionOverride(home, { alpha: 1.5, tau_ms: 120_000, byte_budget: 8000 }, { label: 'tight-budget' })
    ok(saved.ok && saved.session && saved.session.label === 'tight-budget', 'save session override')
    const loaded = loadRrmSessionOverride(home)
    ok(loaded && loaded.alpha === 1.5 && loaded.tau_ms === 120_000, 'load session override')
    const resolved = resolveRrmConfig(home, { alpha: 1, tau_ms: 60_000, byte_budget: 20_000 })
    ok(resolved.source === 'session', 'resolve source session')
    ok(resolved.rrm.alpha === 1.5 && resolved.rrm.byte_budget === 8000, 'session params win')
    const slimS = slimMemoryForSnapshot(
      projectLiveMemory(raw, resolved.rrm, now),
      resolved.rrm,
      { source: resolved.source, session: resolved.session },
    )
    ok(slimS.active.source === 'session' && slimS.active.session?.label === 'tight-budget', 'slim active marks session')
    const cleared = saveRrmSessionOverride(home, null)
    ok(cleared.ok && cleared.cleared, 'clear session override')
    ok(resolveRrmConfig(home, { alpha: 1 }).source === 'yml', 'after clear back to yml')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

{
  const mailbox = [
    { id: 'm1', direction: 'in', read: false, body: 'hi', ts: now },
    { id: 'm2', direction: 'in', read: true, body: 'old', ts: now - 200_000 },
  ]
  const tasks = [
    { id: 't1', title: 'hot', status: 'running', updatedAt: now },
    { id: 't2', title: 'cold', status: 'done', updatedAt: now - 300_000 },
  ]
  const all = compareRrmAllChannels({
    events: raw,
    mailbox,
    tasks,
  }, defaultCompareVariants({ tau_ms: 60_000, alpha: 1, byte_budget: 20_000 }), now)
  ok(all.winner && all.rows && all.rows.length === 4, 'all-channels keeps event rows')
  ok(all.channels && all.channels.events && all.channels.events.winner, 'channels.events present')
  ok(all.channels.mailbox && all.channels.mailbox.winner, 'channels.mailbox winner')
  ok(all.channels.tasks && all.channels.tasks.winner, 'channels.tasks winner')
  ok(String(all.note || '').includes('三通道'), 'note mentions 三通道')
}

{
  const empty = summarizeArchives({})
  ok(empty.totalLines === 0 && empty.hint.includes('空'), 'archives empty hint')
  const sum = summarizeArchives({
    events: { exists: true, lines: 3, bytes: 1200 },
    mailbox: { exists: true, lines: 2, bytes: 800 },
    tasks: { exists: false, lines: 0, bytes: 0 },
  })
  ok(sum.totalLines === 5 && sum.totalBytes === 2000, 'archives totals')
  ok(formatArchiveHint(sum).includes('归档'), 'formatArchiveHint')
}

{
  const home = mkdtempSync(join(tmpdir(), 'ow-rrm-tail-'))
  try {
    mkdirSync(join(home, 'open-world'), { recursive: true })
    const lines = []
    for (let i = 0; i < 8; i++) {
      lines.push(JSON.stringify({ id: `e${i}`, title: `事件${i}`, tier: 'archive', ts: now - i * 1000 }))
    }
    writeFileSync(join(home, 'open-world/rrm-archive.jsonl'), `${lines.join('\n')}\n`, 'utf8')
    const tail = readArchiveTail(home, defaultRrmConfig(), 3)
    ok(tail.items.length === 3, 'tail last 3')
    ok(tail.items[2].title === '事件7' || tail.items[0].title === '事件5', 'tail newest in set')
    ok(slimArchiveItem({ title: 'x'.repeat(80), id: 1 }, 'events').title.length === 48, 'slim title clip')
    const bundle = attachArchiveTails(home, defaultRrmConfig(), summarizeArchives({
      events: { exists: true, lines: 8, bytes: 100 },
    }), 3)
    ok(bundle.recent && bundle.recent.events.length === 3, 'attach recent events')
    ok(String(bundle.recent.note || '').includes('尾预览'), 'recent note')
    const hit = searchArchiveFile(home, defaultRrmConfig(), '事件5', { limit: 3 })
    ok(hit.hits.length === 1, 'searchArchiveFile hit')
    ok(hit.hits[0].title.includes('事件5'), 'searchArchiveFile title')
    const miss = searchArchiveFile(home, defaultRrmConfig(), '不存在的关键词xyz', { limit: 3 })
    ok(miss.hits.length === 0, 'searchArchiveFile miss')
    const multi = searchLocalArchives(home, defaultRrmConfig(), '事件', { perChannel: 3 })
    ok(multi.channels.events.hits.length >= 1, 'searchLocalArchives events')
    ok(String(multi.note || '').includes('末尾扫描'), 'searchLocalArchives note')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

console.log(`\n=== rrm: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
