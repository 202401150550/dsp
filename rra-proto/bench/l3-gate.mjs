#!/usr/bin/env node
/** L3 门槛报告 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runL3Gate } from '../src/l3-eval.mjs'
import { describeProto } from '../src/status.mjs'

const report = { ...runL3Gate(), proto: describeProto(), generatedAt: new Date().toISOString() }
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'reports')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'l3-gate-latest.json')
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log('\n=== rra-proto L3 gate ===\n')
console.log(`ok=${report.ok} · implemented=${report.implemented} · fullNeuralRra=${report.fullNeuralRra}`)
console.log(`overfit: ${report.overfit.first.loss.toFixed(4)} → ${report.overfit.last.loss.toFixed(4)} ratio=${report.overfit.ratio.toFixed(3)} (need ≤${report.overfit.targetRatio}) · ${report.overfit.ok ? 'PASS' : 'FAIL'}`)
console.log(`causal: legalOk=${report.causal.legalOk} caught=${report.causal.illegalCaught} missed=${report.causal.illegalMissed} · ${report.causal.ok ? 'PASS' : 'FAIL'}`)
console.log(`\nwrote ${outPath}`)
console.log(`${report.disclaimer}\n`)
process.exit(report.ok ? 0 : 1)
