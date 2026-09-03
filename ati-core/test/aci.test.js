import test from 'node:test'
import assert from 'node:assert/strict'
import { Graph } from '../src/topology.js'
import { MemorySystem } from '../src/memory.js'
import { Planner } from '../src/planner.js'
import { FeedbackLoop } from '../src/feedback.js'
import { ConflictResolver } from '../src/conflict.js'
import { AtiOrchestrator } from '../src/aci.js'
import {
  SensorOperator, NnOperator, ToolOperator, MemoryOperator, ActuatorOperator, Operator,
} from '../src/operators.js'

// ── MemorySystem ────────────────────────────────────────

test('memory: short-term remember/recall', () => {
  const mem = new MemorySystem()
  mem.remember('key1', 'value1')
  assert.equal(mem.recall('key1'), 'value1')
})

test('memory: short-term miss returns undefined', () => {
  const mem = new MemorySystem()
  assert.equal(mem.recall('nope'), undefined)
})

test('memory: LRU eviction when exceeding maxShortTerm', () => {
  const mem = new MemorySystem({ maxShortTerm: 3 })
  mem.remember('a', 1).remember('b', 2).remember('c', 3)
  // read 'a' so it's not the least-recently-used
  mem.recall('a')
  mem.remember('d', 4) // should evict 'b' (least recently used)
  assert.equal(mem.recall('b'), undefined)
  assert.equal(mem.recall('a'), 1)
  assert.equal(mem.recall('c'), 3)
  assert.equal(mem.recall('d'), 4)
})

test('memory: long-term memorize/recollect without persist', () => {
  const mem = new MemorySystem()
  mem.memorize('fact', 'sky is blue')
  assert.equal(mem.recollect('fact'), 'sky is blue')
})

test('memory: recallPattern fuzzy search', () => {
  const mem = new MemorySystem()
  mem.memorize('weather-today', 'sunny')
  mem.memorize('mood-today', 'happy')
  mem.memorize('unrelated', 'xyz')
  const results = mem.recallPattern('today')
  assert.equal(results.length, 2)
})

test('memory: promote short to long term', () => {
  const mem = new MemorySystem()
  mem.remember('important', 'data')
  mem.promote('important')
  assert.equal(mem.recollect('important'), 'data')
})

// ── Planner ────────────────────────────────────────────

test('planner: buildFromBlueprint creates graph and operators', async () => {
  const p = new Planner()
  const { graph, operators } = p.buildFromBlueprint({
    nodes: [
      { id: 'src', type: 'sensor' },
      { id: 'mid', type: 'nn' },
      { id: 'out', type: 'actuator' },
    ],
    edges: [
      { from: 'src', to: 'mid' },
      { from: 'mid', to: 'out' },
    ],
  })
  assert.equal(graph.nodeCount(), 3)
  assert.equal(operators.size, 3)
})

test('planner: executePlan runs and scores', async () => {
  const p = new Planner()
  p.registerCapability('double', 'nn', new NnOperator({ model: async (x) => x * 2 }))
  const entry = await p.executePlan(
    'double the input',
    {
      nodes: [
        { id: 'in', type: 'sensor' },
        { id: 'proc', type: 'nn', capability: 'double' },
        { id: 'out', type: 'actuator' },
      ],
      edges: [
        { from: 'in', to: 'proc' },
        { from: 'proc', to: 'out' },
      ],
    },
    null,
  )
  // Override sensor source for deterministic input
  // For now just check it ran
  assert.ok(entry.planId)
  assert.ok(entry.score >= 0 && entry.score <= 1)
  assert.ok(entry.graph)
})

test('planner: failed plan gets score 0', async () => {
  const p = new Planner()
  p.registerCapability('bad', 'tool', new ToolOperator({
    execute: async () => { throw new Error('intentional') },
  }))
  const entry = await p.executePlan('will fail', {
    nodes: [{ id: 'x', type: 'tool', capability: 'bad' }],
    edges: [],
  })
  assert.equal(entry.score, 0.0)
  assert.ok(entry.result.error)
})

test('planner: bestPatterns returns high scorers', async () => {
  const p = new Planner()

  // Register a working capability
  p.registerCapability('good-op', 'nn', new NnOperator({ model: async (x) => `ok:${x}` }))

  await p.executePlan('good task', {
    nodes: [
      { id: 'a', type: 'sensor' },
      { id: 'b', type: 'nn', capability: 'good-op' },
      { id: 'c', type: 'actuator' },
    ],
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
  }, null)

  const best = p.bestPatterns(0.5)
  assert.ok(best.length >= 1)
})

// ── FeedbackLoop ───────────────────────────────────────

test('feedback: record updates edge scores', () => {
  const fb = new FeedbackLoop()
  const g = new Graph({ directed: true })
  g.addNode('a'); g.addNode('b'); g.addNode('c')
  g.addEdge('a', 'b'); g.addEdge('b', 'c')

  fb.record({ planId: 'p1', graph: g, score: 0.9 })
  assert.ok(fb.edgeScore('a', 'b') > 0.5)
  assert.ok(fb.edgeScore('b', 'c') > 0.5)

  // Bad execution lowers score
  fb.record({ planId: 'p2', graph: g, score: 0.1 })
  assert.ok(fb.edgeScore('a', 'b') < 0.9)
})

test('feedback: weakest edges identified', () => {
  const fb = new FeedbackLoop({ learningRate: 0.5 })
  const g = new Graph({ directed: true })
  g.addNode('x'); g.addNode('y'); g.addNode('z')
  g.addEdge('x', 'y'); g.addEdge('y', 'z')

  // Good on x→y, bad on y→z
  fb.record({ planId: 'p1', graph: g, score: 0.9 })

  const weak = fb.weakestEdges(1)
  assert.ok(weak.length >= 1)
})

test('feedback: trend detection', () => {
  const fb = new FeedbackLoop()
  const g = new Graph({ directed: true })
  g.addNode('n'); g.addNode('m')
  g.addEdge('n', 'm')

  // Declining trend
  for (let i = 0; i < 10; i++) {
    fb.record({ planId: `t${i}`, graph: g, score: i < 5 ? 0.9 : 0.2 })
  }
  assert.equal(fb.trend(), 'declining')
})

// ── ConflictResolver ───────────────────────────────────

test('conflict: no conflicts with unique resources', () => {
  const cr = new ConflictResolver()
  cr.addGoal('g1', { resources: ['cpu'] })
  cr.addGoal('g2', { resources: ['memory'] })
  assert.ok(!cr.hasConflicts())
  const r = cr.resolve()
  assert.equal(r.approved.length, 2)
  assert.equal(r.deferred.length, 0)
})

test('conflict: same resource → higher priority wins', () => {
  const cr = new ConflictResolver()
  cr.addGoal('low', { priority: 3, resources: ['gpu'] })
  cr.addGoal('high', { priority: 8, resources: ['gpu'] })
  const r = cr.resolve()
  assert.deepEqual(r.approved, ['high'])
  assert.equal(r.deferred[0].goalId, 'low')
  assert.equal(r.conflicts[0].resource, 'gpu')
})

test('conflict: multi-resource partial block', () => {
  const cr = new ConflictResolver()
  cr.addGoal('a', { priority: 7, resources: ['cpu', 'net'] })
  cr.addGoal('b', { priority: 5, resources: ['cpu'] })
  cr.addGoal('c', { priority: 6, resources: ['disk'] })
  const r = cr.resolve()
  assert.ok(r.approved.includes('a'))
  assert.ok(r.approved.includes('c'))
  assert.ok(!r.approved.includes('b')) // blocked by a on cpu
})

test('conflict: reset clears goals', () => {
  const cr = new ConflictResolver()
  cr.addGoal('g', {})
  cr.reset()
  assert.equal(cr.goals().length, 0)
})

// ── AtiOrchestrator（完整闭环）──────────────────────────

test('orchestrator: full think cycle completes', async () => {
  const aci = new AtiOrchestrator()

  aci.registerCapability('echo-sensor', 'sensor', new SensorOperator({ source: () => 'hello' }))
  aci.registerCapability('upper', 'nn', new NnOperator({ model: async (x) => String(x).toUpperCase() }))
  aci.registerCapability('output', 'actuator', new ActuatorOperator({ actuate: async (x) => `result:${x}` }))

  const result = await aci.think(
    'task-1',
    'convert input to uppercase',
    {
      nodes: [
        { id: 'sense', type: 'sensor', capability: 'echo-sensor' },
        { id: 'brain', type: 'nn', capability: 'upper' },
        { id: 'hand', type: 'actuator', capability: 'output' },
      ],
      edges: [
        { from: 'sense', to: 'brain' },
        { from: 'brain', to: 'hand' },
      ],
    },
  )

  assert.equal(result.status, 'completed')
  assert.equal(result.output, 'result:HELLO')
  assert.ok(result.score > 0.5)
  assert.ok(result.trend)
})

test('orchestrator: selfModel returns summary', async () => {
  const aci = new AtiOrchestrator()
  aci.registerCapability('noop', 'tool', new ToolOperator({ execute: async (x) => x }))

  await aci.think('t1', 'test goal', {
    nodes: [{ id: 'n1', type: 'tool', capability: 'noop' }],
    edges: [],
  })

  const sm = aci.selfModel()
  assert.ok(sm.cycles >= 1)
  assert.ok(sm.plansExecuted >= 1)
  assert.ok(sm.averageScore !== null)
  assert.ok(Array.isArray(sm.strongestEdges))
})

test('orchestrator: deferred when resource conflict', async () => {
  const aci = new AtiOrchestrator({ learningRate: 0.5 })
  aci.registerCapability('op', 'tool', new ToolOperator({ execute: async (x) => x }))

  // First goal takes "gpu"
  await aci.think('goal-high', 'first', {
    nodes: [{ id: 'a', type: 'tool', capability: 'op' }],
    edges: [],
  })
  // Manually boost priority of first goal
  aci.conflicts._goals.get('goal-high').priority = 10

  // Second goal also wants gpu, lower priority → should defer
  const result2 = await aci.think('goal-low', 'second', {
    nodes: [{ id: 'b', type: 'tool', capability: 'op' }],
    edges: [],
  })

  assert.equal(result2.status, 'deferred')
})
