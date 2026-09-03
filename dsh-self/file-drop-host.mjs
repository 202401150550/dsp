/**
 * file-drop host routes — fused into dsh-self (was dsh-file-drop always_on).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { homedir } from 'node:os'

const MAX_BYTES = 25 * 1024 * 1024
const API_PATH = '/api/dsh-file-drop'

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function sanitizeName(value) {
  let safe = basename(String(value || ''))
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_')
    .replace(/^\.+/, '')
    .trim()
  if (!safe) safe = 'file.bin'
  if (safe.length > 180) safe = safe.slice(0, 180)
  return safe
}

async function readJsonBody(req, maxBytes) {
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

export function applyFileDropHost(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: API_PATH,
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'POST', 'content-length': 0 })
          res.end()
          return
        }
        const payload = await readJsonBody(req, MAX_BYTES * 2 + 1024 * 1024)
        const { sessionId, name, size, kind } = payload
        if (!name || (kind !== 'text' && kind !== 'binary')) {
          sendJson(res, 400, { error: 'bad request' })
          return
        }
        if (!Number.isFinite(Number(size)) || Number(size) > MAX_BYTES) {
          sendJson(res, 413, { error: 'file too large (25MB limit)' })
          return
        }

        let dir
        const sessions = ctx.sessions
        if (sessions && sessionId) {
          const s = sessions.get(String(sessionId))
          if (s && s.meta && s.meta.cwd) dir = s.meta.cwd
        }
        if (!dir) {
          dir = (process.env.DSH_HOME && process.env.DSH_HOME.trim()) || join(homedir(), '.dsh')
        }
        const dropDir = join(dir, '.dsh-drops')
        mkdirSync(dropDir, { recursive: true })

        const safe = sanitizeName(name)
        const target = join(dropDir, safe)
        if (kind === 'text') {
          writeFileSync(target, String(payload.content == null ? '' : payload.content), 'utf8')
        } else {
          const buf = Buffer.from(String(payload.base64 || ''), 'base64')
          writeFileSync(target, buf)
        }
        sendJson(res, 200, { path: target })
      } catch (err) {
        sendJson(res, 500, { error: String(err && err.message || err) })
      }
    },
  }), 'dsh-self: file-drop route')
}
