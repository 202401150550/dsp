/**
 * Host ↔ Rewind before-backup bridge (path C′).
 * Writes CheckpointEntry-shaped JSON under the same tree layout as dsh-rewind-plugin:
 *   <root>/<sessionId>/<anchorSeq>/<callId>.json
 * Does NOT import rewind internals — format-compatible only.
 *
 * v2（本轮加固）：
 *   - 记录 existed / encoding / byteLen / sha256 / mode，回滚时逐字节校验；
 *   - 非 UTF-8 文本由 fsWrite 在写前拒绝，避免「回滚成功但字节已坏」；
 *   - existed:true 且旧内容未知时拒绝回滚（不再猜）。
 * v1 旧快照仍可读，标记 legacy。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

export const SNAPSHOT_ROOT_ENV = 'DSH_REWIND_SNAPSHOT_DIR'
export const HOST_SESSION_ENV = 'DSH_HOST_REWIND_SESSION'
export const SNAPSHOT_VERSION = 2

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

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

/**
 * Persist a before-backup. On any failure returns { ok:false, error:'snapshot-failed' }.
 * @param {{ filePath: string, before: string|null, beforeBytes?: Buffer|null,
 *           existed?: boolean, callId?: string, anchorSeq?: number, sessionId?: string }} opts
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

  const existed = opts.existed === true || typeof opts.before === 'string'
  let mode = null
  try { mode = existed ? (fs.statSync(filePath).mode & 0o777) : null } catch { mode = null }

  const payload = opts.beforeBytes && Buffer.isBuffer(opts.beforeBytes)
    ? opts.beforeBytes
    : (typeof opts.before === 'string' ? Buffer.from(opts.before, 'utf8') : null)

  const entry = {
    version: SNAPSHOT_VERSION,
    callId,
    anchorSeq,
    path: filePath,
    time: Date.now(),
    existed,
    encoding: 'utf8',
    byteLen: payload ? payload.length : 0,
    sha256: payload ? sha256(payload) : null,
    mode,
    before: typeof opts.before === 'string' ? opts.before : null,
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
      byteLen: entry.byteLen,
      sha256: entry.sha256,
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
        version: Number(parsed.version) || 1,
        callId: String(parsed.callId ?? ''),
        anchorSeq: parsed.anchorSeq,
        path: parsed.path,
        before: typeof parsed.before === 'string' ? parsed.before : null,
        beforeBase64: typeof parsed.beforeBase64 === 'string' ? parsed.beforeBase64 : null,
        time: typeof parsed.time === 'number' ? parsed.time : 0,
        existed: typeof parsed.existed === 'boolean' ? parsed.existed : (typeof parsed.before === 'string'),
        encoding: parsed.encoding === 'base64' ? 'base64' : 'utf8',
        byteLen: Number.isFinite(parsed.byteLen) ? parsed.byteLen : null,
        sha256: typeof parsed.sha256 === 'string' ? parsed.sha256 : null,
        mode: Number.isFinite(parsed.mode) ? parsed.mode : null,
        legacy: (Number(parsed.version) || 1) < SNAPSHOT_VERSION,
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
  // 旧内容未知（existed:true 但没有 before）→ 拒绝，避免用猜测覆盖真实文件。
  if (entry.existed === true && entry.before === null && entry.encoding !== 'base64') {
    return { ok: false, error: 'snapshot-content-unknown', path: entry.path }
  }
  try {
    if (entry.existed === false || (entry.before === null && entry.encoding !== 'base64')) {
      if (fs.existsSync(entry.path)) fs.unlinkSync(entry.path)
      return { ok: true, verified: !fs.existsSync(entry.path), action: 'delete', path: entry.path }
    }
    const payload = entry.encoding === 'base64'
      ? Buffer.from(String(entry.beforeBase64 || ''), 'base64')
      : Buffer.from(String(entry.before ?? ''), 'utf8')
    if (entry.sha256 && sha256(payload) !== entry.sha256) {
      return { ok: false, error: 'snapshot-integrity-failed', path: entry.path, expected: entry.sha256 }
    }
    if (Number.isFinite(entry.byteLen) && payload.length !== entry.byteLen) {
      return { ok: false, error: 'snapshot-length-mismatch', path: entry.path }
    }
    fs.mkdirSync(path.dirname(entry.path), { recursive: true })
    fs.writeFileSync(entry.path, payload)
    if (Number.isFinite(entry.mode)) {
      try { fs.chmodSync(entry.path, entry.mode) } catch { /* Windows 可能不支持 */ }
    }
    const after = fs.readFileSync(entry.path)
    const verified = after.equals(payload)
    return {
      ok: true,
      verified,
      action: 'restore',
      path: entry.path,
      bytes: after.length,
      sha256: sha256(after),
      legacy: !!entry.legacy,
    }
  } catch (err) {
    return { ok: false, error: 'restore-failed', detail: String(err && err.message || err) }
  }
}
