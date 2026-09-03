#!/usr/bin/env node
/**
 * dsh-self / adopt — inspect foreign plugins and wrap them to the native contract.
 *
 *   node adopt.mjs inspect
 *   node adopt.mjs inspect <dir-or-package.json>
 *   node adopt.mjs wrap <dir>
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnNodeSync } from './node-bin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..')
const ADOPTED_ROOT = path.join(DSP, 'dsh-adopted')
const PLUGINS_FILE = path.join(DSP, 'dsh-desktop-toggle', 'plugins.yml')

function loadYaml(file) {
  const require = createRequire(import.meta.url)
  const candidates = [
    path.join(DSP, 'dsh-desktop-toggle', 'node_modules', 'yaml', 'dist', 'index.js'),
    'yaml',
  ]
  let parse = null
  for (const c of candidates) {
    try {
      const mod = require(c)
      parse = mod.parse || mod.load
      if (parse) break
    } catch {}
  }
  if (!parse) throw new Error('Need yaml parser (dsh-desktop-toggle has it)')
  return parse(fs.readFileSync(file, 'utf8'))
}

const CONTRACT = loadYaml(path.join(__dirname, 'native-contract.yml'))
const REGISTRY = loadYaml(path.join(__dirname, 'capability-registry.yml'))
const ORGANS_FILE = path.join(__dirname, 'organs.yml')
const STATE_FILE = path.join(__dirname, 'organs-state.json')
const APPLY = path.join(DSP, 'dsh-desktop-toggle', 'apply.mjs')
const DOCTOR = path.join(DSP, 'dsh-doctor', 'dsh-doctor.mjs')

function exists(p) {
  try { return fs.existsSync(p) } catch { return false }
}

function readText(p) {
  try { return fs.readFileSync(p, 'utf8') } catch { return '' }
}

function listClientFiles(root) {
  const names = [
    'client.js',
    'lib/client.js',
    'src/client/index.ts',
    'src/client/index.tsx',
    'src/client/index.js',
  ]
  return names.map((n) => path.join(root, n)).filter(exists)
}

function matchCapability(pkgName, dirName) {
  const hay = `${pkgName} ${dirName}`.toLowerCase()
  for (const [cap, spec] of Object.entries(REGISTRY.capabilities || {})) {
    const keys = [cap, spec.owner, ...(spec.match || [])].map((s) => String(s).toLowerCase())
    if (keys.some((k) => k && hay.includes(k))) return cap
  }
  return null
}

function isForbiddenPkg(name, dir) {
  const s = `${name} ${dir}`.toLowerCase()
  return /web-ui-all/.test(s) || /skin-center/.test(s) || /dsh-skins$/.test(s)
}

function scanSource(text) {
  const issues = []
  if (/document\.body\.(appendChild|append|prepend)\s*\(/.test(text)) {
    issues.push({
      id: 'body-dump',
      severity: 'high',
      message: '往 document.body 挂节点（侧栏/页面重复堆叠）',
    })
  }
  if (/slots\.inject\(\s*['"]sidebar\.footer|name:\s*['"]sidebar\.footer/.test(text)) {
    issues.push({
      id: 'sidebar-footer',
      severity: 'medium',
      message: '注入 sidebar.footer 槽；应收编到 ventus/web-ui/settings.plugin.item',
    })
  }
  const usesSettings = /ventus\.plugin\.item|web-ui\.plugin\.item|settings\.plugin\.item/.test(text)
  const usesOverlay = /shell\.overlay/.test(text)
  const usesConversation = /conversation\.(input|composer|toolbar)/.test(text)
  if (!usesSettings && !usesOverlay && !usesConversation && /slots\.inject/.test(text)) {
    issues.push({
      id: 'no-native-slot',
      severity: 'medium',
      message: '有 slots 但未用设置卡、浮层或对话槽',
    })
  }
  return { issues, usesSettings, usesOverlay: usesOverlay || usesConversation }
}

function inspectDir(root, extra = {}) {
  const pkgPath = path.join(root, 'package.json')
  let pkg = { name: path.basename(root) }
  if (exists(pkgPath)) {
    try { pkg = JSON.parse(readText(pkgPath)) } catch {}
  }
  const name = pkg.name || path.basename(root)
  const files = listClientFiles(root)
  const issues = []
  let usesSettings = false
  let usesOverlay = false
  for (const f of files) {
    const scanned = scanSource(readText(f))
    issues.push(...scanned.issues.map((i) => ({ ...i, file: path.relative(root, f) })))
    usesSettings = usesSettings || scanned.usesSettings
    usesOverlay = usesOverlay || scanned.usesOverlay
  }
  const cap = matchCapability(name, path.basename(root))
  const forbidden = isForbiddenPkg(name, root)
  let verdict = 'native'
  if (forbidden) verdict = 'forbidden'
  else if (extra.duplicate) verdict = 'duplicate'
  else if (issues.some((i) => i.id === 'body-dump' || i.id === 'sidebar-footer')) {
    verdict = usesSettings || usesOverlay ? 'adopt-runtime' : 'adopt'
  }
  else if (!usesSettings && !usesOverlay && files.length) verdict = 'adopt'
  else if (!files.length) verdict = 'host-only'

  // dedupe issue ids
  const seen = new Set()
  const uniq = []
  for (const i of issues) {
    const k = i.id + ':' + (i.file || '')
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(i)
  }

  return {
    path: root,
    name,
    capability: cap,
    owner: cap ? REGISTRY.capabilities[cap].owner : null,
    verdict,
    usesSettings,
    usesOverlay,
    client_files: files.map((f) => path.relative(root, f)),
    issues: uniq,
    ...extra,
  }
}

function enabledLinks() {
  if (!exists(PLUGINS_FILE)) return []
  const cfg = loadYaml(PLUGINS_FILE)
  const out = []
  for (const item of cfg.always_on || []) {
    if (item.link) out.push({ id: item.id, link: item.link, enabled: true, bucket: 'always_on' })
  }
  for (const [id, f] of Object.entries(cfg.features || {})) {
    if (f.link) out.push({ id, link: f.link, enabled: !!f.enabled, title: f.title, forbidden: !!f.forbidden })
  }
  return out
}

function inspectAll() {
  const targets = []
  const capOwners = new Map()
  const rows = enabledLinks()

  for (const row of rows) {
    if (!row.enabled || row.forbidden) continue
    if (!exists(row.link)) {
      targets.push({
        id: row.id,
        path: row.link,
        name: row.id,
        verdict: 'missing',
        issues: [{ id: 'missing-path', severity: 'high', message: 'link 路径不存在' }],
      })
      continue
    }
    const cap = matchCapability(row.id, path.basename(row.link))
    const duplicate = !!(cap && capOwners.has(cap) && capOwners.get(cap) !== row.id)
    const info = inspectDir(row.link, { id: row.id, duplicate, duplicate_of: duplicate ? capOwners.get(cap) : undefined })
    if (cap && row.enabled && !duplicate) capOwners.set(cap, row.id)
    targets.push({ ...info, id: row.id })
  }

  const duplicates = []
  const grouped = new Map()
  for (const t of targets) {
    if (!t.capability) continue
    const arr = grouped.get(t.capability) || []
    arr.push(t.id)
    grouped.set(t.capability, arr)
  }
  for (const [cap, ids] of grouped) {
    const uniq = [...new Set(ids)]
    if (uniq.length > 1) duplicates.push({ capability: cap, owners: uniq })
  }

  const adopt = targets.filter((t) => t.verdict === 'adopt' || t.verdict === 'duplicate' || t.verdict === 'forbidden' || t.verdict === 'adopt-runtime')
  return {
    ok: duplicates.length === 0 && !targets.some((t) => t.verdict === 'forbidden' && t.id),
    action: 'inspect',
    contract: { id: CONTRACT.id, version: CONTRACT.version },
    scanned: targets.length,
    needs_adopt: adopt.map((t) => t.id || t.name),
    duplicates,
    targets,
  }
}

function safeAdoptId(name) {
  return String(name || 'pkg')
    .replace(/^@/, '')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 80)
}

function wrapDir(root) {
  const info = inspectDir(root)
  if (info.verdict === 'forbidden') {
    return { ok: false, action: 'wrap', error: 'forbidden', target: info }
  }
  if (info.verdict === 'native' || info.verdict === 'host-only' || info.verdict === 'adopt-runtime') {
    return {
      ok: true,
      action: 'wrap',
      skipped: true,
      reason: info.verdict === 'adopt-runtime'
        ? 'already has settings/overlay; runtime dump-guard is enough (do not replace client)'
        : info.verdict === 'native' ? 'already native' : 'no client to wrap',
      target: info,
    }
  }

  const id = 'dsh-adopted-' + safeAdoptId(info.name)
  const dest = path.join(ADOPTED_ROOT, id)
  fs.mkdirSync(dest, { recursive: true })

  const posixRoot = root.replace(/\\/g, '/')
  const pkg = {
    name: id,
    version: '0.1.0',
    description: `Adopted wrapper for ${info.name} (native contract via dsh-self)`,
    type: 'module',
    main: './index.js',
    exports: { '.': './index.js', './client': './client.js', './package.json': './package.json' },
    dependencies: { [info.name]: `link:${posixRoot}` },
    dsh: {
      bundle: { patch: './cordis.patch.yml' },
      client: {
        platform: 'web',
        inject: ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-ui-slots'],
      },
    },
  }
  fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  fs.writeFileSync(path.join(dest, 'cordis.patch.yml'), `- insert:\n    - id: ${id}\n      name: ${id}\n`)
  fs.writeFileSync(path.join(dest, 'adopt.yml'), `# generated by dsh-self adopt wrap\noriginal: ${info.name}\noriginal_path: ${posixRoot}\ncapability: ${info.capability || ''}\nverdict: ${info.verdict}\n`)

  let bakedInject = ['webServer']
  const origPlugin = path.join(root, 'dsh.plugin.json')
  if (exists(origPlugin)) {
    try {
      const pj = JSON.parse(readText(origPlugin))
      if (pj.entry && Array.isArray(pj.entry.inject)) bakedInject = pj.entry.inject
    } catch {}
  }

  fs.writeFileSync(path.join(dest, 'index.js'), `/** Host half: original tools/routes; original client is NOT loaded. */\nexport const name = ${JSON.stringify(id)}\nexport const inject = ${JSON.stringify(bakedInject)}\n\nexport async function apply(ctx) {\n  try {\n    const orig = await import(${JSON.stringify(info.name)})\n    if (orig && typeof orig.apply === 'function') return orig.apply(ctx)\n  } catch (err) {\n    ctx.logger?.warn?.('[dsh-self] wrap host load failed: ' + err)\n  }\n}\n`)

  const title = info.capability && REGISTRY.capabilities[info.capability]
    ? REGISTRY.capabilities[info.capability].title
    : info.name

  fs.writeFileSync(path.join(dest, 'client.js'), `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(id)},\n  factory: (require) => {\n    const module = { exports: {} }\n    const exports = module.exports\n    const React = require('react')\n    exports.inject = ['slots']\n    function Card() {\n      return React.createElement('li', {\n        style: {\n          listStyle: 'none',\n          border: '1px solid var(--dsw-alias-border-l2, #cbd5e0)',\n          borderRadius: 12,\n          padding: '14px 16px',\n        },\n        'data-plugin': ${JSON.stringify(id)},\n        'data-dsh-self': 'adopted-card',\n      },\n        React.createElement('div', { style: { fontWeight: 600 } }, ${JSON.stringify('已收编：' + title)}),\n        React.createElement('div', { style: { fontSize: 13, opacity: 0.75, marginTop: 4 } },\n          ${JSON.stringify('原包 ' + info.name + ' 的 UI 已按自身契约改为设置卡；宿主能力仍在。原 body/侧栏挂载已去掉，避免重复。')}\n        )\n      )\n    }\n    exports.apply = function apply(ctx) {\n      const disposers = []\n      for (const slot of ['ventus.plugin.item', 'web-ui.plugin.item', 'settings.plugin.item']) {\n        try {\n          disposers.push(ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, id: ${JSON.stringify(id)}, order: 40 }, Card)))\n        } catch {}\n      }\n      ctx.effect(() => () => { for (const d of disposers) d() }, ${JSON.stringify(id + ': ui')})\n    }\n    return module.exports\n  },\n})\n`)

  return {
    ok: true,
    action: 'wrap',
    skipped: false,
    dest,
    id,
    original: info.name,
    plugins_yml_hint: `把 features 里对应项的 name/dep/link 改成 ${id} + link: ${dest.replace(/\\/g, '/')}\n并去掉对原包的 insert（否则客户端会重复加载）。`,
    target: info,
  }
}

function pluginsEnabledMap() {
  const map = new Map()
  if (!exists(PLUGINS_FILE)) return map
  const cfg = loadYaml(PLUGINS_FILE)
  for (const item of cfg.always_on || []) {
    map.set(item.id, { enabled: true, locked: true })
  }
  for (const [id, f] of Object.entries(cfg.features || {})) {
    map.set(id, { enabled: !!f.enabled && !f.forbidden, locked: false, forbidden: !!f.forbidden })
  }
  return map
}

function organsCatalog() {
  const spec = loadYaml(ORGANS_FILE)
  const state = loadState()
  const plugs = pluginsEnabledMap()
  const health = doctorSnapshot()
  const issues = (health && health.issues) || []
  const organs = []

  for (const [organId, organ] of Object.entries(spec.organs || {})) {
    const atoms = []
    for (const [atomId, atom] of Object.entries(organ.atoms || {})) {
      const key = atomKey(organId, atomId)
      let enabled = atom.enabled !== false
      if (Object.prototype.hasOwnProperty.call(state, key)) enabled = !!state[key]
      let locked = false

      if (atom.status === 'forbidden') {
        enabled = false
        locked = true
      } else if (atom.status === 'infra' || atom.locked) {
        locked = true
        enabled = atom.enabled !== false
      } else if (atom.provider && plugs.has(atom.provider) && atom.status === 'provider') {
        const p = plugs.get(atom.provider)
        enabled = p.enabled
        locked = !!p.locked
      }

      const row = {
        id: atomId,
        key,
        title: atom.title || atomId,
        status: atom.status || 'provider',
        provider: atom.provider || null,
        impl: atom.impl || null,
        enabled,
        locked,
        pending: atom.status === 'pending',
        forbidden: atom.status === 'forbidden',
        fused: atom.status === 'fused',
      }
      if (atomId === 'health-process' && health) {
        row.health = (health.dsh_pids || []).length > 0 ? 'ok' : 'fail'
        row.detail = `pids=${(health.dsh_pids || []).length}`
      }
      if (atomId === 'health-hot' && health) {
        row.health = health.hot_count === 0 ? 'ok' : 'fail'
        row.detail = `hot=${health.hot_count}`
      }
      if (atomId === 'health-forbidden' && health) {
        const bad = issues.filter((i) => i.severity === 'critical' || i.severity === 'high')
        row.health = bad.length === 0 ? 'ok' : 'fail'
        row.detail = bad.length ? bad.map((i) => i.id).join(',') : 'clean'
      }
      atoms.push(row)
    }
    organs.push({
      id: organId,
      title: organ.title || organId,
      bucket: organ.bucket,
      fused: !!organ.fused,
      atoms,
    })
  }

  return {
    ok: true,
    action: 'organs',
    iteration: spec.iteration,
    version: spec.version,
    owner: spec.owner,
    rule: '细分 → 融合进 dsh-self → 关掉 provider。fused 可单独开关；provider 本轮仍整包。',
    health_ok: health ? !!health.ok : null,
    organs,
  }
}

function setAtom(organId, atomId, enabled) {
  const spec = loadYaml(ORGANS_FILE)
  const organ = (spec.organs || {})[organId]
  if (!organ) return { ok: false, action: 'atom', error: `unknown organ: ${organId}` }
  const atom = (organ.atoms || {})[atomId]
  if (!atom) return { ok: false, action: 'atom', error: `unknown atom: ${organId}.${atomId}` }
  if (atom.status === 'forbidden' && enabled) {
    return { ok: false, action: 'atom', error: 'forbidden', note: atom.title }
  }
  if (atom.status === 'infra' || atom.locked) {
    return { ok: false, action: 'atom', error: 'locked', note: '基础设施，勿开关：' + (atom.title || atomId) }
  }
  if (atom.status === 'pending' && enabled) {
    return { ok: false, action: 'atom', error: 'pending', note: '本轮未落地，下一轮再融合实现' }
  }

  const plugs = pluginsEnabledMap()
  if (atom.provider && plugs.get(atom.provider)?.locked) {
    return { ok: false, action: 'atom', error: 'locked always_on', note: atom.provider }
  }

  const state = loadState()
  const touched = []
  if (atom.provider && atom.status === 'provider') {
    for (const [oid, og] of Object.entries(spec.organs || {})) {
      for (const [aid, a] of Object.entries(og.atoms || {})) {
        if (a.provider === atom.provider) {
          state[atomKey(oid, aid)] = enabled
          touched.push(atomKey(oid, aid))
        }
      }
    }
    saveState(state)
    const r = spawnNodeSync(APPLY, ['set', atom.provider, enabled ? 'true' : 'false'], {
      cwd: path.dirname(APPLY),
    })
    return {
      ok: r.status === 0,
      action: 'atom',
      organ: organId,
      atom: atomId,
      enabled,
      linked_provider: atom.provider,
      linked_atoms: touched,
      apply: firstJsonBlock(r.stdout),
      stderr: (r.stderr || '').trim() || undefined,
      note: '本轮该能力仍整包供应商；细分已记账，融合完成前不能只开其中一个 atom。重启后生效。',
    }
  }

  state[atomKey(organId, atomId)] = enabled
  saveState(state)
  return {
    ok: true,
    action: 'atom',
    organ: organId,
    atom: atomId,
    enabled,
    fused: true,
    restart_required: false,
    note: '已写入自身状态（无需再开外来包）。',
  }
}

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2))
}

function firstJsonBlock(text) {
  const start = String(text || '').indexOf('{')
  const end = String(text || '').lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch {}
  }
  return null
}

function loadState() {
  if (!exists(STATE_FILE)) return {}
  try { return JSON.parse(readText(STATE_FILE)) } catch { return {} }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

function atomKey(organId, atomId) {
  return `${organId}.${atomId}`
}

function doctorSnapshot() {
  try {
    const r = spawnNodeSync(DOCTOR, ['check'])
    return firstJsonBlock(r.stdout)
  } catch {
    return null
  }
}

function main() {
  const args = process.argv.slice(2)
  const cmd = args[0] || 'inspect'

  if (cmd === 'inspect') {
    const target = args[1]
    if (target) {
      const dir = exists(target) && fs.statSync(target).isFile() ? path.dirname(target) : target
      printJson({ ok: true, action: 'inspect', target: inspectDir(path.resolve(dir)) })
    } else {
      printJson(inspectAll())
    }
    process.exit(0)
  }

  if (cmd === 'wrap') {
    const target = args[1]
    if (!target) {
      console.error('Usage: node adopt.mjs wrap <dir>')
      process.exit(2)
    }
    const dir = exists(target) && fs.statSync(target).isFile() ? path.dirname(target) : target
    const result = wrapDir(path.resolve(dir))
    printJson(result)
    process.exit(result.ok ? 0 : 1)
  }

  if (cmd === 'organs') {
    printJson(organsCatalog())
    process.exit(0)
  }

  if (cmd === 'atom') {
    const organId = args[1]
    const atomId = args[2]
    const val = String(args[3] || '').toLowerCase()
    if (!organId || !atomId || (val !== 'true' && val !== 'false')) {
      console.error('Usage: node adopt.mjs atom <organ> <atom> true|false')
      process.exit(2)
    }
    const result = setAtom(organId, atomId, val === 'true')
    printJson(result)
    process.exit(result.ok ? 0 : 1)
  }

  console.error('Commands: inspect [dir] | wrap <dir> | organs | atom <organ> <atom> true|false')
  process.exit(2)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()

export { inspectDir, inspectAll, wrapDir, organsCatalog, setAtom }
