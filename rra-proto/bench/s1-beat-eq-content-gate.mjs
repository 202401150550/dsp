#!/usr/bin/env node
/**
 * 等范数·无 slotMod + 注意力模仿门禁（npm: gate:beat-eq-content；语义=no-slotMod）。
 * L2048 / ≤12 槽 + 同范数 + preferSalientGrid + attnImitate，关 slotMod。
 * 内含消融：同配方 attnImitateWeight=0 必须明显掉召回（钉死教师依赖）。
 * 口径：周期合成任务上的无槽偏置选择；非开放域内容检索；不替代 beat-eq。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BEAT_EQ_NOSLOT_DEFAULTS, runBeatOnce, runBeatSuite } from '../src/s1-beat.mjs'
import { describeProto } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const t0 = Date.now()
const suite = runBeatSuite({
  ...BEAT_EQ_NOSLOT_DEFAULTS,
  seeds: [21, 33, 47],
})

// 消融：关 imitate，单种子（与 suite 同超参）——必须显著低于主召回
const abl = runBeatOnce({
  ...BEAT_EQ_NOSLOT_DEFAULTS,
  attnImitateWeight: 0,
  seed: 21,
})
const ablAcc = abl.branches.query.topicAcc
const mainSeed21 = suite.runs.find((r) => r.seed === 21)?.query?.topicAcc ?? suite.agg.topicAcc
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
  fewSlots: suite.input.nEntries <= 12,
  equalNorm: Number(suite.input.salientScale) === Number(suite.input.distractorScale),
  noSlotMod: suite.input.slotMod !== true,
  hasImitate: Number(suite.input.attnImitateWeight) > 0,
  /** 无教师模仿时不得摸到强召回 */
  ablNoImitateWeak: ablAcc < 0.70,
  /** 模仿相对无模仿有实质增益 */
  imitateHelps: mainSeed21 - ablAcc >= 0.12,
  hardDistractors: (suite.input.trueEvery || 1) >= 3,
  honest: suite.implemented === false && suite.fullNeuralRra === false,
}
const ok = Object.values(checks).every(Boolean) && suite.ok

const gate = {
  ok,
  checks,
  stage: 'L6-S1-BEAT-EQ-NOSLOT',
  alias: 'beat-eq-content (= no-slotMod + attnImitate)',
  implemented: false,
  fullNeuralRra: false,
  elapsedMs,
  suite,
  ablation: {
    tag: 'no-imitate',
    seed: 21,
    attnImitateWeight: 0,
    topicAcc: ablAcc,
    vsSeed21: mainSeed21,
    delta: Math.round((mainSeed21 - ablAcc) * 10000) / 10000,
  },
  proto: describeProto(),
  note: ok
    ? `等范数 no-slotMod+imitate 通过：L${suite.input.length}/e${suite.input.nEntries} 召回 ${suite.agg.topicAcc}；无 imitate 消融 ${ablAcc}（Δ ${checks.imitateHelps ? (mainSeed21 - ablAcc).toFixed(3) : 'n/a'}）；非开放域内容检索`
    : `等范数 no-slotMod 失败: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 's1-beat-eq-content-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({
  ok: gate.ok,
  checks: gate.checks,
  passCount: `${suite.passCount}/${suite.seedCount}`,
  agg: suite.agg,
  ablation: gate.ablation,
  elapsedMs,
  leaderboardSample: suite.runs[0]?.leaderboard,
}, null, 1))

if (!ok) {
  console.error(gate.note)
  process.exit(1)
}
console.log('[s1-beat-eq-content] PASSED · no-slotMod+imitate · abl no-imitate weak · fullNeuralRra=false')
