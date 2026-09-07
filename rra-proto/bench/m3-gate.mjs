#!/usr/bin/env node
/**
 * M3 门禁：严格在线因果 + RoPE 一致 apply 草图。
 * 全绿 ≠ 完整神经 RRA；applyReciprocalResolutionAttention 仍须抛错。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runOnlineCausalEval } from '../src/m3-online.mjs'
import { runApplySketchEval, applyRraSketch, SKETCH_PROTOCOL } from '../src/m3-apply.mjs'
import { describeProto, applyReciprocalResolutionAttention } from '../src/status.mjs'
import { createOnlineStream, pushToken } from '../src/m3-online.mjs'
import { randn, l2 } from '../src/math.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const online = runOnlineCausalEval({ length: 96, dim: 16, blockSize: 4 })
const sketch = runApplySketchEval({ length: 64, dim: 16, blockSize: 4, windowExact: 8 })

// causal=false 必须抛
let causalFlagThrows = false
try {
  applyRraSketch({
    q: randn(16, 1),
    queryPos: 3,
    causal: false,
    k_layers: { exact: [] },
  })
} catch {
  causalFlagThrows = true
}

// 正式 apply 仍抛
let fullApplyThrows = false
try {
  applyReciprocalResolutionAttention({ q: randn(8, 1) })
} catch {
  fullApplyThrows = true
}

const proto = describeProto()

const checks = {
  onlineCausal: online.ok === true,
  prefillEquiv: online.prefillEquiv?.ok === true,
  poisonCaught: online.poison?.caught === true,
  orderReject: online.orderReject?.rejected === true,
  sketchRuns: sketch.ok === true,
  leakIgnored: sketch.leakIgnored === true,
  ropeChecks: sketch.ropeChecks > 0,
  causalFlagThrows,
  fullApplyThrows,
  honest: proto.implemented === false
    && proto.fullNeuralRra === false
    && sketch.protocol === SKETCH_PROTOCOL,
  residentBounded: online.residentVsFull < 0.5,
}

const ok = Object.values(checks).every(Boolean)

const gate = {
  ok,
  checks,
  stage: 'L6-M3',
  implemented: false,
  fullNeuralRra: false,
  // gate 自身阶段仍标 M3 评测；proto 状态面可能已升 M4
  protocol: 'rra/0.10-proto-m3',
  online,
  sketch: {
    ok: sketch.ok,
    queryPos: sketch.queryPos,
    sealed: sketch.sealed,
    bufferLen: sketch.bufferLen,
    contextNorm: sketch.contextNorm,
    tiers: sketch.tiers,
    ropeMaxRel: sketch.ropeMaxRel,
    falsify: sketch.falsify,
    protocol: sketch.protocol,
    bankBytes: sketch.bankBytes,
  },
  proto,
  note: ok
    ? 'M3 通过：在线因果（逐词元≡预填充、注毒/乱序必拒）+ RoPE apply 草图可运行；正式 apply 仍抛错；玩具尺度'
    : `M3 gate fail: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 'm3-gate-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({
  ok: gate.ok,
  checks: gate.checks,
  stage: gate.stage,
  online: {
    sealed: online.oracleSealed,
    equiv: online.prefillEquiv?.ok,
    residentVsFull: Math.round(online.residentVsFull * 1000) / 1000,
  },
  sketch: {
    contextNorm: sketch.contextNorm,
    tiers: sketch.tiers,
    ropeMaxRel: sketch.ropeMaxRel,
  },
}, null, 1))

if (!ok) {
  console.error(gate.note)
  process.exit(1)
}
