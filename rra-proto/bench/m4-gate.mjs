#!/usr/bin/env node
/**
 * M4 门禁：OW 可选 sketch 挂载默认关；显式开可跑且诚实。
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describeProto, applyReciprocalResolutionAttention } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const adapterPath = join(here, '..', '..', 'dsh-open-world', 'bridge', 'rra-adapter.mjs')
const checks = {
  adapterPresent: existsSync(adapterPath),
  protoHonest: false,
  fullApplyThrows: false,
  sketchDefaultOff: false,
  sketchOptIn: false,
}

const proto = describeProto()
checks.protoHonest = proto.implemented === false && proto.fullNeuralRra === false && proto.stage === 'L6-M4'

try {
  applyReciprocalResolutionAttention({})
} catch {
  checks.fullApplyThrows = true
}

if (checks.adapterPresent) {
  const mod = await import(pathToFileURL(adapterPath).href)
  const q = new Array(16).fill(0.1)
  const off = await mod.tryApplyRraSketch({ q, queryPos: 0, causal: true, k_layers: { exact: [] } }, { sketch: false })
  checks.sketchDefaultOff = off.skipped === true && off.ok === false
  const on = await mod.tryApplyRraSketch({
    q,
    queryPos: 0,
    causal: true,
    k_layers: { exact: [{ vec: q, pos: 0 }] },
  }, { sketch: true })
  checks.sketchOptIn = on.ok === true && on.implemented === false && on.fullNeuralRra === false
}

const ok = Object.values(checks).every(Boolean)
const gate = {
  ok,
  checks,
  stage: 'L6-M4',
  implemented: false,
  fullNeuralRra: false,
  protocol: 'rra/0.10-proto-m4',
  proto,
  note: ok
    ? 'M4 通过：OW sketch 默认关、显式开可跑、正式 apply 仍抛错'
    : `M4 gate fail: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}
writeFileSync(join(outDir, 'm4-gate-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({ ok: gate.ok, checks: gate.checks, stage: gate.stage }, null, 1))
if (!ok) process.exit(1)
