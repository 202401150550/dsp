#!/usr/bin/env node
/**
 * S1 权重闭环门禁：短训 → snapshot → JSON 落盘 → restore → 评测一致。
 * 玩具尺度；不宣称生产神经 RRA / 真实模型权重。
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareTask, trainBranch, evalBranch } from '../src/s1-train.mjs'
import { snapshotS1Adapter, restoreS1Adapter, maxAbsWeightDiff } from '../src/s1-adapter.mjs'
import { describeProto } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })
const weightPath = join(outDir, 's1-adapter-weights-latest.json')

const t0 = Date.now()
const task = prepareTask({
  length: 512,
  dim: 32,
  nSeq: 10,
  nTrain: 7,
  seed: 41,
  trueEvery: 1,
  salientScale: 6.8,
  distractorScale: 3.9,
})
const nEntries = 8
const trained = trainBranch(task, {
  kind: 'query',
  steps: 4000,
  lr: 0.12,
  nEntries,
  seed: 41,
  codeDim: 16,
  topicWeight: 0.5,
  rlWeight: 0,
  farHeavy: true,
  salientBias: true,
  skipAblations: true,
})
const live = trained.adapter
const snap = snapshotS1Adapter(live)
writeFileSync(weightPath, JSON.stringify(snap))
const fromDisk = JSON.parse(readFileSync(weightPath, 'utf8'))
const restored = restoreS1Adapter(fromDisk)

const evalSeqs = task.seqs.filter((s) => !s.isTrain)
const pack = { recipe: 'reciprocal', nEntries, farHeavy: true, salientBias: true }
const liveEval = evalBranch(live, task, evalSeqs, pack)
const restEval = evalBranch(restored, task, evalSeqs, pack)
const weightDiff = maxAbsWeightDiff(live, restored)
const topicDelta = Math.abs(liveEval.topicAcc - restEval.topicAcc)
const relDelta = Math.abs(liveEval.meanRelErr - restEval.meanRelErr)

const checks = {
  trained: live.trained === true,
  protocol: snap.protocol === 'rra/0.10-s1-adapter-weights',
  weightExact: weightDiff < 1e-12,
  topicMatch: topicDelta < 1e-9,
  relMatch: relDelta < 1e-9,
  learnSignal: liveEval.topicAcc > 0.35,
  beatsChance: liveEval.topicAcc >= restEval.topicAcc - 1e-9,
  honest: describeProto().implemented === false && describeProto().fullNeuralRra === false,
}
const ok = Object.values(checks).every(Boolean)
const elapsedMs = Date.now() - t0

const gate = {
  ok,
  checks,
  stage: 'L6-S1-WEIGHT',
  implemented: false,
  fullNeuralRra: false,
  elapsedMs,
  weightPath,
  live: { topicAcc: liveEval.topicAcc, meanRelErr: liveEval.meanRelErr, paramCount: live.paramCount },
  restored: { topicAcc: restEval.topicAcc, meanRelErr: restEval.meanRelErr },
  weightDiff,
  topicDelta,
  relDelta,
  proto: describeProto(),
  note: ok
    ? `S1 权重闭环通过：训→存→载 权重差 ${weightDiff}，topicAcc ${liveEval.topicAcc}（玩具尺度）`
    : `S1 权重闭环失败: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}

writeFileSync(join(outDir, 's1-weight-gate-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({
  ok: gate.ok,
  checks: gate.checks,
  live: gate.live,
  restored: gate.restored,
  weightDiff,
  elapsedMs,
}, null, 1))

if (!ok) {
  console.error(gate.note)
  process.exit(1)
}
console.log('[s1-weight] PASSED · train→snapshot→restore · fullNeuralRra=false')
