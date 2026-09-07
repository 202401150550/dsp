/**
 * 大行李占位：Reciprocal-Resolution Attention（神经层）
 *
 * 完整版尖刀尚未实现。契约见 ../RRA_NEURAL.md
 * L5：薄适配器见 ./rra-adapter.mjs（默认关；显式 probe 才探测 rra-proto）
 * L6/M3：rra-proto 在线因果 + applyRraSketch；正式 apply 仍抛错
 * M4：OW 可选 sketch 挂载（rra.sketch 默认 false）≠ 启用神经路径
 *
 * 禁止：假 attention / neural:true / 把探测或 sketch 当神经已启用
 */

export const RRA_STATUS = {
  implemented: false,
  fullNeuralRra: false,
  layer: 'neural',
  protocol: 'rra/0.0-stub',
  stage: 'L6-M4',
  blockers: [
    'production-scale neural apply (real decoder + trained weights)',
  ],
  nextStage: 'production-apply',
  nextCut: '真解码器权重；M5-D dim/协议护栏已开；sketch≠完整 RRA',
  repoBoundary: 'dsh-open-world stub+adapter; prototype in dsp/rra-proto',
  protoPackage: 'rra-proto@0.10.0',
  protoPath: '../rra-proto',
  protoProtocol: 'rra/0.10-proto-m3',
  sketchAvailable: true,
  docs: 'RRA_NEURAL.md',
}

export const RRA_INPUT_KEYS = Object.freeze(['q', 'k_layers', 'positions', 'cfg', 'causal'])
export const RRA_OUTPUT_KEYS = Object.freeze(['context', 'meta', 'falsify'])

export function describeNeuralRra() {
  return {
    ...RRA_STATUS,
    shellBridge: 'ow-rrm/0.1',
    inputKeys: [...RRA_INPUT_KEYS],
    outputKeys: [...RRA_OUTPUT_KEYS],
    message: '神经 RRA 未实现；L6/M4 可可选跑 applyRraSketch（默认关）。正式 apply 仍抛错 · 壳层 ow-rrm/0.1。',
  }
}

export function assertShellDoesNotClaimNeural(memorySlim) {
  if (!memorySlim || typeof memorySlim !== 'object') return true
  if (memorySlim.neural === true) {
    throw new Error('honesty: memory.neural must not be true while RRA stub is off')
  }
  const stub = memorySlim.neuralStub
  if (stub && stub.implemented === true) {
    throw new Error('honesty: neuralStub.implemented must stay false until real runtime')
  }
  if (stub && stub.fullNeuralRra === true) {
    throw new Error('honesty: fullNeuralRra must stay false')
  }
  if (stub && stub.adapter && stub.adapter.neuralEnabled === true) {
    throw new Error('honesty: adapter.neuralEnabled must stay false')
  }
  return true
}

export function applyReciprocalResolutionAttention(input) {
  if (input != null && typeof input === 'object' && input.causal === false) {
    throw new Error('RRA rejects causal=false (online constraint). Neural path still unimplemented.')
  }
  throw new Error('RRA neural path not implemented (L6/M4 sketch is opt-in via rra.sketch; full apply still off). Use shell ow-rrm/0.1. See RRA_NEURAL.md')
}
