/** 小型向量/矩阵工具（无第三方依赖） */

export function zeros(n) {
  return new Float64Array(n)
}

export function randn(n, scale = 0.1) {
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    // Box-Muller
    const u = 1 - Math.random()
    const v = Math.random()
    out[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * scale
  }
  return out
}

export function clone(v) {
  return Float64Array.from(v)
}

export function addInPlace(a, b, scale = 1) {
  for (let i = 0; i < a.length; i++) a[i] += b[i] * scale
  return a
}

export function scaleInPlace(a, s) {
  for (let i = 0; i < a.length; i++) a[i] *= s
  return a
}

export function axpy(out, a, x, b = null) {
  for (let i = 0; i < out.length; i++) out[i] = a * x[i] + (b ? b[i] : 0)
  return out
}

export function dot(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

export function l2(a, b = null) {
  let s = 0
  if (b) {
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i]
      s += d * d
    }
  } else {
    for (let i = 0; i < a.length; i++) s += a[i] * a[i]
  }
  return Math.sqrt(s)
}

export function meanVec(list) {
  if (!list.length) return zeros(0)
  const out = zeros(list[0].length)
  for (const v of list) addInPlace(out, v, 1)
  scaleInPlace(out, 1 / list.length)
  return out
}

/** y = W @ x ；W 行优先，shape [outDim, inDim] */
export function matVec(W, outDim, inDim, x) {
  const y = zeros(outDim)
  for (let i = 0; i < outDim; i++) {
    let s = 0
    const row = i * inDim
    for (let j = 0; j < inDim; j++) s += W[row + j] * x[j]
    y[i] = s
  }
  return y
}

/** 累加 dW += outer(gy, x) */
export function outerAdd(dW, outDim, inDim, gy, x, scale = 1) {
  for (let i = 0; i < outDim; i++) {
    const row = i * inDim
    const g = gy[i] * scale
    for (let j = 0; j < inDim; j++) dW[row + j] += g * x[j]
  }
}

/** gx += W^T @ gy */
export function matVecTAdd(gx, W, outDim, inDim, gy, scale = 1) {
  for (let i = 0; i < outDim; i++) {
    const row = i * inDim
    const g = gy[i] * scale
    for (let j = 0; j < inDim; j++) gx[j] += W[row + j] * g
  }
}

export function sgdStep(W, dW, lr, weightDecay = 0) {
  for (let i = 0; i < W.length; i++) {
    W[i] -= lr * (dW[i] + weightDecay * W[i])
    dW[i] = 0
  }
}
