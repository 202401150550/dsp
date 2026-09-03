/**
 * L6/M2：长上下文压缩码热读 + 字节对照（相对 L4 / 全量 raw）。
 * 不宣称完整神经 RRA；该差则差。
 */
import { createKvBank, appendBlock, trainOnRawBatch, hotRead, hotReadQuality, estimateBankBytes } from './kv-bank.mjs'
import { runL4Gate } from './l4-longctx.mjs'
import { randn, l2 } from './math.mjs'
import { applyRope } from './rope.mjs'

function round4(n) {
  return Math.round(n * 10000) / 10000
}

/**
 * 合成长因果向量块序列（positions 连续）。
 */
export function synthesizeVectorBlocks({
  length = 2048,
  dim = 16,
  blockSize = 4,
} = {}) {
  const nBlocks = Math.ceil(length / blockSize)
  const batches = []
  let pos = 0
  for (let b = 0; b < nBlocks; b++) {
    const vecs = []
    const positions = []
    for (let i = 0; i < blockSize && pos < length; i++, pos++) {
      vecs.push(randn(dim, 1))
      positions.push(pos)
    }
    batches.push({ id: `vb${b}`, vecs, positions })
  }
  return { batches, length: pos, dim, blockSize, nBlocks: batches.length }
}

/**
 * 固定窗口：只保留最近 windowTokens 个向量的「假想 raw 存储」字节与热读误差。
 */
function fixedWindowBaseline(batches, queryPos, dim, windowTokens) {
  const flat = []
  for (const bat of batches) {
    for (let i = 0; i < bat.vecs.length; i++) {
      flat.push({ vec: bat.vecs[i], pos: bat.positions[i] })
    }
  }
  const kept = flat.filter((t) => t.pos > queryPos - windowTokens && t.pos <= queryPos)
  // 近似字节：每个 float64 * dim
  const bytes = kept.length * dim * 8
  let rel = null
  const hit = kept.find((t) => t.pos === queryPos) || kept[kept.length - 1]
  if (hit) {
    // 「精确」窗口读：就是原向量 RoPE
    const want = applyRope(hit.vec, hit.pos, 10000)
    rel = 0 // 窗口内精确命中自己
    if (hit.pos !== queryPos && kept.length) {
      // 用最近一条当近似
      const nearest = kept.reduce((a, c) => (Math.abs(c.pos - queryPos) < Math.abs(a.pos - queryPos) ? c : a))
      const got = applyRope(nearest.vec, nearest.pos, 10000)
      const target = flat.find((t) => t.pos === queryPos)
      if (target) {
        const wantQ = applyRope(target.vec, queryPos, 10000)
        rel = l2(got, wantQ) / Math.max(1e-8, l2(wantQ))
      }
    }
  }
  return { bytes, kept: kept.length, meanRelAtQuery: rel }
}

/**
 * M2 主评测：≥2048 位置、码银行字节 < raw、热读可用、并复跑 L4 门禁。
 */
export function runHotReadLongCtx(opts = {}) {
  const length = Math.max(2048, Number(opts.length) || 2048)
  const dim = Number(opts.dim) || 16
  const compressedDim = Number(opts.compressedDim) || 4
  const blockSize = Number(opts.blockSize) || 4
  const trainSteps = Number(opts.trainSteps) || 40
  const lr = Number(opts.lr) || 0.1
  const windowTokens = Number(opts.windowTokens) || 128

  const syn = synthesizeVectorBlocks({ length, dim, blockSize })
  const bank = createKvBank({
    dim,
    compressedDim,
    maxBlocks: syn.nBlocks + 8,
    keepRaw: true,
  })

  // 先短训再写入（append 时用训后权重压码）
  const train = trainOnRawBatch(bank, syn.batches.slice(0, Math.min(32, syn.batches.length)), {
    steps: trainSteps,
    lr,
    append: false,
  })
  for (const bat of syn.batches) {
    appendBlock(bank, bat.vecs, bat.positions, { id: bat.id })
  }

  const bytesRaw = estimateBankBytes(bank, { includeRaw: true, includePooled: true })
  const bytesCode = estimateBankBytes(bank, { includeRaw: false, includePooled: false })
  const bytesCodePooled = estimateBankBytes(bank, { includeRaw: false, includePooled: true })
  const compressionRatio = bytesCode / Math.max(1, bytesRaw)

  const quality = hotReadQuality(bank, { samplesPerBlock: 1, topK: 1 })

  // 抽几个 query 做热读冒烟
  const probes = [0, Math.floor(length / 2), length - 1].map((q) => {
    const hr = hotRead(bank, q, { topK: 4 })
    const win = fixedWindowBaseline(syn.batches, q, dim, windowTokens)
    return {
      queryPos: q,
      hits: hr.hits.length,
      windowBytes: win.bytes,
      windowRel: win.meanRelAtQuery,
      codeBankBytes: bytesCode,
    }
  })

  const l4 = runL4Gate({ length: Math.min(length, 2048) })

  const codeCheaperThanRaw = bytesCode < bytesRaw * 0.5
  const hotOk = quality.ok && Number.isFinite(quality.meanRel)
  // 块均值压缩不可能很低误差；只要求有界（短训后 < 3）
  const qualityBounded = hotOk && quality.meanRel < 3

  return {
    ok: true,
    stage: 'L6-M2',
    implemented: false,
    fullNeuralRra: false,
    input: { length: syn.length, dim, compressedDim, blockSize, nBlocks: syn.nBlocks, trainSteps },
    train: { improved: train.improved, loss0: train.loss0, loss1: train.loss1 },
    bytes: {
      raw: bytesRaw,
      codeOnly: bytesCode,
      codePooled: bytesCodePooled,
      compressionRatio: round4(compressionRatio),
      codeCheaperThanRaw,
    },
    hotRead: {
      quality,
      probes,
      qualityBounded,
    },
    l4: {
      ok: l4.ok,
      comparableSweeps: l4.report?.summary?.comparableSweeps,
      note: l4.note,
    },
    disclaimer: 'M2 热读+字节对照；非完整神经 RRA。不强制热读胜过窗口精确。',
    generatedAt: new Date().toISOString(),
  }
}

/**
 * M2 门槛：长序列、码银行明显小于 raw、热读有界、L4 门禁仍过。
 */
export function runM2Gate(opts = {}) {
  const report = runHotReadLongCtx(opts)
  const checks = {
    lengthOk: report.input.length >= 2048,
    codeCheaper: report.bytes.codeCheaperThanRaw === true,
    hotBounded: report.hotRead.qualityBounded === true,
    l4Ok: report.l4.ok === true,
    honest: report.implemented === false && report.fullNeuralRra === false,
  }
  const ok = Object.values(checks).every(Boolean)
  return {
    ok,
    checks,
    report,
    implemented: false,
    fullNeuralRra: false,
    stage: 'L6-M2',
    note: ok
      ? 'M2 长上下文热读/字节对照基础设施通过（未宣称神经胜利）'
      : `M2 gate fail: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  }
}
