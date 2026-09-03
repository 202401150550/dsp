#!/usr/bin/env node
import { mergePluginResults, scanManifestEntry } from '../bridge/manifest.mjs'

let passed = 0
let failed = 0

function ok(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

console.log('\n=== bridge/manifest.mjs ===\n')

const entry = scanManifestEntry({
  openWorld: {
    node: { id: 'demo-plugin', label: 'Demo', probe: 'demoProbe' },
    actions: [{ id: 'demo.open', label: 'Open', bridge: { type: 'panel', panel: 'demo' } }],
  },
}, 'dsh-demo', '/tmp/demo')

ok(entry?.node?.id === 'demo-plugin', 'scanManifestEntry parses node')
ok(entry.actions.length === 1, 'scanManifestEntry parses actions')

const merged = mergePluginResults({
  catalog: [{ id: 'task-board', title: 'TB', titleEn: 'TB', dep: 'dsh-task-board', probe: 'taskBoard' }],
  probes: { taskBoard: true, demoProbe: false },
  deps: new Set(['dsh-task-board', 'dsh-demo']),
  manifests: [entry],
})

ok(merged.length === 2, 'merge adds manifest plugin')
ok(merged.find((p) => p.id === 'demo-plugin')?.installed === true, 'manifest plugin installed')
ok(merged.find((p) => p.id === 'task-board')?.online === true, 'catalog probe online')

const offline = mergePluginResults({
  catalog: [{ id: 'ssh', title: 'SSH', titleEn: 'SSH', dep: '@linxin666/dsh-ssh', probe: 'ssh', featureId: 'web-ui-ssh' }],
  probes: { ssh: false },
  deps: new Set(),
  manifests: [],
})
ok(offline[0].howToEnable?.includes('web-ui-ssh'), 'offline howToEnable cites featureId')
ok(offline[0].status === 'missing', 'missing when dep absent')
ok(offline[0].featureId === 'web-ui-ssh', 'featureId preserved')

console.log(`\n=== manifest: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
