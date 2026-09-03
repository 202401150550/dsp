/**
 * RoPE（二维成对旋转）— 纯数值原型，不绑框架。
 * 约定：向量偶数维；位置 pos 为非负整数或实数。
 */
import { clone, l2, zeros } from './math.mjs'

export function ropeAngles(dim, pos, theta = 10000) {
  const half = dim >> 1
  const angles = new Float64Array(half)
  for (let i = 0; i < half; i++) {
    const freq = 1 / (theta ** (2 * i / dim))
    angles[i] = pos * freq
  }
  return angles
}

/** 就地或返回新向量：对 (2i,2i+1) 做旋转 */
export function applyRope(vec, pos, theta = 10000, out = null) {
  const dim = vec.length
  if (dim % 2 !== 0) throw new Error('RoPE requires even dim')
  const y = out || clone(vec)
  if (out) {
    for (let i = 0; i < dim; i++) out[i] = vec[i]
  }
  const half = dim >> 1
  for (let i = 0; i < half; i++) {
    const freq = 1 / (theta ** (2 * i / dim))
    const ang = pos * freq
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    const a = vec[2 * i]
    const b = vec[2 * i + 1]
    y[2 * i] = a * c - b * s
    y[2 * i + 1] = a * s + b * c
  }
  return y
}

/** 逆旋转 = applyRope(vec, -pos) */
export function invertRope(vec, pos, theta = 10000, out = null) {
  return applyRope(vec, -pos, theta, out)
}

/** 正交性：||RoPE(x)|| ≈ ||x|| */
export function ropeNormError(vec, pos, theta = 10000) {
  const n0 = l2(vec)
  const y = applyRope(vec, pos, theta)
  const n1 = l2(y)
  return Math.abs(n0 - n1)
}

/** 可逆性：invert(apply(x)) ≈ x */
export function ropeInvertError(vec, pos, theta = 10000) {
  const y = applyRope(vec, pos, theta)
  const z = invertRope(y, pos, theta)
  return l2(z, vec)
}

/**
 * 朴素「先均值再 RoPE」vs「先 RoPE 再均值」的位置不一致度量。
 * 神经压缩必须正视该间隙；L2 选用 rope-then-pool 作为可自洽路径。
 */
export function ropePoolInconsistency(vecs, positions, theta = 10000) {
  if (!vecs.length) return 0
  const dim = vecs[0].length
  const meanThen = zeros(dim)
  const ropeThen = zeros(dim)
  let meanPos = 0
  for (let i = 0; i < vecs.length; i++) {
    meanPos += positions[i]
    const r = applyRope(vecs[i], positions[i], theta)
    for (let d = 0; d < dim; d++) {
      meanThen[d] += vecs[i][d]
      ropeThen[d] += r[d]
    }
  }
  const n = vecs.length
  meanPos /= n
  for (let d = 0; d < dim; d++) {
    meanThen[d] /= n
    ropeThen[d] /= n
  }
  const meanRope = applyRope(meanThen, meanPos, theta)
  return l2(meanRope, ropeThen)
}
