#!/usr/bin/env node
/**
 * 破周期天花板报告（预期「召回上不去」才算通过）：
 * 同 no-slotMod+imitate 配方 + trueRandom，聚合召回必须 <0.70。
 * 证明：现有配方依赖合成周期布局，不是任意位置内容检索。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BEAT_EQ_NOSLOT_DEFAULTS, BEAT_EQ_DEFAULTS, runBeatSuite } from '../src/s1-beat.mjs'
import { describeProto } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const t0 = Date.now()
const contentRand = runBeatSuite({
  ...BEAT_EQ_NOSLOT_DEFAULTS,
  trueRandom: true,
  seeds: [21, 33, 47],
})
const slotModRand = runBeatSuite({
  ...BEAT_EQ_DEFAULTS,
  trueRandom: true,
  skipAblations: true,
  seeds: [21, 33, 47],
})
const elapsedMs = Date.now() - t0

const CEILING = 0.70
const checks = {
  contentBelowCeiling: contentRand.agg.topicAcc < CEILING,
  slotModBelowCeiling: slotModRand.agg.topicAcc < CEILING,
  contentNoStrong: contentRand.runs.every((r) => r.query.topicAcc < 0.80),
  slotModNoStrong: slotModRand.runs.every((r) => r.query.topicAcc < 0.80),
  trueRandomOn: contentRand.input.trueRandom === true && slotModRand.input.trueRandom === true,
  honest: describeProto().implemented === false && describeProto().fullNeuralRra === false,
}
const ok = Object.values(checks).every(Boolean)

const gate = {
  ok,
  checks,
  stage: 'L6-S1-TRUE-RANDOM-CEILING',
  implemented: false,
  fullNeuralRra: false,
  elapsedMs,
  ceiling: CEILING,
  contentRand: {
    acc: contentRand.agg.topicAcc,
    passCount: `${contentRand.passCount}/${contentRand.seedCount}`,
    per: contentRand.runs.map((r) => ({ seed: r.seed, acc: r.query.topicAcc })),
  },
  slotModRand: {
    acc: slotModRand.agg.topicAcc,
    passCount: `${slotModRand.passCount}/${slotModRand.seedCount}`,
    per: slotModRand.runs.map((r) => ({ seed: r.seed, acc: r.query.topicAcc })),
  },
  proto: describeProto(),
  note: ok
    ? `破周期天花板成立：no-slotMod+imitate=${contentRand.agg.topicAcc}、slotMod=${slotModRand.agg.topicAcc} 均 <${CEILING}；非开放域内容检索`
    : `破周期天花板未成立（意外摸高）: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 's1-true-random-ceiling-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({
  ok: gate.ok,
  checks: gate.checks,
  contentRand: gate.contentRand,
  slotModRand: gate.slotModRand,
  elapsedMs,
}, null, 1))

if (!ok) {
  console.error(gate.note)
  process.exit(1)
}
console.log('[s1-true-random-ceiling] PASSED · recall stays below ceiling · fullNeuralRra=false')
