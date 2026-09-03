#!/usr/bin/env node
/**
 * L6/M1 gate：快照续训（raw + pooled）
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { runKvBankContinueTrain, runKvBankRoundtrip } from '../src/kv-bank.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'reports')
mkdirSync(outDir, { recursive: true })

const snapPath = join(tmpdir(), `rra-kv-m1-snap-${Date.now()}.json`)
const contPath = join(tmpdir(), `rra-kv-m1-cont-${Date.now()}.json`)

const round = runKvBankRoundtrip({
  dim: 16,
  compressedDim: 4,
  steps: 30,
  lr: 0.12,
  filePath: snapPath,
})
const cont = runKvBankContinueTrain({
  dim: 16,
  compressedDim: 4,
  steps: 25,
  continueSteps: 30,
  lr: 0.12,
  filePath: contPath,
})

const report = {
  stage: 'L6-M1',
  ok: !!(round.ok && cont.ok),
  roundtrip: round,
  continueTrain: cont,
  implemented: false,
  fullNeuralRra: false,
  note: 'M1 snapshots + continue-train · not full neural RRA',
}

const latest = join(outDir, 'l6-m1-gate-latest.json')
writeFileSync(latest, JSON.stringify(report, null, 2), 'utf8')

console.log('\n=== rra-proto L6/M1 gate ===\n')
console.log('  roundtrip.ok:', round.ok, 'snapOk:', round.snapOk)
console.log('  continue.ok:', cont.ok, 'usedRaw:', cont.continued && cont.continued.usedRaw)
console.log('  pooledContinue.ok:', cont.continuedPooled && cont.continuedPooled.ok)
console.log('  steps', cont.stepsBefore, '→', cont.stepsAfter)
console.log(`\n  wrote ${latest}\n`)

if (!report.ok) {
  console.error('L6/M1 gate FAILED')
  process.exit(1)
}
console.log('L6/M1 gate PASSED (scaffold · fullNeuralRra=false)')
process.exit(0)
