#!/usr/bin/env node
/** Find DSH Open World HTTP base */
import { connect } from 'node:net'
import { execSync } from 'node:child_process'

async function probe(port) {
  const okTcp = await new Promise((resolve) => {
    const sock = connect({ port, host: '127.0.0.1' })
    const t = setTimeout(() => { sock.destroy(); resolve(false) }, 200)
    sock.on('connect', () => { clearTimeout(t); sock.destroy(); resolve(true) })
    sock.on('error', () => { clearTimeout(t); resolve(false) })
  })
  if (!okTcp) return null
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/open-world/snapshot`, {
      signal: AbortSignal.timeout(800),
    })
    if (!res.ok) return null
    const j = await res.json()
    if (j?.ok && String(j.framework?.protocol || '').includes('owip')) {
      return { port, ver: j.framework?.version, protocol: j.framework?.protocol }
    }
  } catch { /* next */ }
  return null
}

const known = [19359, 29580, 14322, 1742, 15721, 6060]
const ports = new Set(known)
const out = execSync('netstat -ano', { encoding: 'utf8', windowsHide: true })
for (const line of out.split(/\r?\n/)) {
  if (!/LISTENING/i.test(line)) continue
  const m = line.match(/(?:127\.0\.0\.1|0\.0\.0\.0|\[::1?\])\:(\d+)/)
  if (!m) continue
  const p = Number(m[1])
  if (p > 1024) ports.add(p)
}
console.log('scanning', ports.size, 'ports')
for (const p of [...ports].sort((a, b) => b - a)) {
  const hit = await probe(p)
  if (hit) {
    console.log('OW_UP', JSON.stringify(hit))
    process.exit(0)
  }
}
console.log('OW_DOWN')
process.exit(2)
