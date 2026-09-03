#!/usr/bin/env node
/** World state persist unit tests */
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  defaultWorldState,
  normalizeWorldState,
  loadWorldState,
  saveWorldState,
  worldStatePath,
  worldStateForSnapshot,
} from '../bridge/world-state.mjs'

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  ✓', msg) }
  else { failed += 1; console.error('  ✗', msg) }
}

console.log('\n=== world-state ===\n')

const base = defaultWorldState()
ok(base.shell.wmMode === 'split', 'default wmMode split')
ok(base.ui.leftTab === 'status', 'default leftTab status')

const bad = normalizeWorldState({ wmMode: 'nope', leftTab: 'zzz', floatPos: { left: 12.7, top: 9.2 } })
ok(bad.shell.wmMode === 'split', 'invalid wmMode falls back')
ok(bad.ui.leftTab === 'status', 'invalid leftTab falls back')
ok(bad.shell.floatPos.left === 13, 'floatPos rounded')

const home = mkdtempSync(join(tmpdir(), 'ow-world-'))
try {
  const empty = loadWorldState(home)
  ok(empty.updatedAt == null, 'missing file → default')
  ok(!existsSync(worldStatePath(home)), 'default load does not create file')

  const saved = saveWorldState(home, {
    wmMode: 'float',
    leftTab: 'events',
    view: 'ati',
    selected: 'task-board',
    atiPreset: 'ati-unified',
    synapses: [['memory', 'ai-engine'], { from: 'core', to: 'runtime' }],
    open: true,
  })
  ok(saved.shell.wmMode === 'float', 'saved wmMode')
  ok(saved.ui.leftTab === 'events', 'saved leftTab')
  ok(saved.shell.open === true, 'saved open')
  ok(saved.synapses.length === 2, 'synapses normalized')
  ok(existsSync(worldStatePath(home)), 'file created')

  const disk = JSON.parse(readFileSync(worldStatePath(home), 'utf8'))
  ok(disk.ui.view === 'ati', 'disk view')

  const patched = saveWorldState(home, { leftTab: 'actions', wmMode: 'split' })
  ok(patched.ui.leftTab === 'actions', 'patch leftTab')
  ok(patched.shell.wmMode === 'split', 'patch wmMode')
  ok(patched.ui.view === 'ati', 'patch keeps view')
  ok(patched.shell.open === true, 'patch keeps open')

  const remapped = normalizeWorldState({ ui: { view: 'galaxy' } })
  ok(remapped.ui.view === 'ati', 'legacy galaxy → ati')
  const remappedN = normalizeWorldState({ ui: { view: 'neural' } })
  ok(remappedN.ui.view === 'ati', 'legacy neural → ati')

  const snap = worldStateForSnapshot(home)
  ok(snap.path === 'open-world/world-state.json', 'snapshot path')
  ok(snap.ui.leftTab === 'actions', 'snapshot ui')
} finally {
  rmSync(home, { recursive: true, force: true })
}

console.log(`\n=== world-state: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
