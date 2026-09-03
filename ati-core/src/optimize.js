// ati-core · 微积分 & 优化子模块
// 数值梯度 + 梯度下降（后续可扩展 autodiff）

/** 中心差分数值梯度 */
export function numericalGradient(f, x, eps = 1e-6) {
  const n = x.length
  const g = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    const xp = [...x]; const xm = [...x]
    xp[i] += eps; xm[i] -= eps
    g[i] = (f(xp) - f(xm)) / (2 * eps)
  }
  return g
}

/** 基础梯度下降（带动量） */
export function gradientDescent(f, x0, {
  lr = 0.01,
  maxIter = 1000,
  tol = 1e-8,
  momentum = 0.9,
} = {}) {
  let x = [...x0]
  let v = new Array(x.length).fill(0)
  let iter = 0
  for (; iter < maxIter; iter++) {
    const g = numericalGradient(f, x)
    let maxDelta = 0
    for (let i = 0; i < x.length; i++) {
      v[i] = momentum * v[i] - lr * g[i]
      x[i] += v[i]
      maxDelta = Math.max(maxDelta, Math.abs(v[i]))
    }
    if (maxDelta < tol) break
  }
  return { x, value: f(x), iterations: iter }
}

/** 简单 SGD 别名，语义上更贴近深度学习习惯 */
export const sgd = gradientDescent

/**
 * 反向传播自动微分的极简版：只支持标量输出 + 逐节点 tape
 * 用于教学/验证；生产建议换真实 autodiff 库
 */
export function makeScalar(value, requiresGrad = false) {
  return { value, grad: 0, _parents: [], _op: null, requiresGrad }
}

function backward(node) {
  const topo = []
  const visited = new Set()
  const build = (n) => {
    if (visited.has(n)) return
    visited.add(n)
    if (Array.isArray(n._parents)) {
      for (const pair of n._parents) {
        if (Array.isArray(pair)) build(pair[0])
        else build(pair)
      }
    }
    topo.push(n)
  }
  build(node)
  node.grad = 1
  for (let i = topo.length - 1; i >= 0; i--) {
    const n = topo[i]
    if (!Array.isArray(n._parents)) continue
    for (const pair of n._parents) {
      if (!Array.isArray(pair)) continue
      const [parent, localGrad] = pair
      parent.grad += localGrad * n.grad
    }
  }
}

export function scalarAdd(a, b) {
  const out = makeScalar(a.value + b.value)
  out._parents = [[a, 1], [b, 1]]
  return out
}
export function scalarMul(a, b) {
  const out = makeScalar(a.value * b.value)
  out._parents = [[a, b.value], [b, a.value]]
  return out
}
export function scalarBackward(root) { backward(root) }
