#!/usr/bin/env node
/** 跑字节匹配基线并写出 JSON 报告（无训练）。 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runByteMatchedBench } from '../src/baselines.mjs'
import { describeProto } from '../src/status.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const length = Number(process.env.RRA_BENCH_LEN) || 512
const byteBudget = Number(process.env.RRA_BENCH_BUDGET) || 24_000

const report = {
  ...runByteMatchedBench({ length, byteBudget }),
  proto: describeProto(),
}

const outDir = join(root, 'reports')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'byte-matched-latest.json')
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log('\n=== rra-proto L1 byte-matched baseline ===\n')
console.log(`proto: ${report.proto.protocol} · implemented=${report.implemented} · weights=${report.hasWeights}`)
console.log(`seq=${report.input.length} · totalBytes=${report.input.totalBytes} · budget=${report.input.byteBudget}`)
console.log('')
for (const row of report.rows) {
  const flag = row.withinBudget ? 'OK ' : 'OVER'
  console.log(
    `  [${flag}] ${row.id.padEnd(16)} score=${String(row.score).padEnd(6)} `
    + `recent=${row.recentHit} landmark=${row.landmarkHit} `
    + `bytes=${row.usedBytes}/${report.input.byteBudget}`,
  )
}
if (report.winnerFair) {
  console.log(`\nfair winner (within budget): ${report.winnerFair.label} (${report.winnerFair.id}) score=${report.winnerFair.score}`)
}
console.log(`\nwrote ${outPath}`)
console.log(`${report.disclaimer}\n`)
