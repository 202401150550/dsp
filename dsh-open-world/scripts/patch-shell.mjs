#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'client.js')
let src = readFileSync(path, 'utf8')

// shell components block
const shellStart = src.indexOf('    function StatusSummaryChips({ snapshot, plugins }) {')
const shellEnd = src.indexOf('    function fmtClock(d) {')
if (shellStart >= 0 && shellEnd > shellStart) {
  src = src.slice(0, shellStart) + src.slice(shellEnd)
  console.log('Removed shell components')
}

// duplicate sourceTag before AtiCortex
src = src.replace(
  /    function sourceTag\(source\) \{\n      if \(source === 'metaphor'\) \{[\s\S]*?      return null\n    \}\n\n    function AtiCortex/,
  '    function AtiCortex',
)

// duplicate notifyPulse
src = src.replace(
  /    function notifyPulse\(edges\) \{\n      if \(!edges \|\| edges\.length === 0\) return\n      fetch\(PULSE_URL,[\s\S]*?    \}\n\n    function exportSvgPng/,
  '    function exportSvgPng',
)

writeFileSync(path, src)
console.log('Patched client.js shell duplicates')
