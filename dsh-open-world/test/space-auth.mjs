#!/usr/bin/env node
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  authorizeSpaceRequest,
  ensureSpaceToken,
  rotateSpaceToken,
  revokeSpaceToken,
  spaceStatus,
  sealJson,
  unsealJson,
  signMailboxEntry,
  verifyMailboxEntry,
  mergeSpaceConfig,
  SPACE_PROTOCOL,
  buildSecondScreenPayload,
} from '../bridge/space-auth.mjs'

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  ✓', msg) }
  else { failed += 1; console.error('  ✗', msg) }
}

console.log('\n=== space-auth ===\n')

const home = mkdtempSync(join(tmpdir(), 'ow-space-'))
try {
  const cfg = mergeSpaceConfig({ enabled: true, require_token_for_lan: true })
  const issued = ensureSpaceToken(home, cfg, { label: 'test-screen' })
  ok(!!issued.token && issued.created === true, 'ensure creates token')
  const again = ensureSpaceToken(home, cfg)
  ok(again.token === issued.token && again.created === false, 'ensure is idempotent')
  const st = spaceStatus(home, cfg)
  ok(st.hasToken === true && !('token' in st), 'status hasToken, no plaintext')
  ok(st.protocol === SPACE_PROTOCOL, 'status protocol')
  ok(st.role === 'second-screen' || st.role === 'peer', 'status includes role')
  ok(issued.role === 'second-screen', 'default issue role is second-screen')

  const rotated = rotateSpaceToken(home, cfg, 'rotated')
  ok(rotated.token !== issued.token, 'rotate changes token')

  const loopReq = { socket: { remoteAddress: '127.0.0.1' }, headers: {}, url: '/' }
  ok(authorizeSpaceRequest(loopReq, home, cfg).ok === true, 'loopback without token ok')

  const lanNoTok = { socket: { remoteAddress: '192.168.1.20' }, headers: {}, url: '/' }
  const denied = authorizeSpaceRequest(lanNoTok, home, cfg)
  ok(denied.ok === false && denied.status === 401, 'lan without token → 401')

  const lanBad = {
    socket: { remoteAddress: '192.168.1.20' },
    headers: { authorization: 'Bearer wrong' },
    url: '/',
  }
  ok(authorizeSpaceRequest(lanBad, home, cfg).ok === false, 'lan bad token → deny')

  const lanOk = {
    socket: { remoteAddress: '192.168.1.20' },
    headers: { authorization: `Bearer ${rotated.token}` },
    url: '/',
  }
  ok(authorizeSpaceRequest(lanOk, home, cfg).via === 'bearer', 'lan good bearer ok')

  const shortCfg = mergeSpaceConfig({ enabled: true, require_token_for_lan: true, token_ttl_hours: 0.0001 })
  const shortTok = rotateSpaceToken(home, shortCfg, 'ttl')
  ok(!!shortTok.expiresAt, 'ttl writes expiresAt')

  const customTtl = rotateSpaceToken(home, cfg, { label: 'custom', ttl_hours: 2 })
  ok(!!customTtl.expiresAt, 'per-issue ttl_hours writes expiresAt')
  const customExp = Date.parse(customTtl.expiresAt)
  const deltaH = (customExp - Date.parse(customTtl.issuedAt)) / 3600000
  ok(Math.abs(deltaH - 2) < 0.05, 'per-issue ttl ≈ 2h')

  const neverTtl = rotateSpaceToken(home, cfg, { label: 'never', ttl_hours: 0 })
  ok(neverTtl.expiresAt == null, 'ttl_hours 0 → no expiry')

  // force expiry on the currently stored token
  const file = join(home, 'open-world', 'space-token.json')
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  raw.expiresAt = new Date(Date.now() - 1000).toISOString()
  writeFileSync(file, JSON.stringify(raw), 'utf8')
  const expiredAuth = authorizeSpaceRequest({
    socket: { remoteAddress: '192.168.1.20' },
    headers: { authorization: `Bearer ${neverTtl.token}` },
    url: '/',
  }, home, cfg)
  ok(expiredAuth.ok === false && expiredAuth.error === 'token-expired', 'expired token denied')

  rotateSpaceToken(home, cfg, 'again')
  revokeSpaceToken(home, cfg)
  ok(spaceStatus(home, cfg).hasToken === false, 'revoke clears hasToken')

  // re-issue for remaining seal tests
  const fresh = rotateSpaceToken(home, cfg, 'seal')
  const lanOk2 = {
    socket: { remoteAddress: '192.168.1.20' },
    headers: { authorization: `Bearer ${fresh.token}` },
    url: '/',
  }
  ok(authorizeSpaceRequest(lanOk2, home, cfg).ok === true, 're-issue after revoke')

  const qOk = {
    socket: { remoteAddress: '10.0.0.2' },
    headers: {},
    url: `/?token=${encodeURIComponent(fresh.token)}`,
  }
  ok(authorizeSpaceRequest(qOk, home, cfg).ok === true, 'query token ok')

  const sealed = sealJson(fresh.token, { hello: 'world', n: 1 })
  ok(sealed.alg === 'aes-256-gcm' && sealed.ciphertext, 'seal shape')
  const open = unsealJson(fresh.token, sealed)
  ok(open.hello === 'world' && open.n === 1, 'unseal roundtrip')

  const entry = { id: 'm1', ts: 't', from: 'a', to: 'b', body: 'hi' }
  entry.sig = signMailboxEntry(fresh.token, entry)
  ok(verifyMailboxEntry(fresh.token, entry) === true, 'mailbox sig verify')
  entry.body = 'tampered'
  ok(verifyMailboxEntry(fresh.token, entry) === false, 'mailbox sig rejects tamper')

  const ss = buildSecondScreenPayload({
    capturedAt: 'now',
    core: { healthScore: 1 },
    fleet: { counts: { running: 0 }, processes: [] },
    mailbox: { unread: 0, total: 0 },
    events: [],
  }, spaceStatus(home, cfg))
  ok(ss.role === 'second-screen' && ss.space && ss.space.sync === true, 'second-screen payload')

  const off = mergeSpaceConfig({ enabled: false })
  ok(authorizeSpaceRequest(lanNoTok, home, off).ok === false, 'space off → lan still forbidden')
  ok(authorizeSpaceRequest(loopReq, home, off).ok === true, 'space off → loopback ok')
} finally {
  rmSync(home, { recursive: true, force: true })
}

console.log(`\n=== space-auth: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
