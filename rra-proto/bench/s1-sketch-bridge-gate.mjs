#!/usr/bin/env node
/**
 * S1 权重 → applyRraSketch 桥接门禁（玩具）。
 * 训→存→载→打包条目→pooled 草图；不宣称 RoPE 模型互通 / 完整神经 RRA。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runS1SketchBridgeEval } from '../src/s1-sketch-bridge.mjs'
import { describeProto } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const t0 = Date.now()
const report = runS1SketchBridgeEval({ outDir })
const elapsedMs = Date.now() - t0

const checks = {
  bridgeOk: report.ok === true,
  weightExact: report.weightDiff < 1e-12,
  codeExact: report.codeMaxDiff < 1e-12,
  hasEntries: report.nEntriesUsed > 0,
  sketchProtocol: report.sketchMeta?.protocol?.includes('sketch') === true,
  honest: report.implemented === false && report.fullNeuralRra === false
    && describeProto().implemented === false,
}
const ok = Object.values(checks).every(Boolean)

const gate = {
  ok,
  checks,
  stage: 'L6-S1-SKETCH-BRIDGE',
  implemented: false,
  fullNeuralRra: false,
  elapsedMs,
  report,
  proto: describeProto(),
  note: ok
    ? `S1→sketch 桥通过：权重/码一致，pooled apply 有限上下文（${report.nEntriesUsed} 条目）；非 RoPE 互通`
    : `S1→sketch 桥失败: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 's1-sketch-bridge-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({
  ok: gate.ok,
  checks: gate.checks,
  weightDiff: report.weightDiff,
  codeMaxDiff: report.codeMaxDiff,
  nEntriesUsed: report.nEntriesUsed,
  ctxNorm: report.ctxNorm,
  elapsedMs,
}, null, 1))

if (!ok) {
  console.error(gate.note)
  process.exit(1)
}
console.log('[s1-sketch-bridge] PASSED · train→weights→pooled sketch · fullNeuralRra=false')
