/**
 * rra-proto 状态面 — L6/M2：长上下文热读；完整神经 RRA 仍未实现。
 */

export const PROTO_STATUS = {
  name: 'rra-proto',
  version: '0.8.0',
  stage: 'L6-M2',
  implemented: false,
  fullNeuralRra: false,
  layer: 'neural-proto',
  protocol: 'rra/0.8-proto-l6-m2',
  hasWeights: true,
  hasTrainLoop: true,
  trainLoopKind: 'toy-sgd + kv-bank + hot-read longctx',
  baselines: ['full-exact', 'fixed-window', 'uniform-stride', 'power-law-shell'],
  modules: ['baselines', 'rope', 'compress', 'l3-eval', 'l4-longctx', 'kv-bank', 'l6-m2-hotread'],
  note: 'L6/M2：压缩码热读+长上下文字节对照；不在 OW 启用神经路径。禁止 neural:true。',
  nextStage: 'M3',
  nextCut: '严格在线因果 + RoPE 一致的 apply 草图（仍可抛错至实现完成）',
  shellBridge: 'ow-rrm/0.1',
  owAdapter: 'dsh-open-world/bridge/rra-adapter.mjs',
  docs: '../dsh-open-world/RRA_NEURAL.md',
  productionDoc: './PRODUCTION.md',
}

export function describeProto() {
  return { ...PROTO_STATUS }
}

export function applyReciprocalResolutionAttention() {
  throw new Error('rra-proto L6/M2: full neural RRA apply not implemented. hot-read is scaffold-only; see PRODUCTION.md')
}
