/**
 * Resolve a real Node binary. Inside DSH Desktop, process.execPath is the
 * Electron GUI exe — spawning it without ELECTRON_RUN_AS_NODE yields empty stdout.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

let cached

function looksLikeNode(p) {
  const base = path.basename(p).toLowerCase()
  if (base !== 'node.exe' && base !== 'node') return false
  if (/electron|dsh desktop/i.test(p)) return false
  return true
}

export function nodeBin() {
  if (cached) return cached
  if (!process.versions.electron) {
    cached = process.execPath
    return cached
  }
  const hits = []
  const add = (p) => {
    if (!p) return
    const n = String(p).trim().replace(/^"|"$/g, '')
    if (n) hits.push(n)
  }
  add(process.env.DSH_NODE)
  add(process.env.NODE)
  add(process.env.npm_node_execpath)
  try {
    const r = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['node'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 4000,
    })
    for (const line of String(r.stdout || '').split(/\r?\n/)) add(line)
  } catch {}
  const home = process.env.USERPROFILE || process.env.HOME || ''
  add('C:\\Program Files\\nodejs\\node.exe')
  add(path.join(home, 'scoop', 'apps', 'nodejs', 'current', 'node.exe'))
  add('/usr/local/bin/node')
  for (const p of hits) {
    try {
      if (fs.existsSync(p) && looksLikeNode(p)) {
        cached = p
        return cached
      }
    } catch {}
  }
  cached = 'node'
  return cached
}

export function nodeSpawnEnv(base = process.env) {
  const env = { ...base }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

export function spawnNodeSpec(script, args = []) {
  const bin = nodeBin()
  const usingApp = !!process.versions.electron && (
    bin === process.execPath || /dsh desktop|electron/i.test(String(bin))
  )
  if (usingApp) {
    return {
      file: process.execPath,
      args: [script, ...args],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    }
  }
  return {
    file: bin,
    args: [script, ...args],
    env: nodeSpawnEnv(),
  }
}

export function spawnNodeSync(script, args = [], extra = {}) {
  const spec = spawnNodeSpec(script, args)
  return spawnSync(spec.file, spec.args, {
    encoding: 'utf8',
    windowsHide: true,
    ...extra,
    env: extra.env ? { ...spec.env, ...extra.env } : spec.env,
  })
}
