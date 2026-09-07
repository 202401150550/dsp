/**
 * 生产解码器压缩权重包契约（M6 护栏脚手架）。
 * - 定义未来真解码器权重包的字段与协议
 * - 明确拒绝：缺包、玩具 compress 冒充生产、假 implemented
 * - 不提供完整神经 apply；activateProductionApply 恒拒
 */
import { COMPRESS_WEIGHT_PROTOCOL } from './compress.mjs'
import { validateCompressWeightSnap, classifyDimScale } from './m5-dim-contract.mjs'

export const DECODER_WEIGHT_PACK_PROTOCOL = 'rra/0.11-decoder-compress-pack'

/** 已知玩具/实验 family，不得标成 production-ready */
export const TOY_FAMILIES = Object.freeze(['toy', 's1-backbone', 'rra-proto-toy', 'm5-rope'])

/**
 * 校验权重包外壳（可含嵌套 compress 快照）。
 */
export function validateDecoderWeightPack(pack, opts = {}) {
  const errors = []
  const warnings = []
  if (!pack || typeof pack !== 'object') {
    return { ok: false, errors: ['pack missing'], warnings, ready: false }
  }

  const protocol = String(pack.protocol || '')
  if (protocol !== DECODER_WEIGHT_PACK_PROTOCOL) {
    errors.push(`protocol want ${DECODER_WEIGHT_PACK_PROTOCOL} got ${protocol || '(empty)'}`)
  }
  if (pack.implemented === true || pack.fullNeuralRra === true) {
    errors.push('pack must not claim implemented/fullNeuralRra')
  }

  const family = String(pack.family || '')
  if (!family) errors.push('family missing')
  if (TOY_FAMILIES.includes(family) && opts.requireProductionFamily) {
    errors.push(`family=${family} is toy/experimental; not production`)
  }

  const dim = Number(pack.dim)
  if (!Number.isFinite(dim) || dim <= 0 || dim % 2 !== 0) errors.push(`bad dim=${pack.dim}`)
  const scale = classifyDimScale(dim)
  if (opts.requireProductionDim && scale !== 'production-candidate' && scale !== 'beyond-toy') {
    errors.push(`dim=${dim} scale=${scale} too small for production-candidate gate`)
  }

  const source = pack.source || pack.weightsSource
  if (opts.requireSource && !source) errors.push('source missing')

  let compress = null
  if (pack.compress) {
    compress = validateCompressWeightSnap(pack.compress, { qDim: opts.qDim ?? dim })
    if (!compress.ok) errors.push(...compress.errors.map((e) => `compress.${e}`))
    if (pack.compress.protocol === COMPRESS_WEIGHT_PROTOCOL && opts.forbidToyCompressAsProduction) {
      // 玩具协议可以嵌在实验包里，但标 productionReady 则拒
      if (pack.productionReady === true) {
        errors.push('toy compress protocol cannot be productionReady')
      }
    }
  } else if (opts.requireCompress) {
    errors.push('compress snapshot missing')
  }

  if (pack.productionReady === true && !opts.allowProductionReadyFlag) {
    // 脚手架阶段：即使字段齐全也不允许 productionReady=true（尚无真解码器）
    errors.push('productionReady=true forbidden until real decoder weights land')
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    ready: false,
    family: family || undefined,
    dim: Number.isFinite(dim) ? dim : undefined,
    scale,
    protocol,
    compressOk: compress ? compress.ok : null,
    implemented: false,
    fullNeuralRra: false,
  }
}

/**
 * 尝试打开生产路径：当前阶段一律不可激活完整 apply。
 */
export function tryOpenDecoderWeightPack(pack, opts = {}) {
  const v = validateDecoderWeightPack(pack, {
    requireCompress: true,
    requireSource: true,
    forbidToyCompressAsProduction: true,
    allowProductionReadyFlag: false,
    ...opts,
  })
  if (!v.ok) {
    return { ok: false, opened: false, ...v, error: v.errors.join('; ') }
  }
  return {
    ok: true,
    opened: true,
    activated: false,
    reason: 'pack structure ok · production apply still blocked (no real decoder)',
    ...v,
  }
}

/** 正式生产 apply 激活口：恒拒（诚实） */
export function activateProductionApply(_pack) {
  return {
    ok: false,
    activated: false,
    implemented: false,
    fullNeuralRra: false,
    error: 'activateProductionApply: real decoder weights not available; applyReciprocalResolutionAttention still throws',
  }
}

export function runDecoderWeightPackEval() {
  const toyCompress = {
    protocol: COMPRESS_WEIGHT_PROTOCOL,
    dim: 32,
    compressedDim: 8,
    Wdown: Array(8 * 32).fill(0.01),
    Wup: Array(32 * 8).fill(0.01),
  }

  const structuralOk = {
    protocol: DECODER_WEIGHT_PACK_PROTOCOL,
    family: 'future-decoder',
    dim: 512,
    source: 'pending-real-checkpoint',
    compress: {
      protocol: COMPRESS_WEIGHT_PROTOCOL,
      dim: 512,
      compressedDim: 64,
      Wdown: Array(64 * 512).fill(0),
      Wup: Array(512 * 64).fill(0),
    },
    productionReady: false,
    implemented: false,
    fullNeuralRra: false,
  }

  const missing = validateDecoderWeightPack(null)
  const badProto = validateDecoderWeightPack({ ...structuralOk, protocol: 'rra/0.10-compress-weights' })
  const toyAsProd = validateDecoderWeightPack({
    ...structuralOk,
    family: 'toy',
    productionReady: true,
    compress: toyCompress,
  }, { requireProductionFamily: true, forbidToyCompressAsProduction: true, allowProductionReadyFlag: false })
  const claimReady = validateDecoderWeightPack({
    ...structuralOk,
    productionReady: true,
  }, { allowProductionReadyFlag: false })
  const openOk = tryOpenDecoderWeightPack(structuralOk)
  const activate = activateProductionApply(structuralOk)

  const ok = !missing.ok
    && !badProto.ok
    && !toyAsProd.ok
    && !claimReady.ok
    && openOk.ok
    && openOk.opened === true
    && openOk.activated === false
    && activate.ok === false
    && activate.fullNeuralRra === false

  return {
    ok,
    checks: {
      rejectMissing: !missing.ok,
      rejectBadProtocol: !badProto.ok,
      rejectToyAsProduction: !toyAsProd.ok,
      rejectProductionReadyFlag: !claimReady.ok,
      openStructural: openOk.ok && openOk.opened && !openOk.activated,
      activateBlocked: !activate.ok,
    },
    samples: {
      openReason: openOk.reason,
      activateError: activate.error,
      toyErrors: toyAsProd.errors,
    },
    note: 'decoder weight pack contract · structure may open · apply stays blocked · not full neural RRA',
    implemented: false,
    fullNeuralRra: false,
  }
}
