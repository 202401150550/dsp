#!/usr/bin/env node
/**
 * One-shot workspace snapshot for Phase 0.
 * Usage: node scripts/workspace-status.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const DSP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: DSP,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  })
}

const ow = readJson(path.join(DSP, 'dsh-open-world', 'package.json'))
const preset = readJson(path.join(DSP, 'dsh-desktop-toggle', 'active-preset.json'))
const doctor = run(path.join(DSP, 'dsh-doctor', 'dsh-doctor.mjs'), ['check'])
const bootstrap = run(path.join(DSP, 'dsh-desktop-toggle', 'patch-anchored-bootstrap.mjs'), ['--check'])

function parseJsonOut(r) {
  const raw = String(r.stdout || '').trim()
  const start = raw.indexOf('{')
  if (start < 0) return { parse_ok: false, exit: r.status, raw: raw.slice(0, 240) }
  try { return JSON.parse(raw.slice(start)) } catch {
    return { parse_ok: false, exit: r.status, raw: raw.slice(0, 240) }
  }
}

const doctorJson = parseJsonOut(doctor)
const bootJson = parseJsonOut(bootstrap)

const out = {
  ok: doctor.status === 0 && bootstrap.status === 0 && doctorJson.ok !== false && bootJson.ok !== false,
  preset: preset?.name || null,
  open_world: ow?.version || null,
  doctor: { exit: doctor.status, ok: doctorJson.ok, issues: doctorJson.issues || [] },
  bootstrap: { exit: bootstrap.status, ok: bootJson.ok, actions: bootJson.actions || [] },
  checked_at: new Date().toISOString(),
}

console.log(JSON.stringify(out, null, 2))
process.exit(out.ok ? 0 : 1)
