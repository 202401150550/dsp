#!/usr/bin/env node
/**
 * 对打门禁：学习式互易记忆 vs Sliding / Uniform / Fixed-chunk / 未训练 / 显著性捷径。
 * 加难：L2048 / 1 槽 + trueEvery=3 干扰显著 + SCST-REINFORCE + 因果时龄打包。
 * 目标聚合召回 ≥ 80%、常驻 < 4%。全绿只说明「在该合成任务上超过旧办法」；不宣称真实模型有效。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BEAT_DEFAULTS, runBeatSuite } from '../src/s1-beat.mjs'
import { describeProto } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const t0 = Date.now()
const suite = runBeatSuite({
  ...BEAT_DEFAULTS,
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
  fewSlots: suite.input.nEntries <= 1,
  hardDistractors: (suite.input.trueEvery || 1) >= 3,
  honest: suite.implemented === false && suite.fullNeuralRra === false,
}
const ok = Object.values(checks).every(Boolean) && suite.ok

const gate = {
  ok,
  checks,
  stage: 'L6-S1-BEAT',
  implemented: false,
  fullNeuralRra: false,
  elapsedMs,
  suite,
  proto: describeProto(),
  note: ok
    ? `对打通过：L${suite.input.length}/e${suite.input.nEntries}/trueEvery=${suite.input.trueEvery} 召回 ${suite.agg.topicAcc} ≥0.80，常驻 ${suite.agg.residentVsFull}，SCST-RL，超过旧办法（${suite.passCount}/${suite.seedCount} 种子）；玩具尺度`
    : `对打失败: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 's1-beat-latest.json'), JSON.stringify(gate, null, 2))
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
console.log('[s1-beat] PASSED · L2048/e1/trueEvery=3 · SCST-RL · 召回≥80% · fullNeuralRra=false')
