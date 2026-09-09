#!/usr/bin/env node
import {
  WORLD_PACK_DEFS,
  mergeWorldsConfig,
  defaultWorldsConfig,
  buildWorldPacksSnapshot,
  slimWorldPacksForShell,
  resolveWorldPackGate,
  worldPackByPanel,
} from '../bridge/world-packs.mjs'
import { WORLD_DEFS, buildCapabilityGraph } from '../bridge/capability-graph.mjs'
import { CAPABILITY_REGISTRY, resolveEmbedGate, capabilitiesForPreset } from '../bridge/capability-registry.mjs'

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  ✓', msg) }
  else { failed += 1; console.error('  ✗', msg) }
}

console.log('\n=== world-packs ===\n')

ok(WORLD_PACK_DEFS.some((p) => p.id === 'all-in-all'), 'ALL-IN-ALL pack reserved')
ok(WORLD_DEFS.every((w) => w.id !== 'all-in-all'), 'meta pack not in WORLD_DEFS')
ok(defaultWorldsConfig().packs['all-in-all'] === false, 'default pack off')
ok(mergeWorldsConfig(null).packs['all-in-all'] === false, 'merge null stays off')
ok(mergeWorldsConfig({ packs: { 'all-in-all': true } }).packs['all-in-all'] === true, 'merge can opt-in')

const off = buildWorldPacksSnapshot({})
ok(off.source === 'reserved', 'snapshot source reserved')
ok(off.defaultInPath === false, 'never default path')
ok(off.enabled === false, 'default snapshot disabled')
ok(off.packs[0].enterable === false, 'pack never enterable in stage4')

const on = buildWorldPacksSnapshot({ worlds: { packs: { 'all-in-all': true } } })
ok(on.enabled === true, 'opt-in flips enabled')
ok(on.packs[0].enterable === false, 'opt-in still not enterable without real pack')
ok(resolveWorldPackGate('all-in-all', {}).ok === false, 'gate denies default')
ok(resolveWorldPackGate('all-in-all', { worlds: { packs: { 'all-in-all': true } } }).ok === false, 'gate denies opted-in stub')
ok(worldPackByPanel('all-in-all')?.id === 'all-in-all', 'panel→pack')

const slim = slimWorldPacksForShell(off)
ok(slim.count === 1 && slim.enabled === false && !slim.packs, 'shell slim has no pack payloads')

const g = buildCapabilityGraph([{ id: 'task-board', online: true }])
ok(!g.nodes.some((n) => n.id === 'all-in-all'), 'capability graph excludes meta pack')

const reg = CAPABILITY_REGISTRY.find((c) => c.featureId === 'ow-world-pack-all-in-all')
ok(!!reg && (reg.defaultInPresets || []).length === 0, 'registry stub defaultInPresets empty')
ok(!capabilitiesForPreset('bridge').some((c) => c.worldPack), 'bridge preset excludes world packs')
ok(!capabilitiesForPreset('full').some((c) => c.worldPack), 'full preset excludes world packs')
ok(resolveEmbedGate('all-in-all', []).ok === false, 'embed gate blocks all-in-all even with empty plugins')

console.log(`\n=== world-packs: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
