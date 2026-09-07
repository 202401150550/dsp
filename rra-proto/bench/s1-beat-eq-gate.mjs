#!/usr/bin/env node
/**
 * 等范数对打门禁（与 gate:beat e1-gap 并列）：
 * L2048 / ≤8 槽 + trueEvery=3 且真/干扰同范数 + 槽位模偏置 + 显著格点单 token。
 * 口径：模型可学合成周期结构（slot % trueEvery）；不宣称开放域内容检索 SOTA。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BEAT_EQ_DEFAULTS, runBeatSuite } from '../src/s1-beat.mjs'
import { describeProto } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const t0 = Date.now()
const suite = runBeatSuite({
  ...BEAT_EQ_DEFAULTS,
  seeds: [21, 33, 47],
})
const elapsedMs = Date.now() - t0

const checks = {
  robust: suite.robust === true,
  aggBeatsSliding: suite.agg.topicAcc >= suite.agg.slidingAcc + 0.55,
  aggBeatsUniform: suite.agg.topicAcc >= suite.agg.uniformAcc + 0.50,
  aggBeatsFixed: suite.agg.topicAcc >= suite.agg.fixedAcc + 0.50,
  aggBeatsUntrained: suite.agg.topicAcc >= suite.agg.untrainedAcc + 0.40,
  aggBeatsHeuristic: suite.agg.topicAcc >= suite.agg.heuristicAcc + 0.15,
  notShortcut: suite.agg.heuristicAcc < 0.80,
  aggStrongRecall: suite.agg.topicAcc >= 0.80,
  tightResident: suite.agg.residentVsFull < 0.04,
  longContext: suite.input.length >= 2048,
  fewSlots: suite.input.nEntries <= 8,
  equalNorm: Number(suite.input.salientScale) === Number(suite.input.distractorScale),
  slotMod: suite.input.slotMod === true,
  hardDistractors: (suite.input.trueEvery || 1) >= 3,
  honest: suite.implemented === false && suite.fullNeuralRra === false,
}
const ok = Object.values(checks).every(Boolean) && suite.ok

const gate = {
  ok,
  checks,
  stage: 'L6-S1-BEAT-EQ',
  implemented: false,
  fullNeuralRra: false,
  elapsedMs,
  suite,
  proto: describeProto(),
  note: ok
    ? `等范数对打通过：L${suite.input.length}/e${suite.input.nEntries}/eq-scale/slotMod 召回 ${suite.agg.topicAcc} ≥0.80，常驻 ${suite.agg.residentVsFull}（${suite.passCount}/${suite.seedCount} 种子）；学的是合成周期，玩具尺度`
    : `等范数对打失败: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 's1-beat-eq-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({
  ok: gate.ok,
  checks: gate.checks,
  passCount: `${suite.passCount}/${suite.seedCount}`,
  agg: suite.agg,
  elapsedMs,
  leaderboardSample: suite.runs[0]?.leaderboard,
}, null, 1))

if (!ok) {
  console.error(gate.note)
  process.exit(1)
}
console.log('[s1-beat-eq] PASSED · L2048/e8/eq-norm/slotMod · 召回≥80% · fullNeuralRra=false')
