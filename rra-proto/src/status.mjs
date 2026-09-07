/**
 * rra-proto 状态面 — L6/M4：OW 可选 sketch 挂载（默认关）；
 * 完整神经 RRA 仍未实现（正式 apply 恒抛错）。
 */

export const PROTO_STATUS = {
  name: 'rra-proto',
  version: '0.10.0',
  stage: 'L6-M4',
  implemented: false,
  fullNeuralRra: false,
  layer: 'neural-proto',
  protocol: 'rra/0.10-proto-m4',
  hasWeights: true,
  hasTrainLoop: true,
  trainLoopKind: 'hand-written-grad sgd · frozen-normgate backbone · online causal · RoPE sketch · OW opt-in',
  baselines: ['full-exact', 'fixed-window', 'uniform-stride', 'power-law-shell', 'fixed-chunk', 'reciprocal-untrained', 'reciprocal-query', 'reciprocal-gate'],
  modules: [
    'baselines', 'rope', 'compress', 'l3-eval', 'l4-longctx', 'kv-bank', 'l6-m2-hotread',
    's1-backbone', 's1-adapter', 's1-train', 's1-beat', 's1-sketch-bridge', 'm5-rope-bridge', 'm5-dim-contract', 'decoder-weight-pack', 'm3-online', 'm3-apply',
  ],
  note: 'L6/M4：草图/对打/M5 护栏 + decoder-weight-pack 契约；正式 apply 仍抛错。禁止 neural:true。',
  nextStage: 'production-apply',
  nextCut: '接入真实解码器 checkpoint → decoder-weight-pack；activateProductionApply 目前恒拒',
  hasWeightRoundtrip: true,
  hasS1SketchBridge: true,
  hasM5RopeBridge: true,
  hasM5CompressWeights: true,
  hasM5DimContract: true,
  hasDecoderWeightPack: true,
  shellBridge: 'ow-rrm/0.1',
  owAdapter: 'dsh-open-world/bridge/rra-adapter.mjs',
  docs: '../dsh-open-world/RRA_NEURAL.md',
  productionDoc: './PRODUCTION.md',
}

export function describeProto() {
  return { ...PROTO_STATUS }
}

export function applyReciprocalResolutionAttention() {
  throw new Error(
    'rra-proto: full neural RRA apply not implemented. '
    + 'Need real decoder weight pack (see decoder-weight-pack.mjs / gate:decoder-pack). '
    + 'OW may use applyRraSketch via rra.sketch + optional compress_weights; PRODUCTION.md',
  )
}
