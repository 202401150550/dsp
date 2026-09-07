/**
 * L5/M4 薄适配器：默认关闭。
 * - rra.probe=true → 探测 rra-proto 状态（不启用神经）
 * - rra.sketch=true → 允许动态调用 applyRraSketch（仍 implemented:false）
 * 永不打开 memory.neural / implemented / fullNeuralRra。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  describeNeuralRra,
  assertShellDoesNotClaimNeural,
  applyReciprocalResolutionAttention,
  RRA_STATUS,
} from './rra-neural.stub.mjs'

export function defaultRraConfig() {
  return {
    /** 显式开关：探测独立包状态；默认 false */
    probe: false,
    /** M4：允许跑 applyRraSketch；默认 false；≠ 完整神经 RRA */
    sketch: false,
  }
}

export function mergeRraConfig(partial) {
  return { ...defaultRraConfig(), ...(partial || {}) }
}

function adapterRoot() {
  return dirname(fileURLToPath(import.meta.url))
}

/** 解析 rra-proto 包路径候选 */
export function resolveRraProtoDir() {
  const here = adapterRoot()
  const candidates = [
    join(here, '..', '..', 'rra-proto'),
    join(process.cwd(), 'rra-proto'),
    join(process.cwd(), '..', 'rra-proto'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'package.json'))) return dir
  }
  return null
}

/**
 * 同步轻探测：只读 package.json，不 import 运行时、不跑训练。
 */
export function probeRraProtoSync() {
  const dir = resolveRraProtoDir()
  if (!dir) {
    return { ok: false, error: 'rra-proto package.json not found', dir: null, proto: null }
  }
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    return {
      ok: true,
      error: null,
      dir,
      proto: {
        name: pkg.name || 'rra-proto',
        version: pkg.version || null,
        description: pkg.description || null,
        implemented: false,
        fullNeuralRra: false,
        source: 'package.json',
      },
    }
  } catch (err) {
    return { ok: false, error: String(err.message || err), dir, proto: null }
  }
}

/**
 * 异步深探测：动态 import describeProto（仍不启用神经 apply）。
 */
export async function probeRraProtoDeep() {
  const sync = probeRraProtoSync()
  if (!sync.ok || !sync.dir) return { ...sync, deep: false }
  const statusPath = join(sync.dir, 'src', 'status.mjs')
  if (!existsSync(statusPath)) {
    return { ...sync, deep: false, error: sync.error || 'status.mjs missing' }
  }
  try {
    const mod = await import(pathToFileURL(statusPath).href)
    const st = typeof mod.describeProto === 'function' ? mod.describeProto() : null
    return {
      ok: true,
      deep: true,
      error: null,
      dir: sync.dir,
      proto: {
        name: st?.name || sync.proto?.name,
        version: st?.version || sync.proto?.version,
        stage: st?.stage || null,
        protocol: st?.protocol || null,
        implemented: false,
        fullNeuralRra: false,
        hasWeights: !!st?.hasWeights,
        modules: st?.modules || null,
        note: st?.note || null,
        source: 'describeProto',
      },
    }
  } catch (err) {
    return {
      ...sync,
      deep: false,
      error: String(err.message || err),
    }
  }
}

/**
 * M4：在 sketch=true 时动态加载 applyRraSketch。
 * sketch=false → 拒绝。正式 applyReciprocalResolutionAttention 仍抛错。
 */
export async function tryApplyRraSketch(input, rraCfg = {}) {
  const cfg = mergeRraConfig(rraCfg)
  if (!cfg.sketch) {
    return {
      ok: false,
      skipped: true,
      error: 'rra.sketch=false (M4 default-off)',
      implemented: false,
      fullNeuralRra: false,
    }
  }
  if (input && input.causal === false) {
    return {
      ok: false,
      skipped: false,
      error: 'causal must be true',
      implemented: false,
      fullNeuralRra: false,
    }
  }
  const dir = resolveRraProtoDir()
  if (!dir) {
    return { ok: false, skipped: false, error: 'rra-proto not found', implemented: false, fullNeuralRra: false }
  }
  const applyPath = join(dir, 'src', 'm3-apply.mjs')
  if (!existsSync(applyPath)) {
    return { ok: false, skipped: false, error: 'm3-apply.mjs missing', implemented: false, fullNeuralRra: false }
  }
  try {
    const mod = await import(pathToFileURL(applyPath).href)
    if (typeof mod.applyRraSketch !== 'function') {
      return { ok: false, error: 'applyRraSketch export missing', implemented: false, fullNeuralRra: false }
    }
    const out = mod.applyRraSketch({ ...input, causal: true })
    return {
      ok: true,
      skipped: false,
      sketch: true,
      implemented: false,
      fullNeuralRra: false,
      output: {
        context: out.context,
        meta: {
          ...(out.meta || {}),
          sketch: true,
          implemented: false,
          fullNeuralRra: false,
          via: 'dsh-open-world/rra-adapter tryApplyRraSketch',
        },
        falsify: out.falsify ?? null,
      },
      note: 'M4 sketch mount · not full neural RRA',
    }
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: String(err.message || err),
      implemented: false,
      fullNeuralRra: false,
    }
  }
}

/**
 * 组装 neuralStub（L5/M4）。probe=false 时不碰磁盘。
 * @param {{ probe?: boolean, sketch?: boolean }} rraCfg
 * @param {{ deep?: boolean, deepResult?: object }} [opts]
 */
export function buildNeuralStub(rraCfg = {}, opts = {}) {
  const cfg = mergeRraConfig(rraCfg)
  const base = describeNeuralRra()
  const adapter = {
    neuralEnabled: false,
    probe: !!cfg.probe,
    sketch: !!cfg.sketch,
    sketchAvailable: true,
    probed: false,
    deep: false,
    protoDir: null,
    proto: null,
    error: null,
    note: cfg.sketch
      ? 'M4 sketch 开关开：可 tryApplyRraSketch；neuralEnabled 仍 false'
      : '薄适配器默认关；probe/sketch 显式开才探测/跑草图，不启用神经路径',
  }

  if (!cfg.probe) {
    return {
      ...base,
      adapter,
      message: cfg.sketch
        ? '神经 RRA 未实现；sketch 开关开但未探测包（建议同时 probe）。壳层 ow-rrm/0.1。'
        : '神经 RRA 未实现；L5/M4 适配器未探测（rra.probe=false）。壳层仍用 ow-rrm/0.1。',
    }
  }

  const probed = opts.deepResult || probeRraProtoSync()
  adapter.probed = true
  adapter.deep = !!opts.deepResult?.deep
  adapter.protoDir = probed.dir
  adapter.error = probed.error || null
  adapter.proto = probed.proto
    ? {
      ...probed.proto,
      implemented: false,
      fullNeuralRra: false,
    }
    : null

  return {
    ...base,
    implemented: false,
    fullNeuralRra: false,
    adapter,
    message: probed.ok
      ? `神经 RRA 未实现；已探测 rra-proto@${probed.proto?.version || '?'}${cfg.sketch ? ' · sketch 可挂' : ''}（仍不启用完整神经）。`
      : `神经 RRA 未实现；探测失败：${probed.error || 'unknown'}`,
  }
}

/** 写入 memory 并做诚实断言 */
export function attachNeuralStubToMemory(memory, rraCfg = {}, opts = {}) {
  memory.neural = false
  memory.neuralStub = buildNeuralStub(rraCfg, opts)
  assertShellDoesNotClaimNeural(memory)
  return memory.neuralStub
}

export async function attachNeuralStubToMemoryAsync(memory, rraCfg = {}) {
  const cfg = mergeRraConfig(rraCfg)
  if (!cfg.probe) {
    return attachNeuralStubToMemory(memory, cfg)
  }
  const deepResult = await probeRraProtoDeep()
  return attachNeuralStubToMemory(memory, cfg, { deepResult })
}

export {
  describeNeuralRra,
  assertShellDoesNotClaimNeural,
  applyReciprocalResolutionAttention,
  RRA_STATUS,
}
