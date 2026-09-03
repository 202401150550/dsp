#!/usr/bin/env node
/**
 * L6/M2 gate：长上下文压缩码热读 + 字节对照
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runM2Gate } from '../src/l6-m2-hotread.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'reports')
mkdirSync(outDir, { recursive: true })

const gate = runM2Gate({
  length: 2048,
  dim: 16,
  compressedDim: 4,
  blockSize: 4,
  trainSteps: 35,
  lr: 0.12,
})

const latest = join(outDir, 'l6-m2-gate-latest.json')
writeFileSync(latest, JSON.stringify(gate, null, 2), 'utf8')

console.log('\n=== rra-proto L6/M2 gate ===\n')
console.log('  ok:', gate.ok)
console.log('  checks:', gate.checks)
console.log('  length:', gate.report.input.length, 'blocks:', gate.report.input.nBlocks)
console.log('  bytes raw→code:', gate.report.bytes.raw, '→', gate.report.bytes.codeOnly,
  'ratio', gate.report.bytes.compressionRatio)
console.log('  hot meanRel:', gate.report.hotRead.quality.meanRel)
console.log('  note:', gate.note)
console.log(`\n  wrote ${latest}\n`)

if (!gate.ok) {
  console.error('L6/M2 gate FAILED')
  process.exit(1)
}
console.log('L6/M2 gate PASSED (scaffold · fullNeuralRra=false)')
process.exit(0)
