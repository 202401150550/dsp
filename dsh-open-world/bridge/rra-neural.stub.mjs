/**
 * 大行李占位：Reciprocal-Resolution Attention（神经层）
 *
 * 完整版尖刀尚未实现。契约见 ../RRA_NEURAL.md
 * L5：薄适配器见 ./rra-adapter.mjs（默认关；显式 probe 才探测 rra-proto）
 * L6：rra-proto 已有可持久 kv-bank 脚手架（仍非完整 apply）
 *
 * 禁止：假 attention / neural:true / 把探测结果当神经已启用
 */

export const RRA_STATUS = {
  implemented: false,
  fullNeuralRra: false,
  layer: 'neural',
  protocol: 'rra/0.0-stub',
  stage: 'L6-M2',
  blockers: [
    'online causal apply sketch (M3)',
    'OW optional real apply mount default-off (M4)',
  ],
  nextStage: 'M3',
  nextCut: '严格在线因果 + RoPE 一致的 apply 草图',
  repoBoundary: 'dsh-open-world stub+adapter; prototype in dsp/rra-proto',
  protoPackage: 'rra-proto@0.8.0',
  protoPath: '../rra-proto',
  protoProtocol: 'rra/0.8-proto-l6-m2',
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
    message: '神经 RRA 未实现；L6/M2 仅热读/字节对照脚手架。OW 适配器仍 probe-only · 壳层 ow-rrm/0.1。',
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
  throw new Error('RRA neural path not implemented (L6/M2 hot-read is scaffold-only; OW adapter probe-only). Use shell ow-rrm/0.1. See RRA_NEURAL.md')
}
