#!/usr/bin/env node
/**
 * Keep Anchored Standard bootstrapTools/residentTools/compactionTools aligned
 * with plugins that are actually loaded.
 *
 * If agent.cordis.yml still lists hindsight_* / viking_* while those packages
 * are off, tool-bootstrap falls back to "full catalog exposed" → huge prompts
 * → ~7s "回答时间过长" model retries on simple questions.
 *
 * Also migrates legacy dsh-persona `text:` → required `prefix:` (DSH schema
 * rename; otherwise preset mount fails: $.prefix missing required value).
 *
 * Usage:
 *   node patch-anchored-bootstrap.mjs          # patch if needed
 *   node patch-anchored-bootstrap.mjs --check   # report only
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.USERPROFILE || process.env.HOME || ''
const PRESET = process.env.DSH_ANCHORED_PRESET
  || path.join(HOME, '.dsh', '.agent-presets', 'anchored-standard', 'agent.cordis.yml')
const PROFILE = process.env.DSH_PROFILE_DIR
  || path.join(HOME, '.dsh', 'profiles', 'desktop')
const PKG = path.join(PROFILE, 'package.json')

const FAMILIES = [
  {
    id: 'hindsight',
    depRe: /hindsight/i,
    toolRe: /hindsight_[a-z0-9_]+/gi,
    personaOld: /Long-term project memory is Hindsight \(hindsight_\*\)\.[^\n]*/,
    personaNew:
      'Long-term memory tools (hindsight_*) are optional and may be offline; answer from this identity without them. Do not use dsh_host_catalog for memory.',
  },
  {
    id: 'viking',
    depRe: /openviking|viking/i,
    toolRe: /viking_[a-z0-9_]+/gi,
    personaOld: null,
    personaNew: null,
  },
]

function readDeps() {
  if (!fs.existsSync(PKG)) return {}
  try {
    const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'))
    return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
  } catch {
    return {}
  }
}

function stripToolTokens(text, toolRe) {
  // Remove tokens inside YAML list brackets: , name  or  name,
  let out = text.replace(new RegExp(`,\\s*${toolRe.source}`, toolRe.flags), '')
  out = out.replace(new RegExp(`${toolRe.source}\\s*,\\s*`, toolRe.flags), '')
  return out
}

/** DSH renamed dsh-persona `text` → required `prefix`; old key fails mount. */
function needsPersonaPrefixRename(src) {
  // Only the persona row's `text:` key (not arbitrary YAML elsewhere).
  return /name:\s*['"]@deepseek-ai\/dsh-persona['"][\s\S]*?\n\s+text:\s/m.test(src)
    && !/name:\s*['"]@deepseek-ai\/dsh-persona['"][\s\S]*?\n\s+prefix:\s/m.test(src)
}

function renamePersonaTextToPrefix(src) {
  // Within the persona config block, rename the first `text:` to `prefix:`.
  return src.replace(
    /(name:\s*['"]@deepseek-ai\/dsh-persona['"]\s*\n\s*config:\s*\n(?:\s*#[^\n]*\n)*)(\s+)text:/m,
    '$1$2prefix:',
  )
}

function analyze() {
  const deps = readDeps()
  const depNames = Object.keys(deps)
  const exists = fs.existsSync(PRESET)
  const text = exists ? fs.readFileSync(PRESET, 'utf8') : ''
  const actions = []

  for (const fam of FAMILIES) {
    const pluginOn = depNames.some((n) => fam.depRe.test(n))
    const tools = [...new Set((text.match(fam.toolRe) || []).map((t) => t.toLowerCase()))]
    if (!pluginOn && tools.length) {
      actions.push({
        family: fam.id,
        reason: 'plugin-off-but-tools-listed',
        tools,
      })
    }
  }

  if (exists && needsPersonaPrefixRename(text)) {
    actions.push({
      family: 'persona',
      reason: 'legacy-text-key-needs-prefix',
      tools: [],
    })
  }

  return {
    ok: actions.length === 0,
    preset: PRESET,
    preset_exists: exists,
    dep_count: depNames.length,
    actions,
  }
}

function patch() {
  const report = analyze()
  if (!report.preset_exists) {
    return { ...report, patched: false, error: 'preset-missing' }
  }
  if (report.ok) {
    return { ...report, patched: false }
  }

  let text = fs.readFileSync(PRESET, 'utf8')
  const deps = readDeps()
  const depNames = Object.keys(deps)
  const removed = []

  for (const fam of FAMILIES) {
    const pluginOn = depNames.some((n) => fam.depRe.test(n))
    if (pluginOn) continue
    const before = text
    text = stripToolTokens(text, fam.toolRe)
    if (text !== before) removed.push(fam.id)
    if (fam.personaOld && fam.personaNew && fam.personaOld.test(text)) {
      text = text.replace(fam.personaOld, fam.personaNew)
    }
  }

  if (needsPersonaPrefixRename(text)) {
    text = renamePersonaTextToPrefix(text)
    removed.push('persona-text→prefix')
  }

  // Ensure comment near bootstrapTools
  if (!/hindsight_\* removed|viking_\*\/hindsight_\*/i.test(text)) {
    text = text.replace(
      /(bootstrapTools:\s*\[)/,
      '# viking_*/hindsight_* stripped when those plugins are off (else full catalog → timeouts).\n    $1',
    )
  }

  const bak = `${PRESET}.bak-bootstrap-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
  fs.copyFileSync(PRESET, bak)
  fs.writeFileSync(PRESET, text, 'utf8')

  const after = analyze()
  return {
    ...after,
    patched: true,
    backup: bak,
    removed_families: removed,
  }
}

function main() {
  const checkOnly = process.argv.includes('--check')
  const result = checkOnly ? { ...analyze(), patched: false } : patch()
  console.log(JSON.stringify(result, null, 2))
  if (checkOnly) process.exit(result.ok ? 0 : 2)
  process.exit(result.ok ? 0 : 1)
}

main()
