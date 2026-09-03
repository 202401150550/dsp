// ati-core · 概率统计子模块

export function mean(xs) {
  if (!xs.length) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function variance(xs, ddof = 0) {
  if (xs.length <= ddof) return 0
  const m = mean(xs)
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - ddof)
}

export function std(xs, ddof = 0) { return Math.sqrt(variance(xs, ddof)) }

export function normalizeDistribution(p) {
  const s = p.reduce((a, b) => a + b, 0)
  if (s === 0) throw new Error('cannot normalize zero distribution')
  return p.map((v) => v / s)
}

/** Shannon 熵（可选底数） */
export function entropy(p, base = Math.E) {
  if (p.some((v) => v < 0)) throw new RangeError('probabilities must be ≥ 0')
  let h = 0
  for (const pi of p) {
    if (pi === 0) continue
    h -= pi * Math.log(pi)
  }
  return base === Math.E ? h : h / Math.log(base)
}

/** KL(p ‖ q)，要求 p、q 同长且已归一化 */
export function klDivergence(p, q, base = Math.E) {
  if (p.length !== q.length) throw new RangeError('p and q must have same length')
  let d = 0
  for (let i = 0; i < p.length; i++) {
    if (p[i] === 0) continue
    if (q[i] === 0) return Infinity
    d += p[i] * Math.log(p[i] / q[i])
  }
  return base === Math.E ? d : d / Math.log(base)
}

/** JS 散度（对称版） */
export function jsDivergence(p, q, base = Math.E) {
  const m = p.map((v, i) => (v + q[i]) / 2)
  return 0.5 * klDivergence(p, m, base) + 0.5 * klDivergence(q, m, base)
}

/** Box-Muller 正态采样 */
export function sampleNormal(mu = 0, sigma = 1) {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function sampleUniform(lo = 0, hi = 1) { return lo + Math.random() * (hi - lo) }

/** softmax，带温度 */
export function softmax(logits, temperature = 1.0) {
  const t = Math.max(temperature, 1e-8)
  const scaled = logits.map((l) => l / t)
  const maxV = Math.max(...scaled)
  const exps = scaled.map((v) => Math.exp(v - maxV))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}
