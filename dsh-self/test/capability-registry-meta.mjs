#!/usr/bin/env node
/**
 * P2-1a：capability-registry 高风险能力必须带组合校验元数据字段。
 * Run: node test/capability-registry-meta.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..', '..')
const file = path.join(__dirname, '..', 'capability-registry.yml')

const require = createRequire(import.meta.url)
const YAML = require(path.join(DSP, 'dsh-desktop-toggle', 'node_modules', 'yaml', 'dist', 'index.js'))
const doc = YAML.parse(fs.readFileSync(file, 'utf8'))

const REQUIRED = ['reads', 'writes', 'side_effects', 'reversible', 'conflicts_with', 'taint_labels']
const HIGH_RISK = ['ssh', 'remote-web-ui', 'plugin-market', 'config-doctor']

let passed = 0
let failed = 0
function ok(cond, name, detail = '') {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\n=== capability-registry P2-1a meta ===\n')
ok(doc && doc.capabilities, 'registry loads')
const caps = doc.capabilities || {}
for (const id of HIGH_RISK) {
  const spec = caps[id]
  ok(!!spec, `${id} present`)
  if (!spec) continue
  for (const key of REQUIRED) {
    ok(Object.prototype.hasOwnProperty.call(spec, key), `${id}.${key}`)
  }
  ok(Array.isArray(spec.reads), `${id}.reads is array`)
  ok(Array.isArray(spec.writes), `${id}.writes is array`)
  ok(Array.isArray(spec.side_effects), `${id}.side_effects is array`)
  ok(typeof spec.reversible === 'boolean', `${id}.reversible is boolean`)
  ok(Array.isArray(spec.conflicts_with), `${id}.conflicts_with is array`)
  ok(Array.isArray(spec.taint_labels), `${id}.taint_labels is array`)
}

ok(HIGH_RISK.filter((id) => caps[id] && REQUIRED.every((k) => Object.prototype.hasOwnProperty.call(caps[id], k))).length >= 3,
  'at least 3 high-risk caps fully annotated')

console.log(`\n=== capability-registry-meta: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed ? 1 : 0)
