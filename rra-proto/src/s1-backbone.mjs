/**
 * 阶段 1 · 冻结小骨干 + 远距合成任务（论文 6.2 脚手架）。
 * 骨干 = 范数门控前缀池（冻结），教师隐藏态 = 全前缀显著加权池化内容，
 * 学生的缺口 = 远处显著 token 的池化贡献 —— 正是 RRM「用压缩码重建远处状态」的价值主张。
 * 玩具尺度，不宣称真实模型结论；implemented:false 纪律见 status.mjs。
 */
import { zeros } from './math.mjs'

/** 种子随机数（与 l3-eval 的 mulberry32 同源） */
export function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function randnSeeded(dim, scale, rng) {
  const out = new Float64Array(dim)
  for (let i = 0; i < dim; i++) {
    const u = Math.max(1e-12, 1 - rng())
    const v = rng()
    out[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * scale
  }
  return out
}

export function softmaxInPlace(logits) {
  let max = -Infinity
  for (const l of logits) if (l > max) max = l
  let sum = 0
  for (let i = 0; i < logits.length; i++) {
    logits[i] = Math.exp(logits[i] - max)
    sum += logits[i]
  }
  for (let i = 0; i < logits.length; i++) logits[i] /= sum
  return logits
}

export function sigmoid(x) {
  return 1 / (1 + Math.exp(-x))
}

export function sigmoidGrad(y) {
  return y * (1 - y)
}

export function relu(x) {
  return x > 0 ? x : 0
}

/**
 * 冻结骨干：h(t) = Wo·pool(前缀含自身)，池化权重 w_i = ||x_i||⁴（归一化，确定性）。
 * 范数门控 = 「强显著 token 吸引注意力」的玩具替身：教师状态由远处显著 token 主导。
 * 权重生成后永不更新；教师（全前缀）与学生（滑窗）走同一份权重。
 */
export function createFrozenBackbone({ dim = 32, seed = 7 } = {}) {
  const rng = mulberry32(seed)
  const Wo = randnSeeded(dim * dim, 0.5 / Math.sqrt(dim), rng)
  return {
    dim,
    Wo,
    frozen: true,
    paramCount: Wo.length,
    kind: 'frozen-normgate-pooling-backbone/0.1',
    note: '阶段1冻结骨干（范数门控前缀池）· 教师学生共享 · 不参与训练',
  }
}

/** 骨干缓存：维护运行中的加权池（Σw·x 与 Σw） */
export function createBackboneCache(bb) {
  return { bb, sumWX: zeros(bb.dim), sumW: 0 }
}

/**
 * 前向一批 token：池化含缓存内历史与自身（因果）。
 * 返回每个 token 的隐藏态 h[t]。macs 可选累加乘加计数。
 */
export function backboneForward(bb, tokens, positions, cache, macs = null) {
  const dim = bb.dim
  const out = []
  const count = (n) => { if (macs) macs.count += n }
  for (let idx = 0; idx < tokens.length; idx++) {
    const x = tokens[idx]
    let n2 = 0
    for (let d = 0; d < dim; d++) n2 += x[d] * x[d]
    const w = n2 * n2
    cache.sumW += w
    const alpha = w / cache.sumW
    for (let d = 0; d < dim; d++) cache.sumWX[d] += (x[d] - cache.sumWX[d]) * alpha
    out.push(matFree(bb.Wo, cache.sumWX, dim, count))
  }
  return out
}

/** y = W@x（带乘加计数） */
function matFree(W, x, outDim, count) {
  const y = zeros(outDim)
  for (let i = 0; i < outDim; i++) {
    let s = 0
    const row = i * x.length
    for (let j = 0; j < x.length; j++) s += W[row + j] * x[j]
    y[i] = s
  }
  if (count) count(outDim * x.length)
  return y
}

/**
 * 合成语料：背景主题出现在远处显著 token 上；滑窗内无显著点时，均值池无法得知主题。
 * 加难选项（对打用）：
 * - trueEvery>1：仅每 trueEvery 个显著点带真主题，其余为等范数干扰主题
 * - trueRandom：在约 1/trueEvery 密度下随机选真点（破周期格子；slotMod 无效）
 * - distractorScale：干扰点范数（≈ salientScale 时显著性偏置无法单靠范数挑真点）
 * - nTopics 更大、salientScale 更弱、noiseScale 更大 → 更难
 */
export function synthCorpus({
  nSeq = 12,
  nTrain = 8,
  length = 512,
  dim = 32,
  topicEvery = 64,
  salientEvery = 64,
  salientScale = 10,
  seed = 101,
  nTopics = 8,
  /** 每 trueEvery 个显著槽位才放真主题；1=全真（旧行为） */
  trueEvery = 1,
  /** true：按 ~1/trueEvery 密度随机选真点（破周期；与 slotMod 正交） */
  trueRandom = false,
  /** 干扰显著点范数；默认与真点同级 */
  distractorScale = null,
  /** 非显著噪声标准差 */
  noiseScale = 0.4,
} = {}) {
  const rng = mulberry32(seed)
  const topicDirs = []
  for (let k = 0; k < nTopics; k++) {
    const v = randnSeeded(dim, 1, rng)
    let n = 0
    for (const x of v) n += x * x
    n = Math.sqrt(n)
    for (let i = 0; i < dim; i++) v[i] /= n
    topicDirs.push(v)
  }
  const dScale = distractorScale == null ? salientScale : distractorScale
  const gauss = () => {
    const u = Math.max(1e-12, 1 - rng())
    const v = rng()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const pTrue = trueEvery <= 1 ? 1 : (1 / trueEvery)
  const seqs = []
  for (let s = 0; s < nSeq; s++) {
    const bgTopic = s % nTopics
    const tokens = []
    const positions = []
    let nTrue = 0
    let nDistractor = 0
    for (let t = 0; t < length; t++) {
      const v = zeros(dim)
      if (t % salientEvery === 0) {
        const slot = Math.floor(t / salientEvery)
        const isTrue = trueEvery <= 1
          ? true
          : (trueRandom ? rng() < pTrue : (slot % trueEvery) === 0)
        let topic = bgTopic
        let scale = salientScale
        if (!isTrue) {
          // 确定性干扰：错开真主题，轮转其余类
          topic = (bgTopic + 1 + (slot % Math.max(1, nTopics - 1))) % nTopics
          scale = dScale
          nDistractor++
        } else {
          nTrue++
        }
        const base = topicDirs[topic]
        for (let d = 0; d < dim; d++) v[d] = base[d] * scale
      } else {
        for (let d = 0; d < dim; d++) v[d] = gauss() * noiseScale
      }
      tokens.push(v)
      positions.push(t)
    }
    seqs.push({ tokens, positions, bgTopic, id: `seq${s}`, nTrue, nDistractor })
  }
  return {
    seqs, nTrain, length, dim, topicDirs, salientEvery, salientScale, topicEvery, nTopics,
    trueEvery, trueRandom: !!trueRandom, distractorScale: dScale, noiseScale,
  }
}

/** 把骨干的输出投影 Wo 应用到一个字典向量（供探针在 h 空间解码） */
export function backboneApplyWo(bb, v) {
  return matFree(bb.Wo, v, bb.dim, null)
}

/** 冻结主题探针：score_k = <h, Wo·topicDir_k>（在骨干输出几何上解码，不训练） */
export function createTopicProbe(topicDirs, dim, seed = 777, projectFn = null) {
  const dirs = projectFn ? topicDirs.map((d) => projectFn(d)) : topicDirs
  return {
    dim,
    seed,
    /** 投影后的主题方向（训练 CE 辅助损失用；探针本身不训练） */
    dirs,
    decode(h) {
      let best = 0
      let bestScore = -Infinity
      const scores = []
      for (let k = 0; k < dirs.length; k++) {
        let sc = 0
        for (let d = 0; d < dim; d++) sc += h[d] * dirs[k][d]
        scores.push(Math.round(sc * 1000) / 1000)
        if (sc > bestScore) { bestScore = sc; best = k }
      }
      return { best, scores }
    },
  }
}
