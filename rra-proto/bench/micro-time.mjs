#!/usr/bin/env node
import { prepareTask, trainBranch, buildEntries } from '../src/s1-train.mjs'
import { createS1Adapter } from '../src/s1-adapter.mjs'

const mark = (label, t0) => console.log(JSON.stringify({ event: 'bench', label, ms: Date.now() - t0 }))

let t = Date.now()
const task = prepareTask({
  length: 2048, farHeavy: true, salientBias: true, codeDim: 16, nTopics: 8,
  trueEvery: 3, salientScale: 6.5, distractorScale: 4, noiseScale: 0.45,
  probeStride: 48, nSeq: 14, nTrain: 10, seed: 21,
})
mark('prepareTask', t)

const nTrainProbes = task.seqs.filter((s) => s.isTrain).reduce((a, s) => a + s.probes.length, 0)
console.log(JSON.stringify({ event: 'meta', nTrainProbes, nSeq: task.seqs.length, dim: task.dim }))

const adapter = createS1Adapter({ dim: task.dim, kind: 'query', seed: 21, codeDim: 16 })
const seq = task.seqs.find((s) => s.isTrain)
const pr = seq.probes[seq.probes.length - 1]
t = Date.now()
for (let i = 0; i < 50; i++) {
  buildEntries(adapter, task, seq, { recipe: 'reciprocal', nEntries: 3, farHeavy: true, salientBias: true, queryT: pr.t })
}
mark('buildEntriesx50', t)

t = Date.now()
trainBranch(task, {
  kind: 'query', steps: 200, lr: 0.12, nEntries: 3, seed: 21, lrDecay: 0.55,
  codeDim: 16, topicWeight: 0, rlWeight: 0, hardMineTrials: 1,
  farHeavy: true, salientBias: true,
})
mark('train200_noRl', t)

t = Date.now()
trainBranch(task, {
  kind: 'query', steps: 200, lr: 0.12, nEntries: 3, seed: 21, lrDecay: 1,
  codeDim: 16, topicWeight: 0.4, rlWeight: 1.2, hardMineTrials: 1,
  farHeavy: true, salientBias: true,
})
mark('train200_rl_fromStart', t)
