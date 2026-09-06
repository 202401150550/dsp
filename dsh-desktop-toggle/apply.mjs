#!/usr/bin/env node
/**
 * Apply dsp/dsh-desktop-toggle/plugins.yml → ~/.dsh/profiles/desktop
 *
 *   node apply.mjs              # apply current yml + doctor check
 *   node apply.mjs apply
 *   node apply.mjs list         # JSON catalog
 *   node apply.mjs set <id> true|false
 *   node apply.mjs presets      # list profile presets
 *   node apply.mjs preset daily|bridge|full
 *   node apply.mjs probe-apiproxy  # can we drop compat for official?
 *
 * Never writes dsh-web-ui-all or skin-center into the live profile.
 * Every apply/set/preset ends with dsh-doctor check (critical/high → exit 1).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'
import { patchApiRemotesExports } from './patch-api-remotes-exports.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname
const PLUGINS_FILE = path.join(ROOT, 'plugins.yml')
const PRESETS_FILE = path.join(ROOT, 'presets.yml')
const ACTIVE_PRESET_FILE = path.join(ROOT, 'active-preset.json')
const DOCTOR_JS = path.join(ROOT, '..', 'dsh-doctor', 'dsh-doctor.mjs')
const DOCTOR_REPORT = path.join(ROOT, '..', '_doctor-last.json')
const PNPM_CJS = 'C:/Users/admin/AppData/Local/Programs/DSH Desktop/resources/app.asar.unpacked/node_modules/pnpm/bin/pnpm.cjs'
const REGISTRY_FILE = path.join(ROOT, '..', 'dsh-self', 'capability-registry.yml')

function loadRegistry() {
  try { return parse(fs.readFileSync(REGISTRY_FILE, 'utf8')) } catch { return { capabilities: {} } }
}

function capabilityOf(id, feature) {
  const hay = `${id} ${feature && feature.dep || ''} ${feature && feature.name || ''}`.toLowerCase()
  const caps = (loadRegistry().capabilities) || {}
  for (const [cap, spec] of Object.entries(caps)) {
    const keys = [cap, spec.owner, ...(spec.match || [])].map((s) => String(s).toLowerCase())
    if (keys.some((k) => k && hay.includes(k))) return cap
  }
  return null
}

function duplicateOwner(features, id, feature) {
  const cap = capabilityOf(id, feature)
  if (!cap) return null
  for (const [otherId, f] of Object.entries(features || {})) {
    if (otherId === id || !f.enabled) continue
    if (capabilityOf(otherId, f) === cap) return { capability: cap, owner: otherId }
  }
  return null
}

function isForbidden(id, feature) {
  if (feature && feature.forbidden) return true
  const s = String(id || '')
  return /web-ui-all/i.test(s) || /skin-center/i.test(s) || /dsh-skins$/i.test(s)
}

function hindsightDaemonUp() {
  const r = spawnSync(process.execPath, ['-e', `
    const net=require('net');
    const s=net.connect({host:'127.0.0.1',port:9077},()=>{s.destroy();process.exit(0)});
    s.setTimeout(800,()=>{s.destroy();process.exit(1)});
    s.on('error',()=>process.exit(1));
  `], { encoding: 'utf8', windowsHide: true, timeout: 2000 })
  return r.status === 0
}

function loadCfg() {
  return parse(fs.readFileSync(PLUGINS_FILE, 'utf8'))
}

function loadPresets() {
  if (!fs.existsSync(PRESETS_FILE)) return { presets: {} }
  return parse(fs.readFileSync(PRESETS_FILE, 'utf8')) || { presets: {} }
}

function toPosix(p) {
  return String(p).replace(/\\/g, '/')
}

function linkSpec(link) {
  return `link:${toPosix(link)}`
}

function patchAnchoredBootstrap() {
  const script = path.join(ROOT, 'patch-anchored-bootstrap.mjs')
  if (!fs.existsSync(script)) return { skipped: true, reason: 'script-missing' }
  const r = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  })
  let parsed = null
  try { parsed = JSON.parse((r.stdout || '').trim() || '{}') } catch {}
  if (parsed?.patched) {
    console.log('[patch] anchored-standard: stripped orphan hindsight_*/viking_* from bootstrap')
  }
  return {
    skipped: false,
    exit_code: r.status,
    ok: r.status === 0,
    ...(parsed || {}),
  }
}

function runDoctorCheck() {
  if (!fs.existsSync(DOCTOR_JS)) {
    return { skipped: true, reason: 'doctor-missing', path: DOCTOR_JS }
  }
  const r = spawnSync(process.execPath, [DOCTOR_JS, 'check'], {
    cwd: path.dirname(DOCTOR_JS),
    encoding: 'utf8',
    windowsHide: true,
  })
  let report = null
  try {
    report = JSON.parse(fs.readFileSync(DOCTOR_REPORT, 'utf8'))
  } catch {
    try {
      const m = String(r.stdout || '').match(/\{[\s\S]*\}/)
      if (m) report = JSON.parse(m[0])
    } catch {}
  }
  if (report && typeof report === 'object') {
    return {
      skipped: false,
      ok: !!report.ok,
      exit_code: r.status,
      checked_at: report.checked_at,
      hot_count: report.hot_count,
      dep_count: report.dep_count,
      issues: report.issues || [],
    }
  }
  return {
    skipped: false,
    ok: r.status === 0,
    exit_code: r.status,
    error: 'doctor-report-unreadable',
    stderr: (r.stderr || '').trim().slice(-400) || undefined,
  }
}

function setFeatureFlags(desired) {
  let text = fs.readFileSync(PLUGINS_FILE, 'utf8')
  for (const [id, enabled] of Object.entries(desired)) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      throw new Error(`invalid feature id: ${id}`)
    }
    const re = new RegExp(`(^  ${id}:\\r?\\n    enabled: )(true|false)`, 'm')
    if (!re.test(text)) {
      throw new Error(`feature not found in plugins.yml: ${id}`)
    }
    text = text.replace(re, `$1${enabled ? 'true' : 'false'}`)
  }
  fs.writeFileSync(PLUGINS_FILE, text, 'utf8')
}

function presetsCatalog() {
  const cfg = loadCfg()
  const file = loadPresets()
  let active = null
  try {
    active = JSON.parse(fs.readFileSync(ACTIVE_PRESET_FILE, 'utf8'))
  } catch {}
  const enabledIds = []
  for (const [id, f] of Object.entries(cfg.features || {})) {
    if (f.enabled && !isForbidden(id, f)) enabledIds.push(id)
  }
  const list = []
  for (const [name, p] of Object.entries(file.presets || {})) {
    const enable = [...(p.enable || [])]
    list.push({
      name,
      title: p.title || name,
      note: p.note || '',
      enable_count: enable.length,
      enable,
      matches_current: sameSet(enable, enabledIds),
    })
  }
  return {
    ok: true,
    action: 'presets',
    active,
    current_enabled: enabledIds,
    presets: list,
  }
}

function sameSet(a, b) {
  if (a.length !== b.length) return false
  const sb = new Set(b)
  return a.every((x) => sb.has(x))
}

function applyPreset(name) {
  const file = loadPresets()
  const preset = (file.presets || {})[name]
  if (!preset) {
    return {
      ok: false,
      action: 'preset',
      error: `unknown preset: ${name}`,
      available: Object.keys(file.presets || {}),
    }
  }
  const cfg = loadCfg()
  const enableSet = new Set(preset.enable || [])
  const unknown = [...enableSet].filter((id) => !(cfg.features || {})[id])
  const desired = {}
  for (const [id, f] of Object.entries(cfg.features || {})) {
    if (isForbidden(id, f)) {
      desired[id] = false
      continue
    }
    desired[id] = enableSet.has(id)
  }
  setFeatureFlags(desired)
  const status = applyNow({ preset: name })
  const meta = {
    name,
    title: preset.title || name,
    applied_at: status.applied_at,
    enable: [...enableSet],
  }
  fs.writeFileSync(ACTIVE_PRESET_FILE, JSON.stringify(meta, null, 2) + '\n', 'utf8')
  return {
    ...status,
    action: 'preset',
    preset: name,
    preset_title: preset.title || name,
    preset_note: preset.note || '',
    unknown_enable_ids: unknown,
  }
}

function featureList(cfg) {
  const alwaysOn = (cfg.always_on || []).map((item) => ({
    id: item.id,
    bundle: item.bundle,
    locked: true,
    enabled: true,
    title: item.id,
    group: 'always_on',
  }))
  const features = []
  for (const [id, f] of Object.entries(cfg.features || {})) {
    const forbidden = isForbidden(id, f)
    features.push({
      id,
      title: f.title || id,
      group: f.group || 'other',
      enabled: !!f.enabled && !forbidden,
      forbidden,
      note: f.note || '',
      insert_id: f.insert_id,
    })
  }
  return {
    ok: true,
    action: 'list',
    plugins_file: PLUGINS_FILE,
    profile_dir: cfg.profile_dir,
    always_on: alwaysOn,
    features,
    enabled: features.filter((x) => x.enabled).map((x) => x.id),
    disabled: features.filter((x) => !x.enabled).map((x) => x.id),
    forbidden: features.filter((x) => x.forbidden).map((x) => x.id),
  }
}

function ensureBuilt(featureKey, feature) {
  if (!feature.link) return true
  const pkgJson = path.join(feature.link, 'package.json')
  if (!fs.existsSync(pkgJson)) {
    console.warn(`[warn] ${featureKey}: missing package at ${feature.link}`)
    return false
  }
  let main = 'lib/index.js'
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'))
    if (pkg.main) main = pkg.main
  } catch {}
  const mainPath = path.join(feature.link, main)
  if (!fs.existsSync(mainPath) && String(main).includes('lib/')) {
    console.warn(`[warn] ${featureKey}: not built (${main} missing)`)
    return false
  }
  return true
}

function formatYamlScalar(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (value === null) return 'null'
  if (typeof value === 'string') {
    if (/^[A-Za-z0-9_./-]+$/.test(value)) return value
    return JSON.stringify(value)
  }
  return JSON.stringify(value)
}

function writePatch(features) {
  const lines = [
    '# AUTO-GENERATED by dsh-desktop-toggle/apply.mjs — edit plugins.yml then re-run apply',
    '# Desktop unified profile: base bundles + optional feature inserts',
    '',
  ]
  let any = false
  for (const [key, f] of Object.entries(features)) {
    if (!f.enabled || isForbidden(key, f)) continue
    // Package with dsh.bundle.patch is loaded via profile.bundles; do not duplicate the insert.
    if (f.bundle) continue
    any = true
    lines.push(`# ${f.title || key}`)
    lines.push('- insert:')
    lines.push(`    - id: ${f.insert_id}`)
    lines.push(`      name: '${f.name}'`)
    if (f.insert_config && typeof f.insert_config === 'object' && !Array.isArray(f.insert_config)) {
      lines.push('      config:')
      for (const [ck, cv] of Object.entries(f.insert_config)) {
        lines.push(`        ${ck}: ${formatYamlScalar(cv)}`)
      }
    }
    lines.push('')
  }
  if (!any) return '[]\n'
  return lines.join('\n')
}

function setEnabledInYml(id, enabled) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    throw new Error(`invalid feature id: ${id}`)
  }
  const text = fs.readFileSync(PLUGINS_FILE, 'utf8')
  const re = new RegExp(`(^  ${id}:\\r?\\n    enabled: )(true|false)`, 'm')
  if (!re.test(text)) {
    throw new Error(`feature not found in plugins.yml: ${id}`)
  }
  fs.writeFileSync(PLUGINS_FILE, text.replace(re, `$1${enabled ? 'true' : 'false'}`), 'utf8')
}

function runPnpmInstall(profileDir) {
  if (!fs.existsSync(PNPM_CJS)) {
    console.warn(`[warn] pnpm not found at ${PNPM_CJS}; skip install`)
    return { skipped: true }
  }
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const r = spawnSync(process.execPath, [PNPM_CJS, 'install', '--no-frozen-lockfile'], {
    cwd: profileDir,
    env,
    encoding: 'utf8',
    windowsHide: true,
  })
  return {
    skipped: false,
    code: r.status,
    stderr: (r.stderr || '').trim().slice(-800) || undefined,
  }
}

function applyNow(opts = {}) {
  const cfg = loadCfg()
  const profileDir = cfg.profile_dir || path.join(process.env.USERPROFILE || '', '.dsh', 'profiles', 'desktop')
  const pkgPath = path.join(profileDir, 'package.json')
  const patchPath = path.join(profileDir, 'cordis.patch.yml')

  fs.mkdirSync(profileDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  if (fs.existsSync(pkgPath)) fs.copyFileSync(pkgPath, `${pkgPath}.bak-toggle-${stamp}`)
  if (fs.existsSync(patchPath)) fs.copyFileSync(patchPath, `${patchPath}.bak-toggle-${stamp}`)

  const dependencies = {}
  const bundles = []

  for (const item of cfg.always_on || []) {
    if (item.bundle) bundles.push(item.bundle)
    if (item.dep && item.link) dependencies[item.dep] = linkSpec(item.link)
    else if (item.dep && item.version) dependencies[item.dep] = item.version
  }

  const features = cfg.features || {}
  const enabled = []
  const disabled = []
  const blocked = []

  for (const [key, f] of Object.entries(features)) {
    if (f.enabled && isForbidden(key, f)) {
      f.enabled = false
      blocked.push(key)
      disabled.push(`${key} (${f.title || f.insert_id}) [forbidden]`)
      continue
    }
    // Hindsight without :9077 blocks every turn ~25s → all-model Request timed out.
    if (key === 'hindsight' && f.enabled && !hindsightDaemonUp()) {
      console.warn('[skip] hindsight: 127.0.0.1:9077 down — auto-disable to avoid turn timeouts')
      f.enabled = false
      try { setEnabledInYml('hindsight', false) } catch {}
      blocked.push('hindsight')
      disabled.push(`${key} (${f.title || f.insert_id}) [daemon-down]`)
      continue
    }
    // Only ENABLED deps go into package.json — dshmarket hot-mounts the rest.
    if (f.enabled) {
      if (!ensureBuilt(key, f) && (f.group === 'web-ui' || f.group === 'skins')) {
        console.warn(`[skip] ${key}: enabled but not built`)
        f.enabled = false
        disabled.push(`${key} (${f.title || f.insert_id})`)
        continue
      }
      if (f.bundle) bundles.push(f.bundle)
      if (f.dep) {
        if (f.link) dependencies[f.dep] = linkSpec(f.link)
        else if (f.version) dependencies[f.dep] = f.version
      }
      if (f.extra_deps) {
        for (const [dep, link] of Object.entries(f.extra_deps)) {
          dependencies[dep] = linkSpec(link)
        }
      }
      enabled.push(`${key} (${f.title || f.insert_id})`)
    } else {
      disabled.push(`${key} (${f.title || f.insert_id})`)
    }
  }

  const pkg = {
    name: 'dsh-profile-desktop',
    private: true,
    dependencies,
    dsh: { profile: { bundles } },
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  fs.writeFileSync(patchPath, writePatch(features), 'utf8')
  fs.writeFileSync(path.join(profileDir, 'cordis.yml'), '[]\n', 'utf8')

  const marketDir = path.join(profileDir, '.dsh-market')
  fs.mkdirSync(marketDir, { recursive: true })
  for (const name of fs.readdirSync(marketDir)) {
    if (/^hot-\d+\.yml$/.test(name)) fs.unlinkSync(path.join(marketDir, name))
  }

  const allSkinLike = []
  for (const f of Object.values(features)) {
    if (f.group !== 'skins' && !f.extra_deps) continue
    if (f.dep) allSkinLike.push(f.dep)
    if (f.extra_deps) allSkinLike.push(...Object.keys(f.extra_deps))
  }
  const enabledDeps = new Set(Object.keys(dependencies))
  const marketDisabled = [...new Set(allSkinLike)].filter((name) => !enabledDeps.has(name))
  let marketState = { disabled: marketDisabled, groups: {}, groupOrder: [] }
  const statePath = path.join(marketDir, 'state.json')
  try {
    const prev = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    const merged = new Set([...(prev.disabled || prev.disabledSkins || []), ...marketDisabled])
    for (const name of enabledDeps) merged.delete(name)
    marketState = {
      disabled: [...merged],
      groups: prev.groups || {},
      groupOrder: prev.groupOrder || [],
    }
  } catch {}
  fs.writeFileSync(statePath, JSON.stringify(marketState, null, 2) + '\n', 'utf8')

  const install = runPnpmInstall(profileDir)

  // host-apiproxy (official rc) needs agent-lookup symbols; only when that feature is on.
  // apiproxy-compat does not need the Desktop remotes patch.
  let apiRemotesPatch = { skipped: true, reason: 'host-apiproxy-disabled' }
  if ((features['host-apiproxy'] || {}).enabled) {
    apiRemotesPatch = patchApiRemotesExports()
    if (!apiRemotesPatch.ok) {
      console.warn('[warn] api-remotes export patch failed:', apiRemotesPatch)
    } else if (apiRemotesPatch.patched) {
      console.log('[patch] dsh-api-remotes: re-exported agent-lookup for host-apiproxy')
    }
  }

  const anchored_bootstrap_patch = patchAnchoredBootstrap()
  const doctor = runDoctorCheck()

  const status = {
    ok: blocked.length === 0 && (doctor.skipped || doctor.ok !== false),
    action: 'apply',
    applied_at: new Date().toISOString(),
    profile_dir: profileDir,
    preset: opts.preset || null,
    bundles,
    enabled,
    disabled,
    blocked,
    market_disabled: marketState.disabled,
    install,
    api_remotes_patch: apiRemotesPatch,
    anchored_bootstrap_patch,
    doctor,
    restart_required: true,
  }
  fs.writeFileSync(path.join(ROOT, 'last-apply.json'), JSON.stringify(status, null, 2) + '\n', 'utf8')
  return status
}

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2))
}

function printApplySummary(status) {
  console.log('\nApplied →', status.profile_dir)
  if (status.preset) console.log('Preset:', status.preset)
  console.log('Enabled:')
  for (const e of status.enabled) console.log('  ✓', e)
  console.log('Disabled:')
  for (const d of status.disabled) console.log('  ·', d)
  if (status.blocked.length) {
    console.log('Blocked (policy):', status.blocked.join(', '))
  }
  if (status.doctor) {
    if (status.doctor.skipped) {
      console.log('[doctor] skipped:', status.doctor.reason)
    } else if (status.doctor.ok) {
      console.log(`[doctor] OK — deps=${status.doctor.dep_count} hot=${status.doctor.hot_count}`)
    } else {
      const n = (status.doctor.issues || []).filter((i) => i.severity === 'critical' || i.severity === 'high').length
      console.log(`[doctor] FAIL — ${n} critical/high issue(s). Try: node ../dsh-doctor/dsh-doctor.mjs safe-launch`)
    }
  }
  console.log('\nNext: fully quit DSH Desktop, then reopen.')
}

function exitFromStatus(status) {
  process.exit(status.ok ? 0 : 1)
}

function main() {
  const args = process.argv.slice(2)
  const cmd = args[0] || 'apply'

  if (cmd === 'list') {
    printJson(featureList(loadCfg()))
    process.exit(0)
  }

  if (cmd === 'presets') {
    printJson(presetsCatalog())
    process.exit(0)
  }

  if (cmd === 'probe-apiproxy') {
    const probePath = path.join(ROOT, 'probe-apiproxy.mjs')
    const r = spawnSync(process.execPath, [probePath], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    process.exit(r.status == null ? 1 : r.status)
  }

  if (cmd === 'preset') {
    const name = args[1]
    if (!name) {
      console.error('Usage: node apply.mjs preset <daily|bridge|full>')
      process.exit(2)
    }
    const status = applyPreset(name)
    printJson(status)
    if (!status.ok && status.error) {
      process.exit(1)
    }
    printApplySummary(status)
    exitFromStatus(status)
  }

  if (cmd === 'set') {
    const id = args[1]
    const val = String(args[2] || '').toLowerCase()
    if (!id || (val !== 'true' && val !== 'false')) {
      console.error('Usage: node apply.mjs set <id> true|false')
      process.exit(2)
    }
    const cfg = loadCfg()
    const f = (cfg.features || {})[id]
    if (!f) {
      printJson({ ok: false, action: 'set', error: `unknown feature: ${id}` })
      process.exit(1)
    }
    if (val === 'true' && isForbidden(id, f)) {
      printJson({
        ok: false,
        action: 'set',
        error: `forbidden: ${id}`,
        note: f.note || 'blocked by policy (web-ui-all / skin-center)',
      })
      process.exit(1)
    }
    if (val === 'true' && id === 'hindsight' && !hindsightDaemonUp()) {
      printJson({
        ok: false,
        action: 'set',
        error: 'hindsight-daemon-down',
        note: '127.0.0.1:9077 不通。先启动 Hindsight daemon，再 set hindsight true；否则每轮会卡 ~25s 导致全模型超时。',
      })
      process.exit(1)
    }
    if (val === 'true') {
      const dup = duplicateOwner(cfg.features || {}, id, f)
      if (dup) {
        printJson({
          ok: false,
          action: 'set',
          error: `duplicate capability: ${dup.capability}`,
          note: `已由 ${dup.owner} 占用。请收编（dsh-self wrap）或关掉旧主人，不要两套 UI。`,
        })
        process.exit(1)
      }
    }
    setEnabledInYml(id, val === 'true')
    // manual set leaves custom mix — clear active preset stamp
    try { fs.unlinkSync(ACTIVE_PRESET_FILE) } catch {}
    const status = applyNow()
    printJson({ ...status, action: 'set', id, enabled: val === 'true' })
    console.log(`\n[toggle] ${id} → ${val}. Restart DSH Desktop to load.`)
    if (status.doctor && !status.doctor.skipped) {
      console.log(status.doctor.ok
        ? `[doctor] OK — deps=${status.doctor.dep_count}`
        : '[doctor] FAIL — see last-apply.json / _doctor-last.json')
    }
    exitFromStatus(status)
  }

  if (cmd === 'apply') {
    const status = applyNow()
    printJson(status)
    printApplySummary(status)
    exitFromStatus(status)
  }

  console.error(`Unknown command: ${cmd}\nCommands: apply | list | set <id> true|false | presets | preset <name> | probe-apiproxy`)
  process.exit(2)
}

main()
