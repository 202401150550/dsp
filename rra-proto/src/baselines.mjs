/**
 * 字节匹配基线（无训练、无权重）。
 * 每条策略在同一 byteBudget 下选择保留集合，再打保留分。
 */

const ENC = new TextEncoder()

export function tokenBytes(tok) {
  try {
    return ENC.encode(JSON.stringify(tok)).length
  } catch {
    return 0
  }
}

/**
 * 合成因果序列：近处密集普通 token，远处插入可检索地标。
 * @param {{ length?: number, landmarkEvery?: number, now?: number }} [opts]
 */
export function synthesizeSequence(opts = {}) {
  const length = Math.max(32, Math.min(50_000, Number(opts.length) || 512))
  const landmarkEvery = Math.max(8, Number(opts.landmarkEvery) || 64)
  const now = Number.isFinite(opts.now) ? opts.now : 1_000_000
  const tokens = []
  for (let i = 0; i < length; i++) {
    const age = length - 1 - i
    const isLandmark = i > 0 && i % landmarkEvery === 0
    tokens.push({
      id: `t${i}`,
      i,
      age,
      kind: isLandmark ? 'landmark' : 'plain',
      text: isLandmark ? `LANDMARK_${i}_SIGNAL` : `tok_${i}_pad_${'x'.repeat(8)}`,
      ts: now - age * 1000,
    })
  }
  return tokens
}

function selectWithinBudget(candidates, budget, scoreFn) {
  const ranked = candidates
    .map((t) => ({ t, score: scoreFn(t), bytes: tokenBytes(t) }))
    .sort((a, b) => b.score - a.score || a.t.age - b.t.age)
  const kept = []
  let used = 0
  for (const row of ranked) {
    if (used + row.bytes > budget) continue
    kept.push(row.t)
    used += row.bytes
  }
  kept.sort((a, b) => a.i - b.i)
  return { kept, usedBytes: used }
}

/** 全量精确（常超预算；报告里标 overflow） */
export function baselineFullExact(tokens, budget) {
  const used = tokens.reduce((s, t) => s + tokenBytes(t), 0)
  return {
    id: 'full-exact',
    label: '全量精确',
    kept: tokens.slice(),
    usedBytes: used,
    withinBudget: used <= budget,
    note: '质量上界参考；通常超出字节预算',
  }
}

/** 只保留最近窗口，直到预算用尽 */
export function baselineFixedWindow(tokens, budget) {
  const kept = []
  let used = 0
  for (let i = tokens.length - 1; i >= 0; i--) {
    const b = tokenBytes(tokens[i])
    if (used + b > budget) break
    kept.push(tokens[i])
    used += b
  }
  kept.reverse()
  return {
    id: 'fixed-window',
    label: '固定近窗',
    kept,
    usedBytes: used,
    withinBudget: used <= budget,
    note: '经典淘汰基线：只留最近',
  }
}

/** 均匀抽稀，再按预算截断 */
export function baselineUniformStride(tokens, budget) {
  const targetCount = Math.max(1, Math.floor(budget / Math.max(1, tokenBytes(tokens[0] || { text: 'x' }))))
  const stride = Math.max(1, Math.ceil(tokens.length / targetCount))
  const candidates = tokens.filter((_, i) => i % stride === 0 || i === tokens.length - 1)
  const { kept, usedBytes } = selectWithinBudget(candidates, budget, (t) => (t.kind === 'landmark' ? 2 : 1) + 1 / (1 + t.age))
  return {
    id: 'uniform-stride',
    label: '均匀抽稀',
    kept,
    usedBytes,
    withinBudget: usedBytes <= budget,
    note: `stride≈${stride}`,
  }
}

/**
 * 壳层幂律代理：score ∝ (1+age/tau)^(-alpha)，地标加权。
 * 不是神经 RRA。
 */
export function baselinePowerLawShell(tokens, budget, cfg = {}) {
  const tau = Math.max(1, Number(cfg.tau) || 64)
  const alpha = Math.max(0.1, Number(cfg.alpha) || 1)
  const { kept, usedBytes } = selectWithinBudget(tokens, budget, (t) => {
    const dens = (1 + t.age / tau) ** (-alpha)
    const boost = t.kind === 'landmark' ? 1.5 : 1
    return dens * boost
  })
  return {
    id: 'power-law-shell',
    label: '幂律壳代理',
    kept,
    usedBytes,
    withinBudget: usedBytes <= budget,
    note: 'ow-rrm 叙事代理 · 非神经 RRA · 禁止当作已训模型',
    cfg: { tau, alpha },
  }
}

export function scoreRetention(tokens, kept) {
  const keepSet = new Set(kept.map((t) => t.id))
  const landmarks = tokens.filter((t) => t.kind === 'landmark')
  const recentN = Math.min(32, tokens.length)
  const recent = tokens.slice(-recentN)
  const landmarkHit = landmarks.length
    ? landmarks.filter((t) => keepSet.has(t.id)).length / landmarks.length
    : 1
  const recentHit = recent.length
    ? recent.filter((t) => keepSet.has(t.id)).length / recent.length
    : 1
  const coverage = tokens.length ? kept.length / tokens.length : 0
  // 简单合成分：近史权重大，地标次之
  const score = 0.55 * recentHit + 0.35 * landmarkHit + 0.1 * coverage
  return {
    keptCount: kept.length,
    coverage: round4(coverage),
    recentHit: round4(recentHit),
    landmarkHit: round4(landmarkHit),
    score: round4(score),
  }
}

function round4(n) {
  return Math.round(n * 10000) / 10000
}

export function runByteMatchedBench(opts = {}) {
  const length = Number(opts.length) || 512
  const budget = Number(opts.byteBudget) || 24_000
  const tau = Number(opts.tau) || 64
  const alpha = Number(opts.alpha) || 1
  const tokens = synthesizeSequence({ length, landmarkEvery: opts.landmarkEvery || 64 })
  const totalBytes = tokens.reduce((s, t) => s + tokenBytes(t), 0)

  const runners = [
    () => baselineFullExact(tokens, budget),
    () => baselineFixedWindow(tokens, budget),
    () => baselineUniformStride(tokens, budget),
    () => baselinePowerLawShell(tokens, budget, { tau, alpha }),
  ]

  const rows = runners.map((fn) => {
    const base = fn()
    const retention = scoreRetention(tokens, base.kept)
    return {
      id: base.id,
      label: base.label,
      note: base.note,
      usedBytes: base.usedBytes,
      withinBudget: base.withinBudget,
      budgetUtilization: round4(base.usedBytes / budget),
      ...retention,
      neural: false,
    }
  })

  const fair = rows.filter((r) => r.withinBudget && r.id !== 'full-exact')
  const winner = fair.slice().sort((a, b) => b.score - a.score || a.usedBytes - b.usedBytes)[0] || null

  return {
    ok: true,
    stage: 'L1',
    protocol: 'rra/0.1-proto-baseline',
    implemented: false,
    hasWeights: false,
    disclaimer: '字节匹配基线对照；非神经 RRA 质量声明',
    input: {
      length: tokens.length,
      totalBytes,
      byteBudget: budget,
      tau,
      alpha,
      landmarkCount: tokens.filter((t) => t.kind === 'landmark').length,
    },
    rows,
    winnerFair: winner
      ? { id: winner.id, label: winner.label, score: winner.score, usedBytes: winner.usedBytes }
      : null,
    generatedAt: new Date().toISOString(),
  }
}
