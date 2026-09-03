import test from 'node:test'
import assert from 'node:assert/strict'
import { numericalGradient, gradientDescent, makeScalar, scalarAdd, scalarMul, scalarBackward } from '../src/optimize.js'

test('numerical gradient of x²+y²', () => {
  const f = (x) => x[0] ** 2 + x[1] ** 2
  const g = numericalGradient(f, [3, 4])
  assert.ok(Math.abs(g[0] - 6) < 1e-4)
  assert.ok(Math.abs(g[1] - 8) < 1e-4)
})

test('gradient descent converges to origin', () => {
  const f = (x) => (x[0] - 2) ** 2 + (x[1] + 3) ** 2
  const { x, value } = gradientDescent(f, [0, 0], { lr: 0.05, maxIter: 5000 })
  assert.ok(Math.abs(x[0] - 2) < 0.01)
  assert.ok(Math.abs(x[1] + 3) < 0.01)
  assert.ok(value < 0.001)
})

test('scalar autodiff: d/dx of (x*x) at x=3 is 6', () => {
  const x = makeScalar(3)
  const y = scalarMul(x, x)
  scalarBackward(y)
  assert.equal(y.value, 9)
  assert.ok(Math.abs(x.grad - 6) < 1e-12)
})

test('scalar autodiff chain', () => {
  const a = makeScalar(2)
  const b = makeScalar(3)
  // f = a*b + a = 6 + 2 = 8
  const mul = scalarMul(a, b)
  const sum = scalarAdd(mul, a)
  scalarBackward(sum)
  assert.equal(sum.value, 8)
  // df/da = b*da + da = 3+1=4
  assert.ok(Math.abs(a.grad - 4) < 1e-12)
  // df/db = a = 2
  assert.ok(Math.abs(b.grad - 2) < 1e-12)
})
