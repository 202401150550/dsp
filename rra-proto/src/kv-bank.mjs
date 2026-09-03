/**
 * L6 / M1 · 可持久压缩 KV 银行
 * - 因果 append + 玩具可微压缩训
 * - 块上存 code + pooled（可选 raw）→ 断点续训
 * - 仍不是完整 Reciprocal-Resolution Attention apply
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  createCompressModel, compressBlock, reconstructionLoss, assertCausalBlock, readAt,
} from './compress.mjs'
import { randn, matVec, l2, meanVec } from './math.mjs'
import { applyRope } from './rope.mjs'

export const KV_BANK_KIND = 'rra-kv-bank/0.2'

export function createKvBank({
  dim = 16,
  compressedDim = 4,
  theta = 10000,
  maxBlocks = 256,
  keepRaw = true,
} = {}) {
  return {
    kind: KV_BANK_KIND,
    dim,
    compressedDim,
    theta,
    maxBlocks,
    keepRaw: !!keepRaw,
    model: createCompressModel({ dim, compressedDim, theta }),
    blocks: [],
    meta: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trainSteps: 0,
      schema: '0.2',
      note: 'L6/M1 · pooled/raw 快照 · 可续训 · 非完整神经 RRA',
    },
  }
}

function clearGrads(bank) {
  bank.model.dWdown.fill(0)
  bank.model.dWup.fill(0)
}

function asNumArray(x) {
  if (Array.isArray(x)) return x.slice()
  if (x && typeof x.length === 'number') return Array.from(x)
  if (x && typeof x === 'object') {
    return Object.keys(x).sort((a, b) => Number(a) - Number(b)).map((k) => x[k])
  }
  throw new Error('expected numeric array')
}

function asVecList(list) {
  if (!list) return null
  return list.map((v) => asNumArray(v))
}

/** @returns {object} appended compressed block record */
export function appendBlock(bank, vecs, positions, { id = null, keepRaw = null } = {}) {
  assertCausalBlock(positions)
  if (bank.blocks.length >= bank.maxBlocks) {
    throw new Error(`kv-bank full (maxBlocks=${bank.maxBlocks})`)
  }
  const storeRaw = keepRaw == null ? bank.keepRaw : !!keepRaw
  const compressed = compressBlock(bank.model, vecs, positions)
  const rec = {
    id: id || `b${bank.blocks.length}`,
    code: asNumArray(compressed.code),
    pooled: asNumArray(compressed.pooled),
    raw: storeRaw ? asVecList(vecs) : null,
    meanPos: compressed.meanPos,
    count: compressed.count,
    positions: compressed.positions.slice(),
    at: Date.now(),
  }
  bank.blocks.push(rec)
  bank.meta.updatedAt = Date.now()
  return rec
}

function sgdApply(bank, lr, batchCount) {
  const m = bank.model
  const scale = lr / Math.max(1, batchCount)
  for (let i = 0; i < m.Wdown.length; i++) m.Wdown[i] -= scale * m.dWdown[i]
  for (let i = 0; i < m.Wup.length; i++) m.Wup[i] -= scale * m.dWup[i]
}

/**
 * 用原始向量批训；可选把压缩码+快照写入银行。
 * @param {Array<{vecs:number[][], positions:number[], id?:string}>} batches
 */
export function trainOnRawBatch(bank, batches, { steps = 40, lr = 0.08, append = true } = {}) {
  if (!Array.isArray(batches) || !batches.length) {
    return { ok: false, improved: false, note: 'no batches' }
  }
  for (const bat of batches) assertCausalBlock(bat.positions)

  const m = bank.model
  let loss0 = 0
  let loss1 = 0
  for (let s = 0; s < steps; s++) {
    clearGrads(bank)
    let stepLoss = 0
    for (const bat of batches) {
      const compressed = compressBlock(m, bat.vecs, bat.positions)
      const { loss } = reconstructionLoss(m, compressed, { accumulateGrad: true })
      stepLoss += loss
    }
    sgdApply(bank, lr, batches.length)
    if (s === 0) loss0 = stepLoss / batches.length
    if (s === steps - 1) loss1 = stepLoss / batches.length
  }
  bank.meta.trainSteps += steps
  bank.meta.updatedAt = Date.now()
  if (append) {
    for (const bat of batches) {
      if (bank.blocks.length < bank.maxBlocks) {
        appendBlock(bank, bat.vecs, bat.positions, { id: bat.id })
      }
    }
  }
  return {
    ok: true,
    improved: loss1 < loss0,
    loss0,
    loss1,
    blocks: bank.blocks.length,
    trainSteps: bank.meta.trainSteps,
  }
}

/**
 * 从银行快照续训（优先 raw；否则用 pooled 再编码）。
 * @returns {{ok,improved,loss0,loss1,usedRaw,usedPooled,trainSteps}}
 */
export function trainFromBank(bank, { steps = 40, lr = 0.08, preferRaw = true } = {}) {
  const usable = bank.blocks.filter((b) => (preferRaw && b.raw && b.raw.length) || b.pooled)
  if (!usable.length) {
    return { ok: false, improved: false, note: 'no blocks with raw/pooled snapshots' }
  }

  const m = bank.model
  let loss0 = 0
  let loss1 = 0
  let usedRaw = 0
  let usedPooled = 0

  for (let s = 0; s < steps; s++) {
    clearGrads(bank)
    let stepLoss = 0
    for (const b of usable) {
      let compressed
      if (preferRaw && b.raw && b.raw.length) {
        compressed = compressBlock(m, b.raw, b.positions)
        if (s === 0) usedRaw += 1
      } else {
        const pooled = asNumArray(b.pooled)
        const code = matVec(m.Wdown, m.compressedDim, m.dim, pooled)
        compressed = {
          code,
          pooled,
          meanPos: b.meanPos,
          count: b.count,
          positions: b.positions,
        }
        if (s === 0) usedPooled += 1
      }
      const { loss } = reconstructionLoss(m, compressed, { accumulateGrad: true })
      stepLoss += loss
    }
    sgdApply(bank, lr, usable.length)
    if (s === 0) loss0 = stepLoss / usable.length
    if (s === steps - 1) loss1 = stepLoss / usable.length
  }

  // 续训后刷新 code（与当前权重对齐），保留 raw/pooled
  for (const b of bank.blocks) {
    if (b.raw && b.raw.length) {
      const c = compressBlock(m, b.raw, b.positions)
      b.code = asNumArray(c.code)
      b.pooled = asNumArray(c.pooled)
      b.meanPos = c.meanPos
    } else if (b.pooled) {
      b.code = asNumArray(matVec(m.Wdown, m.compressedDim, m.dim, asNumArray(b.pooled)))
    }
  }

  bank.meta.trainSteps += steps
  bank.meta.updatedAt = Date.now()
  return {
    ok: true,
    improved: loss1 < loss0,
    loss0,
    loss1,
    usedRaw,
    usedPooled,
    blocks: bank.blocks.length,
    trainSteps: bank.meta.trainSteps,
  }
}

export function serializeBank(bank) {
  return {
    kind: bank.kind || KV_BANK_KIND,
    dim: bank.dim,
    compressedDim: bank.compressedDim,
    theta: bank.theta,
    maxBlocks: bank.maxBlocks,
    keepRaw: !!bank.keepRaw,
    meta: { ...bank.meta },
    model: {
      kind: bank.model.kind,
      dim: bank.model.dim,
      compressedDim: bank.model.compressedDim,
      theta: bank.model.theta,
      Wdown: asNumArray(bank.model.Wdown),
      Wup: asNumArray(bank.model.Wup),
      note: bank.model.note,
    },
    blocks: bank.blocks.map((b) => ({
      id: b.id,
      code: asNumArray(b.code),
      pooled: b.pooled ? asNumArray(b.pooled) : null,
      raw: b.raw ? asVecList(b.raw) : null,
      meanPos: b.meanPos,
      count: b.count,
      positions: b.positions.slice(),
      at: b.at,
    })),
  }
}

export function deserializeBank(data) {
  if (!data || (data.kind !== KV_BANK_KIND && data.kind !== 'rra-kv-bank/0.1')) {
    throw new Error('invalid kv-bank payload')
  }
  const bank = createKvBank({
    dim: data.dim,
    compressedDim: data.compressedDim,
    theta: data.theta,
    maxBlocks: data.maxBlocks,
    keepRaw: data.keepRaw !== false,
  })
  bank.kind = KV_BANK_KIND
  bank.meta = { ...bank.meta, ...(data.meta || {}), schema: '0.2' }
  bank.model.Wdown = asNumArray(data.model.Wdown)
  bank.model.Wup = asNumArray(data.model.Wup)
  bank.model.dWdown = bank.model.Wdown.map(() => 0)
  bank.model.dWup = bank.model.Wup.map(() => 0)
  bank.blocks = (data.blocks || []).map((b) => ({
    id: b.id,
    code: asNumArray(b.code),
    pooled: b.pooled != null ? asNumArray(b.pooled) : null,
    raw: b.raw ? asVecList(b.raw) : null,
    meanPos: b.meanPos,
    count: b.count,
    positions: b.positions.slice(),
    at: b.at,
  }))
  return bank
}

export function saveBank(bank, filePath) {
  const payload = serializeBank(bank)
  mkdirSync(dirname(filePath), { recursive: true })
  const text = JSON.stringify(payload, null, 2)
  writeFileSync(filePath, text, 'utf8')
  return { ok: true, path: filePath, bytes: Buffer.byteLength(text) }
}

export function loadBank(filePath) {
  if (!existsSync(filePath)) throw new Error(`kv-bank missing: ${filePath}`)
  return deserializeBank(JSON.parse(readFileSync(filePath, 'utf8')))
}

export function describeBank(bank) {
  const withRaw = bank.blocks.filter((b) => b.raw && b.raw.length).length
  const withPooled = bank.blocks.filter((b) => b.pooled).length
  return {
    kind: bank.kind,
    blocks: bank.blocks.length,
    withRaw,
    withPooled,
    maxBlocks: bank.maxBlocks,
    dim: bank.dim,
    compressedDim: bank.compressedDim,
    trainSteps: bank.meta.trainSteps,
    schema: bank.meta.schema || '0.2',
    implemented: false,
    fullNeuralRra: false,
    note: bank.meta.note,
  }
}

/** 估算落盘字节（JSON 体积近似） */
export function estimateBankBytes(bank, { includeRaw = false, includePooled = true } = {}) {
  const slim = {
    kind: bank.kind,
    dim: bank.dim,
    compressedDim: bank.compressedDim,
    model: {
      Wdown: Array.from(bank.model.Wdown),
      Wup: Array.from(bank.model.Wup),
    },
    blocks: bank.blocks.map((b) => ({
      id: b.id,
      code: Array.from(b.code),
      meanPos: b.meanPos,
      count: b.count,
      positions: b.positions,
      pooled: includePooled && b.pooled ? Array.from(b.pooled) : undefined,
      raw: includeRaw && b.raw ? b.raw.map((v) => Array.from(v)) : undefined,
    })),
  }
  return Buffer.byteLength(JSON.stringify(slim))
}

/**
 * 压缩码热读：按 meanPos 距 queryPos 选最近 topK 块，readAt 后均值。
 * @returns {{vec, hits, queryPos}}
 */
export function hotRead(bank, queryPos, { topK = 4 } = {}) {
  if (!bank.blocks.length) {
    throw new Error('hotRead: empty bank')
  }
  const ranked = bank.blocks
    .map((b) => ({ b, dist: Math.abs((b.meanPos ?? 0) - queryPos) }))
    .sort((a, c) => a.dist - c.dist || a.b.meanPos - c.b.meanPos)
    .slice(0, Math.max(1, topK))

  const vecs = ranked.map(({ b }) => readAt(bank.model, {
    code: b.code,
    meanPos: b.meanPos,
  }, queryPos))
  return {
    vec: meanVec(vecs),
    hits: ranked.map(({ b, dist }) => ({ id: b.id, meanPos: b.meanPos, dist, count: b.count })),
    queryPos,
    topK: ranked.length,
  }
}

/**
 * 热读质量：对有 raw 的块，在块内位置读回 vs 原向量 RoPE 后的相对误差均值。
 */
export function hotReadQuality(bank, { samplesPerBlock = 1, topK = 1 } = {}) {
  const errs = []
  for (const b of bank.blocks) {
    if (!b.raw || !b.raw.length) continue
    const n = Math.min(samplesPerBlock, b.raw.length)
    for (let i = 0; i < n; i++) {
      const pos = b.positions[i]
      const got = hotRead(bank, pos, { topK }).vec
      const want = applyRope(b.raw[i], pos, bank.model.theta)
      errs.push(l2(got, want) / Math.max(1e-8, l2(want)))
    }
  }
  if (!errs.length) {
    return { ok: false, meanRel: null, n: 0, note: 'no raw blocks for quality' }
  }
  const meanRel = errs.reduce((a, c) => a + c, 0) / errs.length
  return { ok: true, meanRel, n: errs.length, maxRel: Math.max(...errs) }
}

function weightL2Diff(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    s += d * d
  }
  return Math.sqrt(s)
}

/** L6/M0：训 → 存 → 载 */
export function runKvBankRoundtrip({
  dim = 16,
  compressedDim = 4,
  steps = 30,
  lr = 0.1,
  filePath = null,
  batches = null,
} = {}) {
  const bank = createKvBank({ dim, compressedDim, keepRaw: true })
  const bats = batches || [
    { id: 't0', vecs: [randn(dim, 1), randn(dim, 1), randn(dim, 1), randn(dim, 1)], positions: [0, 1, 2, 3] },
    { id: 't1', vecs: [randn(dim, 1), randn(dim, 1), randn(dim, 1), randn(dim, 1)], positions: [4, 5, 6, 7] },
  ]
  const trained = trainOnRawBatch(bank, bats, { steps, lr, append: true })
  const hasSnapshots = bank.blocks.every((b) => b.pooled && b.raw && b.raw.length)
  if (!filePath) {
    return {
      ok: !!(trained.ok && trained.improved && hasSnapshots),
      trained,
      hasSnapshots,
      reloaded: null,
      implemented: false,
      fullNeuralRra: false,
      stage: 'L6-M1',
      note: 'no filePath · train-only',
    }
  }
  saveBank(bank, filePath)
  const loaded = loadBank(filePath)
  const sameBlocks = loaded.blocks.length === bank.blocks.length
  const wClose = weightL2Diff(bank.model.Wdown, loaded.model.Wdown) < 1e-9
    && weightL2Diff(bank.model.Wup, loaded.model.Wup) < 1e-9
  const snapOk = loaded.blocks.every((b) => b.pooled && b.raw && b.raw.length)
  return {
    ok: !!(trained.ok && trained.improved && sameBlocks && wClose && snapOk),
    trained,
    reloaded: describeBank(loaded),
    sameBlocks,
    wClose,
    snapOk,
    path: filePath,
    implemented: false,
    fullNeuralRra: false,
    stage: 'L6-M1',
    note: 'L6/M1 kv-bank roundtrip with snapshots · not full neural RRA',
  }
}

/** M1：训 → 存 → 载 → trainFromBank 续训 */
export function runKvBankContinueTrain({
  dim = 16,
  compressedDim = 4,
  steps = 25,
  continueSteps = 25,
  lr = 0.1,
  filePath,
} = {}) {
  const bank = createKvBank({ dim, compressedDim, keepRaw: true })
  const bats = [
    { id: 'c0', vecs: [randn(dim, 1), randn(dim, 1), randn(dim, 1), randn(dim, 1)], positions: [0, 1, 2, 3] },
    { id: 'c1', vecs: [randn(dim, 1), randn(dim, 1), randn(dim, 1), randn(dim, 1)], positions: [4, 5, 6, 7] },
  ]
  const first = trainOnRawBatch(bank, bats, { steps, lr, append: true })
  saveBank(bank, filePath)
  const loaded = loadBank(filePath)
  const stepsBefore = loaded.meta.trainSteps
  const cont = trainFromBank(loaded, { steps: continueSteps, lr, preferRaw: true })
  // 剥掉 raw，只留 pooled，验证 pooled 续训
  const pooledBank = deserializeBank(serializeBank(loaded))
  for (const b of pooledBank.blocks) b.raw = null
  const contPooled = trainFromBank(pooledBank, { steps: Math.max(10, Math.floor(continueSteps / 2)), lr, preferRaw: true })

  const ok = !!(
    first.ok && first.improved
    && cont.ok && cont.improved
    && cont.trainSteps > stepsBefore
    && cont.usedRaw >= 1
    && contPooled.ok
    && contPooled.usedPooled >= 1
  )
  return {
    ok,
    first,
    continued: cont,
    continuedPooled: contPooled,
    stepsBefore,
    stepsAfter: cont.trainSteps,
    path: filePath,
    implemented: false,
    fullNeuralRra: false,
    stage: 'L6-M1',
    note: 'M1 continue-train from raw + pooled snapshots · not full neural RRA',
  }
}
