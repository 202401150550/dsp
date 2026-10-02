/**
 * 聊天坞存储层（Open World · Chat）。
 *
 * 设计取舍（为什么不是「再做一个微信」）：
 *   - 线程/消息是**本地文件**，落在 <home>/open-world/chat/，可直接备份/审计；
 *   - 只存文本 + 附件元数据 + 文件本体，附件另有大小上限与敏感名拒绝；
 *   - 对外只有一个数据面：线程、消息、文件。UI 想怎么画都行。
 *
 * 目录：
 *   <home>/open-world/chat/meta.json                 线程表（标题/未读/最后消息）
 *   <home>/open-world/chat/messages/<threadId>.json  消息（每线程上限 500 条）
 *   <home>/open-world/chat/files/<threadId>/<id>-<name>
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const CHAT_REL = 'open-world/chat'
export const MAX_TEXT_CHARS = 8000
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const MAX_MESSAGES = 500
export const MAX_THREADS = 50
export const DEFAULT_THREAD = 'main'

const ROLE_VALUES = new Set(['user', 'agent', 'system'])

const DENY_UPLOAD_NAME = [
  /^\.env/i,
  /^\.credentials/i,
  /^credentials\.json$/i,
  /^id_(rsa|ed25519)$/i,
  /\.(pem|key|pfx|p12|keystore|jks)$/i,
]

export function chatPaths(home) {
  const root = path.join(String(home || ''), CHAT_REL)
  return {
    root,
    meta: path.join(root, 'meta.json'),
    messagesDir: path.join(root, 'messages'),
    filesDir: path.join(root, 'files'),
    filesFor: (threadId) => path.join(root, 'files', safeId(threadId)),
  }
}

export function safeId(value) {
  const s = String(value || '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(s)) return null
  return s
}

export function sanitizeName(name) {
  const raw = String(name || '').replace(/[\r\n\t]/g, ' ').trim()
  const base = path.basename(raw).replace(/[^A-Za-z0-9._\u4e00-\u9fa5-]+/g, '_')
  return base.slice(0, 96) || 'file'
}

export function isUploadNameDenied(name) {
  const base = String(name || '')
  return DENY_UPLOAD_NAME.some((re) => re.test(base))
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

export function loadMeta(home) {
  const p = chatPaths(home)
  const data = readJson(p.meta, null)
  if (data && Array.isArray(data.threads)) return data
  return { version: 1, threads: [] }
}

export function saveMeta(home, meta) {
  const p = chatPaths(home)
  const trimmed = { ...meta, version: 1, threads: (meta.threads || []).slice(0, MAX_THREADS) }
  writeJson(p.meta, trimmed)
  return trimmed
}

export function ensureThread(home, { id = DEFAULT_THREAD, title = '新对话', kind = 'chat' } = {}) {
  const tid = safeId(id)
  if (!tid) return { ok: false, error: 'bad-thread-id' }
  const meta = loadMeta(home)
  let thread = meta.threads.find((t) => t.id === tid)
  if (!thread) {
    // Refuse new threads at capacity rather than silently evicting existing metadata.
    if (meta.threads.length >= MAX_THREADS) {
      return { ok: false, error: 'thread-limit-reached', max: MAX_THREADS }
    }
    thread = { id: tid, title: String(title).slice(0, 60), kind, createdAt: Date.now(), updatedAt: Date.now(), unread: 0 }
    meta.threads.unshift(thread)
    saveMeta(home, meta)
  }
  return { ok: true, thread }
}

export function listThreads(home) {
  const meta = loadMeta(home)
  return meta.threads
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export function messagesFile(home, threadId) {
  return path.join(chatPaths(home).messagesDir, `${safeId(threadId) || 'invalid'}.json`)
}

export function listMessages(home, threadId, { limit = 200, since = 0 } = {}) {
  const tid = safeId(threadId)
  if (!tid) return { ok: false, error: 'bad-thread-id' }
  const data = readJson(messagesFile(home, tid), { threadId: tid, messages: [] })
  const list = Array.isArray(data.messages) ? data.messages : []
  const filtered = since ? list.filter((m) => (m.ts || 0) > Number(since)) : list
  return { ok: true, threadId: tid, messages: filtered.slice(-Math.max(1, Math.min(500, limit))) }
}

export function appendMessage(home, { threadId, role = 'user', text = '', attachments = [], status = 'sent', meta = null } = {}) {
  const tid = safeId(threadId)
  if (!tid) return { ok: false, error: 'bad-thread-id' }
  if (!ROLE_VALUES.has(role)) return { ok: false, error: 'bad-role' }
  const body = String(text || '').slice(0, MAX_TEXT_CHARS)
  const atts = Array.isArray(attachments) ? attachments.slice(0, 8) : []
  if (!body && atts.length === 0) return { ok: false, error: 'empty-message' }

  const ensured = ensureThread(home, { id: tid })
  if (!ensured.ok) return ensured

  const file = messagesFile(home, tid)
  const data = readJson(file, { threadId: tid, messages: [] })
  const msg = {
    id: crypto.randomUUID(),
    threadId: tid,
    role,
    text: body,
    attachments: atts,
    status,
    ts: Date.now(),
    meta: meta || undefined,
  }
  const messages = [...(Array.isArray(data.messages) ? data.messages : []), msg].slice(-MAX_MESSAGES)
  writeJson(file, { threadId: tid, updatedAt: Date.now(), messages })

  const metaStore = loadMeta(home)
  const thread = metaStore.threads.find((t) => t.id === tid)
  if (thread) {
    thread.updatedAt = msg.ts
    thread.lastMessage = body ? body.slice(0, 80) : `[文件] ${atts.map((a) => a.name).join(', ')}`.slice(0, 80)
    thread.lastRole = role
    if (role !== 'user') thread.unread = (thread.unread || 0) + 1
    saveMeta(home, metaStore)
  }
  return { ok: true, message: msg, thread }
}

export function markRead(home, threadId) {
  const tid = safeId(threadId)
  if (!tid) return { ok: false, error: 'bad-thread-id' }
  const meta = loadMeta(home)
  const thread = meta.threads.find((t) => t.id === tid)
  if (thread) {
    thread.unread = 0
    saveMeta(home, meta)
  }
  return { ok: true, threadId: tid }
}

export function storeFile(home, threadId, name, buffer, contentType = 'application/octet-stream') {
  const tid = safeId(threadId)
  if (!tid) return { ok: false, error: 'bad-thread-id' }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return { ok: false, error: 'empty-file' }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'file-too-large', bytes: buffer.length, max: MAX_UPLOAD_BYTES }
  }
  const clean = sanitizeName(name)
  if (isUploadNameDenied(clean)) return { ok: false, error: 'file-name-denied', name: clean }

  const dir = chatPaths(home).filesFor(tid)
  fs.mkdirSync(dir, { recursive: true })
  const sha = crypto.createHash('sha256').update(buffer).digest('hex')
  const id = sha.slice(0, 12)
  const stored = `${id}-${clean}`
  const target = path.join(dir, stored)
  if (!fs.existsSync(target)) fs.writeFileSync(target, buffer)
  return {
    ok: true,
    attachment: {
      id,
      name: clean,
      stored,
      bytes: buffer.length,
      sha256: sha,
      mime: String(contentType || '').slice(0, 80) || 'application/octet-stream',
      url: `/api/open-world/chat/file?thread=${encodeURIComponent(tid)}&id=${encodeURIComponent(id)}`,
    },
  }
}

export function resolveFile(home, threadId, fileId) {
  const tid = safeId(threadId)
  const fid = String(fileId || '').toLowerCase()
  if (!tid || !/^[a-f0-9]{6,64}$/.test(fid)) return { ok: false, error: 'bad-file-ref' }
  const dir = chatPaths(home).filesFor(tid)
  if (!fs.existsSync(dir)) return { ok: false, error: 'not-found' }
  const hit = fs.readdirSync(dir).find((f) => f.startsWith(fid))
  if (!hit) return { ok: false, error: 'not-found' }
  const full = path.join(dir, hit)
  const real = fs.realpathSync(full)
  const rootReal = fs.realpathSync(chatPaths(home).filesFor(tid))
  const inside = real.replace(/\\/g, '/').toLowerCase().startsWith(rootReal.replace(/\\/g, '/').toLowerCase())
  if (!inside) return { ok: false, error: 'outside-chat-root' }
  const stat = fs.statSync(real)
  return {
    ok: true,
    path: real,
    name: hit.slice(fid.length + 1) || hit,
    bytes: stat.size,
    mime: guessMime(hit),
  }
}

export function guessMime(name) {
  const ext = path.extname(String(name || '')).toLowerCase()
  const table = {
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.log': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
  }
  return table[ext] || 'application/octet-stream'
}

export function chatStats(home) {
  const threads = listThreads(home)
  let messages = 0
  let files = 0
  let bytes = 0
  for (const t of threads) {
    messages += listMessages(home, t.id, { limit: MAX_MESSAGES }).messages.length
    const dir = chatPaths(home).filesFor(t.id)
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        files += 1
        try { bytes += fs.statSync(path.join(dir, f)).size } catch { /* ignore */ }
      }
    }
  }
  return { threads: threads.length, messages, files, bytes }
}
