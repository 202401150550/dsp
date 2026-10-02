/**
 * P2-2：dry-run 强制面 + 统一 impact_summary。
 * Run: node test/host-dry-run-gate.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..', '..')
const FIX = path.join(DSP, '_scratch', `dry-run-gate-${crypto.randomUUID().slice(0, 8)}`)

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

fs.mkdirSync(FIX, { recursive: true })
process.env.DSH_HOST_STATE_DIR = path.join(FIX, 'state')
fs.mkdirSync(process.env.DSH_HOST_STATE_DIR, { recursive: true })
process.env.DSH_REWIND_SNAPSHOT_DIR = path.join(FIX, 'snaps')
fs.mkdirSync(process.env.DSH_REWIND_SNAPSHOT_DIR, { recursive: true })
process.env.DSH_HOST_REWIND_SESSION = 'dry-run-gate'

const agent = await import(pathToFileURL(path.join(__dirname, '..', 'host-agent.mjs')).href)
const impactMod = await import(pathToFileURL(path.join(__dirname, '..', 'host-impact.mjs')).href)

console.log('\n=== host dry-run gate (P2-2) ===\n')

agent.clearPreviewTickets()

const target = path.join(DSP, '_scratch', 'dry-run-gate-target.txt')
fs.writeFileSync(target, 'OLD\n', 'utf8')
const args = { path: target, content: 'NEW\n' }

console.log('D1 confirm without preview')
{
  const denied = agent.run('fs.write', args, { confirm: true, runId: 'd1' })
  ok(denied.ok === false && denied.error === 'preview-required', 'D1a preview-required', JSON.stringify(denied).slice(0, 160))
  ok(fs.readFileSync(target, 'utf8') === 'OLD\n', 'D1b disk unchanged')
}

console.log('D2 dry-run then confirm')
{
  agent.clearPreviewTickets()
  const prev = agent.run('fs.write', args, { dryRun: true, runId: 'd2' })
  ok(prev.ok === true && prev.dry_run === true, 'D2a dry-run ok', JSON.stringify(prev).slice(0, 160))
  ok(prev.impact_summary && Array.isArray(prev.impact_summary.paths), 'D2b impact_summary.paths')
  ok(prev.impact_summary.snapshot && prev.impact_summary.snapshot.will_snapshot === true, 'D2c snapshot.will_snapshot')
  const done = agent.run('fs.write', args, { confirm: true, runId: 'd2' })
  ok(done.ok === true, 'D2d confirm after preview', JSON.stringify(done).slice(0, 180))
  ok(fs.readFileSync(target, 'utf8') === 'NEW\n', 'D2e disk written')
  ok(done.impact_summary && done.impact_summary.paths.some((p) => /dry-run-gate-target/.test(p)), 'D2f paths include target')
}

console.log('D3 arg mismatch burns ticket')
{
  agent.clearPreviewTickets()
  fs.writeFileSync(target, 'OLD2\n', 'utf8')
  agent.run('fs.write', args, { dryRun: true, runId: 'd3' })
  const mismatch = agent.run('fs.write', { ...args, content: 'OTHER\n' }, { confirm: true, runId: 'd3' })
  ok(mismatch.ok === false && mismatch.error === 'preview-required', 'D3a mismatch requires new preview')
  ok(fs.readFileSync(target, 'utf8') === 'OLD2\n', 'D3b disk unchanged')
}

console.log('D4 read tools skip gate')
{
  agent.clearPreviewTickets()
  const read = agent.run('fs.read', { path: target }, { runId: 'd4' })
  ok(read.ok === true, 'D4 fs.read without preview', JSON.stringify(read).slice(0, 120))
  ok(read.impact_summary && Array.isArray(read.impact_summary.paths), 'D4 impact_summary present')
}

console.log('D5 impact builder shape')
{
  const s = impactMod.buildImpactSummary('doctor.fix', {}, [{ path: 'hot.yml', from: 'a', to: 'b' }])
  ok(Array.isArray(s.paths) && Array.isArray(s.config_keys) && Array.isArray(s.rows), 'D5a fields')
  ok(s.config_keys.length >= 1, 'D5b config_keys for doctor.fix')
  ok(typeof s.network === 'boolean', 'D5c network boolean')
  ok(s.snapshot === null || typeof s.snapshot === 'object', 'D5d snapshot null|object')
}

console.log('D6 confirm-required still before preview gate')
{
  agent.clearPreviewTickets()
  const need = agent.run('fs.write', args, { runId: 'd6' })
  ok(need.ok === false && need.error === 'confirm-required', 'D6 confirm-required without confirm flag')
}

try { fs.rmSync(FIX, { recursive: true, force: true }) } catch {}
try { fs.unlinkSync(target) } catch {}

console.log(`\n=== host-dry-run-gate: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed ? 1 : 0)
