/**
 * Open World · Space ACL (owip/0.3-draft)
 * principal roles: loopback-shell | second-screen | peer
 */
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const SPACE_ROLES = Object.freeze({
  LOOPBACK_SHELL: 'loopback-shell',
  SECOND_SCREEN: 'second-screen',
  PEER: 'peer',
})

/** peer 可调用的 Host action（白名单；每次只 +1，须单测 + 审计） */
export const PEER_ACTION_ALLOWLIST = Object.freeze([
  'send-message',
  'mark-read',
  'memory-search', // v2.72：更深只读（Hindsight 检索；不写世界 / 不发令牌）
  'world-state-get', // v2.74：更深只读（读本机 world-state；不写 / 不 enter）
])

/** observer / second-screen：只允许这些路径前缀（method 另判） */
const OBSERVER_GET_PREFIXES = Object.freeze([
  '/space',
  '/space/',
  '/space/view',
  '/space/second-screen',
  '/space/sse-ticket',
  '/space/status',
])

const SSE_TICKET_REL = 'open-world/space-sse-tickets.json'
const SSE_TICKET_TTL_MS = 120_000

function normalizeSub(sub) {
  let s = String(sub || '/')
  if (!s.startsWith('/')) s = `/${s}`
  // strip trailing slash except root
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  return s
}

export function roleFromTokenRecord(tok) {
  if (!tok) return SPACE_ROLES.SECOND_SCREEN
  const r = String(tok.role || tok.label || '').toLowerCase()
  if (r === 'peer' || r === 'space-peer' || r === 'readwrite' || r === 'rw') {
    return SPACE_ROLES.PEER
  }
  // legacy tokens without role → observer only (安全默认)
  return SPACE_ROLES.SECOND_SCREEN
}

/**
 * Attach principal after authorizeSpaceRequest succeeds.
 * @returns {{ role:string, scopes:string[], via?:string, loopback?:boolean }}
 */
export function attachPrincipal(auth, tokenRecord) {
  if (!auth || !auth.ok) return null
  if (auth.loopback && auth.via === 'loopback') {
    return {
      role: SPACE_ROLES.LOOPBACK_SHELL,
      scopes: ['*'],
      via: auth.via,
      loopback: true,
    }
  }
  if (auth.via === 'lan-open') {
    // space require_token_for_lan=false：视为只读观察，禁止写
    return {
      role: SPACE_ROLES.SECOND_SCREEN,
      scopes: ['observe'],
      via: auth.via,
      loopback: !!auth.loopback,
    }
  }
  const role = roleFromTokenRecord(tokenRecord)
  return {
    role,
    scopes: role === SPACE_ROLES.PEER ? ['observe', 'peer-write'] : ['observe'],
    via: auth.via,
    loopback: !!auth.loopback,
    label: tokenRecord && tokenRecord.label,
  }
}

export function allowAction(actionName, principal) {
  if (!principal) return false
  if (principal.role === SPACE_ROLES.LOOPBACK_SHELL) return true
  if (principal.role === SPACE_ROLES.PEER) {
    return PEER_ACTION_ALLOWLIST.includes(String(actionName || ''))
  }
  return false
}

/**
 * @param {string} sub pathname after /api/open-world
 * @param {string} method HTTP method
 * @param {object} principal
 * @param {URLSearchParams} [searchParams]
 */
export function allowRoute(sub, method, principal, searchParams) {
  if (!principal) return false
  if (principal.role === SPACE_ROLES.LOOPBACK_SHELL) return true

  const path = normalizeSub(sub)
  const m = String(method || 'GET').toUpperCase()

  // stream: role query must match principal
  if (path === '/stream') {
    if (m !== 'GET') return false
    const want = (searchParams && searchParams.get('role')) || 'shell'
    if (principal.role === SPACE_ROLES.SECOND_SCREEN || principal.role === SPACE_ROLES.PEER) {
      return want === 'second-screen'
    }
    return false
  }

  if (principal.role === SPACE_ROLES.SECOND_SCREEN) {
    // 观察者可换短时 SSE ticket（POST），其余只读 GET /space/*
    if (m === 'POST' && path === '/space/sse-ticket') return true
    if (m !== 'GET') return false
    if (path === '/space' || path.startsWith('/space/')) return true
    return OBSERVER_GET_PREFIXES.some((p) => path === p || (p !== '/space' && path.startsWith(p)))
  }

  if (principal.role === SPACE_ROLES.PEER) {
    // peer: observer GETs + peer-action POST + limited /action + messages GET
    if (path === '/space' || path.startsWith('/space/')) {
      if (m === 'GET') return true
      if (m === 'POST' && (path === '/space/peer-action' || path === '/space/sse-ticket')) return true
      return false
    }
    if (path === '/action' && m === 'POST') return true
    if (path === '/messages' && m === 'GET') return true
    if (path === '/snapshot' && m === 'GET') {
      // peer 可用 shell 瘦身快照，禁止默认索取完整调试面由 view=shell 约束在 handler
      return true
    }
    return false
  }

  return false
}

export function denyBody(code = 'forbidden') {
  return { ok: false, error: code, acl: true }
}

/** 短时 SSE ticket（仅 stream），避免长寿命 token 挂在 EventSource URL */
export function issueSseTicket(home, principal, tokenValue) {
  if (!principal || !tokenValue) return null
  if (principal.role === SPACE_ROLES.LOOPBACK_SHELL) return null
  const file = join(home, SSE_TICKET_REL)
  mkdirSync(dirname(file), { recursive: true })
  let store = { tickets: {} }
  try {
    if (existsSync(file)) store = JSON.parse(readFileSync(file, 'utf8')) || store
  } catch { /* ignore */ }
  const ticket = randomBytes(16).toString('base64url')
  const exp = Date.now() + SSE_TICKET_TTL_MS
  store.tickets = store.tickets || {}
  // prune
  for (const [k, v] of Object.entries(store.tickets)) {
    if (!v || v.exp < Date.now()) delete store.tickets[k]
  }
  store.tickets[ticket] = {
    exp,
    role: principal.role,
    tokenHash: createHash('sha256').update(String(tokenValue)).digest('hex').slice(0, 16),
  }
  writeFileSync(file, JSON.stringify(store, null, 2), 'utf8')
  return { ticket, expiresInSec: Math.floor(SSE_TICKET_TTL_MS / 1000), role: principal.role }
}

export function consumeSseTicket(home, ticket) {
  if (!ticket) return null
  const file = join(home, SSE_TICKET_REL)
  if (!existsSync(file)) return null
  try {
    const store = JSON.parse(readFileSync(file, 'utf8'))
    const row = store.tickets && store.tickets[ticket]
    if (!row || row.exp < Date.now()) return null
    return { role: row.role || SPACE_ROLES.SECOND_SCREEN, via: 'sse-ticket' }
  } catch {
    return null
  }
}
