import test from 'node:test'
import assert from 'node:assert/strict'
import {
  Operator, NnOperator, LogicOperator, ToolOperator,
  MemoryOperator, SensorOperator, ActuatorOperator,
  registerOperator, createOperator,
} from '../src/operators.js'

// ── NN 算子 ─────────────────────────────────────────────

test('NnOperator requires model function', () => {
  assert.throws(() => new NnOperator({}), /requires config\.model/)
})

test('NnOperator forwards to model', async () => {
  const op = new NnOperator({
    model: async (x) => x * 2,
    name: 'double',
  })
  const out = await op.forward(21, {})
  assert.equal(out, 42)
  assert.equal(op.stats().calls, 1)
})

test('NnOperator records inference error', async () => {
  const op = new NnOperator({
    model: async () => { throw new Error('model crashed') },
  })
  await assert.rejects(() => op.forward(1, {}), /model crashed/)
  assert.ok(op.stats().lastError)
})

// ── Logic 算子 ──────────────────────────────────────────

test('LogicOperator routes true branch', async () => {
  const op = new LogicOperator({
    condition: (x) => x > 10,
    trueTarget: 'big',
    falseTarget: 'small',
  })
  const out = await op.forward(15, {})
  assert.equal(out.branch, 'true')
  assert.equal(out.value, 15)
})

test('LogicOperator routes false branch', async () => {
  const op = new LogicOperator({ condition: (x) => x > 10 })
  const out = await op.forward(5, {})
  assert.equal(out.branch, 'false')
})

test('LogicOperator with transform', async () => {
  const op = new LogicOperator({
    condition: () => true,
    transform: (x) => x.toUpperCase(),
  })
  const out = await op.forward('hello', {})
  assert.equal(out.value, 'HELLO')
})

// ── Tool 算子 ───────────────────────────────────────────

test('ToolOperator executes tool', async () => {
  const op = new ToolOperator({
    execute: async (x) => `result:${x}`,
    name: 'fetcher',
  })
  const out = await op.forward('data', {})
  assert.equal(out, 'result:data')
})

test('ToolOperator timeout', async () => {
  const op = new ToolOperator({
    execute: () => new Promise(() => {}), // never resolves
    timeoutMs: 50,
  })
  await assert.rejects(() => op.forward(null, {}), /timeout/)
})

// ── Memory 算子 ─────────────────────────────────────────

test('MemoryOperator write mode', async () => {
  const mem = new Map()
  const op = new MemoryOperator({ mode: 'write', key: 'k1' })
  const out = await op.forward('hello', { memory: mem })
  assert.equal(mem.get('k1'), 'hello')
  assert.equal(out.written, 'k1')
})

test('MemoryOperator read mode hit', async () => {
  const mem = new Map([['k1', 'stored']])
  const op = new MemoryOperator({ mode: 'read', key: 'k1' })
  const out = await op.forward(null, { memory: mem })
  assert.equal(out, 'stored')
})

test('MemoryOperator read mode miss returns default', async () => {
  const mem = new Map()
  const op = new MemoryOperator({ mode: 'read', key: 'nope', defaultValue: 'fallback' })
  const out = await op.forward(null, { memory: mem })
  assert.equal(out, 'fallback')
})

test('MemoryOperator read-write returns previous', async () => {
  const mem = new Map([['k', 'old']])
  const op = new MemoryOperator({ mode: 'read-write', key: 'k' })
  const out = await op.forward('new', { memory: mem })
  assert.equal(out.previous, 'old')
  assert.equal(out.current, 'new')
  assert.equal(mem.get('k'), 'new')
})

test('MemoryOperator dynamic key function', async () => {
  const mem = new Map()
  const op = new MemoryOperator({ mode: 'write', key: (input) => `prefix-${input}` })
  await op.forward('abc', { memory: mem })
  assert.equal(mem.get('prefix-abc'), 'abc')
})

test('MemoryOperator rejects non-Map ctx.memory', async () => {
  const op = new MemoryOperator({ mode: 'read', key: 'k' })
  await assert.rejects(() => op.forward(null, { memory: 'not-a-map' }), /must be a Map/)
})

// ── Sensor / Actuator ───────────────────────────────────

test('SensorOperator pulls from source', async () => {
  let count = 0
  const op = new SensorOperator({ source: () => ++count })
  const a = await op.forward(null, {})
  const b = await op.forward(null, {})
  assert.equal(a, 1)
  assert.equal(b, 2)
})

test('ActuatorOperator pushes to sink', async () => {
  const received = []
  const op = new ActuatorOperator({ actuate: async (x) => { received.push(x); return 'done' } })
  const out = await op.forward('go', {})
  assert.equal(out, 'done')
  assert.deepEqual(received, ['go'])
})

// ── 注册表 ──────────────────────────────────────────────

test('createOperator from registry', () => {
  const op = createOperator('nn', { model: async (x) => x })
  assert.ok(op instanceof NnOperator)
})

test('createOperator unknown type throws', () => {
  assert.throws(() => createOperator('nope', {}), /no operator registered/)
})

test('registerOperator custom type', async () => {
  class EchoOp extends Operator {
    async forward(input) { this._record(input); return `echo:${input}` }
  }
  registerOperator('echo', EchoOp)
  const op = createOperator('echo', {})
  assert.equal(await op.forward('hi', {}), 'echo:hi')
})
