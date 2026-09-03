#!/usr/bin/env node
/**
 * L6 gate：可持久 KV 银行 roundtrip（训 → 存 → 载）
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { runKvBankRoundtrip } from '../src/kv-bank.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'reports')
mkdirSync(outDir, { recursive: true })

const filePath = join(tmpdir(), `rra-kv-bank-${Date.now()}.json`)
const report = runKvBankRoundtrip({
  dim: 16,
  compressedDim: 4,
  steps: 40,
  lr: 0.12,
  filePath,
})

const latest = join(outDir, 'l6-gate-latest.json')
writeFileSync(latest, JSON.stringify(report, null, 2), 'utf8')

console.log('\n=== rra-proto L6 kv-bank gate ===\n')
console.log('  ok:', report.ok)
console.log('  improved:', report.trained && report.trained.improved)
console.log('  blocks:', report.reloaded && report.reloaded.blocks)
console.log('  path:', report.path)
console.log('  note:', report.note)
console.log(`\n  wrote ${latest}\n`)

if (!report.ok) {
  console.error('L6 gate FAILED')
  process.exit(1)
}
console.log('L6 gate PASSED (scaffold only · fullNeuralRra=false)')
process.exit(0)
