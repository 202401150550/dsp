/**
 * Host ↔ Rewind before-backup bridge (path C′).
 * Writes CheckpointEntry-shaped JSON under the same tree layout as dsh-rewind-plugin:
 *   <root>/<sessionId>/<anchorSeq>/<callId>.json
 * Does NOT import rewind internals — format-compatible only.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

export const SNAPSHOT_ROOT_ENV = 'DSH_REWIND_SNAPSHOT_DIR'
export const HOST_SESSION_ENV = 'DSH_HOST_REWIND_SESSION'

export function getSnapshotRoot() {
  return process.env[SNAPSHOT_ROOT_ENV]
    || path.join(os.homedir(), '.dsh', 'rewind-snapshots')
}

export function getHostSessionId() {
  return process.env[HOST_SESSION_ENV] || 'host-local'
}

export function newCallId() {
  return `host-fs-write-${crypto.randomUUID()}`
}

function safeFileId(callId) {
  return String(callId).replace(/[^a-zA-Z0-9._-]/g, '_')
}

function safeSessionId(sessionId) {
  const safe = String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '_')
  return safe === '..' || safe === '.' ? 'session' : safe
}

/**
 * Persist a before-backup. On any failure returns { ok:false, error:'snapshot-failed' }.
 * @param {{ filePath: string, before: string|null, callId?: string, anchorSeq?: number, sessionId?: string }} opts
 */
export function commitBeforeSnapshot(opts = {}) {
  const filePath = String(opts.filePath || '')
  if (!filePath) return { ok: false, error: 'snapshot-failed', detail: 'path-required' }

  const callId = opts.callId || newCallId()
  const anchorSeq = Number.isSafeInteger(opts.anchorSeq) ? opts.anchorSeq : Date.now()
  const sessionId = opts.sessionId || getHostSessionId()
  const root = getSnapshotRoot()
  const dir = path.join(root, safeSessionId(sessionId), String(anchorSeq))
  const snapshotPath = path.join(dir, `${safeFileId(callId)}.json`)
  const entry = {
    callId,
    anchorSeq,
    path: filePath,
    before: typeof opts.before === 'string' ? opts.before : null,
    time: Date.now(),
  }

  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(snapshotPath, JSON.stringify(entry), 'utf8')
    const parsed = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
    if (typeof parsed.path !== 'string' || typeof parsed.anchorSeq !== 'number') {
      return { ok: false, error: 'snapshot-failed', detail: 'snapshot-corrupt', callId }
    }
    return {
      ok: true,
      callId,
      anchorSeq,
      sessionId,
      snapshot_path: snapshotPath,
      entry: parsed,
    }
  } catch (err) {
    return {
      ok: false,
      error: 'snapshot-failed',
      detail: String(err && err.message || err),
      callId,
    }
  }
}

export function readCheckpointFile(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (typeof parsed.path !== 'string' || typeof parsed.anchorSeq !== 'number') {
      return { ok: false, error: 'snapshot-corrupt' }
    }
    return {
      ok: true,
      entry: {
        callId: String(parsed.callId ?? ''),
        anchorSeq: parsed.anchorSeq,
        path: parsed.path,
        before: typeof parsed.before === 'string' ? parsed.before : null,
        time: typeof parsed.time === 'number' ? parsed.time : 0,
      },
    }
  } catch (err) {
    return { ok: false, error: 'snapshot-read-failed', detail: String(err && err.message || err) }
  }
}

/** Apply one CheckpointEntry to disk (H5 restore helper). */
export function applyCheckpointEntry(entry) {
  if (!entry || typeof entry.path !== 'string') {
    return { ok: false, error: 'bad-entry' }
  }
  try {
    if (entry.before === null) {
      if (fs.existsSync(entry.path)) fs.unlinkSync(entry.path)
      return { ok: true, action: 'delete', path: entry.path }
    }
    fs.mkdirSync(path.dirname(entry.path), { recursive: true })
    fs.writeFileSync(entry.path, entry.before, 'utf8')
    return { ok: true, action: 'restore', path: entry.path, bytes: Buffer.byteLength(entry.before, 'utf8') }
  } catch (err) {
    return { ok: false, error: 'restore-failed', detail: String(err && err.message || err) }
  }
}
