#!/usr/bin/env node
/**
 * Fail if client.js is out of date vs client/modules + bridge sources.
 * Used by pretest / check:client. Fix: npm run build:client
 */
import { freshnessReport } from './client-build-meta.mjs'

const report = freshnessReport()
const lines = [
  `expected=${report.expected}`,
  `embedded=${report.embedded ? report.embedded.build : '(missing)'}`,
  `clientVer=${report.clientVer}`,
]

if (report.ok) {
  console.log(`[check:client] OK — CLIENT_BUILD ${report.expected} (${report.clientVer})`)
  if (report.mtimeStale) {
    console.warn(`[check:client] warn: source mtime newer than client.js (${report.newestSource}) — hash still matches`)
  }
  process.exit(0)
}

console.error('[check:client] STALE — client.js does not match sources')
console.error(`  ${lines.join('\n  ')}`)
if (report.newestSource) console.error(`  newest source: ${report.newestSource}`)
console.error('  Fix: npm run build:client')
process.exit(1)
