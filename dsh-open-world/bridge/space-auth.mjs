/**
 * Open World · 空间/多人最小切片（阶段 C）
 * - Bearer token：非 loopback 访问 OW API
 * - 信箱 outbox 密封（AES-256-GCM，非明文落盘）
 */
import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const SPACE_TOKEN_REL = 'open-world/space-token.json'
export const SPACE_PROTOCOL = 'owip/0.3-draft'
export const SPACE_PROTOCOL_LEGACY = 'owip/0.2-draft'

export function defaultSpaceConfig() {
  return {
    enabled: true,
    /** 非 loopback 必须带 Bearer；loopback 默认免 token */
    require_token_for_lan: true,
    /** 为 true 时连本机也要 token（调试/加固） */
    require_token_always: false,
    /** remote/external outbox 写密封包，不写明文 body */
    seal_outbox: true,
    /** 第二屏 SSE 可选实时推送 compact 视图 */
    sync: true,
    /** 令牌有效期（小时）；0 = 永不过期（仍可用轮换吊销） */
    token_ttl_hours: 168,
    token_file: SPACE_TOKEN_REL,
  }
}

export function mergeSpaceConfig(raw = {}) {
  return { ...defaultSpaceConfig(), ...(raw && typeof raw === 'object' ? raw : {}) }
}

export function spaceTokenPath(home, cfg = {}) {
  const rel = cfg.token_file || SPACE_TOKEN_REL
  return join(home, rel)
}

function newTokenValue() {
  return randomBytes(24).toString('base64url')
}

function computeExpiresAt(issuedAtIso, ttlHours) {
  const ttl = Number(ttlHours)
  if (!Number.isFinite(ttl) || ttl <= 0) return null
  const issued = issuedAtIso ? Date.parse(issuedAtIso) : Date.now()
  if (!Number.isFinite(issued)) return null
  return new Date(issued + ttl * 3600 * 1000).toISOString()
}

export function isSpaceTokenExpired(tok, cfg = {}) {
  if (!tok) return true
  const space = mergeSpaceConfig(cfg)
  const exp = tok.expiresAt || computeExpiresAt(tok.issuedAt, space.token_ttl_hours)
  if (!exp) return false
  return Date.now() > Date.parse(exp)
}

export function loadSpaceToken(home, cfg = {}) {
  const file = spaceTokenPath(home, cfg)
  if (!existsSync(file)) return null
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    if (!data || !data.token) return null
    const space = mergeSpaceConfig(cfg)
    const issuedAt = data.issuedAt || null
    const expiresAt = data.expiresAt || computeExpiresAt(issuedAt, space.token_ttl_hours)
    return {
      token: String(data.token),
      issuedAt,
      expiresAt,
      label: data.label || 'second-screen',
      role: data.role || (String(data.label || '').toLowerCase() === 'peer' ? 'peer' : 'second-screen'),
      protocol: data.protocol || SPACE_PROTOCOL,
    }
  } catch {
    return null
  }
}

export function ensureSpaceToken(home, cfg = {}, { rotate = false, label, ttl_hours, role } = {}) {
  const space = mergeSpaceConfig(cfg)
  if (!space.enabled && !rotate) {
    return { ok: true, enabled: false, token: null }
  }
  const file = spaceTokenPath(home, space)
  mkdirSync(dirname(file), { recursive: true })
  const existing = rotate ? null : loadSpaceToken(home, space)
  if (existing && !isSpaceTokenExpired(existing, space) && role == null) {
    return { ok: true, enabled: !!space.enabled, created: false, ...existing, path: SPACE_TOKEN_REL }
  }
  // 若指定 role 且与现有不同，强制轮换
  if (existing && !isSpaceTokenExpired(existing, space) && role != null
    && String(existing.role) === String(role)) {
    return { ok: true, enabled: !!space.enabled, created: false, ...existing, path: SPACE_TOKEN_REL }
  }
  const issuedAt = new Date().toISOString()
  const ttl = ttl_hours != null && Number.isFinite(Number(ttl_hours))
    ? Number(ttl_hours)
    : space.token_ttl_hours
  const roleNorm = String(role || 'second-screen').toLowerCase() === 'peer' ? 'peer' : 'second-screen'
  const record = {
    token: newTokenValue(),
    issuedAt,
    expiresAt: computeExpiresAt(issuedAt, ttl),
    label: label || roleNorm,
    role: roleNorm,
    protocol: SPACE_PROTOCOL,
    ttlHours: ttl,
  }
  writeFileSync(file, JSON.stringify(record, null, 2), 'utf8')
  return { ok: true, enabled: !!space.enabled, created: true, ...record, path: SPACE_TOKEN_REL }
}

/** label 可为字符串，或 `{ label, ttl_hours }` */
export function rotateSpaceToken(home, cfg = {}, labelOrOpts) {
  if (labelOrOpts && typeof labelOrOpts === 'object') {
    return ensureSpaceToken(home, cfg, { rotate: true, ...labelOrOpts })
  }
  return ensureSpaceToken(home, cfg, { rotate: true, label: labelOrOpts })
}

/** 吊销：删除磁盘令牌（下次 ensure/issue 再签发） */
export function revokeSpaceToken(home, cfg = {}) {
  const space = mergeSpaceConfig(cfg)
  const file = spaceTokenPath(home, space)
  try {
    if (existsSync(file)) {
      writeFileSync(file, JSON.stringify({
        revokedAt: new Date().toISOString(),
        token: null,
        protocol: SPACE_PROTOCOL,
      }, null, 2), 'utf8')
    }
  } catch { /* ignore */ }
  return { ok: true, revoked: true, hasToken: false }
}

export function extractBearer(req) {
  const h = (req && req.headers && (req.headers.authorization || req.headers.Authorization)) || ''
  const m = String(h).match(/^Bearer\s+(\S+)/i)
  if (m) return m[1]
  const url = req && req.url
  if (url) {
    try {
      const u = new URL(url, 'http://local')
      return u.searchParams.get('token') || u.searchParams.get('access_token')
    } catch { /* ignore */ }
  }
  return null
}

export function isLoopbackAddress(addr) {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

/**
 * @returns {{ ok:boolean, status?:number, error?:string, via?:string, loopback?:boolean }}
 */
export function authorizeSpaceRequest(req, home, spaceCfg) {
  const space = mergeSpaceConfig(spaceCfg)
  const addr = req && req.socket && req.socket.remoteAddress
  const loopback = isLoopbackAddress(addr)
  if (!space.enabled) {
    // 未启用空间层：保持 v0.1 仅 loopback
    if (!loopback) return { ok: false, status: 403, error: 'forbidden', loopback: false }
    return { ok: true, via: 'loopback', loopback: true }
  }

  const needToken = space.require_token_always || (!loopback && space.require_token_for_lan)
  if (!needToken) {
    return { ok: true, via: loopback ? 'loopback' : 'lan-open', loopback }
  }

  // SSE 短时 ticket（仅当 URL 带 ticket= 时由 ACL 层消费；此处仍要求或允许 bearer）
  const presented = extractBearer(req)
  if (!presented) {
    // 允许仅带 ticket 进入（stream）；ACL 再验 ticket
    try {
      const u = new URL(req.url || '/', 'http://local')
      if (u.searchParams.get('ticket')) {
        return { ok: true, via: 'ticket-pending', loopback }
      }
    } catch { /* ignore */ }
    return { ok: false, status: 401, error: 'token-required', loopback }
  }
  const stored = loadSpaceToken(home, space)
  if (!stored || !stored.token) {
    return { ok: false, status: 403, error: 'token-missing', loopback }
  }
  if (isSpaceTokenExpired(stored, space)) {
    return { ok: false, status: 403, error: 'token-expired', loopback }
  }
  if (presented !== stored.token) {
    return { ok: false, status: 403, error: 'token-invalid', loopback }
  }
  return { ok: true, via: 'bearer', loopback }
}

function deriveKey(secret) {
  return createHash('sha256').update(String(secret || ''), 'utf8').digest()
}

/** AES-256-GCM 密封 JSON 对象 → 可落盘结构 */
export function sealJson(secret, payload) {
  const key = deriveKey(secret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plain = Buffer.from(JSON.stringify(payload), 'utf8')
  const enc = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: enc.toString('base64'),
    sha256: createHash('sha256').update(plain).digest('hex'),
  }
}

export function unsealJson(secret, sealed) {
  if (!sealed || sealed.alg !== 'aes-256-gcm' || sealed.v !== 1) {
    throw new Error('unsupported-seal')
  }
  const key = deriveKey(secret)
  const iv = Buffer.from(sealed.iv, 'base64')
  const tag = Buffer.from(sealed.tag, 'base64')
  const data = Buffer.from(sealed.ciphertext, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(plain.toString('utf8'))
}

/** 轻量完整性标记（不加密，用于本机信箱条目可选签名） */
export function signMailboxEntry(secret, entry) {
  const body = JSON.stringify({
    id: entry.id,
    ts: entry.ts,
    from: entry.from,
    to: entry.to,
    body: entry.body,
  })
  return createHmac('sha256', String(secret || '')).update(body).digest('hex')
}

export function verifyMailboxEntry(secret, entry) {
  if (!entry || !entry.sig) return false
  return signMailboxEntry(secret, entry) === entry.sig
}

export function spaceStatus(home, cfg = {}) {
  const space = mergeSpaceConfig(cfg)
  const tok = loadSpaceToken(home, space)
  const expired = !!(tok && isSpaceTokenExpired(tok, space))
  return {
    enabled: !!space.enabled,
    require_token_for_lan: !!space.require_token_for_lan,
    require_token_always: !!space.require_token_always,
    seal_outbox: space.seal_outbox !== false,
    sync: space.sync !== false,
    token_ttl_hours: space.token_ttl_hours,
    protocol: SPACE_PROTOCOL,
    hasToken: !!(tok && tok.token && !expired),
    expired,
    issuedAt: tok && tok.issuedAt,
    expiresAt: tok && (tok.expiresAt || computeExpiresAt(tok.issuedAt, space.token_ttl_hours)),
    label: tok && tok.label,
    role: tok && (tok.role || 'second-screen'),
    path: SPACE_TOKEN_REL,
    // 永不在 status 里回传完整 token（需专门 issue/reveal 动作）
  }
}

/** 第二屏 compact 视图（JSON API + SSE） */
export function buildSecondScreenPayload(snap, spaceSt) {
  const fleet = snap && snap.fleet
  return {
    ok: true,
    protocol: SPACE_PROTOCOL,
    role: 'second-screen',
    capturedAt: (snap && snap.capturedAt) || new Date().toISOString(),
    core: snap && snap.core,
    load: snap && snap.load
      ? {
          taskRunning: snap.load.taskRunning,
          taskQueued: snap.load.taskQueued,
          uptimeSec: snap.load.uptimeSec,
        }
      : undefined,
    fleet: fleet
      ? {
          counts: fleet.counts || {},
          processes: (fleet.processes || []).slice(0, 12),
          ventusAvailable: !!fleet.ventusAvailable,
        }
      : { counts: {}, processes: [] },
    integrations: snap && snap.integrations,
    space: spaceSt,
    mailbox: {
      unread: snap && snap.mailbox && snap.mailbox.unread,
      total: snap && snap.mailbox && snap.mailbox.total,
    },
    events: ((snap && snap.events) || []).slice(0, 8).map((e) => ({
      kind: e.kind || e.type,
      text: e.text || e.message || e.summary,
      ts: e.ts || e.at || e.time,
      tier: e.tier,
    })),
  }
}
