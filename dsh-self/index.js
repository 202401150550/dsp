/**
 * dsh-self — host half.
 * Inspect / wrap foreign plugins; also owns in-app doctor + feature-toggle APIs
 * (formerly dsh-config-doctor). Out-of-band rescue remains dsp/dsh-doctor CLI.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawnNodeSpec } from './node-bin.mjs'
import { inspectAll, inspectDir, wrapDir, organsCatalog, setAtom } from './adopt.mjs'
import { isAtomEnabled, anyAtomEnabled } from './organ-atoms.mjs'
import { applyFileDropHost } from './file-drop-host.mjs'
import { applyUsageHost } from './usage-host.mjs'
import { status as visionStatus, apply as visionApply } from './wizard-vision.mjs'
import { catalog as hostCatalog, run as hostRun } from './host-agent.mjs'

export const name = 'dsh-self'
export const inject = ['webServer', 'sessions']

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(ROOT, '..')
const DOCTOR_ROOT = path.join(DSP, 'dsh-doctor')
const DOCTOR = path.join(DOCTOR_ROOT, 'dsh-doctor.mjs')
const TOGGLE_ROOT = path.join(DSP, 'dsh-desktop-toggle')
const APPLY = path.join(TOGGLE_ROOT, 'apply.mjs')

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function sendCli(res, result) {
  if (result && result.report) {
    sendJson(res, 200, result.report)
    return
  }
  sendJson(res, 200, {
    ok: false,
    error: result && result.error ? result.error : 'cli-no-json',
    code: result && result.code,
    stderr: result && result.stderr,
  })
}

function sendSafe(res, fn) {
  try {
    sendJson(res, 200, fn())
  } catch (e) {
    sendJson(res, 500, { ok: false, error: String((e && e.message) || e) })
  }
}

function firstJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch {}
  }
  return null
}

function runNode(script, args, cwd) {
  return new Promise((resolve) => {
    const spec = spawnNodeSpec(script, args)
    const child = spawn(spec.file, spec.args, {
      cwd,
      env: spec.env,
      windowsHide: true,
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (c) => { out += c })
    child.stderr.on('data', (c) => { err += c })
    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        code,
        report: firstJson(out),
        stderr: err.trim() || undefined,
      })
    })
    child.on('error', (e) => {
      resolve({ ok: false, code: -1, error: String(e.message || e) })
    })
  })
}

function runDoctor(cmd) {
  return runNode(DOCTOR, [cmd], DOCTOR_ROOT).then((r) => ({
    ...r,
    doctor_path: DOCTOR,
  }))
}

function runApply(args) {
  return runNode(APPLY, args, TOGGLE_ROOT).then((r) => ({
    ...r,
    apply_path: APPLY,
  }))
}

async function readJsonBody(req, maxBytes = 64 * 1024) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > maxBytes) {
      req.resume()
      throw new Error('payload too large')
    }
  }
  if (raw === '') return {}
  return JSON.parse(raw)
}

export async function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-self/inspect',
    handler: async (req, res) => {
      if (req.method === 'GET') {
        sendSafe(res, () => inspectAll())
        return
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'GET, POST', 'content-length': 0 })
        res.end()
        return
      }
      let body
      try { body = await readJsonBody(req) } catch (e) {
        sendJson(res, 400, { ok: false, error: String(e.message || e) })
        return
      }
      const target = String(body.path || '').trim()
      if (!target) {
        sendSafe(res, () => inspectAll())
        return
      }
      sendSafe(res, () => {
        const dir = path.resolve(target)
        return { ok: true, action: 'inspect', target: inspectDir(dir) }
      })
    },
  }), 'dsh-self: inspect')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-self/wrap',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST', 'content-length': 0 })
        res.end()
        return
      }
      let body
      try { body = await readJsonBody(req) } catch (e) {
        sendJson(res, 400, { ok: false, error: String(e.message || e) })
        return
      }
      const target = String(body.path || '').trim()
      if (!target) {
        sendJson(res, 400, { ok: false, error: 'path required' })
        return
      }
      sendSafe(res, () => wrapDir(path.resolve(target)))
    },
  }), 'dsh-self: wrap')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-self/organs',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405, { allow: 'GET', 'content-length': 0 })
        res.end()
        return
      }
      sendSafe(res, () => organsCatalog())
    },
  }), 'dsh-self: organs')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-self/atom',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST', 'content-length': 0 })
        res.end()
        return
      }
      let body
      try { body = await readJsonBody(req) } catch (e) {
        sendJson(res, 400, { ok: false, error: String(e.message || e) })
        return
      }
      const organ = String(body.organ || '')
      const atom = String(body.atom || '')
      const enabled = body.enabled === true || body.enabled === 'true'
      if (!/^[a-z0-9-]+$/i.test(organ) || !/^[a-z0-9-]+$/i.test(atom)) {
        sendJson(res, 400, { ok: false, error: 'bad organ/atom id' })
        return
      }
      sendSafe(res, () => setAtom(organ, atom, enabled))
    },
  }), 'dsh-self: atom')

  // --- ops APIs (absorbed from dsh-config-doctor; paths kept for SelfCard) ---

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-doctor/check',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'POST') {
        res.writeHead(405, { allow: 'GET, POST', 'content-length': 0 })
        res.end()
        return
      }
      sendCli(res, await runDoctor('check'))
    },
  }), 'dsh-self: doctor-check')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-doctor/fix',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST', 'content-length': 0 })
        res.end()
        return
      }
      sendCli(res, await runDoctor('fix'))
    },
  }), 'dsh-self: doctor-fix')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-doctor/baseline-save',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST', 'content-length': 0 })
        res.end()
        return
      }
      sendCli(res, await runDoctor('baseline-save'))
    },
  }), 'dsh-self: doctor-baseline-save')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-toggle/list',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405, { allow: 'GET', 'content-length': 0 })
        res.end()
        return
      }
      sendCli(res, await runApply(['list']))
    },
  }), 'dsh-self: toggle-list')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-toggle/set',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST', 'content-length': 0 })
        res.end()
        return
      }
      let body
      try {
        body = await readJsonBody(req)
      } catch (e) {
        sendJson(res, 400, { ok: false, error: String(e.message || e) })
        return
      }
      const id = String(body.id || '')
      const enabled = body.enabled === true || body.enabled === 'true'
      if (!/^[a-zA-Z0-9-]+$/.test(id)) {
        sendJson(res, 400, { ok: false, error: 'bad feature id' })
        return
      }
      sendCli(res, await runApply(['set', id, enabled ? 'true' : 'false']))
    },
  }), 'dsh-self: toggle-set')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-self/wizard/vision',
    handler: async (req, res) => {
      if (req.method === 'GET') {
        sendSafe(res, () => visionStatus())
        return
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'GET, POST', 'content-length': 0 })
        res.end()
        return
      }
      let body = {}
      try { body = await readJsonBody(req) } catch (e) {
        sendJson(res, 400, { ok: false, error: String(e.message || e) })
        return
      }
      sendSafe(res, () => visionApply({ dryRun: body.dry_run === true || body.dry_run === 'true' }))
    },
  }), 'dsh-self: wizard-vision')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-host/tools',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405, { allow: 'GET', 'content-length': 0 })
        res.end()
        return
      }
      sendSafe(res, () => hostCatalog())
    },
  }), 'dsh-self: host-catalog')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-host/run',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST', 'content-length': 0 })
        res.end()
        return
      }
      let body
      try { body = await readJsonBody(req) } catch (e) {
        sendJson(res, 400, { ok: false, error: String(e.message || e) })
        return
      }
      const tool = String(body.tool || '')
      if (!/^[a-z0-9._-]+$/i.test(tool)) {
        sendJson(res, 400, { ok: false, error: 'bad tool id' })
        return
      }
      sendSafe(res, () => hostRun(tool, body.args && typeof body.args === 'object' ? body.args : {}, {
        dryRun: body.dry_run === true || body.dry_run === 'true',
        confirm: body.confirm === true || body.confirm === 'true',
      }))
    },
  }), 'dsh-self: host-run')

  if (isAtomEnabled('chat', 'file-drop')) {
    applyFileDropHost(ctx)
  }
  if (anyAtomEnabled('observe', ['usage-balance', 'usage-today'])) {
    await applyUsageHost(ctx)
  }
}
