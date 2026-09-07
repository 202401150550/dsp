/**
 * 最小可微压缩读写（rope-then-pool + 线性 bottleneck）。
 * 玩具权重，可在本包内短训；不宣称完整神经 RRA。
 */
import {
  zeros, randn, clone, addInPlace, scaleInPlace, meanVec, matVec, matVecTAdd, outerAdd, sgdStep, l2, dot,
} from './math.mjs'
import { applyRope, invertRope } from './rope.mjs'

export function createCompressModel({ dim = 16, compressedDim = 4, theta = 10000, seedScale = 0.15 } = {}) {
  if (dim % 2 !== 0) throw new Error('dim must be even for RoPE')
  const Wdown = randn(compressedDim * dim, seedScale)
  const Wup = randn(dim * compressedDim, seedScale)
  // 轻微偏置：近似放大，帮助起步
  for (let i = 0; i < Math.min(dim, compressedDim); i++) {
    Wdown[i * dim + i] += 0.5
    Wup[i * compressedDim + i] += 0.5
  }
  return {
    dim,
    compressedDim,
    theta,
    Wdown,
    Wup,
    dWdown: zeros(Wdown.length),
    dWup: zeros(Wup.length),
    kind: 'rope-then-pool-linear',
    note: '玩具可微压缩 · 非完整神经 RRA',
  }
}

/**
 * 将一组 (vec, pos) 压成单条压缩态：先 RoPE，再均值，再 Wdown。
 */
export function compressBlock(model, vecs, positions) {
  if (!vecs.length) throw new Error('empty block')
  const roped = vecs.map((v, i) => applyRope(v, positions[i], model.theta))
  const pooled = meanVec(roped)
  const meanPos = positions.reduce((a, b) => a + b, 0) / positions.length
  const code = matVec(model.Wdown, model.compressedDim, model.dim, pooled)
  return {
    code,
    pooled,
    meanPos,
    count: vecs.length,
    positions: positions.slice(),
  }
}

/** 从压缩态读回 dim 维内容（在 meanPos 的 RoPE 帧中） */
export function expandCode(model, code) {
  return matVec(model.Wup, model.dim, model.compressedDim, code)
}

/**
 * 读到查询位置 queryPos：先 expand，再相对旋转到 query 帧。
 * relative = queryPos - meanPos
 */
export function readAt(model, compressed, queryPos) {
  const content = expandCode(model, compressed.code)
  const rel = queryPos - compressed.meanPos
  return applyRope(content, rel, model.theta)
}

/**
 * 重建损失：expand(code) 对齐 pooled（同一 RoPE 帧）。
 * 可选返回 grad。
 */
export function reconstructionLoss(model, compressed, { accumulateGrad = false } = {}) {
  const pred = expandCode(model, compressed.code)
  const target = compressed.pooled
  const diff = clone(pred)
  addInPlace(diff, target, -1)
  const loss = 0.5 * dot(diff, diff)

  if (accumulateGrad) {
    // dL/dpred = diff ；pred = Wup @ code
    outerAdd(model.dWup, model.dim, model.compressedDim, diff, compressed.code, 1)
    const dCode = zeros(model.compressedDim)
    matVecTAdd(dCode, model.Wup, model.dim, model.compressedDim, diff, 1)
    // code = Wdown @ pooled
    outerAdd(model.dWdown, model.compressedDim, model.dim, dCode, compressed.pooled, 1)
  }
  return { loss, pred, err: l2(pred, target) }
}

/**
 * 位置一致性：在块内某成员位置读回，与「该位置原向量经 RoPE」的接近度。
 * 使用相对旋转 readAt；误差应可通过短训下降，并保持有界。
 */
export function positionReadError(model, vecs, positions, index = 0) {
  const compressed = compressBlock(model, vecs, positions)
  const got = readAt(model, compressed, positions[index])
  const want = applyRope(vecs[index], positions[index], model.theta)
  // 块均值压缩不可能完美还原单点；报告相对误差
  return {
    abs: l2(got, want),
    rel: l2(got, want) / Math.max(1e-8, l2(want)),
    meanPos: compressed.meanPos,
  }
}

/**
 * 短训：多块随机数据上降重建损失。
 */
export function trainToySteps(model, { steps = 40, lr = 0.05, blockSize = 4, batchBlocks = 8 } = {}) {
  const losses = []
  for (let s = 0; s < steps; s++) {
    let lossSum = 0
    for (let b = 0; b < batchBlocks; b++) {
      const vecs = []
      const positions = []
      const base = Math.floor(Math.random() * 64)
      for (let i = 0; i < blockSize; i++) {
        vecs.push(randn(model.dim, 1))
        positions.push(base + i)
      }
      const compressed = compressBlock(model, vecs, positions)
      const { loss } = reconstructionLoss(model, compressed, { accumulateGrad: true })
      lossSum += loss
    }
    sgdStep(model.Wdown, model.dWdown, lr / batchBlocks, 1e-4)
    sgdStep(model.Wup, model.dWup, lr / batchBlocks, 1e-4)
    losses.push(lossSum / batchBlocks)
  }
  const head = Math.max(1, Math.floor(steps / 5))
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
  const firstMean = mean(losses.slice(0, head))
  const lastMean = mean(losses.slice(-head))
  return {
    losses,
    first: losses[0],
    last: losses[losses.length - 1],
    firstMean,
    lastMean,
    improved: lastMean < firstMean,
  }
}

/** 因果检查：压缩块不得包含未来位置（positions 必须非降序且 query 不读未来） */
export function assertCausalBlock(positions, queryPos = null) {
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] < positions[i - 1]) {
      throw new Error('causal: block positions must be non-decreasing')
    }
  }
  if (queryPos != null && positions.some((p) => p > queryPos)) {
    throw new Error('causal: cannot read compressed block that contains future positions')
  }
  return true
}

export const COMPRESS_WEIGHT_PROTOCOL = 'rra/0.10-compress-weights'

/** 压缩模型权重快照（玩具；可 JSON 落盘） */
export function snapshotCompressModel(model) {
  if (!model) throw new Error('snapshotCompressModel: missing model')
  return {
    protocol: COMPRESS_WEIGHT_PROTOCOL,
    dim: model.dim,
    compressedDim: model.compressedDim,
    theta: model.theta,
    kind: model.kind || 'rope-then-pool-linear',
    Wdown: Array.from(model.Wdown),
    Wup: Array.from(model.Wup),
    note: 'rope-then-pool compress weights · toy · not full neural RRA',
  }
}

/** 从快照恢复压缩模型（零梯度缓冲） */
export function restoreCompressModel(snap) {
  if (!snap || snap.protocol !== COMPRESS_WEIGHT_PROTOCOL) {
    throw new Error('restoreCompressModel: bad protocol')
  }
  if (!snap.Wdown || !snap.Wup) throw new Error('restoreCompressModel: missing weights')
  if (snap.Wdown.length !== snap.compressedDim * snap.dim) {
    throw new Error('restoreCompressModel: Wdown shape mismatch')
  }
  if (snap.Wup.length !== snap.dim * snap.compressedDim) {
    throw new Error('restoreCompressModel: Wup shape mismatch')
  }
  const model = createCompressModel({
    dim: snap.dim,
    compressedDim: snap.compressedDim,
    theta: snap.theta ?? 10000,
    seedScale: 0,
  })
  model.Wdown = Float64Array.from(snap.Wdown)
  model.Wup = Float64Array.from(snap.Wup)
  model.dWdown = zeros(model.Wdown.length)
  model.dWup = zeros(model.Wup.length)
  model.kind = snap.kind || model.kind
  return model
}

export function maxAbsCompressWeightDiff(a, b) {
  let m = 0
  for (let i = 0; i < a.Wdown.length; i++) m = Math.max(m, Math.abs(a.Wdown[i] - b.Wdown[i]))
  for (let i = 0; i < a.Wup.length; i++) m = Math.max(m, Math.abs(a.Wup[i] - b.Wup[i]))
  return m
}

export function compressParamCount(model) {
  return model.Wdown.length + model.Wup.length
}
