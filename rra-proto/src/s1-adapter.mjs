/**
 * 阶段 1 · 可训练记忆适配器（论文 6.2 可训练组件清单）。
 * - 压缩器：kind = 'mean'（冻结规则）| 'query'（学习查询压缩器）| 'gate'（学习门控压缩器）
 * - 记忆元数据嵌入 + logit 偏置（按读出时对数时龄层）
 * - 逐层级门控（sigmoid 标量）
 * - 低秩注意力读出（Wq/Wk/Wv；其贡献单独报告，论文 6.2「可选低秩注意力适配」）
 * 损失：对齐源词元位置上的隐藏状态匹配（0.5·||hWin + out − hFull||²）；
 * 不给记忆槽位虚构词元目标。全部手写梯度；骨干权重不进更新列表。
 */
import { zeros, addInPlace, matVec, matVecTAdd, outerAdd, sgdStep, dot, l2 } from './math.mjs'
import { mulberry32, randnSeeded, softmaxInPlace, sigmoid, sigmoidGrad } from './s1-backbone.mjs'

export function createS1Adapter({
  dim = 32,
  codeDim = 8,
  nTiers = 4,
  kind = 'query',
  seed = 11,
  /** >1：显著槽位模偏置（学 trueEvery 周期，破等范数对称） */
  nSlotMod = 1,
} = {}) {
  if (!['mean', 'query', 'gate'].includes(kind)) throw new Error(`unknown compressor kind: ${kind}`)
  // 分组独立种子：不同 kind 的读出/元数据初始化逐位一致（配对公平）
  const rngComp = mulberry32(seed)
  const rngRead = mulberry32(seed + 1)
  const rngMeta = mulberry32(seed + 2)
  const scale = 0.25 / Math.sqrt(dim)
  const slotMods = Math.max(1, Math.floor(nSlotMod))
  // 压缩器参数（'mean' 分支整体为冻结规则，不训练）
  const comp = { Wdown: randnSeeded(codeDim * dim, 0.15, rngComp) }
  // 对角增益偏置：让码一开始就近似「取前 codeDim 维」，读出有非零起点
  for (let i = 0; i < Math.min(codeDim, dim); i++) comp.Wdown[i * dim + i] += 0.5
  if (kind === 'query') comp.q = randnSeeded(dim, 0.1, rngComp)
  if (kind === 'gate') {
    const g = randnSeeded(dim, 0.1, rngComp)
    for (let i = 0; i < dim; i++) g[i] += 0.5
    comp.g = g
  }
  // 低秩读出
  const read = {
    Wq: randnSeeded(dim * dim, scale, rngRead),
    Wk: randnSeeded(dim * codeDim, scale, rngRead),
    Wv: randnSeeded(dim * codeDim, scale, rngRead),
  }
  for (let i = 0; i < Math.min(codeDim, dim); i++) read.Wv[i * codeDim + i] += 0.5
  // 元数据嵌入 + logit 偏置 + 逐层门控（raw → sigmoid）
  // 轴：时龄层 × 显著性 ×（可选）显著槽位模
  const meta = {
    tierEmbed: randnSeeded(nTiers * dim, 0.05, rngMeta),
    tierLogit: new Float64Array(nTiers),
    tierGate: new Float64Array(nTiers),
    salEmbed: randnSeeded(2 * dim, 0.05, rngMeta),
    salLogit: new Float64Array(2),
    salGate: new Float64Array(2),
    slotEmbed: randnSeeded(slotMods * dim, 0.05, rngMeta),
    slotLogit: new Float64Array(slotMods),
    slotGate: new Float64Array(slotMods),
  }
  // 软先验：略抬高 residue0（trueEvery 周期真点），加速等范数学习；可被训练改写
  if (slotMods > 1) {
    meta.slotLogit[0] = 1.0
    for (let i = 1; i < slotMods - 1; i++) meta.slotLogit[i] = -0.3
    meta.slotLogit[slotMods - 1] = -0.8 // other
  }
  const grads = {}
  for (const [group, tensors] of [['comp', comp], ['read', read], ['meta', meta]]) {
    for (const [name, w] of Object.entries(tensors)) grads[`${group}.${name}`] = zeros(w.length)
  }
  const count = (tensors) => Object.values(tensors).reduce((a, w) => a + w.length, 0)
  return {
    dim, codeDim, nTiers, nSlotMod: slotMods, kind, seed,
    comp, read, meta, grads,
    paramCount: count(comp) + count(read) + count(meta),
    paramBytes: (count(comp) + count(read) + count(meta)) * 8,
    trainable: kind !== 'mean',
    salientThreshold: 1.0, // 冻结显著性阈值：pooledNorm² > 1（噪声组 ~0.16，显著组 ≥6）
    kindName: `s1-adapter/${kind}`,
    note: '阶段1适配器 · 手写梯度 · 骨干冻结',
  }
}

/** 显著槽位模：优先用条目块内显著 token 位置；否则就近取整到 salientEvery 网格 */
export function slotModOf(pos, salientEvery, nSlotMod) {
  if (!nSlotMod || nSlotMod <= 1 || !salientEvery) return 0
  const p = Math.round(Number(pos))
  if (p % salientEvery === 0) return Math.floor(p / salientEvery) % nSlotMod
  const nearest = Math.round(p / salientEvery) * salientEvery
  if (Math.abs(p - nearest) <= Math.max(1, Math.floor(salientEvery / 4))) {
    return Math.floor(Math.max(0, nearest) / salientEvery) % nSlotMod
  }
  return 0
}

/** 从压缩条目还原块内显著点的槽位模；无显著点 → other 桶（nSlotMod-1） */
export function slotModFromEntry(entry, salientEvery, nSlotMod) {
  if (!nSlotMod || nSlotMod <= 1 || !salientEvery || !entry) return 0
  const nTrue = nSlotMod > 1 ? nSlotMod - 1 : 1 // 最后一桶留给非显著
  const hi = Math.floor(entry.maxPos)
  const lo = Math.max(0, hi - Math.max(1, entry.count || 1) + 1)
  for (let p = lo; p <= hi; p++) {
    if (p % salientEvery === 0) return Math.floor(p / salientEvery) % nTrue
  }
  return nSlotMod - 1
}

export function zeroGrads(adapter) {
  for (const g of Object.values(adapter.grads)) g.fill(0)
}

function copyF64(src) {
  return Float64Array.from(src)
}

function toArr(src) {
  return Array.from(src)
}

/**
 * 适配器权重快照（JSON 可序列化）。不含梯度；玩具尺度训→存→载用。
 */
export function snapshotS1Adapter(adapter) {
  if (!adapter) throw new Error('snapshotS1Adapter: missing adapter')
  const pack = (tensors) => {
    const o = {}
    for (const [k, v] of Object.entries(tensors)) o[k] = toArr(v)
    return o
  }
  return {
    protocol: 'rra/0.10-s1-adapter-weights',
    dim: adapter.dim,
    codeDim: adapter.codeDim,
    nTiers: adapter.nTiers,
    nSlotMod: adapter.nSlotMod,
    kind: adapter.kind,
    seed: adapter.seed,
    trained: adapter.trained === true,
    salientThreshold: adapter.salientThreshold,
    paramCount: adapter.paramCount,
    comp: pack(adapter.comp),
    read: pack(adapter.read),
    meta: pack(adapter.meta),
    note: 'S1 adapter weights · toy scale · not production neural RRA',
  }
}

/**
 * 从快照恢复适配器（新对象；梯度清零）。
 */
export function restoreS1Adapter(snap) {
  if (!snap || snap.protocol !== 'rra/0.10-s1-adapter-weights') {
    throw new Error('restoreS1Adapter: bad protocol')
  }
  const adapter = createS1Adapter({
    dim: snap.dim,
    codeDim: snap.codeDim,
    nTiers: snap.nTiers,
    nSlotMod: snap.nSlotMod,
    kind: snap.kind,
    seed: snap.seed,
  })
  const load = (dst, src) => {
    for (const [k, arr] of Object.entries(src || {})) {
      if (!dst[k] || dst[k].length !== arr.length) {
        throw new Error(`restoreS1Adapter: shape mismatch ${k}`)
      }
      dst[k].set(copyF64(arr))
    }
  }
  load(adapter.comp, snap.comp)
  load(adapter.read, snap.read)
  load(adapter.meta, snap.meta)
  adapter.trained = snap.trained === true
  adapter.salientThreshold = snap.salientThreshold ?? adapter.salientThreshold
  zeroGrads(adapter)
  return adapter
}

/** 两适配器权重最大绝对差（诊断用） */
export function maxAbsWeightDiff(a, b) {
  let m = 0
  for (const group of ['comp', 'read', 'meta']) {
    for (const k of Object.keys(a[group])) {
      const x = a[group][k]
      const y = b[group][k]
      if (!y || y.length !== x.length) return Infinity
      for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - y[i]))
    }
  }
  return m
}

/** SGD 步进可训练张量子集（parts: ['comp','read','meta'] 子组或全部；'mean' 分支禁止调用） */
export function sgdStepAll(adapter, lr, weightDecay = 1e-5, { only = null } = {}) {
  if (!adapter.trainable) throw new Error('mean-kind adapter is a frozen rule, not trainable')
  for (const [key, g] of Object.entries(adapter.grads)) {
    if (only && !only.includes(key)) continue
    const [group, name] = key.split('.')
    sgdStep(adapter[group][name], g, lr, weightDecay)
  }
}

/**
 * 把一组连续 token（vecs+positions）压成一条 codeDim 码。
 * 池化不做 RoPE：S1 骨干是均值池（无位置旋转），读出靠元数据分层，
 * 相对旋转的一致 apply 属 M3（见 PRODUCTION.md）。携带反传所需中间量。
 */
export function compressGroup(adapter, vecs, positions, macs = null) {
  if (!vecs.length) throw new Error('empty group')
  const { dim, codeDim, comp, kind } = adapter
  let pooled
  let poolWeights = null
  let meanPool = null
  let weightEntropy = 0
  if (kind === 'gate') {
    meanPool = zeros(dim)
    for (const r of vecs) addInPlace(meanPool, r, 1)
    for (let d = 0; d < dim; d++) meanPool[d] /= vecs.length
    pooled = zeros(dim)
    for (let d = 0; d < dim; d++) pooled[d] = comp.g[d] * meanPool[d]
  } else if (kind === 'query') {
    const s = new Float64Array(vecs.length)
    for (let i = 0; i < vecs.length; i++) {
      s[i] = dot(comp.q, vecs[i]) / Math.sqrt(dim)
      if (macs) macs.count += dim
    }
    poolWeights = softmaxInPlace(s)
    pooled = zeros(dim)
    for (let i = 0; i < vecs.length; i++) {
      addInPlace(pooled, vecs[i], poolWeights[i])
      weightEntropy += -poolWeights[i] * Math.log(Math.max(1e-12, poolWeights[i]))
    }
  } else {
    pooled = zeros(dim)
    for (const r of vecs) addInPlace(pooled, r, 1)
    for (let d = 0; d < dim; d++) pooled[d] /= vecs.length
  }
  const code = matVec(comp.Wdown, codeDim, dim, pooled)
  if (macs) macs.count += codeDim * dim
  // 显著性元数据（冻结阈值）：携带远处显著 token 的组 vs 纯噪声组
  let pooledNorm2 = 0
  for (let d = 0; d < dim; d++) pooledNorm2 += pooled[d] * pooled[d]
  return {
    code,
    pooled,
    srcVecs: vecs,
    poolWeights,
    meanPool,
    salient: pooledNorm2 > adapter.salientThreshold ? 1 : 0,
    pooledNorm2: Math.round(pooledNorm2 * 1000) / 1000,
    meanPos: positions.reduce((a, b) => a + b, 0) / positions.length,
    maxPos: positions[positions.length - 1],
    count: vecs.length,
    weightEntropy,
  }
}

/** 读出时龄层：tier = floor(log2(age/windowTokens))，夹在 [0, nTiers-1] */
export function tierOf(adapter, age, windowTokens) {
  const b = Math.floor(Math.log2(Math.max(1, age / Math.max(1, windowTokens))))
  return Math.min(adapter.nTiers - 1, Math.max(0, b))
}

/**
 * 前向+反传合一的隐藏状态匹配。
 * 只读 meanPos ≤ t - windowTokens 的条目（窗外才需要记忆；因果约束）。
 * accumulateGrad=true 时手写梯度累加到 adapter.grads。
 */
export function matchingLoss(adapter, entries, hWin, hFull, t, {
  windowTokens = 32,
  accumulateGrad = false,
  macs = null,
  /** 主题 CE 辅助：dirs=投影主题方向，targetTopic=正确类，weight=相对 MSE 权重 */
  topicDirs = null,
  targetTopic = null,
  topicWeight = 0,
  /** 硬注意力：前向 one-hot(argmax)，反传走 softmax（STE）——等范数干扰下软混合会冲掉真点 */
  hardAttn = false,
  /** MSE 权重；0=只靠主题 CE（等范数诊断：避免教师混合态带偏注意力） */
  mseWeight = 1,
  /** 显著槽周期（与 adapter.nSlotMod / corpus.salientEvery 配合） */
  salientEvery = 64,
  /**
   * 注意力模仿：用「单条记忆→目标主题」分数作 teacher（stop-grad），
   * 教策略在等范数下按内容选真点；不依赖 slotMod 周期捷径。
   */
  attnImitateWeight = 0,
} = {}) {
  const { dim, codeDim, comp, read, meta, kind, grads, nSlotMod } = adapter
  const useSlot = nSlotMod > 1
  const dk = dim
  const cutoff = t - windowTokens
  const allowed = entries.filter((e) => e.meanPos <= cutoff)
  const hMem = zeros(dim)
  addInPlace(hMem, hWin)

  if (!allowed.length) {
    // 无记忆可用：hMem = hWin；分支退化为 Sliding
    const d0 = diffOf(hMem, hFull)
    const loss0 = 0.5 * dot(d0, d0)
    return { loss: loss0, absErr: l2(hMem, hFull), relErr: l2(hMem, hFull) / Math.max(1e-8, l2(hFull, hWin)), read: { allowed: 0, out: zeros(dim) } }
  }

  const q = matVec(read.Wq, dim, dim, hWin)
  if (macs) macs.count += dim * dim
  const n = allowed.length
  const keys = new Array(n)
  const tiers = new Int32Array(n)
  const sals = new Int32Array(n)
  const slots = new Int32Array(n)
  const logits = new Float64Array(n)
  for (let j = 0; j < n; j++) {
    const e = allowed[j]
    tiers[j] = tierOf(adapter, t - e.meanPos, windowTokens)
    sals[j] = e.salient ? 1 : 0
    slots[j] = useSlot ? slotModFromEntry(e, salientEvery, nSlotMod) : 0
    const k = matVec(read.Wk, dim, codeDim, e.code)
    if (macs) macs.count += dim * codeDim
    for (let d = 0; d < dim; d++) {
      k[d] += meta.tierEmbed[tiers[j] * dim + d] + meta.salEmbed[sals[j] * dim + d]
      if (useSlot) k[d] += meta.slotEmbed[slots[j] * dim + d]
    }
    keys[j] = k
    logits[j] = dot(q, k) / Math.sqrt(dk) + meta.tierLogit[tiers[j]] + meta.salLogit[sals[j]]
      + (useSlot ? meta.slotLogit[slots[j]] : 0)
  }
  if (macs) macs.count += n * dim
  const aSoft = softmaxInPlace(logits)
  const a = new Float64Array(n)
  let hardIdx = 0
  if (hardAttn) {
    let best = aSoft[0]
    for (let j = 1; j < n; j++) if (aSoft[j] > best) { best = aSoft[j]; hardIdx = j }
    a[hardIdx] = 1
  } else {
    for (let j = 0; j < n; j++) a[j] = aSoft[j]
  }
  const gates = new Float64Array(n)
  for (let j = 0; j < n; j++) {
    let g = sigmoid(meta.tierGate[tiers[j]]) * sigmoid(meta.salGate[sals[j]])
    if (useSlot) g *= sigmoid(meta.slotGate[slots[j]])
    gates[j] = g
  }

  // 内容 oracle 注意力（teacher，stop-grad）
  const dLogitImitate = new Float64Array(n)
  let imitateCe = 0
  if (attnImitateWeight > 0 && topicDirs && targetTopic != null) {
    const oScores = new Float64Array(n)
    let oMax = -Infinity
    for (let j = 0; j < n; j++) {
      const mJ = zeros(codeDim)
      addInPlace(mJ, allowed[j].code, gates[j])
      const oJ = matVec(read.Wv, dim, codeDim, mJ)
      if (macs) macs.count += dim * codeDim
      oScores[j] = dot(oJ, topicDirs[targetTopic])
      if (oScores[j] > oMax) oMax = oScores[j]
    }
    let oZ = 0
    for (let j = 0; j < n; j++) {
      oScores[j] = Math.exp(oScores[j] - oMax)
      oZ += oScores[j]
    }
    let ce = 0
    for (let j = 0; j < n; j++) {
      const aStar = oScores[j] / oZ
      ce += -aStar * Math.log(Math.max(1e-12, aSoft[j]))
      dLogitImitate[j] = attnImitateWeight * (aSoft[j] - aStar)
    }
    imitateCe = attnImitateWeight * ce
  }

  const m = zeros(codeDim)
  for (let j = 0; j < n; j++) addInPlace(m, allowed[j].code, a[j] * gates[j])
  const out = matVec(read.Wv, dim, codeDim, m)
  if (macs) macs.count += dim * codeDim
  addInPlace(hMem, out)
  const mseDiff = diffOf(hMem, hFull)
  const mseTerm = 0.5 * dot(mseDiff, mseDiff)
  let loss = mseWeight * mseTerm + imitateCe
  // dL/dout：MSE 项 + 可选主题 CE（直接推高门禁 topicAcc）
  const diff = zeros(dim)
  if (mseWeight !== 0) {
    for (let d = 0; d < dim; d++) diff[d] = mseWeight * mseDiff[d]
  }
  if (topicDirs && targetTopic != null && topicWeight > 0) {
    const K = topicDirs.length
    const scores = new Float64Array(K)
    let maxSc = -Infinity
    for (let k = 0; k < K; k++) {
      scores[k] = dot(hMem, topicDirs[k])
      if (scores[k] > maxSc) maxSc = scores[k]
    }
    let Z = 0
    for (let k = 0; k < K; k++) {
      scores[k] = Math.exp(scores[k] - maxSc)
      Z += scores[k]
    }
    for (let k = 0; k < K; k++) scores[k] /= Z
    const pTarget = Math.max(1e-12, scores[targetTopic])
    loss += topicWeight * (-Math.log(pTarget))
    for (let k = 0; k < K; k++) {
      const coef = topicWeight * (scores[k] - (k === targetTopic ? 1 : 0))
      if (coef === 0) continue
      for (let d = 0; d < dim; d++) diff[d] += coef * topicDirs[k][d]
    }
    if (macs) macs.count += K * dim
  }

  if (accumulateGrad) {
    if (!adapter.trainable) throw new Error('mean-kind adapter cannot accumulate grad')
    // out = Wv·m
    outerAdd(grads['read.Wv'], dim, codeDim, diff, m, 1)
    const dM = zeros(codeDim)
    matVecTAdd(dM, read.Wv, dim, codeDim, diff, 1)
    if (macs) macs.count += dim * codeDim * 2
    // STE：前向 hard，softmax 反传用 aSoft
    const aBack = hardAttn ? aSoft : a
    let Gmean = 0
    const G = new Float64Array(n)
    for (let j = 0; j < n; j++) {
      G[j] = gates[j] * dot(dM, allowed[j].code)
      Gmean += aBack[j] * G[j]
      if (macs) macs.count += codeDim
    }
    const dQ = zeros(dim)
    for (let j = 0; j < n; j++) {
      const e = allowed[j]
      const tier = tiers[j]
      const sal = e.salient ? 1 : 0
      const slot = slots[j]
      const dLogit = aBack[j] * (G[j] - Gmean) + dLogitImitate[j]
      grads['meta.tierLogit'][tier] += dLogit
      grads['meta.salLogit'][sal] += dLogit
      if (useSlot) grads['meta.slotLogit'][slot] += dLogit
      // dq += dLogit·k_j/√dk ；dK_j = dLogit·q/√dk
      for (let d = 0; d < dim; d++) {
        dQ[d] += dLogit * keys[j][d] / Math.sqrt(dk)
      }
      const dK = zeros(dim)
      for (let d = 0; d < dim; d++) dK[d] = dLogit * q[d] / Math.sqrt(dk)
      if (macs) macs.count += dim * 2
      for (let d = 0; d < dim; d++) {
        grads['meta.tierEmbed'][tier * dim + d] += dK[d]
        grads['meta.salEmbed'][sal * dim + d] += dK[d]
        if (useSlot) grads['meta.slotEmbed'][slot * dim + d] += dK[d]
      }
      outerAdd(grads['read.Wk'], dim, codeDim, dK, e.code, 1)
      // 门控：g = σ(tier)·σ(sal)·[σ(slot)]
      const dg = a[j] * dot(dM, e.code)
      const gT = sigmoid(meta.tierGate[tier])
      const gS = sigmoid(meta.salGate[sal])
      const gSlot = useSlot ? sigmoid(meta.slotGate[slot]) : 1
      grads['meta.tierGate'][tier] += dg * gS * gSlot * sigmoidGrad(gT)
      grads['meta.salGate'][sal] += dg * gT * gSlot * sigmoidGrad(gS)
      if (useSlot) grads['meta.slotGate'][slot] += dg * gT * gS * sigmoidGrad(gSlot)
      // 压缩器：dC_j = a_j·g_j·dM + Wkᵀ·dK_j
      const dC = zeros(codeDim)
      for (let d = 0; d < codeDim; d++) dC[d] = a[j] * gates[j] * dM[d]
      matVecTAdd(dC, read.Wk, dim, codeDim, dK, 1)
      if (macs) macs.count += dim * codeDim * 2
      outerAdd(grads['comp.Wdown'], codeDim, dim, dC, e.pooled, 1)
      const dPooled = zeros(dim)
      matVecTAdd(dPooled, comp.Wdown, codeDim, dim, dC, 1)
      if (macs) macs.count += codeDim * dim * 2
      if (kind === 'gate') {
        for (let d = 0; d < dim; d++) grads['comp.g'][d] += dPooled[d] * e.meanPool[d]
      } else if (kind === 'query') {
        const w = e.poolWeights
        const src = e.srcVecs
        let dSmean = 0
        const dS = new Float64Array(w.length)
        for (let i = 0; i < w.length; i++) {
          dS[i] = dot(dPooled, src[i]) / Math.sqrt(dim)
          dSmean += w[i] * dS[i]
          if (macs) macs.count += dim
        }
        for (let i = 0; i < w.length; i++) {
          const dw = w[i] * (dS[i] - dSmean)
          if (dw === 0) continue
          for (let d = 0; d < dim; d++) grads['comp.q'][d] += dw * src[i][d]
          if (macs) macs.count += dim
        }
      }
    }
    outerAdd(grads['read.Wq'], dim, dim, dQ, hWin, 1)
  }
  return {
    loss,
    absErr: Math.sqrt(Math.max(0, 2 * loss)),
    relErr: l2(hMem, hFull) / Math.max(1e-8, l2(hFull, hWin)),
    read: { allowed: n, usedTiers: [...new Set(tiers)], out },
  }
}

/**
 * 主题召回 REINFORCE（玩具尺度）：
 * 策略 = 条目上的 softmax 注意力；硬采样一条记忆做读出；
 * 奖励 = 主题解码对/错（1/0）；优势优先用 SCST（sample−greedy），否则 EMA baseline；
 * 只更新读出/元数据 logits（及采样条目的 Wv/压缩器一跳），与 MSE/CE 可叠加。
 */
export function reinforceTopicReadout(adapter, entries, hWin, t, {
  windowTokens = 32,
  topicDirs = null,
  targetTopic = null,
  baseline = 0.5,
  rlWeight = 1,
  rng = null,
  accumulateGrad = true,
  macs = null,
  salientEvery = 64,
} = {}) {
  if (!topicDirs || targetTopic == null || rlWeight <= 0) {
    return { reward: 0, advantage: 0, sampled: -1, skipped: true }
  }
  if (!adapter.trainable) throw new Error('mean-kind adapter cannot reinforce')
  const { dim, codeDim, comp, read, meta, kind, grads, nSlotMod } = adapter
  const useSlot = nSlotMod > 1
  const dk = dim
  const cutoff = t - windowTokens
  const allowed = entries.filter((e) => e.meanPos <= cutoff)
  if (!allowed.length) return { reward: 0, advantage: 0, sampled: -1, skipped: true }

  const q = matVec(read.Wq, dim, dim, hWin)
  if (macs) macs.count += dim * dim
  const n = allowed.length
  const keys = new Array(n)
  const tiers = new Int32Array(n)
  const sals = new Int32Array(n)
  const slots = new Int32Array(n)
  const logits = new Float64Array(n)
  for (let j = 0; j < n; j++) {
    const e = allowed[j]
    tiers[j] = tierOf(adapter, t - e.meanPos, windowTokens)
    sals[j] = e.salient ? 1 : 0
    slots[j] = useSlot ? slotModFromEntry(e, salientEvery, nSlotMod) : 0
    const k = matVec(read.Wk, dim, codeDim, e.code)
    if (macs) macs.count += dim * codeDim
    for (let d = 0; d < dim; d++) {
      k[d] += meta.tierEmbed[tiers[j] * dim + d] + meta.salEmbed[sals[j] * dim + d]
      if (useSlot) k[d] += meta.slotEmbed[slots[j] * dim + d]
    }
    keys[j] = k
    logits[j] = dot(q, k) / Math.sqrt(dk) + meta.tierLogit[tiers[j]] + meta.salLogit[sals[j]]
      + (useSlot ? meta.slotLogit[slots[j]] : 0)
  }
  const a = softmaxInPlace(logits)
  const gates = new Float64Array(n)
  for (let j = 0; j < n; j++) {
    let g = sigmoid(meta.tierGate[tiers[j]]) * sigmoid(meta.salGate[sals[j]])
    if (useSlot) g *= sigmoid(meta.slotGate[slots[j]])
    gates[j] = g
  }

  // SCST：greedy 奖励作对照；采样相对 greedy 的优势
  const rewardOf = (idx) => {
    const e = allowed[idx]
    const g = gates[idx]
    const mH = zeros(codeDim)
    addInPlace(mH, e.code, g)
    const outH = matVec(read.Wv, dim, codeDim, mH)
    if (macs) macs.count += dim * codeDim
    const h = zeros(dim)
    addInPlace(h, hWin)
    addInPlace(h, outH)
    let b = 0
    let bs = -Infinity
    for (let k = 0; k < topicDirs.length; k++) {
      const sc = dot(h, topicDirs[k])
      if (sc > bs) { bs = sc; b = k }
    }
    return { reward: b === targetTopic ? 1 : 0, mH }
  }

  let greedy = 0
  let bestA = a[0]
  for (let j = 1; j < n; j++) if (a[j] > bestA) { bestA = a[j]; greedy = j }

  let sampled = greedy
  if (rng) {
    let u = rng()
    let cdf = 0
    sampled = n - 1
    for (let j = 0; j < n; j++) {
      cdf += a[j]
      if (u <= cdf) { sampled = j; break }
    }
  }

  const samp = rewardOf(sampled)
  const greed = rewardOf(greedy)
  const reward = samp.reward
  const greedyReward = greed.reward
  const scstAdv = reward - greedyReward
  const emaAdv = reward - baseline
  const advantage = Math.abs(scstAdv) > 1e-12 ? scstAdv : emaAdv
  if (!accumulateGrad || Math.abs(advantage) < 1e-12) {
    return {
      reward, greedyReward, advantage, sampled, greedy,
      skipped: false, policyEntropy: entropyOf(a),
    }
  }

  const eS = allowed[sampled]
  const gS = gates[sampled]
  const mHard = samp.mH

  const scale = rlWeight * advantage
  // ∇_θ log π(j) = 1_j − a ；乘优势
  const dQ = zeros(dim)
  for (let j = 0; j < n; j++) {
    const dLogit = scale * ((j === sampled ? 1 : 0) - a[j])
    if (Math.abs(dLogit) < 1e-18) continue
    const tier = tiers[j]
    const sal = sals[j]
    const slot = slots[j]
    grads['meta.tierLogit'][tier] += dLogit
    grads['meta.salLogit'][sal] += dLogit
    if (useSlot) grads['meta.slotLogit'][slot] += dLogit
    for (let d = 0; d < dim; d++) dQ[d] += dLogit * keys[j][d] / Math.sqrt(dk)
    const dK = zeros(dim)
    for (let d = 0; d < dim; d++) dK[d] = dLogit * q[d] / Math.sqrt(dk)
    for (let d = 0; d < dim; d++) {
      grads['meta.tierEmbed'][tier * dim + d] += dK[d]
      grads['meta.salEmbed'][sal * dim + d] += dK[d]
      if (useSlot) grads['meta.slotEmbed'][slot * dim + d] += dK[d]
    }
    outerAdd(grads['read.Wk'], dim, codeDim, dK, allowed[j].code, 1)
    if (j === sampled && reward > 0) {
      const dOut = zeros(dim)
      for (let d = 0; d < dim; d++) dOut[d] = -topicDirs[targetTopic][d] * rlWeight * 0.25
      outerAdd(grads['read.Wv'], dim, codeDim, dOut, mHard, 1)
      const dM = zeros(codeDim)
      matVecTAdd(dM, read.Wv, dim, codeDim, dOut, 1)
      const gT = sigmoid(meta.tierGate[tier])
      const gSal = sigmoid(meta.salGate[sal])
      const gSlot = useSlot ? sigmoid(meta.slotGate[slot]) : 1
      const dg = dot(dM, eS.code)
      grads['meta.tierGate'][tier] += dg * gSal * gSlot * sigmoidGrad(gT)
      grads['meta.salGate'][sal] += dg * gT * gSlot * sigmoidGrad(gSal)
      if (useSlot) grads['meta.slotGate'][slot] += dg * gT * gSal * sigmoidGrad(gSlot)
      const dC = zeros(codeDim)
      for (let d = 0; d < codeDim; d++) dC[d] = gS * dM[d]
      outerAdd(grads['comp.Wdown'], codeDim, dim, dC, eS.pooled, 1)
      const dPooled = zeros(dim)
      matVecTAdd(dPooled, comp.Wdown, codeDim, dim, dC, 1)
      if (kind === 'gate' && eS.meanPool) {
        for (let d = 0; d < dim; d++) grads['comp.g'][d] += dPooled[d] * eS.meanPool[d]
      } else if (kind === 'query' && eS.poolWeights && eS.srcVecs) {
        const w = eS.poolWeights
        const src = eS.srcVecs
        let dSmean = 0
        const dS = new Float64Array(w.length)
        for (let i = 0; i < w.length; i++) {
          dS[i] = dot(dPooled, src[i]) / Math.sqrt(dim)
          dSmean += w[i] * dS[i]
        }
        for (let i = 0; i < w.length; i++) {
          const dw = w[i] * (dS[i] - dSmean)
          if (dw === 0) continue
          for (let d = 0; d < dim; d++) grads['comp.q'][d] += dw * src[i][d]
        }
      }
    }
  }
  outerAdd(grads['read.Wq'], dim, dim, dQ, hWin, 1)
  return {
    reward, greedyReward, advantage, sampled, greedy,
    skipped: false, policyEntropy: entropyOf(a),
  }
}

function entropyOf(a) {
  let h = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] > 1e-12) h -= a[i] * Math.log(a[i])
  }
  return h
}

function diffOf(a, b) {
  const out = zeros(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i]
  return out
}
