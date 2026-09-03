#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runL4Gate } from '../src/l4-longctx.mjs'
import { describeProto } from '../src/status.mjs'

const length = Number(process.env.RRA_L4_LEN) || 2048
const gate = { ...runL4Gate({ length }), proto: describeProto(), generatedAt: new Date().toISOString() }

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'reports')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'l4-gate-latest.json')
writeFileSync(outPath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8')

console.log('\n=== rra-proto L4 long-context gate ===\n')
console.log(`ok=${gate.ok} · len=${gate.report.input.length} · totalBytes=${gate.report.input.totalBytes}`)
console.log(`comparable=${gate.checks.comparableSweeps} matchedSpend=${gate.checks.matchedSpendSweeps} shellWins=${gate.checks.shellWins} windowWins=${gate.checks.windowWins}`)
for (const s of gate.report.sweeps) {
  const w = s.window
  const sh = s.shell
  if (!w || !sh) continue
  console.log(
    `  frac=${s.frac} budget=${s.byteBudget} · window score=${w.score} lm=${w.landmarkHit} · shell score=${sh.score} lm=${sh.landmarkHit} · ${s.verdict}`,
  )
}
console.log(`\n${gate.note}`)
console.log(`wrote ${outPath}`)
console.log(`${gate.disclaimer}\n`)
process.exit(gate.ok ? 0 : 1)
