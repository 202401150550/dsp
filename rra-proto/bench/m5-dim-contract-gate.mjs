#!/usr/bin/env node
/**
 * M5-D 门禁：压缩权重 dim/协议契约（护栏，≠ 真解码器）。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runM5DimContractEval } from '../src/m5-dim-contract.mjs'
import { describeProto } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const t0 = Date.now()
const report = runM5DimContractEval()
const elapsedMs = Date.now() - t0

const checks = {
  evalOk: report.ok === true,
  ...report.checks,
  honest: report.implemented === false && report.fullNeuralRra === false,
}
const ok = Object.values(checks).every(Boolean)

const gate = {
  ok,
  checks,
  stage: 'L6-M5-D',
  implemented: false,
  fullNeuralRra: false,
  elapsedMs,
  report,
  proto: describeProto(),
  note: ok
    ? 'M5-D 通过：协议/形状/q.dim 护栏成立；拒绝假生产协议；非真解码器'
    : `M5-D 失败: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 'm5-dim-contract-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({ ok: gate.ok, checks: gate.checks, elapsedMs }, null, 1))
if (!ok) {
  console.error(gate.note)
  process.exit(1)
}
console.log('[m5-dim] PASSED · dim/protocol contract · fullNeuralRra=false')
