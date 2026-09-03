/**
 * L5 薄适配器：默认关闭；显式 rra.probe=true 才探测 rra-proto。
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
 * 组装 neuralStub（L5）。probe=false 时不碰磁盘。
 * @param {{ probe?: boolean }} rraCfg
 * @param {{ deep?: boolean, deepResult?: object }} [opts]
 */
export function buildNeuralStub(rraCfg = {}, opts = {}) {
  const cfg = mergeRraConfig(rraCfg)
  const base = describeNeuralRra()
  const adapter = {
    neuralEnabled: false,
    probe: !!cfg.probe,
    probed: false,
    deep: false,
    protoDir: null,
    proto: null,
    error: null,
    note: '薄适配器默认关；probe=true 仅探测包状态，不启用神经路径',
  }

  if (!cfg.probe) {
    return {
      ...base,
      adapter,
      message: '神经 RRA 未实现；L5 适配器未探测（rra.probe=false）。壳层仍用 ow-rrm/0.1。',
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
      ? `神经 RRA 未实现；已探测 rra-proto@${probed.proto?.version || '?'}（仍不启用）。`
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
