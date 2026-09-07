#!/usr/bin/env node
/**
 * M5-R 门禁：
 * 1) RoPE 银行 → applyRraSketch(readAt)（vs pooled 有差）
 * 2) 压缩权重训→存→载→sketch/readAt 一致
 * 3) 更大 dim=128 冒烟（仍玩具，非真实解码器）
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runM5RopeBridgeGate } from '../src/m5-rope-bridge.mjs'
import { describeProto } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const t0 = Date.now()
const report = runM5RopeBridgeGate({
  length: 96,
  dim: 32,
  trainSteps: 80,
  seed: 17,
  outDir,
  wideDim: 128,
  wideCodeDim: 32,
  wideLength: 128,
  wideTrainSteps: 60,
})
const elapsedMs = Date.now() - t0
const { bridge, weight, wide } = report

const checks = {
  bridgeOk: bridge.ok === true,
  hasCompressed: bridge.compressedTokens > 0,
  pathDiffersFromPooled: bridge.pathDiff > 1e-6,
  weightOk: weight.ok === true,
  weightExact: weight.weightDiff < 1e-12,
  weightCtxMatch: weight.ctxDiff < 1e-12,
  wideOk: wide.ok === true,
  wideDim: wide.dim >= 128,
  wideCompressed: wide.compressedTokens > 0,
  honest: bridge.implemented === false && bridge.fullNeuralRra === false,
}
const ok = Object.values(checks).every(Boolean)

const gate = {
  ok,
  checks,
  stage: 'L6-M5-R',
  implemented: false,
  fullNeuralRra: false,
  elapsedMs,
  bridge: {
    pathDiff: bridge.pathDiff,
    compressedTokens: bridge.compressedTokens,
    dim: bridge.dim,
  },
  weight: {
    weightDiff: weight.weightDiff,
    ctxDiff: weight.ctxDiff,
    paramCount: weight.paramCount,
    weightPath: weight.weightPath,
  },
  wide: {
    dim: wide.dim,
    pathDiff: wide.pathDiff,
    compressedTokens: wide.compressedTokens,
  },
  proto: describeProto(),
  note: ok
    ? `M5-R 通过：readAt 桥 Δpooled=${bridge.pathDiff}；权重闭环；dim${wide.dim} 冒烟；玩具尺度`
    : `M5-R 失败: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 'm5-rope-bridge-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({
  ok: gate.ok,
  checks: gate.checks,
  bridge: gate.bridge,
  weight: gate.weight,
  wide: gate.wide,
  elapsedMs,
}, null, 1))

if (!ok) {
  console.error(gate.note)
  process.exit(1)
}
console.log('[m5-rope] PASSED · readAt + weight roundtrip + dim128 · fullNeuralRra=false')
