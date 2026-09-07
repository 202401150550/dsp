/**
 * M5-R · RoPE 压缩银行 → applyRraSketch（玩具尺度第一刀）。
 * 与 S1 pooled 桥不同：走 compress.mjs rope-then-pool + readAt（相对旋转）。
 * 不宣称真实模型 / 完整神经 RRA；正式 apply 仍抛错。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createCompressModel, compressBlock, trainToySteps, readAt,
} from './compress.mjs'
import { applyRraSketch, SKETCH_PROTOCOL } from './m3-apply.mjs'
import { randn, l2, zeros } from './math.mjs'

function round4(n) {
  return Math.round(n * 10000) / 10000
}

/**
 * 造一条短序列 + 若干压缩块（RoPE 帧）。
 */
export function buildRopeBankToy(opts = {}) {
  const dim = opts.dim || 32
  const length = opts.length || 96
  const blockSize = opts.blockSize || 4
  const codeDim = opts.codeDim || 8
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

  const bank = []
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

  return { model, tokens, bank, train, dim, length, blockSize, codeDim, seed }
}

/**
 * 端到端：RoPE 银行 → applyRraSketch(model) 走 readAt；并对照 pooled-only。
 */
export function runM5RopeBridgeEval(opts = {}) {
  const toy = buildRopeBankToy(opts)
  const { model, tokens, bank, dim, length } = toy
  const queryPos = opts.queryPos ?? (length - 1)
  const windowTokens = opts.windowTokens ?? 8
  const q = tokens[queryPos]

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
    topK: 8,
  }
  const layers = {
    exact,
    compressed: farBank,
    landmark: farBank.filter((_, i) => i % 2 === 0),
  }

  const withModel = applyRraSketch({
    q, queryPos, causal: true, model, k_layers: layers, cfg: sketchCfg,
  })
  const pooledOnly = applyRraSketch({
    q, queryPos, causal: true, model: null, k_layers: layers, cfg: sketchCfg,
  })

  const sample = farBank[0]
  const readVec = sample
    ? readAt(model, { code: sample.code, meanPos: sample.meanPos }, queryPos)
    : zeros(dim)
  const readOk = !!sample && readVec.every((x) => Number.isFinite(x)) && l2(readVec) > 0

  let causalThrow = false
  try {
    applyRraSketch({ q, queryPos, causal: false, model, k_layers: { exact } })
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
    note: 'M5-R rope-then-pool bank → applyRraSketch(readAt) · toy dim · not full neural RRA',
    implemented: false,
    fullNeuralRra: false,
  }
}

export function runM5RopeBridgeGate(opts = {}) {
  const here = dirname(fileURLToPath(import.meta.url))
  const outDir = opts.outDir || join(here, '..', 'reports')
  mkdirSync(outDir, { recursive: true })
  const report = runM5RopeBridgeEval(opts)
  writeFileSync(join(outDir, 'm5-rope-bridge-latest.json'), JSON.stringify(report, null, 2))
  return report
}
