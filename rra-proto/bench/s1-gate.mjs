#!/usr/bin/env node
/**
 * S1 门禁：阶段 1（冻结骨干适配训练）的证伪门槛。
 * 全绿只代表玩具尺度脚手架成立（学习信号 + 匹配字节胜过滑窗 + 因果诚实），
 * 不宣称真实模型质量/内存优势。失败 = 证伪信息，如实落盘。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runS1 } from '../src/s1-train.mjs'
import { prepareTask, buildEntries } from '../src/s1-train.mjs'
import { createS1Adapter } from '../src/s1-adapter.mjs'
import { describeProto } from '../src/status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })

const report = runS1({
  length: 512, dim: 32, windowTokens: 32, blockSize: 4,
  nEntries: 24, steps: 3000, lr: 0.12,
})

// 常驻字节随长度有界：同 nEntries，长度翻倍 → 银行字节不变
function bankBytesAt(length) {
  const task = prepareTask({ length, nSeq: 4, nTrain: 2 })
  const adapter = createS1Adapter({ dim: task.dim, kind: 'query' })
  const { entries } = buildEntries(adapter, task, task.seqs[0], { recipe: 'reciprocal', nEntries: 24 })
  return entries.length * (adapter.codeDim + 2) * 8
}
const bankBytes512 = bankBytesAt(512)
const bankBytes1024 = bankBytesAt(1024)

const q = report.branches['reciprocal-query-trained']
const g = report.branches['reciprocal-gate-trained']
const untr = report.branches['reciprocal-untrained']
const sliding = report.branches['sliding-window']

const checks = {
  pairedFair: report.pairedFair.sameSchedule === true
    && report.pairedFair.sameParamCount === true
    && report.pairedFair.sameEvalProbes === true,
  learnSignal: q.meanRelErr < untr.meanRelErr - 0.05
    && q.topicAcc > untr.topicAcc + 0.1,
  beatsSliding: q.meanRelErr < 0.9
    && q.topicAcc > sliding.topicAcc + 0.2,
  hotBounded: report.ledger.residentVsFull < 0.2 && bankBytes512 === bankBytes1024,
  causalOk: report.causal.causalOk === true
    && report.causalViolations.query === 0
    && report.causalViolations.gate === 0,
  honest: report.implemented === false && report.fullNeuralRra === false,
}
const ok = Object.values(checks).every(Boolean)

const gate = {
  ok,
  checks,
  stage: 'L6-S1',
  implemented: false,
  fullNeuralRra: false,
  protocol: 'rra/0.9-proto-s1',
  report,
  scalingProbe: { bankBytes512, bankBytes1024, bounded: bankBytes512 === bankBytes1024 },
  proto: describeProto(),
  note: ok
    ? 'S1 脚手架通过：冻结骨干下学习信号成立、匹配字节胜过滑窗、账本有界、因果诚实（玩具尺度，非真实模型结论）'
    : `S1 gate fail: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(',')}`,
  generatedAt: new Date().toISOString(),
}
writeFileSync(join(outDir, 's1-gate-latest.json'), JSON.stringify(gate, null, 2))
console.log(JSON.stringify({
  ok: gate.ok,
  checks: gate.checks,
  stage: gate.stage,
  query: { relErr: q.meanRelErr, topicAcc: q.topicAcc },
  gateBranch: { relErr: g.meanRelErr, topicAcc: g.topicAcc },
  sliding: { topicAcc: sliding.topicAcc },
  ledger: report.ledger.residentVsFull,
}, null, 1))
if (!ok) {
  console.error('[s1-gate] FAILED —', gate.note)
  process.exit(1)
}
console.log('[s1-gate] PASSED (scaffold · fullNeuralRra=false · 玩具尺度)')
