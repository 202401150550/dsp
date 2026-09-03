import test from 'node:test'
import assert from 'node:assert/strict'
import { Vec, Mat } from '../src/linalg.js'

test('Vec dot product', () => {
  const a = new Vec([1, 2, 3])
  const b = new Vec([4, 5, 6])
  assert.equal(a.dot(b), 32)
})

test('Vec norm and normalize', () => {
  const v = new Vec([3, 4])
  assert.equal(v.norm(), 5)
  const n = v.normalize()
  assert.ok(Math.abs(n.norm() - 1) < 1e-12)
})

test('Mat transpose', () => {
  const m = new Mat([[1, 2], [3, 4]])
  const t = m.T()
  assert.equal(t.get(0, 0), 1)
  assert.equal(t.get(0, 1), 3)
  assert.equal(t.get(1, 0), 2)
  assert.equal(t.get(1, 1), 4)
})

test('Mat matmul', () => {
  const a = new Mat([[1, 2], [3, 4]])
  const b = new Mat([[5, 6], [7, 8]])
  const c = a.mulMat(b)
  // [[19,22],[43,50]]
  assert.deepEqual(c.toArray(), [[19, 22], [43, 50]])
})

test('Mat determinant', () => {
  const m = new Mat([[1, 2], [3, 4]])
  assert.ok(Math.abs(m.det() - (-2)) < 1e-10)
})

test('Mat inverse', () => {
  const m = new Mat([[4, 7], [2, 6]])
  const inv = m.inv()
  const identity = m.mulMat(inv)
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      assert.ok(Math.abs(identity.get(i, j) - (i === j ? 1 : 0)) < 1e-10)
})

test('Mat trace', () => {
  const m = Mat.diag([5, 3, 2])
  assert.equal(m.trace(), 10)
})
