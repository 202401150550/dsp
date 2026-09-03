#!/usr/bin/env node
/**
 * 智谱看图向导 — 只绑 baseURL / model / apiKeyEnv，永不写入或回显 API Key。
 *
 *   node wizard-vision.mjs status
 *   node wizard-vision.mjs apply
 *   node wizard-vision.mjs apply --dry-run
 *   node wizard-vision.mjs replay   # 连续 3 次 apply，验收幂等
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { spawnNodeSync } from './node-bin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..')
const HOME = process.env.USERPROFILE || process.env.HOME || ''
const SETTINGS = path.join(HOME, '.dsh', 'settings.yaml')
const CREDENTIALS = path.join(HOME, '.dsh', '.credentials.yaml')
const APPLY = path.join(DSP, 'dsh-desktop-toggle', 'apply.mjs')

export const PRESET = {
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  model: 'glm-4v-flash',
  apiKeyEnv: 'ZHIPU_API_KEY',
  apiStyle: 'chat-completions',
}

const FEATURE_ID = 'web-ui-describe-image'

function yamlMod() {
  const require = createRequire(import.meta.url)
  return require(path.join(DSP, 'dsh-desktop-toggle', 'node_modules', 'yaml', 'dist', 'index.js'))
}

function readText(p) {
  try { return fs.readFileSync(p, 'utf8') } catch { return '' }
}

function hasCredentialEnv(name) {
  const text = readText(CREDENTIALS)
  if (!text) return false
  const re = new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:', 'm')
  return re.test(text)
}

function pluginEnabled() {
  const r = spawnNodeSync(APPLY, ['list'], {
    cwd: path.dirname(APPLY),
  })
  const start = String(r.stdout || '').indexOf('{')
  const end = String(r.stdout || '').lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const report = JSON.parse(r.stdout.slice(start, end + 1))
    const enabled = report.enabled || report.features || []
    if (Array.isArray(enabled)) {
      return enabled.some((row) => String(row).includes(FEATURE_ID) || String(row).includes('describe-image'))
    }
    if (enabled && typeof enabled === 'object') {
      const row = enabled[FEATURE_ID]
      return !!(row && (row.enabled === true || row === true))
    }
  } catch {}
  const plugs = readText(path.join(DSP, 'dsh-desktop-toggle', 'plugins.yml'))
  const block = plugs.split(/\n(?=  [a-z])/).find((b) => b.includes(FEATURE_ID) || b.includes('web-ui-describe-image:'))
  return block ? /enabled:\s*true/.test(block) : null
}

function currentDescribe(doc) {
  const node = doc.get('describe-image')
  if (!node || typeof node.toJSON !== 'function') {
    if (node && typeof node === 'object' && !node.items) return node
    return {}
  }
  return node.toJSON() || {}
}

function status() {
  const YAML = yamlMod()
  const text = readText(SETTINGS)
  const doc = text ? YAML.parseDocument(text) : new YAML.Document({})
  const cur = currentDescribe(doc) || {}
  const bound = {
    baseURL: String(cur.baseURL || '').replace(/\/+$/, ''),
    model: String(cur.model || ''),
    apiKeyEnv: String(cur.apiKeyEnv || ''),
    apiStyle: String(cur.apiStyle || ''),
  }
  const missing = []
  if (bound.baseURL !== PRESET.baseURL) missing.push('baseURL')
  if (bound.model !== PRESET.model) missing.push('model')
  if (bound.apiKeyEnv !== PRESET.apiKeyEnv) missing.push('apiKeyEnv')
  if (bound.apiStyle && bound.apiStyle !== PRESET.apiStyle) missing.push('apiStyle')
  const cred = hasCredentialEnv(PRESET.apiKeyEnv)
  const enabled = pluginEnabled()
  if (enabled === false) missing.push('plugin')
  if (!cred) missing.push('credential')

  let next = 'ready'
  if (missing.includes('baseURL') || missing.includes('model') || missing.includes('apiKeyEnv') || missing.includes('apiStyle') || missing.includes('plugin')) {
    next = 'apply'
  } else if (!cred) {
    next = 'add-credential'
  }

  return {
    ok: missing.filter((k) => k !== 'credential').length === 0,
    action: 'status',
    preset: { ...PRESET },
    bound,
    has_credential: cred,
    plugin_enabled: enabled,
    missing,
    next,
    note: cred
      ? '密钥只绑环境变量名，向导不回显 Key。'
      : `请在凭据里配置 ${PRESET.apiKeyEnv}（向导不会写入密钥）。重启后生效。`,
  }
}

function plannedWrites(cur) {
  const writes = []
  const fields = ['baseURL', 'model', 'apiKeyEnv', 'apiStyle']
  for (const key of fields) {
    const from = String((cur && cur[key]) || '')
    const to = PRESET[key]
    if (from !== to) writes.push({ path: `describe-image.${key}`, from: from || '(empty)', to })
  }
  writes.push({
    path: 'llm-pi-ai.providers.zhipu.apiKeyEnv',
    from: '(keep-or-set)',
    to: PRESET.apiKeyEnv,
  })
  return writes
}

function apply({ dryRun = false } = {}) {
  const YAML = yamlMod()
  const text = readText(SETTINGS)
  const doc = text ? YAML.parseDocument(text) : new YAML.Document({})
  const cur = currentDescribe(doc) || {}
  const writes = plannedWrites(cur)

  if (dryRun) {
    return {
      ok: true,
      action: 'apply',
      dry_run: true,
      impact: writes,
      will_enable_plugin: pluginEnabled() === false,
      never_writes: ['apiKey', 'credentials'],
      note: '预演：不会改文件。确认后去掉 dry_run 再执行。',
    }
  }

  if (!doc.get('describe-image')) {
    doc.set('describe-image', doc.createNode({}))
  }
  for (const key of ['baseURL', 'model', 'apiKeyEnv', 'apiStyle']) {
    doc.setIn(['describe-image', key], PRESET[key])
  }

  const zhipuEnv = doc.getIn(['llm-pi-ai', 'providers', 'zhipu', 'apiKeyEnv'])
  if (zhipuEnv == null || String(zhipuEnv) === '') {
    if (doc.getIn(['llm-pi-ai', 'providers', 'zhipu'])) {
      doc.setIn(['llm-pi-ai', 'providers', 'zhipu', 'apiKeyEnv'], PRESET.apiKeyEnv)
    }
  }

  const out = String(doc)
  fs.writeFileSync(SETTINGS, out.endsWith('\n') ? out : out + '\n', 'utf8')

  let applyPlugin = null
  if (pluginEnabled() === false) {
    const r = spawnNodeSync(APPLY, ['set', FEATURE_ID, 'true'], {
      cwd: path.dirname(APPLY),
    })
    applyPlugin = { code: r.status, ok: r.status === 0 }
  }

  const after = status()
  return {
    ok: after.ok || after.next === 'add-credential',
    action: 'apply',
    dry_run: false,
    impact: writes,
    plugin_apply: applyPlugin,
    restart_required: true,
    has_credential: after.has_credential,
    bound: after.bound,
    next: after.next,
    note: after.has_credential
      ? '已绑定智谱看图（仅 env 名）。完全退出并重开 Desktop 后生效。'
      : `已绑定 ${PRESET.apiKeyEnv}，但凭据文件里还没有该变量。向导不会代填 Key。`,
  }
}

function replay() {
  const runs = []
  for (let i = 0; i < 3; i += 1) {
    runs.push(apply({ dryRun: false }))
  }
  const allOk = runs.every((r) => r.ok)
  const last = status()
  return {
    ok: allOk && last.bound.baseURL === PRESET.baseURL && last.bound.model === PRESET.model && last.bound.apiKeyEnv === PRESET.apiKeyEnv,
    action: 'replay',
    runs: runs.length,
    bound: last.bound,
    has_credential: last.has_credential,
  }
}

export { status, apply, replay }

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2))
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const cmd = process.argv[2] || 'status'
  const dry = process.argv.includes('--dry-run')
  if (cmd === 'status') printJson(status())
  else if (cmd === 'apply') printJson(apply({ dryRun: dry }))
  else if (cmd === 'replay') printJson(replay())
  else {
    console.error('Commands: status | apply [--dry-run] | replay')
    process.exit(2)
  }
}
