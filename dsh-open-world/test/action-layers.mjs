#!/usr/bin/env node
/** Host vs Bridge action layer unit tests */
import {
  SNAPSHOT_SCHEMA_VERSION,
  classifyAction,
  actionLayersSummary,
  HOST_ACTION_IDS,
  BRIDGE_ACTION_TYPES,
  CORE_SHELL_HOST_ACTIONS,
} from '../bridge/action-layers.mjs'

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  ✓', msg) }
  else { failed += 1; console.error('  ✗', msg) }
}

console.log('\n=== action-layers ===\n')

ok(SNAPSHOT_SCHEMA_VERSION === 8, 'schema version 8')
ok(classifyAction('idea-inject').layer === 'host', 'idea-inject is host')
ok(classifyAction('inject-message').layer === 'bridge', 'inject-message is bridge')
ok(classifyAction('space-token-revoke').layer === 'host', 'space-token-revoke is host')
ok(classifyAction('rrm-session-apply').layer === 'host', 'rrm-session-apply is host')
ok(classifyAction('rrm-session-clear').layer === 'host', 'rrm-session-clear is host')
ok(classifyAction('session-focus').layer === 'bridge', 'session-focus is bridge')
ok(classifyAction('nope').layer === 'unknown', 'unknown action')
ok(HOST_ACTION_IDS.includes('send-message'), 'host has send-message')
ok(BRIDGE_ACTION_TYPES.includes('rewind-exec'), 'bridge has rewind-exec')

const summary = actionLayersSummary()
ok(summary.ideaInjectPath.includes('Host') && summary.ideaInjectPath.includes('Bridge'), 'idea path documents both layers')
ok(summary.host.actions.length >= 10, 'host action list non-empty')
ok(summary.bridge.actions.length >= 10, 'bridge action list non-empty')
ok(CORE_SHELL_HOST_ACTIONS.includes('idea-inject'), 'core shell has idea-inject')
ok(HOST_ACTION_IDS.includes('world-enter'), 'host has world-enter')
ok(CORE_SHELL_HOST_ACTIONS.includes('world-enter'), 'core shell has world-enter')
ok(HOST_ACTION_IDS.includes('request-local'), 'host has request-local')
ok(!CORE_SHELL_HOST_ACTIONS.includes('request-local'), 'request-local not in core shell UI')
ok(BRIDGE_ACTION_TYPES.includes('enter-world'), 'bridge has enter-world')
ok(summary.host.coreShell && summary.host.coreShell.includes('send-message'), 'summary.coreShell present')
ok(Array.isArray(summary.host.advanced) && summary.host.advanced.includes('rrm-session-apply'), 'advanced lists rrm apply')

console.log(`\n=== action-layers: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
