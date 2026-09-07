#!/usr/bin/env node
/**
 * 解码器权重包契约门禁：结构可校验，生产 apply 仍拒。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runDecoderWeightPackEval } from '../src/decoder-weight-pack.mjs'
import { describeProto } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const t0 = Date.now()
const report = runDecoderWeightPackEval()
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
  stage: 'L6-M6-PACK',
  implemented: false,
  fullNeuralRra: false,
  elapsedMs,
  report,
  proto: describeProto(),
  note: ok
    ? 'decoder-pack 通过：结构可开、假生产/玩具冒充被拒、activate 仍阻塞'
    : `decoder-pack 失败: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 'decoder-weight-pack-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({ ok: gate.ok, checks: gate.checks, samples: report.samples, elapsedMs }, null, 1))
if (!ok) {
  console.error(gate.note)
  process.exit(1)
}
console.log('[decoder-pack] PASSED · structure ok / apply blocked · fullNeuralRra=false')
