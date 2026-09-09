#!/usr/bin/env node
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  attachPrincipal,
  allowRoute,
  allowAction,
  issueSseTicket,
  consumeSseTicket,
  SPACE_ROLES,
  PEER_ACTION_ALLOWLIST,
  PEER_LOCAL_REQUEST_ALLOWLIST,
  allowLocalRequest,
  roleFromTokenRecord,
} from '../bridge/space-acl.mjs'
import {
  ensureSpaceToken,
  authorizeSpaceRequest,
  mergeSpaceConfig,
  SPACE_PROTOCOL,
} from '../bridge/space-auth.mjs'

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  ✓', msg) }
  else { failed += 1; console.error('  ✗', msg) }
}

console.log('\n=== space-acl ===\n')

const home = mkdtempSync(join(tmpdir(), 'ow-acl-'))
try {
  const cfg = mergeSpaceConfig({ enabled: true, require_token_for_lan: true })

  ok(SPACE_PROTOCOL === 'owip/0.3-draft', 'protocol 0.3-draft')
  ok(roleFromTokenRecord(null) === SPACE_ROLES.SECOND_SCREEN, 'null token → observer')
  ok(roleFromTokenRecord({ label: 'legacy' }) === SPACE_ROLES.SECOND_SCREEN, 'legacy without role → observer')
  ok(roleFromTokenRecord({ role: 'peer' }) === SPACE_ROLES.PEER, 'peer role')

  const observerTok = ensureSpaceToken(home, cfg, { rotate: true, role: 'second-screen', label: 'obs' })
  ok(observerTok.role === 'second-screen', 'ensure default/explicit second-screen')

  const loopAuth = { ok: true, via: 'loopback', loopback: true }
  const shell = attachPrincipal(loopAuth, observerTok)
  ok(shell.role === SPACE_ROLES.LOOPBACK_SHELL && allowAction('pair-issue', shell), 'loopback-shell full actions')

  const lanAuth = { ok: true, via: 'bearer', loopback: false }
  const obs = attachPrincipal(lanAuth, observerTok)
  ok(obs.role === SPACE_ROLES.SECOND_SCREEN, 'bearer observer principal')
  ok(allowRoute('/space/status', 'GET', obs), 'observer GET /space/status')
  ok(allowRoute('/space/second-screen', 'GET', obs), 'observer GET second-screen')
  ok(allowRoute('/space/sse-ticket', 'POST', obs), 'observer POST sse-ticket')
  ok(!allowRoute('/action', 'POST', obs), 'observer blocked POST /action')
  ok(!allowAction('send-message', obs), 'observer cannot send-message')
  ok(!allowAction('space-token-issue', obs), 'observer cannot space-token-issue')
  ok(!allowRoute('/stream', 'GET', obs, new URLSearchParams('role=shell')), 'observer cannot stream role=shell')
  ok(allowRoute('/stream', 'GET', obs, new URLSearchParams('role=second-screen')), 'observer stream second-screen')

  const peerTok = ensureSpaceToken(home, cfg, { rotate: true, role: 'peer', label: 'peer' })
  ok(peerTok.role === 'peer', 'ensure peer role stored')
  const peer = attachPrincipal(lanAuth, peerTok)
  ok(peer.role === SPACE_ROLES.PEER, 'peer principal')
  ok(allowRoute('/action', 'POST', peer), 'peer may POST /action route')
  ok(allowRoute('/space/peer-action', 'POST', peer), 'peer may peer-action')
  ok(allowAction('send-message', peer) && allowAction('mark-read', peer), 'peer allowlist send/mark')
  ok(allowAction('memory-search', peer), 'peer allowlist memory-search')
  ok(allowAction('world-state-get', peer), 'peer allowlist world-state-get')
  ok(allowAction('request-local', peer), 'peer allowlist request-local (+1)')
  ok(!allowAction('share-snapshot', peer), 'peer cannot call share-snapshot directly')
  ok(!allowAction('world-state-save', peer), 'peer still denied world-state-save')
  ok(!allowAction('pair-issue', peer), 'peer denied pair-issue')
  ok(!allowAction('space-token-issue', peer), 'peer denied space-token-issue')
  ok(!allowAction('idea-inject', peer), 'peer denied idea-inject')
  ok(!allowAction('rrm-session-apply', peer), 'peer denied rrm-session')
  ok(PEER_ACTION_ALLOWLIST.length === 5, 'peer allowlist size=5')
  ok(PEER_ACTION_ALLOWLIST.includes('request-local'), 'allowlist contains request-local')
  ok(PEER_LOCAL_REQUEST_ALLOWLIST.length === 2, 'local request allowlist size=2')
  ok(PEER_LOCAL_REQUEST_ALLOWLIST.includes('share-snapshot'), 'local has share-snapshot')
  ok(PEER_LOCAL_REQUEST_ALLOWLIST.includes('space-token-status'), 'local has space-token-status (+1)')
  ok(allowLocalRequest('share-snapshot'), 'allowLocalRequest share-snapshot')
  ok(allowLocalRequest('space-token-status'), 'allowLocalRequest space-token-status')
  ok(!allowLocalRequest('world-state-save'), 'deny local world-state-save')
  ok(!allowLocalRequest('space-token-issue'), 'deny local space-token-issue')
  ok(!allowLocalRequest('request-local'), 'deny nested request-local')
  ok(!allowLocalRequest('idea-inject'), 'deny local idea-inject')
  ok(!allowAction('space-token-status', peer), 'peer cannot call space-token-status directly')

  const lanOpen = attachPrincipal({ ok: true, via: 'lan-open', loopback: false }, null)
  ok(lanOpen.role === SPACE_ROLES.SECOND_SCREEN && !allowAction('send-message', lanOpen), 'lan-open is observe-only')

  const ticket = issueSseTicket(home, peer, peerTok.token)
  ok(!!ticket?.ticket && ticket.role === 'peer', 'issue sse ticket')
  const consumed = consumeSseTicket(home, ticket.ticket)
  ok(consumed?.role === 'peer', 'consume sse ticket')
  ok(consumeSseTicket(home, 'nope') == null, 'bad ticket null')

  const lanNoTok = { socket: { remoteAddress: '192.168.1.9' }, headers: {}, url: '/api/open-world/action' }
  ok(authorizeSpaceRequest(lanNoTok, home, cfg).ok === false, 'lan still needs token at auth layer')

  const obsAgain = ensureSpaceToken(home, cfg, { rotate: true, role: 'second-screen', label: 'obs2' })
  const lanWithObs = {
    socket: { remoteAddress: '192.168.1.9' },
    headers: { authorization: `Bearer ${obsAgain.token}` },
    url: '/api/open-world/action',
  }
  const authObs = authorizeSpaceRequest(lanWithObs, home, cfg)
  ok(authObs.ok === true && authObs.via === 'bearer', 'observer bearer auth ok')
  const pObs = attachPrincipal(authObs, obsAgain)
  ok(!allowRoute('/action', 'POST', pObs) && !allowAction('world-state-save', pObs), 'LAN observer must not write any action')
} finally {
  rmSync(home, { recursive: true, force: true })
}

console.log(`\n=== space-acl: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
