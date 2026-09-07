/**
 * M5-R · RoPE 压缩银行 → applyRraSketch（玩具尺度阶梯）。
 * 1) dim32 桥：readAt vs pooled 有差
 * 2) 压缩权重训→存→载→sketch 一致
 * 3) dim64 / dim128 冒烟（仍玩具，非真实解码器）
 * 不宣称完整神经 RRA；正式 apply 仍抛错。
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createCompressModel, compressBlock, trainToySteps, readAt,
  snapshotCompressModel, restoreCompressModel, maxAbsCompressWeightDiff, compressParamCount,
} from './compress.mjs'
import { applyRraSketch, SKETCH_PROTOCOL } from './m3-apply.mjs'
import { randn, l2, zeros } from './math.mjs'

function round4(n) {
  return Math.round(n * 10000) / 10000
}

function bankFromModel(model, tokens, blockSize) {
  const bank = []
  const length = tokens.length
  for (let start = 0; start + blockSize <= length; start += blockSize) {
    const vecs = tokens.slice(start, start + blockSize)
    const positions = Array.from({ length: blockSize }, (_, i) => start + i)
    const c = compressBlock(model, vecs, positions)
    bank.push({
      code: c.code,
      pooled: c.pooled,
      meanPos: c.meanPos,
      count: vecs.length,
      maxPos: positions[positions.length - 1],
    })
  }
  return bank
}

/**
 * 造一条短序列 + 若干压缩块（RoPE 帧）。
 */
export function buildRopeBankToy(opts = {}) {
  const dim = opts.dim || 32
  const length = opts.length || 96
  const blockSize = opts.blockSize || 4
  const codeDim = opts.codeDim || Math.max(4, Math.floor(dim / 4))
  const seed = opts.seed || 17

  const model = createCompressModel({ dim, compressedDim: codeDim, seedScale: 0.05 })
  const train = trainToySteps(model, {
    steps: opts.trainSteps || 80,
    lr: 0.08,
    blockSize,
    batchBlocks: 8,
  })

  const tokens = []
  for (let t = 0; t < length; t++) {
    const v = randn(dim, 0.8)
    for (let d = 0; d < dim; d++) v[d] += 0.15 * Math.sin((t + 1) * (d + 1) * 0.07 + seed * 0.01)
    tokens.push(v)
  }

  const bank = bankFromModel(model, tokens, blockSize)
  return { model, tokens, bank, train, dim, length, blockSize, codeDim, seed }
}

function sketchOnce(model, tokens, bank, {
  queryPos, windowTokens, length, topK = 8,
}) {
  const exact = []
  for (let p = queryPos - windowTokens + 1; p <= queryPos; p++) {
    if (p < 0) continue
    exact.push({ vec: tokens[p], pos: p })
  }
  const farBank = bank.filter((b) => b.meanPos <= queryPos - windowTokens)
  const sketchCfg = {
    exactRadius: windowTokens,
    compressRadius: Math.floor(length / 2),
    alpha: 1.0,
    topK,
  }
  const layers = {
    exact,
    compressed: farBank,
    landmark: farBank.filter((_, i) => i % 2 === 0),
  }
  const withModel = applyRraSketch({
    q: tokens[queryPos], queryPos, causal: true, model, k_layers: layers, cfg: sketchCfg,
  })
  const pooledOnly = applyRraSketch({
    q: tokens[queryPos], queryPos, causal: true, model: null, k_layers: layers, cfg: sketchCfg,
  })
  return { withModel, pooledOnly, farBank, exact }
}

/**
 * 端到端：RoPE 银行 → applyRraSketch(model) 走 readAt；并对照 pooled-only。
 */
export function runM5RopeBridgeEval(opts = {}) {
  const toy = buildRopeBankToy(opts)
  const { model, tokens, bank, dim, length } = toy
  const queryPos = opts.queryPos ?? (length - 1)
  const windowTokens = opts.windowTokens ?? 8

  const { withModel, pooledOnly, farBank, exact } = sketchOnce(model, tokens, bank, {
    queryPos, windowTokens, length,
  })

  const sample = farBank[0]
  const readVec = sample
    ? readAt(model, { code: sample.code, meanPos: sample.meanPos }, queryPos)
    : zeros(dim)
  const readOk = !!sample && readVec.every((x) => Number.isFinite(x)) && l2(readVec) > 0

  let causalThrow = false
  try {
    applyRraSketch({ q: tokens[queryPos], queryPos, causal: false, model, k_layers: { exact } })
  } catch {
    causalThrow = true
  }

  const pathDiff = l2(withModel.context, pooledOnly.context)
  const compressedTokens = withModel.meta?.tiers?.compressed?.tokens ?? 0
  const ctxFinite = withModel.context.every((x) => Number.isFinite(x))
  const ctxNorm = l2(withModel.context)

  const ok = readOk
    && ctxFinite
    && ctxNorm > 0
    && causalThrow
    && withModel.meta?.sketch === true
    && withModel.meta?.protocol === SKETCH_PROTOCOL
    && withModel.meta?.implemented === false
    && withModel.meta?.fullNeuralRra === false
    && farBank.length > 0
    && compressedTokens > 0
    && pathDiff > 1e-6

  return {
    ok,
    dim,
    codeDim: toy.codeDim,
    pathDiff: round4(pathDiff),
    ctxNorm: round4(ctxNorm),
    nBank: bank.length,
    nFar: farBank.length,
    compressedTokens,
    readOk,
    causalThrow,
    trainImproved: toy.train?.improved === true,
    trainLast: toy.train?.last ?? null,
    sketchMeta: withModel.meta,
    note: `M5-R rope bank→readAt · dim=${dim} · toy · not full neural RRA`,
    implemented: false,
    fullNeuralRra: false,
  }
}

/**
 * 压缩权重训→快照→恢复→银行/草图一致。
 */
export function runM5WeightRoundtripEval(opts = {}) {
  const toy = buildRopeBankToy(opts)
  const { model, tokens, bank, length, blockSize } = toy
  const queryPos = opts.queryPos ?? (length - 1)
  const windowTokens = opts.windowTokens ?? 8

  const snap = snapshotCompressModel(model)
  let weightPath = null
  let restored
  if (opts.outDir) {
    mkdirSync(opts.outDir, { recursive: true })
    weightPath = join(opts.outDir, 'm5-compress-weights-latest.json')
    writeFileSync(weightPath, JSON.stringify(snap))
    restored = restoreCompressModel(JSON.parse(readFileSync(weightPath, 'utf8')))
  } else {
    restored = restoreCompressModel(snap)
  }

  const weightDiff = maxAbsCompressWeightDiff(model, restored)
  const restBank = bankFromModel(restored, tokens, blockSize)

  const live = sketchOnce(model, tokens, bank, { queryPos, windowTokens, length })
  const rest = sketchOnce(restored, tokens, restBank, { queryPos, windowTokens, length })
  const ctxDiff = l2(live.withModel.context, rest.withModel.context)

  // 码一致（同 token / 同权重）
  let codeMaxDiff = 0
  const n = Math.min(bank.length, restBank.length)
  for (let i = 0; i < n; i++) {
    const a = bank[i].code
    const b = restBank[i].code
    for (let d = 0; d < a.length; d++) codeMaxDiff = Math.max(codeMaxDiff, Math.abs(a[d] - b[d]))
  }

  const ok = weightDiff < 1e-12
    && ctxDiff < 1e-12
    && codeMaxDiff < 1e-12
    && live.withModel.meta?.protocol === SKETCH_PROTOCOL
    && rest.farBank.length > 0

  return {
    ok,
    weightDiff,
    ctxDiff,
    codeMaxDiff,
    paramCount: compressParamCount(model),
    weightPath,
    dim: toy.dim,
    note: 'M5-R compress weight roundtrip · toy · not full neural RRA',
    implemented: false,
    fullNeuralRra: false,
  }
}

/**
 * 门禁聚合：桥 + 权重闭环 + 尺度阶梯（64 / 128）。
 */
export function runM5RopeBridgeGate(opts = {}) {
  const here = dirname(fileURLToPath(import.meta.url))
  const outDir = opts.outDir || join(here, '..', 'reports')
  mkdirSync(outDir, { recursive: true })

  const seed = opts.seed || 17
  const bridge = runM5RopeBridgeEval({
    length: opts.length || 96,
    dim: opts.dim || 32,
    codeDim: opts.codeDim || 8,
    trainSteps: opts.trainSteps || 80,
    seed,
  })
  const weight = runM5WeightRoundtripEval({
    length: opts.length || 96,
    dim: opts.dim || 32,
    codeDim: opts.codeDim || 8,
    trainSteps: opts.trainSteps || 80,
    seed,
    outDir,
  })
  const mid = runM5RopeBridgeEval({
    length: opts.midLength || 96,
    dim: opts.midDim || 64,
    codeDim: opts.midCodeDim || 16,
    trainSteps: opts.midTrainSteps || 50,
    seed: seed + 1,
  })
  const wide = runM5RopeBridgeEval({
    length: opts.wideLength || 128,
    dim: opts.wideDim || 128,
    codeDim: opts.wideCodeDim || 32,
    trainSteps: opts.wideTrainSteps || 60,
    seed: seed + 2,
  })

  const report = {
    ok: bridge.ok && weight.ok && mid.ok && wide.ok,
    bridge,
    weight,
    mid,
    wide,
    ladder: [
      { dim: bridge.dim, ok: bridge.ok, pathDiff: bridge.pathDiff, compressed: bridge.compressedTokens },
      { dim: mid.dim, ok: mid.ok, pathDiff: mid.pathDiff, compressed: mid.compressedTokens },
      { dim: wide.dim, ok: wide.ok, pathDiff: wide.pathDiff, compressed: wide.compressedTokens },
    ],
    note: 'M5-R ladder dim32→64→128 + weight roundtrip · toy · not full neural RRA',
    implemented: false,
    fullNeuralRra: false,
  }
  writeFileSync(join(outDir, 'm5-rope-bridge-latest.json'), JSON.stringify(report, null, 2))
  return report
}
