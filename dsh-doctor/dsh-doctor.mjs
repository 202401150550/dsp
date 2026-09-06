#!/usr/bin/env node
/**
 * dsh-doctor — Phase 1a out-of-band recovery (does NOT need DSH UI).
 *
 * Usage:
 *   node dsh-doctor.mjs check
 *   node dsh-doctor.mjs fix              # clear hot-*.yml + reinforce market disabled skins
 *   node dsh-doctor.mjs baseline-save
 *   node dsh-doctor.mjs baseline-restore --yes
 *   node dsh-doctor.mjs launch           # clear bad env, start Desktop
 *   node dsh-doctor.mjs safe-launch      # fix + launch
 *   node dsh-doctor.mjs report           # write JSON report to dsp/_doctor-last.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync, execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..')
const HOME = process.env.USERPROFILE || process.env.HOME || ''
const PROFILE = process.env.DSH_PROFILE_DIR || path.join(HOME, '.dsh', 'profiles', 'desktop')
const DSH_ROOT = path.join(HOME, '.dsh')
const SETTINGS = path.join(DSH_ROOT, 'settings.yaml')
const MARKET = path.join(PROFILE, '.dsh-market')
const BASELINE_DIR = path.join(DSP, 'dsh-doctor', 'baselines', 'current')
const REPORT_PATH = path.join(DSP, '_doctor-last.json')
const DESKTOP_EXE = process.env.DSH_DESKTOP_EXE
  || 'C:\\Users\\admin\\AppData\\Local\\Programs\\DSH Desktop\\DSH Desktop.exe'

const FORBIDDEN_DEP_SUBSTR = [
  'dsh-web-ui-all',
  'dsh-client-ui-skin-center',
  'dsh-skins',
  'dsh-client-ui-skin-xp',
  'dsh-client-ui-skin-miku',
  'dsh-client-ui-skin-minecraft',
  'dsh-client-ui-skin-tokyo-night',
  'dsh-client-ui-skin-dracula',
  'dsh-client-ui-skin-cyberpunk',
  'dsh-client-ui-skin-blue-fantasy',
  'dsh-client-ui-skin-dragon-heir',
  'dsh-client-ui-skin-harbor',
  'dsh-client-ui-skin-maid-atelier',
  'dsh-client-ui-skin-matrix',
  'dsh-client-ui-skin-trading',
  'dsh-client-ui-skin-whale-mom',
  'dsh-client-ui-skin-whale-song',
]

const SKIN_MARKET_DISABLE = [
  '@linxin666/dsh-client-ui-skin-center',
  '@linxin666/dsh-skins',
  '@linxin666/dsh-client-ui-skin-xp',
  '@linxin666/dsh-client-ui-skin-miku',
  '@linxin666/dsh-client-ui-skin-minecraft',
  '@linxin666/dsh-client-ui-skin-tokyo-night',
  '@linxin666/dsh-client-ui-skin-dracula',
  '@linxin666/dsh-client-ui-skin-cyberpunk',
  '@linxin666/dsh-client-ui-skin-blue-fantasy',
  '@linxin666/dsh-client-ui-skin-dragon-heir',
  '@linxin666/dsh-client-ui-skin-harbor',
  '@linxin666/dsh-client-ui-skin-maid-atelier',
  '@linxin666/dsh-client-ui-skin-matrix',
  '@linxin666/dsh-client-ui-skin-trading',
  '@linxin666/dsh-client-ui-skin-whale-mom',
  '@linxin666/dsh-client-ui-skin-whale-song',
]

function exists(p) {
  try { return fs.existsSync(p) } catch { return false }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

function listHot() {
  if (!exists(MARKET)) return []
  return fs.readdirSync(MARKET)
    .filter((n) => /^hot-\d+\.yml$/.test(n))
    .map((n) => path.join(MARKET, n))
}

function getDeps() {
  const pkgPath = path.join(PROFILE, 'package.json')
  if (!exists(pkgPath)) return { pkgPath, deps: {} }
  const pkg = readJson(pkgPath)
  return { pkgPath, deps: pkg.dependencies || {} }
}

function findForbiddenDeps(deps) {
  const hits = []
  for (const name of Object.keys(deps)) {
    for (const bad of FORBIDDEN_DEP_SUBSTR) {
      if (name.includes(bad) || name.endsWith('/' + bad) || name === '@linxin666/' + bad) {
        hits.push(name)
        break
      }
    }
    // also catch any @linxin666/*skin* except deep-whale external
    if (/skin/i.test(name) && !/deep-whale/i.test(name)) {
      if (!hits.includes(name)) hits.push(name)
    }
  }
  return hits
}

function checkLinkedLibs(deps) {
  const missing = []
  for (const [name, spec] of Object.entries(deps)) {
    if (typeof spec !== 'string' || !spec.startsWith('link:')) continue
    const linkPath = spec.slice(5).replace(/\//g, path.sep)
    const abs = path.isAbsolute(linkPath) ? linkPath : path.resolve(PROFILE, linkPath)
    const candidates = [
      path.join(abs, 'lib', 'index.js'),
      path.join(abs, 'lib', 'client.js'),
    ]
    const ok = candidates.some((c) => exists(c))
    if (!ok && exists(path.join(abs, 'package.json'))) {
      // package exists but no built lib — warn
      let main = 'lib/index.js'
      try {
        const pj = readJson(path.join(abs, 'package.json'))
        if (pj.main) main = pj.main
      } catch {}
      if (!exists(path.join(abs, main))) {
        missing.push({ name, path: abs, main })
      }
    }
  }
  return missing
}

function envElectronNode() {
  return {
    process: process.env.ELECTRON_RUN_AS_NODE || null,
    user: (() => {
      try {
        return execSync(
          '[Environment]::GetEnvironmentVariable("ELECTRON_RUN_AS_NODE","User")',
          { shell: 'powershell.exe', encoding: 'utf8' },
        ).trim() || null
      } catch { return null }
    })(),
  }
}

function dshRunning() {
  try {
    const out = execSync(
      'Get-Process -Name "DSH Desktop" -EA SilentlyContinue | Select-Object -ExpandProperty Id',
      { shell: 'powershell.exe', encoding: 'utf8' },
    ).trim()
    return out ? out.split(/\r?\n/).filter(Boolean) : []
  } catch { return [] }
}

function diagnose() {
  const hot = listHot()
  const { pkgPath, deps } = getDeps()
  const forbidden = findForbiddenDeps(deps)
  const missingLibs = checkLinkedLibs(deps)
  const electronNode = envElectronNode()
  const pids = dshRunning()
  const issues = []

  if (hot.length) {
    issues.push({
      id: 'hot-yml',
      severity: 'critical',
      message: `${hot.length} market hot-*.yml present (classic Loading plugins hang)`,
      files: hot.map((f) => path.basename(f)),
    })
  }
  if (forbidden.length) {
    issues.push({
      id: 'forbidden-deps',
      severity: 'critical',
      message: 'Profile dependencies include skin-center / web-ui-all style packages',
      packages: forbidden,
    })
  }
  if (electronNode.process || electronNode.user) {
    issues.push({
      id: 'electron-run-as-node',
      severity: 'high',
      message: 'ELECTRON_RUN_AS_NODE is set (Desktop may fail to open as GUI)',
      process: electronNode.process,
      user: electronNode.user,
    })
  }
  if (!exists(pkgPath)) {
    issues.push({
      id: 'missing-profile',
      severity: 'critical',
      message: `Profile package.json missing: ${pkgPath}`,
    })
  }
  if (missingLibs.length) {
    issues.push({
      id: 'missing-lib',
      severity: 'medium',
      message: 'Some linked packages lack built main/lib entry',
      packages: missingLibs,
    })
  }

  const settingsText = exists(SETTINGS) ? fs.readFileSync(SETTINGS, 'utf8') : ''
  const visionBound = /describe-image:[\s\S]*?apiKeyEnv:\s*ZHIPU_API_KEY/.test(settingsText)
    && /describe-image:[\s\S]*?baseURL:\s*https:\/\/open\.bigmodel\.cn/.test(settingsText)
  if (!visionBound) {
    issues.push({
      id: 'describe-image-config',
      severity: 'low',
      message: '智谱看图未绑定（自身器官 → 智谱看图向导可一键填表，不回显 Key）',
    })
  }

  // Hindsight autoReflect waits up to ~25s per turn when :9077 is down → all-model timeouts.
  const hindsightOn = Object.keys(deps).some((n) => /hindsight/i.test(n))
  if (hindsightOn) {
    const r = spawnSync(process.execPath, ['-e', `
      const net=require('net');
      const s=net.connect({host:'127.0.0.1',port:9077},()=>{console.log('ok');s.destroy();process.exit(0)});
      s.setTimeout(800,()=>{s.destroy();process.exit(1)});
      s.on('error',()=>process.exit(1));
    `], { encoding: 'utf8', windowsHide: true, timeout: 2000 })
    if (r.status !== 0) {
      issues.push({
        id: 'hindsight-daemon-down',
        severity: 'high',
        message: 'Hindsight 已启用但 127.0.0.1:9077 不通——每轮会卡 ~25s，易表现为全模型 Request timed out。请关 hindsight 或先启动 daemon。',
      })
    }
  }

  // Anchored Standard: requiring missing hindsight_*/viking_* disables bootstrap → full tool catalog → ~7s retries.
  const anchoredYml = path.join(DSH_ROOT, '.agent-presets', 'anchored-standard', 'agent.cordis.yml')
  if (exists(anchoredYml)) {
    const anchoredText = fs.readFileSync(anchoredYml, 'utf8')
    const vikingOn = Object.keys(deps).some((n) => /openviking|viking/i.test(n))
    const orphan = []
    if (!hindsightOn && /hindsight_[a-z0-9_]+/i.test(anchoredText)) orphan.push('hindsight_*')
    if (!vikingOn && /viking_[a-z0-9_]+/i.test(anchoredText)) orphan.push('viking_*')
    if (orphan.length) {
      issues.push({
        id: 'anchored-bootstrap-orphan-tools',
        severity: 'high',
        message: `锚定预设仍要求已关闭插件的工具（${orphan.join(', ')}）→ bootstrap 失效、整包工具表倾倒、简单题也会模型重试。运行: node dsh-desktop-toggle/patch-anchored-bootstrap.mjs`,
      })
    }
  }

  const ok = issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length === 0
  return {
    ok,
    checked_at: new Date().toISOString(),
    profile: PROFILE,
    desktop_exe: DESKTOP_EXE,
    desktop_exe_exists: exists(DESKTOP_EXE),
    dsh_pids: pids,
    hot_count: hot.length,
    dep_count: Object.keys(deps).length,
    issues,
  }
}

function clearHot() {
  const hot = listHot()
  for (const f of hot) fs.unlinkSync(f)
  return hot.length
}

function reinforceMarketDisabled() {
  fs.mkdirSync(MARKET, { recursive: true })
  const statePath = path.join(MARKET, 'state.json')
  let state = { disabled: [], groups: {}, groupOrder: [] }
  if (exists(statePath)) {
    try { state = { ...state, ...readJson(statePath) } } catch {}
  }
  const set = new Set([...(state.disabled || []), ...SKIN_MARKET_DISABLE])
  state.disabled = [...set]
  writeJson(statePath, state)
  return state.disabled.length
}

function patchAnchoredBootstrap() {
  const script = path.join(DSP, 'dsh-desktop-toggle', 'patch-anchored-bootstrap.mjs')
  if (!exists(script)) return { skipped: true, reason: 'script-missing' }
  const r = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  })
  let parsed = null
  try { parsed = JSON.parse((r.stdout || '').trim() || '{}') } catch {}
  return {
    skipped: false,
    exit_code: r.status,
    ok: r.status === 0,
    ...(parsed || { raw: (r.stdout || '').slice(0, 500) }),
  }
}

function cmdFix() {
  const n = clearHot()
  const disabled = reinforceMarketDisabled()
  console.log(`[fix] removed ${n} hot-*.yml`)
  console.log(`[fix] market disabled entries: ${disabled}`)
  const anchored = patchAnchoredBootstrap()
  if (anchored.patched) {
    console.log('[fix] patched anchored-standard bootstrap (orphan memory tools stripped)')
  } else if (anchored.ok === false && !anchored.skipped) {
    console.warn('[fix] anchored bootstrap patch failed:', anchored.error || anchored)
  }
  return diagnose()
}

function baselineSave() {
  fs.mkdirSync(BASELINE_DIR, { recursive: true })
  const files = [
    [path.join(PROFILE, 'package.json'), 'package.json'],
    [path.join(PROFILE, 'cordis.patch.yml'), 'cordis.patch.yml'],
    [SETTINGS, 'settings.yaml'],
  ]
  const saved = []
  for (const [src, name] of files) {
    if (!exists(src)) {
      console.warn(`[baseline-save] skip missing ${src}`)
      continue
    }
    const dest = path.join(BASELINE_DIR, name)
    fs.copyFileSync(src, dest)
    saved.push(name)
  }
  const meta = {
    saved_at: new Date().toISOString(),
    profile: PROFILE,
    files: saved,
  }
  writeJson(path.join(BASELINE_DIR, 'meta.json'), meta)
  // JSON first so in-app host can parse (same convention as printReport)
  console.log(JSON.stringify({ ok: true, action: 'baseline-save', ...meta }, null, 2))
  console.log(`[baseline-save] -> ${BASELINE_DIR}`)
  console.log(`[baseline-save] files: ${saved.join(', ')}`)
  return meta
}

function baselineRestore(yes) {
  if (!yes) {
    console.error('Refusing restore without --yes (destructive to current profile config).')
    process.exit(2)
  }
  const metaPath = path.join(BASELINE_DIR, 'meta.json')
  if (!exists(metaPath)) {
    console.error(`No baseline at ${BASELINE_DIR}. Run baseline-save first.`)
    process.exit(2)
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const bakDir = path.join(PROFILE, `_doctor-pre-restore-${stamp}`)
  fs.mkdirSync(bakDir, { recursive: true })

  const map = [
    ['package.json', path.join(PROFILE, 'package.json')],
    ['cordis.patch.yml', path.join(PROFILE, 'cordis.patch.yml')],
    ['settings.yaml', SETTINGS],
  ]
  for (const [name, dest] of map) {
    const src = path.join(BASELINE_DIR, name)
    if (!exists(src)) continue
    if (exists(dest)) fs.copyFileSync(dest, path.join(bakDir, name))
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    console.log(`[baseline-restore] restored ${name}`)
  }
  clearHot()
  reinforceMarketDisabled()
  console.log(`[baseline-restore] previous copies in ${bakDir}`)
  console.log('[baseline-restore] run: node dsh-doctor.mjs safe-launch')
}

function stopDesktop() {
  try {
    execSync('Stop-Process -Name "DSH Desktop" -Force -EA SilentlyContinue', {
      shell: 'powershell.exe',
      stdio: 'ignore',
    })
  } catch {}
}

function sleepMs(ms) {
  try {
    execSync(`Start-Sleep -Milliseconds ${ms}`, { shell: 'powershell.exe', stdio: 'ignore' })
  } catch {
    // ignore
  }
}

function launchDesktop() {
  // Clear process env for child
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  if (!exists(DESKTOP_EXE)) {
    console.error(`Desktop exe not found: ${DESKTOP_EXE}`)
    process.exit(2)
  }

  const child = spawn(DESKTOP_EXE, [], {
    cwd: path.dirname(DESKTOP_EXE),
    env,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  child.unref()
  console.log(`[launch] started ${DESKTOP_EXE} (pid ${child.pid}) without ELECTRON_RUN_AS_NODE`)
}

function printReport(report) {
  console.log(JSON.stringify(report, null, 2))
  const crit = report.issues.filter((i) => i.severity === 'critical' || i.severity === 'high')
  if (report.ok) {
    console.log('\n[doctor] OK — no critical/high issues')
  } else {
    console.log(`\n[doctor] FAIL — ${crit.length} critical/high issue(s). Try: node dsh-doctor.mjs safe-launch`)
  }
}

function main() {
  const args = process.argv.slice(2)
  const cmd = args[0] || 'check'
  const yes = args.includes('--yes')

  if (cmd === 'check') {
    const report = diagnose()
    printReport(report)
    writeJson(REPORT_PATH, report)
    process.exit(report.ok ? 0 : 1)
  }

  if (cmd === 'report') {
    const report = diagnose()
    writeJson(REPORT_PATH, report)
    printReport(report)
    console.log(`[report] wrote ${REPORT_PATH}`)
    process.exit(report.ok ? 0 : 1)
  }

  if (cmd === 'fix') {
    const report = cmdFix()
    printReport(report)
    writeJson(REPORT_PATH, report)
    process.exit(report.ok ? 0 : 1)
  }

  if (cmd === 'baseline-save') {
    baselineSave()
    process.exit(0)
  }

  if (cmd === 'baseline-restore') {
    baselineRestore(yes)
    process.exit(0)
  }

  if (cmd === 'launch') {
    stopDesktop()
    sleepMs(1500)
    launchDesktop()
    process.exit(0)
  }

  if (cmd === 'safe-launch') {
    console.log('[safe-launch] stop → fix → launch')
    stopDesktop()
    sleepMs(1500)
    const report = cmdFix()
    printReport(report)
    writeJson(REPORT_PATH, report)
    launchDesktop()
    process.exit(0)
  }

  console.error(`Unknown command: ${cmd}
Commands: check | fix | baseline-save | baseline-restore --yes | launch | safe-launch | report`)
  process.exit(2)
}

main()
