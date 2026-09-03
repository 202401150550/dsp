#!/usr/bin/env node
/**
 * Probe whether Desktop can drop dsh-apiproxy-compat and use official
 * @deepseek-ai/dsh-host-apiproxy without the DSP api-remotes patch.
 *
 *   node probe-apiproxy.mjs
 *   node apply.mjs probe-apiproxy
 */
import fs from 'node:fs'
import path from 'node:path'

const LOCAL = process.env.LOCALAPPDATA || ''
const DESKTOP_UNPACKED = path.join(
  LOCAL,
  'Programs',
  'DSH Desktop',
  'resources',
  'app.asar.unpacked',
)
const NM = path.join(DESKTOP_UNPACKED, 'node_modules', '@deepseek-ai')
const PATCH_MARKER = 'DSP-PATCH: api-remotes agent-lookup re-export for host-apiproxy'

const REQUIRED_SYMBOLS = [
  'ApiRemoteSessionNotFound',
  'ApiRemoteSubagentSessionOwnership',
  'apiRemoteSubagentOwnershipError',
  'createApiRemoteAgentResolver',
  'hasApiRemoteSubagentOwner',
  'inspectApiRemoteSession',
]

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function exists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function pkgVersion(name) {
  const p = path.join(NM, name, 'package.json')
  if (!exists(p)) return null
  try {
    return readJson(p).version
  } catch {
    return null
  }
}

function stripDspPatch(src) {
  return String(src).replace(
    /\n\/\/ DSP-PATCH: api-remotes agent-lookup re-export for host-apiproxy[\s\S]*?from "\.\/types\/agent-lookup\.js";\r?\n?/g,
    '\n',
  )
}

function symbolsPresent(src, symbols) {
  const missing = []
  for (const s of symbols) {
    if (!src.includes(s)) missing.push(s)
  }
  return { ok: missing.length === 0, missing }
}

function probe() {
  const desktopPkg = path.join(DESKTOP_UNPACKED, 'package.json')
  const remotesIndex = path.join(NM, 'dsh-api-remotes', 'lib', 'index.js')
  const apiproxyIndex = path.join(NM, 'dsh-host-apiproxy', 'lib', 'index.js')
  const agentLookup = path.join(NM, 'dsh-api-remotes', 'lib', 'types', 'agent-lookup.js')

  const desktopVersion = exists(desktopPkg) ? readJson(desktopPkg).version : null
  const remotesVersion = pkgVersion('dsh-api-remotes')
  const apiproxyVersion = pkgVersion('dsh-host-apiproxy')
  const baseVersion = pkgVersion('dsh-base')

  const checks = {
    desktop_present: exists(desktopPkg),
    remotes_index_present: exists(remotesIndex),
    apiproxy_present: exists(apiproxyIndex),
    agent_lookup_module_present: exists(agentLookup),
  }

  let remotesHasPatch = false
  let remotesNativeExportsOk = false
  let remotesMissing = REQUIRED_SYMBOLS.slice()
  let apiproxyImportsRemotesRoot = null
  let apiproxyImportLine = null

  if (checks.remotes_index_present) {
    const raw = fs.readFileSync(remotesIndex, 'utf8')
    remotesHasPatch = raw.includes(PATCH_MARKER)
    const stripped = stripDspPatch(raw)
    const native = symbolsPresent(stripped, REQUIRED_SYMBOLS)
    remotesNativeExportsOk = native.ok
    remotesMissing = native.missing
  }

  if (checks.apiproxy_present) {
    const src = fs.readFileSync(apiproxyIndex, 'utf8')
    const m = src.match(/import\s*\{([^}]+)\}\s*from\s*["']@deepseek-ai\/dsh-api-remotes["']/)
    if (m) {
      apiproxyImportsRemotesRoot = true
      apiproxyImportLine = m[0].slice(0, 200)
    } else if (/from\s*["']@deepseek-ai\/dsh-api-remotes/.test(src)) {
      apiproxyImportsRemotesRoot = true
      apiproxyImportLine = '(subpath or mixed import)'
    } else {
      apiproxyImportsRemotesRoot = false
    }
  }

  // Ready when official apiproxy either no longer needs remotes root symbols,
  // or remotes natively exports them without our patch.
  const ready =
    checks.apiproxy_present
    && (
      apiproxyImportsRemotesRoot === false
      || (remotesNativeExportsOk && !remotesHasPatch)
    )

  let recommendation = 'keep-compat'
  let reason = ''
  if (!checks.desktop_present) {
    recommendation = 'unknown'
    reason = 'DSH Desktop unpacked tree not found'
  } else if (ready) {
    recommendation = 'switch-to-official'
    reason = apiproxyImportsRemotesRoot === false
      ? 'host-apiproxy no longer imports agent-lookup from dsh-api-remotes root'
      : 'dsh-api-remotes natively re-exports agent-lookup symbols (no DSP patch needed)'
  } else if (remotesHasPatch && remotesNativeExportsOk === false) {
    recommendation = 'keep-compat'
    reason = 'Desktop still needs DSP patch for remotes root exports; prefer apiproxy-compat over patched official'
  } else if (!checks.apiproxy_present) {
    recommendation = 'keep-compat'
    reason = 'official dsh-host-apiproxy not installed beside Desktop'
  } else {
    recommendation = 'keep-compat'
    reason = `remotes root missing symbols without patch: ${remotesMissing.join(', ') || '(unknown)'}`
  }

  return {
    ok: true,
    action: 'probe-apiproxy',
    checked_at: new Date().toISOString(),
    versions: {
      desktop: desktopVersion,
      'dsh-base': baseVersion,
      'dsh-api-remotes': remotesVersion,
      'dsh-host-apiproxy': apiproxyVersion,
      'dsh-apiproxy-compat': '1.0.0',
    },
    checks: {
      ...checks,
      remotes_has_dsp_patch: remotesHasPatch,
      remotes_native_exports_ok: remotesNativeExportsOk,
      remotes_missing_without_patch: remotesMissing,
      apiproxy_imports_remotes_root: apiproxyImportsRemotesRoot,
      apiproxy_import_sample: apiproxyImportLine,
    },
    ready_to_switch: ready,
    recommendation,
    reason,
    next_if_ready: [
      'node apply.mjs set apiproxy-compat false',
      'node apply.mjs set host-apiproxy true',
      'Fully quit DSH Desktop, reopen, verify task-board',
    ],
    docs: 'D:/dsp/dsh-apiproxy-compat/README.md',
  }
}

const report = probe()
console.log(JSON.stringify(report, null, 2))
console.log(`\n[probe-apiproxy] ${report.recommendation} — ${report.reason}`)
process.exit(report.recommendation === 'switch-to-official' ? 0 : 2)
