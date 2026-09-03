import test from 'node:test'
import assert from 'node:assert/strict'
import { Graph } from '../src/topology.js'
import {
  NnOperator, LogicOperator, ToolOperator, MemoryOperator,
  SensorOperator, ActuatorOperator,
} from '../src/operators.js'
import { GraphExecutor } from '../src/executor.js'

// ── 基础线性流：sensor → nn → actuator ─────────────────

test('linear pipeline: sensor → nn → actuator', async () => {
  const g = new Graph({ directed: true })
  g.addNode('sense', { type: 'sensor' })
  g.addNode('brain', { type: 'nn' })
  g.addNode('hand',  { type: 'actuator' })
  g.addEdge('sense', 'brain')
  g.addEdge('brain', 'hand')

  const ops = new Map([
    ['sense', new SensorOperator({ source: () => 42 })],
    ['brain', new NnOperator({ model: async (x) => x * 2 })],
    ['hand',  new ActuatorOperator({ actuate: async (x) => `done:${x}` })],
  ])

  const ex = new GraphExecutor(g, ops)
  const { output } = await ex.run()
  assert.equal(output, 'done:84')
})

test('executor trace has all nodes with timing', async () => {
  const g = new Graph({ directed: true })
  g.addNode('a', { type: 'sensor' })
  g.addNode('b', { type: 'nn' })
  g.addEdge('a', 'b')
  const ops = new Map([
    ['a', new SensorOperator({ source: () => 'raw' })],
    ['b', new NnOperator({ model: async (x) => x.toUpperCase() })],
  ])
  const ex = new GraphExecutor(g, ops)
  const { trace } = await ex.run()
  assert.equal(trace.length, 2)
  assert.ok(trace[0].ok)
  assert.ok(trace[1].ok)
  assert.equal(trace[0].type, 'sensor')
  assert.equal(trace[1].output, 'RAW')
})

test('executor error propagates with node id', async () => {
  const g = new Graph({ directed: true })
  g.addNode('a', { type: 'tool' })
  g.addNode('b', { type: 'logic' })
  g.addEdge('a', 'b')
  const ops = new Map([
    ['a', new ToolOperator({ execute: async () => { throw new Error('tool broke') } })],
    ['b', new LogicOperator({ condition: () => true })],
  ])
  const ex = new GraphExecutor(g, ops)
  await assert.rejects(() => ex.run(), /node "a".*tool broke/)
})

// ── 分支路由：logic 节点 ────────────────────────────────

test('diamond topology with memory node', async () => {
  const g = new Graph({ directed: true })
  g.addNode('src',   { type: 'sensor' })
  g.addNode('store', { type: 'memory' })
  g.addNode('proc',  { type: 'nn' })
  g.addNode('sink',  { type: 'actuator' })
  g.addEdge('src', 'store')
  g.addEdge('src', 'proc')
  g.addEdge('store', 'sink')
  g.addEdge('proc', 'sink')

  const mem = new Map()
  const ops = new Map([
    ['src',   new SensorOperator({ source: () => 'hello' })],
    ['store', new MemoryOperator({ mode: 'write', key: 'last_input' })],
    ['proc',  new NnOperator({ model: async (x) => `processed:${x}` })],
    ['sink',  new ActuatorOperator({
      actuate: async (inputs) => {
        // 多上游时 inputs 是数组
        return Array.isArray(inputs)
          ? inputs.map((u) => u.value).join('|')
          : String(inputs)
      },
    })],
  ])
  const ex = new GraphExecutor(g, ops)
  const { output } = await ex.run()
  // sink 收到 store 和 proc 的输出
  assert.ok(output.includes('hello'))
  assert.ok(output.includes('processed:hello'))
  // memory 也写入了
  assert.ok(ex.memory.get('last_input'))
})

// ── runTo 部分推理 ─────────────────────────────────────

test('runTo stops at target node', async () => {
  const g = new Graph({ directed: true })
  g.addNode('a', { type: 'sensor' })
  g.addNode('b', { type: 'nn' })
  g.addNode('c', { type: 'actuator' })
  g.addEdge('a', 'b')
  g.addEdge('b', 'c')

  const ops = new Map([
    ['a', new SensorOperator({ source: () => 10 })],
    ['b', new NnOperator({ model: async (x) => x + 5 })],
    ['c', new ActuatorOperator({ actuate: async (x) => `out:${x}` })],
  ])
  const ex = new GraphExecutor(g, ops)
  const { output } = await ex.runTo(null, 'b')
  assert.equal(output, 15)
})

// ── cycle graph rejected ────────────────────────────────

test('cycle graph cannot execute', async () => {
  const g = new Graph({ directed: true, allowCycles: true })
  g.addNode('a', { type: 'nn' })
  g.addNode('b', { type: 'nn' })
  g.addEdge('a', 'b')
  g.addEdge('b', 'a') // 手动造环（allowCycles=true 时 addEdge 不拦截）

  const ops = new Map([
    ['a', new NnOperator({ model: async (x) => x })],
    ['b', new NnOperator({ model: async (x) => x })],
  ])
  const ex = new GraphExecutor(g, ops)
  await assert.rejects(() => ex.run(), /cycle/)
})

// ── executor requires operators for connected nodes ────

test('missing operator for connected node throws at construction', () => {
  const g = new Graph({ directed: true })
  g.addNode('a', { type: 'nn' })
  g.addNode('b', { type: 'nn' })
  g.addEdge('a', 'b')
  const ops = new Map([['a', new NnOperator({ model: async (x) => x })]])
  assert.throws(() => new GraphExecutor(g, ops), /no operator/)
})

// ── reset clears state ──────────────────────────────────

test('reset clears trace and memory', async () => {
  const g = new Graph({ directed: true })
  g.addNode('m', { type: 'memory' })
  const ops = new Map([
    ['m', new MemoryOperator({ mode: 'write', key: 'k' })],
  ])
  const ex = new GraphExecutor(g, ops)
  await ex.run('val')
  assert.ok(ex.trace().length > 0)
  assert.ok(ex.memory.size > 0)
  ex.reset()
  assert.equal(ex.trace().length, 0)
  assert.equal(ex.memory.size, 0)
})
