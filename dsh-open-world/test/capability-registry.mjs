#!/usr/bin/env node
import {
  CAPABILITY_REGISTRY,
  resolveEmbedGate,
  satelliteFeatureIds,
  capabilitiesForPreset,
  enrichPluginWithRegistry,
} from '../bridge/capability-registry.mjs'

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  ✓', msg) }
  else { failed += 1; console.error('  ✗', msg) }
}

console.log('\n=== capability-registry ===\n')

ok(CAPABILITY_REGISTRY.length >= 7, 'registry has core satellites')
ok(satelliteFeatureIds().includes('dsh-open-world'), 'OW is satellite')
ok(satelliteFeatureIds().includes('web-ui-remote-web-ui'), 'remote is satellite')
ok(capabilitiesForPreset('bridge').some((c) => c.featureId === 'dsh-open-world'), 'bridge includes OW')
ok(!capabilitiesForPreset('bridge').some((c) => c.featureId === 'web-ui-remote-web-ui'), 'bridge excludes remote by default')
ok(!capabilitiesForPreset('daily').some((c) => c.featureId === 'dsh-open-world'), 'daily excludes OW')

const online = [{ id: 'rewind', online: true, howToEnable: null }]
ok(resolveEmbedGate('rewind', online).ok === true, 'online rewind embed ok')
const offline = [{ id: 'rewind', online: false, howToEnable: 'enable rewind' }]
ok(resolveEmbedGate('rewind', offline).ok === false, 'offline rewind blocked')
ok(String(resolveEmbedGate('rewind', offline).howToEnable).includes('enable'), 'offline hint')
ok(resolveEmbedGate('rewind', []).ok === true, 'empty plugins do not block')
ok(resolveEmbedGate('monitor', []).ok === true, 'monitor always ok')
ok(resolveEmbedGate('fleet', []).ok === true, 'fleet shell-owned ok')

const row = enrichPluginWithRegistry({
  id: 'remote-web-ui',
  featureId: 'web-ui-remote-web-ui',
  dep: '@linxin666/dsh-remote-web-ui',
  online: false,
})
ok(row.insertId === 'web-ui-remote-web-ui', 'enrich insertId')
ok(row.defaultInPresets.length === 0, 'remote defaultInPresets empty')
const office = CAPABILITY_REGISTRY.find((c) => c.featureId === 'dsh-office')
ok(office, 'office capability declared')
ok(Array.isArray(office.tools) && office.tools.length >= 2, 'office tools[] granular decl (A2)')
const orow = enrichPluginWithRegistry({ id: 'dsh-office', featureId: 'dsh-office', online: false })
ok(Array.isArray(orow.tools) && orow.tools.length >= 2, 'enrich maps tools')
ok(office.defaultInPresets.length === 0, 'office opt-in only')

console.log(`\n=== capability-registry: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
