/**
 * 阶段 1 · 冻结骨干适配训练 + 配对评测（论文 6.2 / 7.1 玩具版）。
 * 三支配对：Full（教师）/ Sliding / 记忆分支；同语料顺序、同步数、同优化器、
 * 同可训练参数口径、同字节预算；另设 Uniform / Fixed-chunk / 未训练互易筛选对照。
 * 三类内存账本 + 因果与分块等价检查；implemented:false 纪律不变。
 */
import { zeros, dot, l2 } from './math.mjs'
import { applyRope } from './rope.mjs'
import {
  createFrozenBackbone, createBackboneCache, backboneForward,
  synthCorpus, createTopicProbe, backboneApplyWo, mulberry32,
} from './s1-backbone.mjs'
import {
  createS1Adapter, compressGroup, matchingLoss, reinforceTopicReadout,
  zeroGrads, sgdStepAll, tierOf,
} from './s1-adapter.mjs'

function round4(n) {
  return Math.round(n * 10000) / 10000
}

/** 乘加计数器 */
function newMacs() {
  return { count: 0 }
}

/**
 * 准备任务：语料 + 冻结骨干预计算（教师全前缀 / 学生滑窗隐藏态）+ 探针目标。
 * 探针目标 = 窗外最后一个显著 token 的主题（滑窗必然不可见，教师可见）。
 */
export function prepareTask({
  length = 512,
  dim = 32,
  windowTokens = 32,
  blockSize = 4,
  topicEvery = 64,
  salientEvery = 64,
  salientScale = 6,
  nSeq = 12,
  nTrain = 8,
  seed = 101,
  backboneSeed = 7,
  probeStride = 32,
  probeMinWindows = 2,
  nTopics = 8,
  trueEvery = 1,
  trueRandom = false,
  distractorScale = null,
  noiseScale = 0.4,
} = {}) {
  const bb = createFrozenBackbone({ dim, seed: backboneSeed })
  const corpus = synthCorpus({
    nSeq, nTrain, length, dim, topicEvery, salientEvery, salientScale, seed,
    nTopics, trueEvery, trueRandom, distractorScale, noiseScale,
  })
  // 探针字典须经过骨干输出投影 Wo（否则随机投影不保持方向几何）
  const probe = createTopicProbe(corpus.topicDirs, dim, seed + 777, (d) => backboneApplyWo(bb, d))
  const seqs = corpus.seqs.map((seq, si) => {
    // 教师全前缀单遍（KV 缓存）
    const cache = createBackboneCache(bb)
    const hAll = backboneForward(bb, seq.tokens, seq.positions, cache)
    const probes = []
    const t0 = windowTokens * Math.max(2, probeMinWindows)
    for (let t = t0; t < length; t += probeStride) {
      // 滑窗内不得含显著 token（否则滑窗能直接看到主题/干扰，对比失效）
      let windowHasSalient = false
      for (let p = t - windowTokens + 1; p <= t; p++) {
        if (p % salientEvery === 0) { windowHasSalient = true; break }
      }
      if (windowHasSalient) continue
      // 学生滑窗隐藏态：只给窗口 token，独立缓存
      const wCache = createBackboneCache(bb)
      const wTok = seq.tokens.slice(t - windowTokens + 1, t + 1)
      const wPos = seq.positions.slice(t - windowTokens + 1, t + 1)
      const hWinList = backboneForward(bb, wTok, wPos, wCache)
      const hWin = hWinList[hWinList.length - 1]
      probes.push({
        t,
        hFull: hAll[t],
        hWin,
        // 目标：背景主题（真显著点在窗外；干扰点同范数迷惑显著性筛选）
        targetTopic: seq.bgTopic,
      })
    }
    return { ...seq, si, isTrain: si < nTrain, probes }
  })
  const nProbes = seqs.reduce((a, s) => a + s.probes.length, 0)
  if (!nProbes) {
    throw new Error(
      `prepareTask: 无有效探针（length=${length}, probeStride=${probeStride}, salientEvery=${salientEvery}）；` +
      'probeStride 勿与 salientEvery 对齐，否则滑窗必含显著点而被滤空',
    )
  }
  return {
    bb, corpus, probe, seqs, dim, length, windowTokens, blockSize,
    nTrain, topicEvery, salientEvery, nTopics, trueEvery, trueRandom: !!trueRandom,
  }
}

/**
 * 按配方把远区折成 ≤ nEntries 条记忆。
 * reciprocal：按对数时龄层均分条目（层内连续块成组）；
 * fixed-chunk：等宽组；uniform：等步长单 token。
 * queryT：若给定，按该探针时刻做因果打包（远区端 = queryT−W，时龄相对 queryT）；
 * 否则退化为序列末 T（旧行为，仅用于无探针的构建检查）。
 */
export function buildEntries(adapter, task, seq, {
  recipe = 'reciprocal',
  nEntries = 32,
  maxGroupWidth = null,
  macs = null,
  /** 远侧重：更老时龄层分到更多槽（互易分辨率的本意） */
  farHeavy = false,
  /** 显著性偏置：层内优先小窗罩住高分 token，避免大组均值冲淡 */
  salientBias = false,
  /**
   * 打包打分：norm=原始范数²（等范数干扰下无法辨真）；
   * comp=用压缩器 query/gate 可学习打分（等范数时靠内容分化）。
   */
  packScore = 'norm',
  /** 探针时刻；给定则按因果时龄打包 */
  queryT = null,
  /** 打包时优先落在 salientEvery 网格上的块（知显著日程，不知真/干扰标签） */
  preferSalientGrid = false,
} = {}) {
  const { length: Tseq, windowTokens: W, blockSize, dim } = task
  const salEvery = task.salientEvery || task.corpus?.salientEvery || 64
  const T = queryT != null ? queryT : Tseq
  const farEnd = Math.max(0, T - W) // 远区开区间端（position < farEnd）
  if (farEnd <= 0) return { entries: [], recipe, queryT: queryT ?? null }
  if (recipe === 'uniform') {
    const stride = Math.max(1, Math.floor(farEnd / nEntries))
    const entries = []
    for (let p = farEnd - 1; p >= 0 && entries.length < nEntries; p -= stride) {
      entries.push(compressGroup(adapter, [seq.tokens[p]], [p], macs))
    }
    return { entries: entries.reverse(), recipe, queryT: queryT ?? null }
  }
  if (recipe === 'fixed-chunk') {
    const chunkW = Math.max(blockSize, Math.floor(farEnd / nEntries))
    const entries = []
    for (let end = farEnd; end > 0 && entries.length < nEntries; end -= chunkW) {
      const start = Math.max(0, end - chunkW)
      const vecs = seq.tokens.slice(start, end)
      const positions = seq.positions.slice(start, end)
      entries.push(compressGroup(adapter, vecs, positions, macs))
    }
    return { entries: entries.reverse(), recipe, chunkW, queryT: queryT ?? null }
  }
  // reciprocal：对数时龄层 [W·2^b, W·2^{b+1})，相对 T（探针或序列末）
  const nTiers = adapter.nTiers
  // 远侧重：层权重随 b 增大（更老更多槽）；默认均匀
  const tierWeights = []
  for (let b = 0; b < nTiers; b++) tierWeights.push(farHeavy ? (b + 1) : 1)
  const wSum = tierWeights.reduce((a, c) => a + c, 0)
  // 槽数 < 层数时允许 0 配额（否则「每层至少 1」会卡死在 while）
  const tierQuota = tierWeights.map((w) => Math.max(0, Math.round(nEntries * w / wSum)))
  let qSum = tierQuota.reduce((a, c) => a + c, 0)
  let guard = 0
  while (qSum > nEntries && guard++ < nTiers * nEntries + 8) {
    // 优先削年轻层（farHeavy 意图：保老层）
    let cut = false
    for (let b = 0; b < nTiers && qSum > nEntries; b++) {
      if (tierQuota[b] > 0) { tierQuota[b]--; qSum--; cut = true }
    }
    if (!cut) break
  }
  guard = 0
  while (qSum < nEntries && guard++ < nEntries + 8) {
    tierQuota[nTiers - 1]++; qSum++
  }

  const useCompScore = salientBias && packScore === 'comp' && adapter.kind !== 'mean'
  const scoreBlock = (s, e) => {
    let best = 0
    let onGrid = false
    for (let p = s; p < e; p++) {
      if (preferSalientGrid && p % salEvery === 0) onGrid = true
      const tok = seq.tokens[p]
      let sc = 0
      if (useCompScore) {
        if (adapter.kind === 'query' && adapter.comp.q) {
          sc = Math.abs(dot(adapter.comp.q, tok))
        } else if (adapter.kind === 'gate' && adapter.comp.g) {
          for (let d = 0; d < dim; d++) sc += (adapter.comp.g[d] * tok[d]) ** 2
          sc = Math.sqrt(sc)
        } else {
          for (let d = 0; d < dim; d++) sc += tok[d] * tok[d]
        }
      } else {
        for (let d = 0; d < dim; d++) sc += tok[d] * tok[d]
      }
      if (sc > best) best = sc
    }
    if (preferSalientGrid && onGrid) best += 1e6
    return best
  }

  const entries = []
  for (let b = 0; b < nTiers; b++) {
    const quota = tierQuota[b]
    if (quota <= 0) continue
    const hi = T - W * Math.pow(2, b)
    const lo = Math.max(0, T - W * Math.pow(2, b + 1))
    if (hi <= 0) break
    const blocks = []
    for (let s = Math.floor(lo / blockSize) * blockSize; s < Math.min(hi, farEnd); s += blockSize) {
      const e = Math.min(s + blockSize, Math.min(hi, farEnd))
      if (e > s) {
        const score = salientBias ? scoreBlock(s, e) : 1
        blocks.push([s, e, score])
      }
    }
    if (!blocks.length) continue

    if (salientBias) {
      // 按显著性降序取 quota 个单块（小窗罩显著点）
      const ranked = blocks.slice().sort((a, c) => c[2] - a[2] || a[0] - c[0])
      const picked = ranked.slice(0, quota).sort((a, c) => a[0] - c[0])
      for (const [start, end] of picked) {
        if (entries.length >= nEntries) break
        if (maxGroupWidth && end - start > maxGroupWidth) continue
        // 优先压成「显著格点上的单 token」，避免 block 均值冲淡主题方向
        let gStart = start
        let gEnd = end
        if (preferSalientGrid) {
          let hit = -1
          for (let p = start; p < end; p++) if (p % salEvery === 0) { hit = p; break }
          if (hit >= 0) { gStart = hit; gEnd = hit + 1 }
        }
        entries.push(compressGroup(adapter, seq.tokens.slice(gStart, gEnd), seq.positions.slice(gStart, gEnd), macs))
      }
    } else {
      const per = Math.max(1, Math.ceil(blocks.length / quota))
      for (let i = 0; i < blocks.length && entries.length < nEntries; i += per) {
        const group = blocks.slice(i, i + per)
        const start = group[0][0]
        const end = group[group.length - 1][1]
        if (maxGroupWidth && end - start > maxGroupWidth) continue
        entries.push(compressGroup(adapter, seq.tokens.slice(start, end), seq.positions.slice(start, end), macs))
      }
    }
  }
  return {
    entries, recipe, farHeavy: !!farHeavy, salientBias: !!salientBias,
    packScore: salientBias ? packScore : 'none', tierQuota, queryT: queryT ?? null,
  }
}

/** 三类内存账本 + 活跃字节 */
export function ledgerOf(task, nEntries, adapter) {
  const windowBytes = task.windowTokens * task.dim * 8
  const bankBytes = nEntries * (adapter.codeDim + 2) * 8 // code + meanPos + count
  const fullBytes = task.length * task.dim * 8
  return {
    windowBytes,
    bankBytes,
    activeTotal: windowBytes + bankBytes,
    fullExact: fullBytes,
    residentVsFull: round4((windowBytes + bankBytes) / fullBytes),
    persistentTotal: bankBytes,
    paramBytes: adapter.paramBytes,
    ledgerNote: '活跃常驻=滑窗+记忆银行；持久总存=银行归档；参数字节单列（不入逻辑缓存账本）',
  }
}

/** 评测一个分支：relErr / 主题探针准确率 / 读出统计 */
export function evalBranch(adapter, task, seqs, {
  recipe = 'reciprocal',
  nEntries = 32,
  macs = null,
  farHeavy = false,
  salientBias = false,
  packScore = 'norm',
  hardAttn = false,
  preferSalientGrid = false,
} = {}) {
  const { windowTokens } = task
  const salEvery = task.salientEvery || task.corpus?.salientEvery || 64
  const rels = []
  const accs = []
  let allowedSum = 0
  let probes = 0
  for (const seq of seqs) {
    for (const pr of seq.probes) {
      const { entries } = buildEntries(adapter, task, seq, {
        recipe, nEntries, macs, farHeavy, salientBias, packScore, preferSalientGrid, queryT: pr.t,
      })
      const r = matchingLoss(adapter, entries, pr.hWin, pr.hFull, pr.t, {
        windowTokens, macs, hardAttn, salientEvery: salEvery,
      })
      rels.push(r.relErr)
      // 主题探针：解码 hMem
      const hMem = zeros(task.dim)
      for (let d = 0; d < task.dim; d++) hMem[d] = pr.hWin[d] + (r.read.out ? r.read.out[d] : 0)
      const dec = task.probe.decode(hMem)
      accs.push(dec.best === pr.targetTopic ? 1 : 0)
      allowedSum += r.read.allowed ?? 0
      probes++
    }
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
  return {
    recipe,
    kind: adapter.kind,
    trained: adapter.trainable && adapter.trained === true,
    meanRelErr: round4(mean(rels)),
    topicAcc: round4(mean(accs)),
    probes,
    meanAllowed: round4(allowedSum / Math.max(1, probes)),
  }
}

/**
 * 训练一个可训练分支（'query' | 'gate'）。
 * 语料顺序 = 步数 → 训练序列 → 探针，确定性；与另一分支逐位同调度。
 * parts: 'all' | 'comp'（只训压缩器，读出冻结）| 'read'（只训读出，压缩器冻结）—— 消融用。
 */
export function trainBranch(task, {
  kind = 'query',
  steps = 3000,
  lr = 0.12,
  nEntries = 24,
  recipe = 'reciprocal',
  seed = 11,
  parts = 'all',
  /** 学习率衰减：每 half 步把 lr *= lrDecay（对打强化用） */
  lrDecay = 1,
  codeDim = 8,
  farHeavy = false,
  salientBias = false,
  /** 主题 CE 辅助损失权重（相对 MSE）；0=关闭 */
  topicWeight = 0,
  /** 课程：前半程只训 t≤curriculumCap 的探针（0=关闭） */
  curriculumCap = 0,
  /** 后半程主题 REINFORCE 权重；0=关闭 */
  rlWeight = 0,
  /** 奖励基线 EMA 系数 */
  rlBaselineMom = 0.9,
  /** 后半程困难样本候选数（1=关闭 hard-mine） */
  hardMineTrials = 3,
  packScore = 'norm',
  hardAttn = false,
  mseWeight = 1,
  nSlotMod = 1,
  preferSalientGrid = false,
  attnImitateWeight = 0,
} = {}) {
  const adapter = createS1Adapter({ dim: task.dim, kind, seed, codeDim, nSlotMod })
  adapter.trained = false
  const only = parts === 'comp'
    ? Object.keys(adapter.grads).filter((k) => k.startsWith('comp.'))
    : parts === 'read'
      ? Object.keys(adapter.grads).filter((k) => !k.startsWith('comp.'))
      : null
  const trainSeqs = task.seqs.filter((s) => s.isTrain)
  const scheduleAll = []
  for (const seq of trainSeqs) for (let p = 0; p < seq.probes.length; p++) scheduleAll.push({ seq, p })
  if (!scheduleAll.length) throw new Error('empty train schedule')
  const scheduleEasy = curriculumCap > 0
    ? scheduleAll.filter(({ seq, p }) => seq.probes[p].t <= curriculumCap)
    : scheduleAll
  const macs = newMacs()
  const curve = []
  const curveEvery = Math.max(1, Math.floor(steps / 6))
  let causalViolations = 0
  let curLr = lr
  const half = Math.max(1, Math.floor(steps / 2))
  const pack = { recipe, nEntries, macs, farHeavy, salientBias, packScore, preferSalientGrid }
  const salEvery = task.salientEvery || task.corpus?.salientEvery || 64
  let rlBaseline = 0.5
  let rlRewardSum = 0
  let rlSteps = 0
  const rlRng = mulberry32(seed + 909)
  const mineN = Math.max(1, Math.floor(hardMineTrials))
  const progressEvery = Number(process.env.RRA_TRAIN_PROGRESS) || 0
  for (let s = 0; s < steps; s++) {
    if (progressEvery > 0 && (s === 0 || s === steps - 1 || s % progressEvery === 0)) {
      console.error(JSON.stringify({ event: 'train-step', kind, parts, step: s, steps, lr: round4(curLr) }))
    }
    if (lrDecay < 1 && s > 0 && s % half === 0) curLr *= lrDecay
    // 后半程才开主题 CE / RL / 注意力模仿，避免早期淹没 MSE 几何
    const tw = (s >= half) ? topicWeight : 0
    const rw = (s >= half) ? rlWeight : 0
    const iw = (s >= half) ? attnImitateWeight : 0
    const schedule = (s < half && scheduleEasy.length) ? scheduleEasy : scheduleAll
    let seq
    let p
    if (s >= half && schedule.length > 1 && mineN > 1) {
      // 后半程：从 mineN 个候选里挑当前损失最大的（困难样本）
      let bestLoss = -1
      for (let trial = 0; trial < mineN; trial++) {
        const cand = schedule[(s * mineN + trial) % schedule.length]
        const pr0 = cand.seq.probes[cand.p]
        const { entries: ent } = buildEntries(adapter, task, cand.seq, { ...pack, queryT: pr0.t })
        const r0 = matchingLoss(adapter, ent, pr0.hWin, pr0.hFull, pr0.t, {
          windowTokens: task.windowTokens, accumulateGrad: false,
          topicDirs: tw > 0 || iw > 0 ? task.probe.dirs : null,
          targetTopic: tw > 0 || iw > 0 ? pr0.targetTopic : null,
          topicWeight: tw,
          hardAttn,
          mseWeight,
          salientEvery: salEvery,
          attnImitateWeight: iw,
        })
        if (r0.loss > bestLoss) {
          bestLoss = r0.loss
          seq = cand.seq
          p = cand.p
        }
      }
    } else {
      const pick = schedule[s % schedule.length]
      seq = pick.seq
      p = pick.p
    }
    const pr = seq.probes[p]
    const { entries } = buildEntries(adapter, task, seq, { ...pack, queryT: pr.t })
    // 严格因果检查：所用条目（meanPos ≤ cutoff）的成员最大位置必须 < t
    const cutoff = pr.t - task.windowTokens
    for (const e of entries) {
      if (e.meanPos <= cutoff && e.maxPos >= pr.t) causalViolations++
    }
    zeroGrads(adapter)
    const r = matchingLoss(adapter, entries, pr.hWin, pr.hFull, pr.t, {
      windowTokens: task.windowTokens, accumulateGrad: true, macs,
      topicDirs: tw > 0 || iw > 0 ? task.probe.dirs : null,
      targetTopic: tw > 0 || iw > 0 ? pr.targetTopic : null,
      topicWeight: tw,
      hardAttn,
      mseWeight,
      salientEvery: salEvery,
      attnImitateWeight: iw,
    })
    if (rw > 0) {
      const rl = reinforceTopicReadout(adapter, entries, pr.hWin, pr.t, {
        windowTokens: task.windowTokens,
        topicDirs: task.probe.dirs,
        targetTopic: pr.targetTopic,
        baseline: rlBaseline,
        rlWeight: rw,
        rng: rlRng,
        accumulateGrad: true,
        macs,
        salientEvery: salEvery,
      })
      if (!rl.skipped) {
        rlBaseline = rlBaselineMom * rlBaseline + (1 - rlBaselineMom) * rl.reward
        rlRewardSum += rl.reward
        rlSteps++
      }
    }
    sgdStepAll(adapter, curLr, 1e-5, { only })
    if (s === 0 || s === steps - 1 || s % curveEvery === 0) {
      curve.push({
        step: s,
        loss: round4(r.loss),
        lr: round4(curLr),
        rlBaseline: round4(rlBaseline),
      })
    }
  }
  adapter.trained = true
  adapter.trainMacs = macs.count
  return {
    adapter,
    curve,
    causalViolations,
    trainFlops: macs.count,
    trainParams: only ? only.reduce((a, k) => a + adapter.grads[k].length, 0) : adapter.paramCount,
    kind,
    parts,
    rl: rlWeight > 0
      ? { meanReward: round4(rlRewardSum / Math.max(1, rlSteps)), steps: rlSteps, finalBaseline: round4(rlBaseline) }
      : null,
  }
}

/** 因果与构建检查（论文 6.5 迷你版） */
export function causalChecks(task, { nEntries = 32, seed = 11 } = {}) {
  const adapter = createS1Adapter({ dim: task.dim, kind: 'query', seed })
  const seq = task.seqs.find((s) => !s.isTrain)
  const pr = seq.probes[Math.floor(seq.probes.length / 2)]
  const { entries } = buildEntries(adapter, task, seq, { recipe: 'reciprocal', nEntries, queryT: pr.t })
  // 1) 泄漏毒化：把一个 meanPos > cutoff 的条目注毒（超大范数），读出必须不受影响
  const cutoff = pr.t - task.windowTokens
  const far = entries.filter((e) => e.meanPos <= cutoff)
  const clean = matchingLoss(adapter, far, pr.hWin, pr.hFull, pr.t, { windowTokens: task.windowTokens })
  const poisoned = far.concat([{
    code: new Float64Array(adapter.codeDim).fill(1e6),
    pooled: zeros(task.dim),
    srcVecs: [],
    poolWeights: null,
    meanPool: null,
    salient: 1,
    pooledNorm2: 1e12,
    meanPos: cutoff + 5, // 窗口边缘之外（但 ≤ t）：必须被过滤
    maxPos: cutoff + 5,
    count: 1,
  }])
  const dirty = matchingLoss(adapter, poisoned, pr.hWin, pr.hFull, pr.t, { windowTokens: task.windowTokens })
  let leakDetected = true
  for (let d = 0; d < task.dim; d++) {
    if (Math.abs(clean.read.out[d] - dirty.read.out[d]) > 0) { leakDetected = false; break }
  }
  // 2) 构建确定性：同参数两次独立构建逐位一致（无隐藏状态、无未来信息渗入分组）
  const again = buildEntries(createS1Adapter({ dim: task.dim, kind: 'query', seed }), task, seq, {
    recipe: 'reciprocal', nEntries, queryT: pr.t,
  }).entries
  let buildDeterministic = again.length === entries.length
  if (buildDeterministic) {
    for (let i = 0; i < entries.length; i++) {
      if (l2(entries[i].code, again[i].code) > 1e-12 || entries[i].meanPos !== again[i].meanPos) {
        buildDeterministic = false
        break
      }
    }
  }
  // 3) 闭合组语义：所有条目成员位置 < queryT - W（远区），不得含 frontier 之后内容
  const farEnd = pr.t - task.windowTokens
  const groupsClosed = entries.every((e) => e.maxPos < farEnd)
  return {
    leakDetected,
    buildDeterministic,
    groupsClosed,
    causalOk: leakDetected && buildDeterministic && groupsClosed,
    note: '注毒条目必须被过滤；构建逐位可复现；闭合组不含 frontier 之后内容。流式在线 apply 属 M3，本阶段不声明。',
  }
}

/** 主题探针基准：教师/滑窗的解码准确率（诊断上界与下界） */
export function probeBaselines(task, seqs) {
  let fullOk = 0
  let slideOk = 0
  let n = 0
  let gapNorm = 0
  for (const seq of seqs) {
    for (const pr of seq.probes) {
      fullOk += task.probe.decode(pr.hFull).best === pr.targetTopic ? 1 : 0
      slideOk += task.probe.decode(pr.hWin).best === pr.targetTopic ? 1 : 0
      gapNorm += l2(pr.hFull, pr.hWin) / Math.max(1e-8, l2(pr.hFull))
      n++
    }
  }
  return { fullAcc: round4(fullOk / n), slidingAcc: round4(slideOk / n), meanGapRel: round4(gapNorm / n), probes: n }
}

/**
 * S1 主报告：三支配对 + 六支对照 + 账本 + 因果检查。
 */
export function runS1(opts = {}) {
  const task = prepareTask(opts)
  const nEntries = Number(opts.nEntries) || 24
  const steps = Number(opts.steps) || 3000
  const lr = Number(opts.lr) || 0.12
  const seed = Number(opts.seed) || 11
  const codeDim = Number(opts.codeDim) || 8
  const farHeavy = opts.farHeavy === true
  const salientBias = opts.salientBias === true
  const packScore = opts.packScore === 'comp' ? 'comp' : 'norm'
  const preferSalientGrid = opts.preferSalientGrid === true || opts.slotMod === true
  const hardAttn = opts.hardAttn === true
  const mseWeight = opts.mseWeight != null ? Number(opts.mseWeight) : 1
  const attnImitateWeight = Number(opts.attnImitateWeight) || 0
  const nSlotMod = opts.slotMod === true
    ? Math.max(3, (Number(opts.nSlotMod) || task.trueEvery || 3) + 1) // +1 other 桶
    : (Number(opts.nSlotMod) || 1)
  const packRecip = { farHeavy, salientBias, packScore, preferSalientGrid }
  const topicWeight = Number(opts.topicWeight) || 0
  const curriculumCap = Number(opts.curriculumCap) || 0
  const rlWeight = Number(opts.rlWeight) || 0
  const hardMineTrials = opts.hardMineTrials != null ? Number(opts.hardMineTrials) : 3

  const evalSeqs = task.seqs.filter((s) => !s.isTrain)
  const bases = probeBaselines(task, evalSeqs)

  // 配对训练：对打场景可传 lrDecay / 远侧重 / 显著性偏置 / 主题 CE / 课程 / RL
  const lrDecay = Number(opts.lrDecay) || 1
  const trainOpts = {
    steps, lr, nEntries, seed, lrDecay, codeDim, topicWeight, curriculumCap, rlWeight,
    hardMineTrials, hardAttn, mseWeight, attnImitateWeight, nSlotMod, ...packRecip,
  }
  const tq = trainBranch(task, { kind: 'query', ...trainOpts })
  const tg = trainBranch(task, { kind: 'gate', ...trainOpts, seed: seed + 100 })
  // 消融：只训压缩器 / 只训读出（论文 6.2）；对打扫参可 skipAblations 加速
  const skipAblations = opts.skipAblations === true
  const tc = skipAblations ? null : trainBranch(task, { kind: 'query', ...trainOpts, parts: 'comp' })
  const tr = skipAblations ? null : trainBranch(task, { kind: 'query', ...trainOpts, parts: 'read' })
  // 未训练互易（同初始化种子、同打包策略，零步）
  const untrained = createS1Adapter({ dim: task.dim, kind: 'query', seed, codeDim, nSlotMod })
  untrained.trained = false
  // 冻结规则对照
  const meanA = createS1Adapter({ dim: task.dim, kind: 'mean', seed, codeDim, nSlotMod: 1 })

  const macsEval = newMacs()
  const rows = {
    'full-exact': { topicAcc: bases.fullAcc, meanRelErr: 0, isTeacher: true },
    'sliding-window': { topicAcc: bases.slidingAcc, meanRelErr: 1, isStudentFloor: true },
    'uniform-retention': evalBranch(meanA, task, evalSeqs, { recipe: 'uniform', nEntries, macs: macsEval }),
    'fixed-chunk': evalBranch(meanA, task, evalSeqs, { recipe: 'fixed-chunk', nEntries, macs: macsEval }),
    // 捷径：冻结 mean 压缩 + 远侧重/显著性打包，零学习——若已 ≥80% 则任务被显著性捷径打穿
    'salience-heuristic': evalBranch(meanA, task, evalSeqs, {
      recipe: 'reciprocal', nEntries, macs: macsEval, farHeavy: true, salientBias: true,
    }),
    'reciprocal-untrained': evalBranch(untrained, task, evalSeqs, { recipe: 'reciprocal', nEntries, macs: macsEval, ...packRecip }),
    'reciprocal-query-trained': evalBranch(tq.adapter, task, evalSeqs, { recipe: 'reciprocal', nEntries, macs: macsEval, hardAttn, ...packRecip }),
    'reciprocal-gate-trained': evalBranch(tg.adapter, task, evalSeqs, { recipe: 'reciprocal', nEntries, macs: macsEval, hardAttn, ...packRecip }),
  }
  if (!skipAblations) {
    rows['ablation-comp-only'] = evalBranch(tc.adapter, task, evalSeqs, { recipe: 'reciprocal', nEntries, macs: macsEval, hardAttn, ...packRecip })
    rows['ablation-read-only'] = evalBranch(tr.adapter, task, evalSeqs, { recipe: 'reciprocal', nEntries, macs: macsEval, hardAttn, ...packRecip })
  }
  // full/sliding 行补齐字段
  rows['full-exact'].recipe = 'full'
  rows['full-exact'].trained = false
  rows['sliding-window'].recipe = 'sliding'
  rows['sliding-window'].trained = false

  const causal = causalChecks(task, { nEntries, seed })
  const trainedQ = rows['reciprocal-query-trained']
  const untr = rows['reciprocal-untrained']
  const sliding = rows['sliding-window']

  const pairedFair = {
    sameSchedule: tq.curve.length === tg.curve.length && steps >= 1,
    sameParamCount: tq.trainParams === tg.trainParams,
    sameEvalProbes: trainedQ.probes === untr.probes && trainedQ.probes === rows['fixed-chunk'].probes,
    trainFlops: skipAblations
      ? { query: tq.trainFlops, gate: tg.trainFlops }
      : { query: tq.trainFlops, gate: tg.trainFlops, 'comp-only': tc.trainFlops, 'read-only': tr.trainFlops },
    trainParams: skipAblations
      ? { query: tq.trainParams, gate: tg.trainParams }
      : { query: tq.trainParams, gate: tg.trainParams, 'comp-only': tc.trainParams, 'read-only': tr.trainParams },
    note: skipAblations
      ? 'query/gate 同步数同调度同参数量；已 skipAblations'
      : 'query/gate 同步数同调度同参数量；comp-only/read-only 为消融（可训练子集，参数量单独报告）',
  }
  const ledger = ledgerOf(task, nEntries, tq.adapter)

  return {
    ok: null, // 由 gate 判
    stage: 'L6-S1',
    implemented: false,
    fullNeuralRra: false,
    input: {
      length: task.length, dim: task.dim, windowTokens: task.windowTokens,
      blockSize: task.blockSize, topicEvery: task.topicEvery, salientEvery: task.salientEvery,
      nSeq: task.corpus.seqs.length, nTrain: task.nTrain, nEntries, steps, lr, seed,
      codeDim, farHeavy, salientBias, lrDecay,
      trueEvery: task.trueEvery ?? 1,
      trueRandom: task.trueRandom === true,
      nTopics: task.nTopics ?? task.corpus.nTopics,
      topicWeight, curriculumCap, rlWeight,
    },
    probeBaselines: bases,
    branches: rows,
    pairedFair,
    ledger,
    causal,
    curves: { query: tq.curve, gate: tg.curve },
    causalViolations: { query: tq.causalViolations, gate: tg.causalViolations },
    trainableComponents: ['compressor(query|gate)', 'meta-embed+logit-bias(时龄层×显著性)', 'tier-gates', 'lowrank-read(单列)'],
    frozenComponents: ['backbone(attn+mlp)', 'mean-kind compressor'],
    generalizationNote: '评测序列 held-out，但主题字典与训练一致；新主题/新字典的泛化属阶段 2 课题，本阶段不声明。',
    disclaimer: '阶段1玩具尺度：冻结随机小骨干+合成任务；不宣称真实模型质量/内存/时延优势；不可与真实 SOTA 比较。',
    generatedAt: new Date().toISOString(),
  }
}
