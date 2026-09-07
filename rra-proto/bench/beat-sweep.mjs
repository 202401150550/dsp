#!/usr/bin/env node
/** Beat sweep：按 seed 落盘；默认先单 seed 筛，再对通过项做 3-seed 确认 */
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBeatOnce } from '../src/s1-beat.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'reports')
mkdirSync(outDir, { recursive: true })
const out = join(outDir, 'beat-sweep-latest.jsonl')
writeFileSync(out, '')
const log = (obj) => {
  const line = JSON.stringify(obj)
  console.log(line)
  appendFileSync(out, line + '\n')
}

const shared = {
  length: 2048, farHeavy: true, salientBias: true, codeDim: 16, lrDecay: 0.55,
  noiseScale: 0.45, nTopics: 8, probeStride: 48, skipAblations: true,
  // triage 关 hard-mine 加速；confirm 恢复默认 3
  hardMineTrials: 1,
}

const configs = [
  { tag: 'e1-eq', nEntries: 1, trueEvery: 3, salientScale: 6, distractorScale: 6, steps: 40000, lr: 0.09, rlWeight: 2.2, topicWeight: 0.7 },
  { tag: 'e2-eq', nEntries: 2, trueEvery: 3, salientScale: 6, distractorScale: 6, steps: 40000, lr: 0.09, rlWeight: 2.2, topicWeight: 0.7 },
  { tag: 'e4-eq', nEntries: 4, trueEvery: 3, salientScale: 6, distractorScale: 6, steps: 48000, lr: 0.08, rlWeight: 2.5, topicWeight: 0.8, codeDim: 32 },
]

const phase = process.argv[2] || 'triage' // triage | confirm | all
const confirmTags = process.argv.slice(3)

log({ event: 'meta', phase, out, at: new Date().toISOString() })

const triageOk = []
if (phase === 'triage' || phase === 'all') {
  for (const c of configs) {
    const { tag, ...opts } = c
    log({ event: 'start', phase: 'triage', tag, seed: 21, at: new Date().toISOString() })
    const t0 = Date.now()
    const r = runBeatOnce({ ...shared, ...opts, seed: 21 })
    const fail = Object.entries(r.wins).filter(([, v]) => !v).map(([k]) => k)
    log({
      event: 'seed-done', phase: 'triage', tag, seed: 21, ok: r.ok,
      acc: r.branches.query.topicAcc, rel: r.branches.query.meanRelErr,
      heur: r.branches.heuristic.topicAcc, resident: r.ledger.residentVsFull,
      fail, ms: Date.now() - t0,
    })
    if (r.ok) triageOk.push(tag)
  }
  log({ event: 'triage-summary', okTags: triageOk })
}

const toConfirm = phase === 'confirm'
  ? (confirmTags.length ? confirmTags : configs.map((c) => c.tag))
  : phase === 'all' ? triageOk : []

if (toConfirm.length) {
  for (const tag of toConfirm) {
    const c = configs.find((x) => x.tag === tag)
    if (!c) {
      log({ event: 'skip', tag, reason: 'unknown' })
      continue
    }
    const { tag: _t, ...opts } = c
    log({ event: 'start', phase: 'confirm', tag, seeds: [21, 33, 47], at: new Date().toISOString() })
    const t0 = Date.now()
    // 按 seed 跑，避免长时间无输出；confirm 用默认 hard-mine
    const runs = []
    for (const seed of [21, 33, 47]) {
      const st = Date.now()
      const r = runBeatOnce({ ...shared, ...opts, seed, hardMineTrials: 3 })
      const fail = Object.entries(r.wins).filter(([, v]) => !v).map(([k]) => k)
      log({
        event: 'seed-done', phase: 'confirm', tag, seed, ok: r.ok,
        acc: r.branches.query.topicAcc, rel: r.branches.query.meanRelErr,
        heur: r.branches.heuristic.topicAcc, fail, ms: Date.now() - st,
      })
      runs.push(r)
    }
    const passCount = runs.filter((r) => r.ok).length
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
    log({
      event: 'done', phase: 'confirm', tag, ok: passCount >= 2,
      pass: `${passCount}/3`,
      acc: mean(runs.map((r) => r.branches.query.topicAcc)),
      heur: mean(runs.map((r) => r.branches.heuristic.topicAcc)),
      resident: mean(runs.map((r) => r.ledger.residentVsFull)),
      ms: Date.now() - t0,
    })
  }
} else if (phase === 'triage') {
  log({ event: 'hint', msg: triageOk.length
    ? `triage 通过: ${triageOk.join(',')}. 跑: node bench/beat-sweep.mjs confirm ${triageOk.join(' ')}`
    : 'triage 全挂；不必 3-seed confirm' })
}

log({ event: 'all-done', at: new Date().toISOString() })
