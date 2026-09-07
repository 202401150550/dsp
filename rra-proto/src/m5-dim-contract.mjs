/**
 * M5-D · 压缩权重 dim / 协议契约（通向真实尺度的护栏，不是真解码器）。
 * - 校验 protocol、形状、q.dim 对齐
 * - 标注尺度档（toy / ladder / beyond-toy）
 * - 拒绝「生产已实现」类假协议
 * 正式 applyReciprocalResolutionAttention 仍抛错。
 */
import { COMPRESS_WEIGHT_PROTOCOL } from './compress.mjs'

/** 本包已门禁过的玩具阶梯 dim（M5-R） */
export const TOY_LADDER_DIMS = Object.freeze([16, 32, 64, 128])

/** 明确禁止的「假装生产」协议前缀 / 标签 */
export const FORBIDDEN_PRODUCTION_PROTOCOLS = Object.freeze([
  'rra/1.',
  'rra/prod',
  'neural-rra/full',
  'full-neural-rra',
])

export function classifyDimScale(dim) {
  const d = Number(dim)
  if (!Number.isFinite(d) || d <= 0 || d % 2 !== 0) return 'invalid'
  if (TOY_LADDER_DIMS.includes(d)) return 'toy-ladder'
  if (d <= 256) return 'beyond-toy-small'
  if (d <= 4096) return 'beyond-toy'
  return 'production-candidate'
}

/**
 * 校验压缩权重快照本身（不读盘）。
 * @returns {{ ok: boolean, errors: string[], warnings: string[], scale: string, dim?: number, compressedDim?: number }}
 */
export function validateCompressWeightSnap(snap, opts = {}) {
  const errors = []
  const warnings = []
  if (!snap || typeof snap !== 'object') {
    return { ok: false, errors: ['snap missing'], warnings, scale: 'invalid' }
  }

  const protocol = String(snap.protocol || '')
  if (protocol !== COMPRESS_WEIGHT_PROTOCOL) {
    errors.push(`protocol want ${COMPRESS_WEIGHT_PROTOCOL} got ${protocol || '(empty)'}`)
  }
  for (const bad of FORBIDDEN_PRODUCTION_PROTOCOLS) {
    if (protocol.startsWith(bad) || protocol === bad) {
      errors.push(`forbidden production-claim protocol: ${protocol}`)
    }
  }
  if (snap.fullNeuralRra === true || snap.implemented === true) {
    errors.push('snap must not claim implemented/fullNeuralRra')
  }

  const dim = Number(snap.dim)
  const compressedDim = Number(snap.compressedDim)
  if (!Number.isFinite(dim) || dim <= 0 || dim % 2 !== 0) errors.push(`bad dim=${snap.dim}`)
  if (!Number.isFinite(compressedDim) || compressedDim <= 0) errors.push(`bad compressedDim=${snap.compressedDim}`)

  const scale = classifyDimScale(dim)
  if (scale === 'invalid') errors.push('dim scale invalid')

  if (Array.isArray(snap.Wdown) && Number.isFinite(dim) && Number.isFinite(compressedDim)) {
    const wantDown = compressedDim * dim
    if (snap.Wdown.length !== wantDown) errors.push(`Wdown length ${snap.Wdown.length} ≠ ${wantDown}`)
  } else if (!Array.isArray(snap.Wdown)) {
    errors.push('Wdown missing')
  }
  if (Array.isArray(snap.Wup) && Number.isFinite(dim) && Number.isFinite(compressedDim)) {
    const wantUp = dim * compressedDim
    if (snap.Wup.length !== wantUp) errors.push(`Wup length ${snap.Wup.length} ≠ ${wantUp}`)
  } else if (!Array.isArray(snap.Wup)) {
    errors.push('Wup missing')
  }

  if (opts.requireToyLadder && scale !== 'toy-ladder') {
    errors.push(`requireToyLadder but scale=${scale} dim=${dim}`)
  }
  if (scale === 'beyond-toy' || scale === 'beyond-toy-small' || scale === 'production-candidate') {
    warnings.push(`dim=${dim} is ${scale}: not covered by gate:m5-rope toy ladder; still not a real decoder`)
  }

  const qDim = opts.qDim
  if (qDim != null) {
    const q = Number(qDim)
    if (q !== dim) errors.push(`compress weight dim ${dim} != q.length ${q}`)
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    scale,
    dim: Number.isFinite(dim) ? dim : undefined,
    compressedDim: Number.isFinite(compressedDim) ? compressedDim : undefined,
    protocol,
    implemented: false,
    fullNeuralRra: false,
  }
}

/**
 * 查询态与模型 dim 对齐（运行时护栏）。
 */
export function assertQueryMatchesCompressModel(model, q) {
  if (!model) return { ok: false, error: 'model missing' }
  if (!q || !q.length) return { ok: false, error: 'q missing' }
  if (model.dim !== q.length) {
    return {
      ok: false,
      error: `compress weight dim ${model.dim} != q.length ${q.length}`,
      modelDim: model.dim,
      qDim: q.length,
    }
  }
  return { ok: true, dim: model.dim, scale: classifyDimScale(model.dim) }
}

/**
 * 门禁用：自检契约逻辑。
 */
export function runM5DimContractEval() {
  const good = {
    protocol: COMPRESS_WEIGHT_PROTOCOL,
    dim: 32,
    compressedDim: 8,
    Wdown: Array(8 * 32).fill(0.01),
    Wup: Array(32 * 8).fill(0.01),
    note: 'toy',
  }
  const vGood = validateCompressWeightSnap(good, { qDim: 32, requireToyLadder: true })
  const vMismatch = validateCompressWeightSnap(good, { qDim: 16 })
  const vFake = validateCompressWeightSnap({
    ...good,
    protocol: 'rra/1.0-full-neural',
    implemented: true,
    fullNeuralRra: true,
  })
  const vOdd = validateCompressWeightSnap({ ...good, dim: 31, Wdown: Array(8 * 31).fill(0), Wup: Array(31 * 8).fill(0) })
  const vWide = validateCompressWeightSnap({
    protocol: COMPRESS_WEIGHT_PROTOCOL,
    dim: 512,
    compressedDim: 64,
    Wdown: Array(64 * 512).fill(0),
    Wup: Array(512 * 64).fill(0),
  }, { requireToyLadder: true })

  const match = assertQueryMatchesCompressModel({ dim: 32 }, new Float64Array(32))
  const badMatch = assertQueryMatchesCompressModel({ dim: 32 }, new Float64Array(16))

  const ok = vGood.ok
    && !vMismatch.ok
    && !vFake.ok
    && !vOdd.ok
    && !vWide.ok
    && match.ok
    && !badMatch.ok
    && vGood.scale === 'toy-ladder'
    && classifyDimScale(128) === 'toy-ladder'
    && classifyDimScale(512) === 'beyond-toy'

  return {
    ok,
    checks: {
      goodSnap: vGood.ok,
      rejectQMismatch: !vMismatch.ok,
      rejectFakeProd: !vFake.ok,
      rejectOddDim: !vOdd.ok,
      rejectWideUnderToyLadder: !vWide.ok,
      assertMatch: match.ok,
      assertReject: !badMatch.ok,
    },
    samples: {
      good: vGood,
      mismatch: vMismatch.errors,
      fake: vFake.errors,
      wide: vWide.errors,
    },
    note: 'M5-D dim/protocol contract · not a real decoder · fullNeuralRra=false',
    implemented: false,
    fullNeuralRra: false,
  }
}
