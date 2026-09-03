import test from 'node:test'
import assert from 'node:assert/strict'
import { Graph, NODE_TYPES, DEFAULT_EDGE_COMPAT } from '../src/topology.js'

// ── 节点类型系统 ────────────────────────────────────────

test('node type defaults to custom', () => {
  const g = new Graph()
  g.addNode('a')
  assert.equal(g.nodeType('a'), 'custom')
})

test('node type is stored and queryable', () => {
  const g = new Graph()
  g.addNode('s', { type: 'sensor' })
  g.addNode('n', { type: 'nn' })
  assert.equal(g.nodeType('s'), 'sensor')
  assert.equal(g.nodeType('n'), 'nn')
  assert.deepEqual(g.nodesByType('sensor'), ['s'])
  assert.deepEqual(g.nodesByType('nn'), ['n'])
})

test('invalid node type rejected', () => {
  const g = new Graph()
  assert.throws(() => g.addNode('x', { type: 'not-a-type' }), /invalid node type/)
})

test('all NODE_TYPES are valid', () => {
  const g = new Graph()
  for (const t of NODE_TYPES) {
    g.addNode(`n-${t}`, { type: t })
  }
  assert.equal(g.nodeCount(), NODE_TYPES.length)
})

// ── 边类型兼容性 ────────────────────────────────────────

test('edge compat: sensor → nn is allowed', () => {
  const g = new Graph()
  g.addNode('s', { type: 'sensor' })
  g.addNode('n', { type: 'nn' })
  g.addEdge('s', 'n')
  assert.ok(g.hasEdge('s', 'n'))
})

test('edge compat: sensor → actuator is rejected', () => {
  const g = new Graph()
  g.addNode('s', { type: 'sensor' })
  g.addNode('a', { type: 'actuator' })
  assert.throws(() => g.addEdge('s', 'a'), /type mismatch/)
})

test('edge compat: custom type connects to anything', () => {
  const g = new Graph()
  g.addNode('c') // custom
  g.addNode('a', { type: 'actuator' })
  g.addEdge('c', 'a')
  assert.ok(g.hasEdge('c', 'a'))
})

test('edge compat: nn → nn is allowed (self-type)', () => {
  const g = new Graph()
  g.addNode('n1', { type: 'nn' })
  g.addNode('n2', { type: 'nn' })
  g.addEdge('n1', 'n2')
  assert.ok(g.hasEdge('n1', 'n2'))
})

// ── 动态结构 + 事件流 ───────────────────────────────────

test('event log records structural changes', () => {
  const events = []
  const g = new Graph({ onEvent: (ev) => events.push(ev) })
  g.addNode('a')
  g.addNode('b')
  g.addEdge('a', 'b')
  g.removeEdge('a', 'b')
  g.removeNode('a')
  const kinds = g.eventLog().map((e) => e.kind)
  assert.ok(kinds.includes('add-node'))
  assert.ok(kinds.includes('add-edge'))
  assert.ok(kinds.includes('remove-edge'))
  assert.ok(kinds.includes('remove-node'))
  assert.ok(events.length > 0)
})

test('event log has sequence numbers', () => {
  const g = new Graph()
  g.addNode('x')
  g.addNode('y')
  const log = g.eventLog()
  assert.equal(log[0].seq, 0)
  assert.equal(log[1].seq, 1)
})

// ── 拓扑校验器 ──────────────────────────────────────────

test('maxNodes enforced', () => {
  const g = new Graph({ maxNodes: 2 })
  g.addNode('a'); g.addNode('b')
  assert.throws(() => g.addNode('c'), /maxNodes/)
})

test('allowCycles=false rejects cycle-creating edge', () => {
  const g = new Graph({ directed: true, allowCycles: false })
  g.addNode('a'); g.addNode('b'); g.addNode('c')
  g.addEdge('a', 'b')
  g.addEdge('b', 'c')
  assert.throws(() => g.addEdge('c', 'a'), /cycle/)
  // edge was not actually added
  assert.ok(!g.hasEdge('c', 'a'))
})

test('validate() reports orphans as warnings', () => {
  const g = new Graph()
  g.addNode('a')
  g.addNode('b')
  g.addNode('lonely')
  g.addEdge('a', 'b')
  const v = g.validate()
  assert.ok(v.ok)
  assert.ok(v.warnings.some((w) => w.includes('lonely')))
})

test('validate() catches type mismatch after edgeCompat change', () => {
  const g = new Graph()
  g.addNode('s', { type: 'sensor' })
  g.addNode('a', { type: 'actuator' })
  // bypass addEdge check by directly mutating edgeCompat
  const orig = { ...g.edgeCompat }
  g.edgeCompat = { ...orig, sensor: ['actuator'] }
  g.addEdge('s', 'a')
  // restore strict compat, then validate should flag it
  g.edgeCompat = orig
  const v = g.validate()
  assert.ok(!v.ok)
  assert.ok(v.errors.some((e) => e.includes('type mismatch')))
})

test('stats() returns type distribution and density', () => {
  const g = new Graph()
  g.addNode('s', { type: 'sensor' })
  g.addNode('n', { type: 'nn' })
  g.addNode('a', { type: 'actuator' })
  g.addEdge('s', 'n')
  g.addEdge('n', 'a')
  const s = g.stats()
  assert.equal(s.nodes, 3)
  assert.equal(s.edges, 2)
  assert.equal(s.typeDistribution.sensor, 1)
  assert.equal(s.typeDistribution.nn, 1)
  assert.equal(s.typeDistribution.actuator, 1)
  assert.ok(s.density > 0 && s.density <= 1)
})

// ── rewire ──────────────────────────────────────────────

test('rewire changes edge target', () => {
  const g = new Graph()
  g.addNode('a'); g.addNode('b'); g.addNode('c')
  g.addEdge('a', 'b')
  g.rewire('a', 'b', 'c')
  assert.ok(!g.hasEdge('a', 'b'))
  assert.ok(g.hasEdge('a', 'c'))
})

test('rewire preserves edge data', () => {
  const g = new Graph()
  g.addNode('a'); g.addNode('b'); g.addNode('c')
  g.addEdge('a', 'b', { weight: 0.7 })
  g.rewire('a', 'b', 'c')
  assert.equal(g.edges().find((e) => e.from === 'a').weight, 0.7)
})

test('rewire to incompatible type throws', () => {
  const g = new Graph()
  g.addNode('s', { type: 'sensor' })
  g.addNode('l', { type: 'logic' })
  g.addNode('a', { type: 'actuator' })
  g.addEdge('s', 'l')
  assert.throws(() => g.rewire('s', 'l', 'a'), /mismatch/)
  // original edge intact
  assert.ok(g.hasEdge('s', 'l'))
})

// ── 快照 / 回滚 ────────────────────────────────────────

test('snapshot and restore roundtrip', () => {
  const g = new Graph()
  g.addNode('a'); g.addNode('b')
  g.addEdge('a', 'b', { weight: 0.5 })
  const snap = g.snapshot()

  g.removeNode('a')
  assert.equal(g.nodeCount(), 1)
  g.restore(snap)
  assert.equal(g.nodeCount(), 2)
  assert.ok(g.hasEdge('a', 'b'))
  assert.equal(g.edges()[0].weight, 0.5)
})

test('snapshot preserves node types', () => {
  const g = new Graph()
  g.addNode('s', { type: 'sensor' })
  const snap = g.snapshot()
  g.addNode('x', { type: 'nn' })
  g.restore(snap)
  assert.equal(g.nodeType('s'), 'sensor')
  assert.ok(!g.hasNode('x'))
})

// ── 序列化包含新字段 ────────────────────────────────────

test('serialize/deserialize roundtrips types and config', () => {
  const g = new Graph({ directed: true, maxNodes: 50, allowCycles: false })
  g.addNode('s', { type: 'sensor' })
  g.addNode('n', { type: 'nn' })
  g.addEdge('s', 'n')
  const g2 = Graph.deserialize(g.serialize())
  assert.equal(g2.directed, true)
  assert.equal(g2.maxNodes, 50)
  assert.equal(g2.allowCycles, false)
  assert.equal(g2.nodeType('s'), 'sensor')
  assert.ok(g2.hasEdge('s', 'n'))
})
