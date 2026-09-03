#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'client.js')
let src = readFileSync(path, 'utf8')

const start = src.indexOf('    // ── Bridge 辅助层')
const end = src.indexOf('    async function postOpenWorldAction(action) {')
if (start < 0 || end < 0) {
  console.error('markers not found', start, end)
  process.exit(1)
}

const replacement = `    let sessionsBridge = null

    function notifyPulse(edges) {
      if (!edges || edges.length === 0) return
      fetch(PULSE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ edges }),
      }).catch(() => {})
    }

    const {
      bridgeExecute, readBridgeHealth, checkBridgeCapabilities,
    } = BridgeLib.createBridge({
      getSessionsBridge: () => sessionsBridge,
      postTaskAction,
      notifyPulse,
    })

    `

src = src.slice(0, start) + replacement + src.slice(end)
writeFileSync(path, src)
console.log('Replaced bridge block in client.js')
