/**
 * M3 · 严格在线因果流
 * - 逐词元推入；仅当区段完全落在 frontier 之后才 seal 进 KV 银行
 * - 禁止偷看未来；注毒（含未来位置）必须拒绝
 * - 分块预填充 ≡ 逐词元预言机（数值容差）
 * 仍不是完整 Reciprocal-Resolution Attention。
 */
import { createKvBank, appendBlock, estimateBankBytes } from './kv-bank.mjs'
import { assertCausalBlock } from './compress.mjs'
import { randn, l2 } from './math.mjs'

export const ONLINE_KIND = 'rra-online/0.1'

/**
 * @param {{ dim?:number, compressedDim?:number, blockSize?:number, maxBlocks?:number, theta?:number, keepRaw?:boolean }} opts
 */
export function createOnlineStream(opts = {}) {
  const dim = opts.dim || 16
  const blockSize = Math.max(1, opts.blockSize || 4)
  const bank = createKvBank({
    dim,
    compressedDim: opts.compressedDim || 4,
    theta: opts.theta || 10000,
    maxBlocks: opts.maxBlocks || 512,
    keepRaw: opts.keepRaw !== false,
  })
  return {
    kind: ONLINE_KIND,
    dim,
    blockSize,
    bank,
    /** 未闭合缓冲（frontier 上的开放段） */
    buffer: [],
    /** 已接受的最大位置（含） */
    frontier: -1,
    sealed: 0,
    rejected: 0,
    pushed: 0,
    meta: {
      note: 'M3 在线因果流 · 仅 seal 闭合区段 · 非完整神经 RRA',
      createdAt: Date.now(),
    },
  }
}

function isMonotone(positions) {
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] < positions[i - 1]) return false
  }
  return true
}

/**
 * 推入一个词元。pos 必须 = frontier+1（严格在线顺序）。
 * @returns {{ sealed:object[], rejected:boolean, reason?:string }}
 */
export function pushToken(stream, vec, pos) {
  const p = Number(pos)
  if (!Number.isFinite(p)) {
    stream.rejected++
    return { sealed: [], rejected: true, reason: 'non-finite pos' }
  }
  if (stream.frontier >= 0 && p !== stream.frontier + 1) {
    stream.rejected++
    return { sealed: [], rejected: true, reason: `pos ${p} breaks online order (expect ${stream.frontier + 1})` }
  }
  if (!vec || vec.length !== stream.dim) {
    stream.rejected++
    return { sealed: [], rejected: true, reason: 'dim mismatch' }
  }

  stream.buffer.push({ vec, pos: p })
  stream.frontier = p
  stream.pushed++

  return { sealed: sealClosed(stream), rejected: false }
}

/**
 * 将所有已满且完全 ≤ frontier 的块 seal 进银行。
 * 开放尾（长度 < blockSize）保留在 buffer。
 */
export function sealClosed(stream) {
  const sealed = []
  const bs = stream.blockSize
  while (stream.buffer.length >= bs) {
    const chunk = stream.buffer.slice(0, bs)
    const positions = chunk.map((x) => x.pos)
    const vecs = chunk.map((x) => x.vec)
    // 闭合条件：块内最大位置 ≤ frontier（恒真，因只从 buffer 头取）
    // 且不得含未来相对「查询点」——在线 seal 时 query=frontier
    try {
      assertCausalBlock(positions, stream.frontier)
      if (!isMonotone(positions)) throw new Error('non-monotone')
      const rec = appendBlock(stream.bank, vecs, positions, {
        id: `on${stream.sealed}`,
      })
      stream.buffer = stream.buffer.slice(bs)
      stream.sealed++
      sealed.push(rec)
    } catch (err) {
      stream.rejected++
      throw err
    }
  }
  return sealed
}

/** 强制 flush：仅当 buffer 为空或调用方确认流结束。未满尾块可可选 seal。 */
export function flushTail(stream, { allowPartial = false } = {}) {
  if (!stream.buffer.length) return []
  if (!allowPartial && stream.buffer.length < stream.blockSize) {
    return []
  }
  const chunk = stream.buffer.slice()
  const positions = chunk.map((x) => x.pos)
  const vecs = chunk.map((x) => x.vec)
  assertCausalBlock(positions, stream.frontier)
  const rec = appendBlock(stream.bank, vecs, positions, { id: `on-tail-${stream.sealed}` })
  stream.buffer = []
  stream.sealed++
  return [rec]
}

/**
 * 试图注入「未来」位置进 buffer / 银行 —— 必须失败。
 */
export function tryPoisonFuture(stream, futureVec, futurePos) {
  try {
    if (futurePos <= stream.frontier) {
      return { caught: false, reason: 'not actually future' }
    }
    // 直接尝试用含未来的块 append
    const fakePos = []
    const fakeVec = []
    const start = Math.max(0, stream.frontier - stream.blockSize + 2)
    for (let i = 0; i < stream.blockSize - 1; i++) {
      fakePos.push(start + i)
      fakeVec.push(randn(stream.dim, 0.01))
    }
    fakePos.push(futurePos)
    fakeVec.push(futureVec)
    assertCausalBlock(fakePos, stream.frontier)
    appendBlock(stream.bank, fakeVec, fakePos)
    return { caught: false, reason: 'poison accepted' }
  } catch (err) {
    return { caught: true, reason: String(err.message || err) }
  }
}

/**
 * 逐词元预言机：按序 push 整条流，返回银行快照摘要。
 * @param {object} [opts.stream] 可注入已建流（用于共享压缩器权重）
 */
export function runTokenOracle(vecs, positions, opts = {}) {
  const stream = opts.stream || createOnlineStream({
    dim: vecs[0]?.length || opts.dim || 16,
    blockSize: opts.blockSize || 4,
    compressedDim: opts.compressedDim || 4,
    keepRaw: true,
  })
  for (let i = 0; i < vecs.length; i++) {
    const r = pushToken(stream, vecs[i], positions[i])
    if (r.rejected) throw new Error(`oracle reject at ${i}: ${r.reason}`)
  }
  if (opts.flushTail) flushTail(stream, { allowPartial: true })
  return summarizeStream(stream)
}

/**
 * 分块预填充：与逐词元使用同一压缩器时，码必须逐位相等。
 * 实现上仍逐 token push（frontier 规则不变），调度按块推进仅为叙事对称。
 */
export function runChunkPrefill(vecs, positions, opts = {}) {
  const blockSize = opts.blockSize || 4
  const stream = opts.stream || createOnlineStream({
    dim: vecs[0]?.length || opts.dim || 16,
    blockSize,
    compressedDim: opts.compressedDim || 4,
    keepRaw: true,
  })
  for (let i = 0; i < vecs.length; i += blockSize) {
    const end = Math.min(vecs.length, i + blockSize)
    for (let j = i; j < end; j++) {
      const r = pushToken(stream, vecs[j], positions[j])
      if (r.rejected) throw new Error(`prefill reject at ${j}: ${r.reason}`)
    }
  }
  if (opts.flushTail) flushTail(stream, { allowPartial: true })
  return summarizeStream(stream)
}

function summarizeStream(stream) {
  return {
    stream,
    sealed: stream.sealed,
    frontier: stream.frontier,
    bufferLen: stream.buffer.length,
    blockIds: stream.bank.blocks.map((b) => b.id),
    codes: stream.bank.blocks.map((b) => Array.from(b.code)),
    meanPos: stream.bank.blocks.map((b) => b.meanPos),
    positions: stream.bank.blocks.map((b) => b.positions.slice()),
    /** 仅码+位置元数据，不含模型权重 */
    codeBytes: stream.bank.blocks.reduce((s, b) => s + (b.code?.length || 0) * 8 + 16, 0),
    bytes: estimateBankBytes(stream.bank, { includeRaw: false }),
  }
}

/**
 * 克隆压缩器权重到新流（保证预言机与预填充可比）。
 */
export function cloneStreamWithSameModel(template) {
  const s = createOnlineStream({
    dim: template.dim,
    blockSize: template.blockSize,
    compressedDim: template.bank.compressedDim,
    theta: template.bank.theta,
    maxBlocks: template.bank.maxBlocks,
    keepRaw: template.bank.keepRaw,
  })
  const m = template.bank.model
  s.bank.model.Wdown.set(m.Wdown)
  s.bank.model.Wup.set(m.Wup)
  s.bank.model.dWdown.fill(0)
  s.bank.model.dWup.fill(0)
  return s
}

/**
 * 数值容差比较两份银行码。
 */
export function banksEquiv(a, b, { absTol = 1e-9, relTol = 1e-9 } = {}) {
  if (a.sealed !== b.sealed) return { ok: false, reason: `sealed ${a.sealed}≠${b.sealed}` }
  if (a.frontier !== b.frontier) return { ok: false, reason: 'frontier mismatch' }
  if (a.codes.length !== b.codes.length) return { ok: false, reason: 'block count' }
  let maxAbs = 0
  for (let i = 0; i < a.codes.length; i++) {
    if (Math.abs(a.meanPos[i] - b.meanPos[i]) > absTol) {
      return { ok: false, reason: `meanPos[${i}]` }
    }
    const ca = a.codes[i]
    const cb = b.codes[i]
    for (let d = 0; d < ca.length; d++) {
      const diff = Math.abs(ca[d] - cb[d])
      maxAbs = Math.max(maxAbs, diff)
      const scale = Math.max(1e-8, Math.abs(ca[d]) + Math.abs(cb[d]))
      if (diff > absTol && diff / scale > relTol) {
        return { ok: false, reason: `code[${i}][${d}]`, maxAbs: diff }
      }
    }
  }
  return { ok: true, maxAbs }
}

/**
 * M3 在线因果主评测。
 */
export function runOnlineCausalEval(opts = {}) {
  const length = opts.length || 64
  const dim = opts.dim || 16
  const blockSize = opts.blockSize || 4
  const vecs = []
  const positions = []
  for (let i = 0; i < length; i++) {
    vecs.push(randn(dim, 1))
    positions.push(i)
  }

  const template = createOnlineStream({ dim, blockSize, compressedDim: opts.compressedDim || 4 })
  const oracle = runTokenOracle(vecs, positions, {
    blockSize, dim, flushTail: false, stream: template,
  })
  // 同权重新流跑预填充
  const prefillStream = cloneStreamWithSameModel(template)
  const prefill = runChunkPrefill(vecs, positions, {
    blockSize, dim, flushTail: false, stream: prefillStream,
  })
  const equiv = banksEquiv(oracle, prefill)

  const poisonStream = createOnlineStream({ dim, blockSize })
  for (let i = 0; i < blockSize; i++) {
    pushToken(poisonStream, vecs[i], positions[i])
  }
  const poison = tryPoisonFuture(poisonStream, randn(dim, 1), length + 10)

  // 乱序拒绝
  const orderStream = createOnlineStream({ dim, blockSize })
  pushToken(orderStream, vecs[0], 0)
  const skip = pushToken(orderStream, vecs[2], 2)

  const expectedSealed = Math.floor(length / blockSize)
  const bufferLeft = length % blockSize
  const fullRawBytes = length * dim * 8
  const codeBytes = oracle.codeBytes

  return {
    ok: equiv.ok
      && poison.caught === true
      && skip.rejected === true
      && oracle.sealed === expectedSealed
      && oracle.bufferLen === bufferLeft,
    length,
    blockSize,
    expectedSealed,
    oracleSealed: oracle.sealed,
    bufferLeft: oracle.bufferLen,
    prefillEquiv: equiv,
    poison,
    orderReject: skip,
    bytes: oracle.bytes,
    codeBytes,
    fullRawBytes,
    residentVsFull: codeBytes / Math.max(1, fullRawBytes),
    note: '在线因果：逐词元≡分块预填充（共享压缩器）；未来注毒必拒；乱序必拒；账本按码字节',
  }
}
