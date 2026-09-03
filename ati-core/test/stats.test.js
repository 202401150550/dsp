import test from 'node:test'
import assert from 'node:assert/strict'
import { entropy, klDivergence, jsDivergence, softmax, mean, std } from '../src/stats.js'

test('entropy of uniform distribution (2 outcomes)', () => {
  const h = entropy([0.5, 0.5])
  assert.ok(Math.abs(h - Math.log(2)) < 1e-12)
})

test('entropy of certain event is 0', () => {
  assert.equal(entropy([1, 0]), 0)
})

test('KL divergence of identical distributions is 0', () => {
  const p = [0.3, 0.7]
  assert.ok(Math.abs(klDivergence(p, p)) < 1e-12)
})

test('KL divergence non-negative', () => {
  const d = klDivergence([0.8, 0.2], [0.5, 0.5])
  assert.ok(d > 0)
})

test('JS divergence symmetric and bounded', () => {
  const p = [0.9, 0.1]
  const q = [0.1, 0.9]
  const d1 = jsDivergence(p, q)
  const d2 = jsDivergence(q, p)
  assert.ok(Math.abs(d1 - d2) < 1e-12)
  assert.ok(d1 > 0 && d1 < Math.log(2) + 1e-6)
})

test('softmax sums to 1 and respects ordering', () => {
  const s = softmax([2, 1, 0])
  assert.ok(Math.abs(s.reduce((a, b) => a + b, 0) - 1) < 1e-12)
  assert.ok(s[0] > s[1] && s[1] > s[2])
})

test('softmax with high temperature flattens', () => {
  const s = softmax([10, 0], 100)
  assert.ok(s[0] / s[1] < 2)
})

test('mean and std', () => {
  const xs = [1, 2, 3, 4, 5]
  assert.equal(mean(xs), 3)
  assert.ok(std(xs, 1) > 1.5 && std(xs, 1) < 2)
})
