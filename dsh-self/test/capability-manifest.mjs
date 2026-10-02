/**
 * Phase 3：dsh.capability.json 校验 / forbidden / owner 冲突。
 * Run: node test/capability-manifest.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..', '..')

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

const manifest = await import(pathToFileURL(path.join(__dirname, '..', 'capability-manifest.mjs')).href)
const adopt = await import(pathToFileURL(path.join(__dirname, '..', 'adopt.mjs')).href)

console.log('\n=== capability-manifest (Phase 3) ===\n')

console.log('M1 schema validate')
{
  const good = {
    id: 'web-ui-task-board',
    bucket: 'capability',
    owner_capability: 'task-board',
    risk: 'medium',
    reads: ['session.tasks'],
    writes: ['session.tasks'],
    side_effects: ['ui.mount'],
    reversible: true,
    conflicts_with: [],
    taint_labels: [],
    requires_confirm_above: 'L1',
    default_presets: ['bridge', 'full'],
    forbidden_with: ['web-ui-all'],
  }
  ok(manifest.validateManifest(good).ok === true, 'M1a complete manifest ok')
  const bad = { ...good }
  delete bad.owner_capability
  const v = manifest.validateManifest(bad)
  ok(v.ok === false && v.errors.includes('missing:owner_capability'), 'M1b missing owner_capability')
}

console.log('M2 policy forbidden')
{
  ok(manifest.policyForbiddenReason('dsh-web-ui-all') === 'web-ui-all', 'M2a web-ui-all')
  ok(manifest.policyForbiddenReason('@x/skin-center') === 'skin-center', 'M2b skin-center')
  ok(manifest.policyForbiddenReason('dsh-better-sidebar') == null, 'M2c sidebar allowed')
}

console.log('M3 inspectDir fixtures')
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-cap-'))
  const a = path.join(root, 'pkg-a')
  const b = path.join(root, 'pkg-b')
  const forbid = path.join(root, 'web-ui-all-clone')
  const invalid = path.join(root, 'broken')
  for (const d of [a, b, forbid, invalid]) fs.mkdirSync(d, { recursive: true })

  const base = {
    bucket: 'capability',
    risk: 'medium',
    reads: [],
    writes: [],
    side_effects: [],
    reversible: true,
    conflicts_with: [],
    taint_labels: [],
    requires_confirm_above: 'L1',
    default_presets: ['bridge'],
    forbidden_with: ['web-ui-all'],
  }
  fs.writeFileSync(path.join(a, 'package.json'), JSON.stringify({ name: 'pkg-a' }))
  fs.writeFileSync(path.join(a, 'dsh.capability.json'), JSON.stringify({
    ...base, id: 'pkg-a', owner_capability: 'demo-cap',
  }))
  fs.writeFileSync(path.join(b, 'package.json'), JSON.stringify({ name: 'pkg-b' }))
  fs.writeFileSync(path.join(b, 'dsh.capability.json'), JSON.stringify({
    ...base, id: 'pkg-b', owner_capability: 'demo-cap',
  }))
  fs.writeFileSync(path.join(forbid, 'package.json'), JSON.stringify({ name: 'my-web-ui-all' }))
  fs.writeFileSync(path.join(invalid, 'package.json'), JSON.stringify({ name: 'broken' }))
  fs.writeFileSync(path.join(invalid, 'dsh.capability.json'), JSON.stringify({ id: 'broken' }))

  const ia = adopt.inspectDir(a)
  ok(ia.manifest?.present === true && ia.manifest?.valid === true, 'M3a pkg-a manifest valid')
  ok(ia.owner_capability === 'demo-cap', 'M3b owner_capability from manifest')

  const ib = adopt.inspectDir(b, { duplicate: true, duplicate_of: 'pkg-a' })
  ok(ib.verdict === 'duplicate', 'M3c duplicate verdict')

  const iff = adopt.inspectDir(forbid)
  ok(iff.verdict === 'forbidden', 'M3d forbidden package', iff.verdict)
  ok(iff.forbidden_reason === 'web-ui-all', 'M3e forbidden_reason')

  const iv = adopt.inspectDir(invalid)
  ok(iv.verdict === 'manifest-invalid', 'M3f invalid manifest', iv.verdict)

  const wrapF = adopt.wrapDir(forbid)
  ok(wrapF.ok === false && wrapF.error === 'forbidden', 'M3g wrap forbidden refused')
  const wrapI = adopt.wrapDir(invalid)
  ok(wrapI.ok === false && wrapI.error === 'manifest-invalid', 'M3h wrap invalid refused')

  const conflicts = manifest.findOwnerConflicts([
    { id: 'pkg-a', owner_capability: 'demo-cap' },
    { id: 'pkg-b', owner_capability: 'demo-cap' },
  ])
  ok(conflicts.length === 1 && conflicts[0].owners.length === 2, 'M3i findOwnerConflicts')

  fs.rmSync(root, { recursive: true, force: true })
}

console.log('M4 real packages ship manifests')
{
  const sidebar = path.join(DSP, 'dsh-better-sidebar')
  const whale = path.join(DSP, 'deep-whale-day-night-theme')
  const s = adopt.inspectDir(sidebar)
  ok(s.manifest?.present === true && s.manifest?.valid === true, 'M4a better-sidebar manifest')
  ok(s.owner_capability === 'better-sidebar', 'M4b better-sidebar owner')
  const w = adopt.inspectDir(whale)
  ok(w.manifest?.present === true && w.manifest?.valid === true, 'M4c whale manifest')
  ok(w.owner_capability === 'desktop-skin', 'M4d whale owner')
}

console.log(`\n=== capability-manifest: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed ? 1 : 0)
