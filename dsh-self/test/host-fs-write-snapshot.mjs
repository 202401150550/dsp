/**
 * H1–H5: host fs.write before-snapshot (Rewind-compatible).
 * Run: node test/host-fs-write-snapshot.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyCheckpointEntry,
  readCheckpointFile,
  SNAPSHOT_ROOT_ENV,
  HOST_SESSION_ENV,
} from '../host-rewind-bridge.mjs'
import {
  fsWrite,
  previewFsWrite,
  resolveAllowed,
} from '../host-runtime.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..', '..')

let passed = 0
let failed = 0

function assert(cond, name, detail = '') {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function withEnv(env, fn) {
  const prev = {}
  for (const [k, v] of Object.entries(env)) {
    prev[k] = process.env[k]
    if (v === null || v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    return fn()
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-host-snap-'))
const snapRoot = path.join(tmpRoot, 'rewind-snapshots')
const workDir = path.join(DSP, '_scratch', 'host-fs-write-snapshot-test')
fs.mkdirSync(workDir, { recursive: true })
fs.mkdirSync(snapRoot, { recursive: true })

const existingPath = path.join(workDir, 'existing.txt')
const createPath = path.join(workDir, 'created.txt')
const h4Path = path.join(workDir, 'h4-target.txt')

fs.writeFileSync(existingPath, 'OLD_CONTENT', 'utf8')
if (fs.existsSync(createPath)) fs.unlinkSync(createPath)
fs.writeFileSync(h4Path, 'H4_BEFORE', 'utf8')

console.log('\n=== host-fs-write-snapshot (H1–H5) ===\n')

withEnv({ [SNAPSHOT_ROOT_ENV]: snapRoot, [HOST_SESSION_ENV]: 'host-test' }, () => {
  // H1 — dry-run / preview: will_snapshot, disk unchanged
  console.log('H1 preview existing')
  const beforeH1 = fs.readFileSync(existingPath, 'utf8')
  const prev = previewFsWrite({ path: existingPath, content: 'NEW_SHOULD_NOT_WRITE' })
  assert(prev.ok === true, 'H1 preview ok')
  assert(prev.will_snapshot === true, 'H1 will_snapshot true')
  assert(prev.existed === true, 'H1 existed true')
  assert(fs.readFileSync(existingPath, 'utf8') === beforeH1, 'H1 disk unchanged')
  const snapsBefore = findSnapshots(snapRoot)
  assert(snapsBefore.length === 0, 'H1 no snapshot files from preview')

  // H2 — overwrite existing: snapshot has old, file has new
  console.log('H2 write existing')
  const old = 'OLD_CONTENT'
  fs.writeFileSync(existingPath, old, 'utf8')
  const w2 = fsWrite({ path: existingPath, content: 'NEW_CONTENT' })
  assert(w2.ok === true, 'H2 write ok', JSON.stringify(w2))
  assert(w2.will_snapshot === true, 'H2 will_snapshot')
  assert(w2.existed === true, 'H2 existed')
  assert(typeof w2.callId === 'string' && w2.callId.startsWith('host-fs-write-'), 'H2 callId')
  assert(fs.readFileSync(existingPath, 'utf8') === 'NEW_CONTENT', 'H2 file is new')
  assert(typeof w2.snapshot_path === 'string' && fs.existsSync(w2.snapshot_path), 'H2 snapshot file')
  const e2 = readCheckpointFile(w2.snapshot_path)
  assert(e2.ok && e2.entry.before === old, 'H2 before == old content')
  assert(e2.entry.path === existingPath || path.resolve(e2.entry.path) === path.resolve(existingPath), 'H2 entry path')

  // H3 — create new file: before null
  console.log('H3 create new')
  if (fs.existsSync(createPath)) fs.unlinkSync(createPath)
  const w3 = fsWrite({ path: createPath, content: 'BRAND_NEW' })
  assert(w3.ok === true, 'H3 write ok', JSON.stringify(w3))
  assert(w3.existed === false, 'H3 existed false')
  assert(fs.readFileSync(createPath, 'utf8') === 'BRAND_NEW', 'H3 file created')
  const e3 = readCheckpointFile(w3.snapshot_path)
  assert(e3.ok && e3.entry.before === null, 'H3 before null')

  // H4 — snapshot root not writable → refuse write (S1)
  console.log('H4 snapshot-failed refuses write')
  const badRoot = path.join(tmpRoot, 'not-a-directory')
  fs.writeFileSync(badRoot, 'blocker', 'utf8')
  const h4Before = fs.readFileSync(h4Path, 'utf8')
  withEnv({ [SNAPSHOT_ROOT_ENV]: badRoot, [HOST_SESSION_ENV]: 'host-test' }, () => {
    const w4 = fsWrite({ path: h4Path, content: 'SHOULD_NOT_LAND' })
    assert(w4.ok === false, 'H4 ok false')
    assert(w4.error === 'snapshot-failed', 'H4 error snapshot-failed', JSON.stringify(w4))
    assert(fs.readFileSync(h4Path, 'utf8') === h4Before, 'H4 target unchanged')
  })

  // H5 — restore from snapshot
  console.log('H5 restore from snapshot')
  fs.writeFileSync(existingPath, 'OLD_FOR_H5', 'utf8')
  const w5 = fsWrite({ path: existingPath, content: 'MUTATED_FOR_H5' })
  assert(w5.ok === true, 'H5 setup write ok')
  assert(fs.readFileSync(existingPath, 'utf8') === 'MUTATED_FOR_H5', 'H5 mutated')
  const loaded = readCheckpointFile(w5.snapshot_path)
  assert(loaded.ok, 'H5 load snapshot')
  const restored = applyCheckpointEntry(loaded.entry)
  assert(restored.ok === true, 'H5 restore ok')
  assert(fs.readFileSync(existingPath, 'utf8') === 'OLD_FOR_H5', 'H5 bytes restored')

  // whitelist sanity
  const denied = resolveAllowed('C:/Windows/System32/drivers/etc/hosts')
  assert(denied.ok === false, 'outside whitelist still denied')
})

function findSnapshots(root) {
  const out = []
  function walk(d) {
    if (!fs.existsSync(d)) return
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name)
      const st = fs.statSync(p)
      if (st.isDirectory()) walk(p)
      else out.push(p)
    }
  }
  walk(root)
  return out
}

// cleanup scratch files (keep tmpRoot for debug if failed)
try {
  if (failed === 0) {
    fs.rmSync(workDir, { recursive: true, force: true })
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
} catch { /* ignore */ }

console.log(`\n=== host-fs-write-snapshot: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed ? 1 : 0)
