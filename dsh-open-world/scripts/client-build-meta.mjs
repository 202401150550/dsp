#!/usr/bin/env node
/**
 * Shared client compose / freshness helpers for dsh-open-world.
 */
import { createHash } from 'node:crypto'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const MODULE_ORDER = [
  'constants.js',
  'styles.js',
  'runtime.js',
  'shell.js',
  'idea.js',
  'ati-lab.js',
  'hubs.js',
  'views-space.js',
  'ati-view.js',
  'chrome.js',
  'app-layout.js',
  'portal.js',
  'hooks.js',
]

export function sourcePaths() {
  const paths = [
    join(ROOT, 'bridge', 'execute.mjs'),
    ...MODULE_ORDER.map((n) => join(ROOT, 'client', 'modules', n)),
    join(ROOT, 'client', 'client-main.js'),
  ]
  return paths.filter((p) => existsSync(p))
}

export function hashSources(paths = sourcePaths()) {
  const h = createHash('sha256')
  const sorted = [...paths].sort((a, b) => a.localeCompare(b))
  for (const p of sorted) {
    h.update(p.replace(/\\/g, '/'))
    h.update('\0')
    h.update(readFileSync(p))
    h.update('\0')
  }
  return h.digest('hex').slice(0, 10)
}

export function clientVerFromPackage() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const m = String(pkg.version).match(/^(\d+\.\d+)/)
  const short = m ? m[1] : String(pkg.version)
  return {
    full: pkg.version,
    version: short,
    clientVer: `v${short}`,
  }
}

export function parseClientJsMeta(src) {
  const m = String(src).match(/^\/\/ CLIENT_BUILD (\S+) (\S+) (\S+)/m)
  if (!m) return null
  return { build: m[1], builtAt: m[2], clientVer: m[3] }
}

export function readComposedMeta() {
  const p = join(ROOT, 'client.js')
  if (!existsSync(p)) return null
  return parseClientJsMeta(readFileSync(p, 'utf8'))
}

export function freshnessReport() {
  const paths = sourcePaths()
  const expected = hashSources(paths)
  const ver = clientVerFromPackage()
  const embedded = readComposedMeta()
  const clientPath = join(ROOT, 'client.js')
  let newestSource = null
  let newestMtime = 0
  for (const p of paths) {
    const t = statSync(p).mtimeMs
    if (t >= newestMtime) {
      newestMtime = t
      newestSource = p
    }
  }
  const clientMtime = existsSync(clientPath) ? statSync(clientPath).mtimeMs : 0
  const hashStale = !embedded || embedded.build !== expected
  const mtimeStale = newestMtime > clientMtime + 500
  return {
    ok: !hashStale,
    expected,
    embedded,
    clientVer: ver.clientVer,
    packageVersion: ver.full,
    hashStale,
    mtimeStale,
    newestSource,
    clientPath,
  }
}
