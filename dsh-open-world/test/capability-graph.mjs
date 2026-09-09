#!/usr/bin/env node
import {
  WORLD_DEFS,
  OFFLINE_COST,
  enterCost,
  buildCapabilityGraph,
  pickDefaultWorld,
  worldDefByPanel,
} from '../bridge/capability-graph.mjs'

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  ✓', msg) }
  else { failed += 1; console.error('  ✗', msg) }
}

console.log('\n=== capability-graph ===\n')

ok(WORLD_DEFS[0].id === 'tasks', 'tasks is first world def')
ok(WORLD_DEFS[0].priority < WORLD_DEFS[1].priority, 'tasks priority ahead of rewind')
ok(enterCost(WORLD_DEFS[0], true) === 1, 'online tasks cost=1')
ok(enterCost(WORLD_DEFS[0], false) === 1 + OFFLINE_COST, 'offline tasks cost penalized')

const online = [
  { id: 'task-board', online: true, title: '任务看板' },
  { id: 'rewind', online: false, howToEnable: 'enable rewind' },
]
const g = buildCapabilityGraph(online)
ok(g.source === 'derived', 'graph source derived')
ok(g.nodes.length === 2, 'two world nodes')
ok(g.defaultWorldId === 'tasks', 'default world tasks when online')
ok(g.default && g.default.enterable === true, 'default enterable')
ok(g.edges.length === 2 && g.edges[0].from === 'shell', 'star edges from shell')

const bothOff = buildCapabilityGraph([
  { id: 'task-board', online: false, howToEnable: 'enable tasks' },
  { id: 'rewind', online: false },
])
ok(bothOff.defaultWorldId == null, 'no default when all offline')
ok(pickDefaultWorld(bothOff)?.id === 'tasks', 'pickDefault falls back to tasks node')
ok(worldDefByPanel('task-board')?.id === 'tasks', 'panel→world map')

const rewindOnly = buildCapabilityGraph([
  { id: 'task-board', online: false },
  { id: 'rewind', online: true },
])
ok(rewindOnly.defaultWorldId === 'rewind', 'rewind wins when only online')

console.log(`\n=== capability-graph: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
