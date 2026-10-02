#!/usr/bin/env node
/**
 * Phase 2 参数化宿主（脊梁，不是市场包）。
 * 禁止自由拼 shell；只跑白名单 tool + schema 参数；默认可 dry-run。
 *
 *   node host-agent.mjs catalog
 *   node host-agent.mjs run <tool> [--dry-run] [--confirm] [--args-json '{}']
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnNodeSync } from './node-bin.mjs'
import { status as visionStatus, apply as visionApply } from './wizard-vision.mjs'
import * as runtime from './host-runtime.mjs'
import { validatePlan } from './plan-validate.mjs'
import { buildImpactSummary } from './host-impact.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..')
const DOCTOR = path.join(DSP, 'dsh-doctor', 'dsh-doctor.mjs')
// 状态目录可外置（测试/多实例），默认仍在插件目录（已被 .gitignore 忽略）。
const STATE_DIR = process.env.DSH_HOST_STATE_DIR || __dirname
const AUDIT = path.join(STATE_DIR, 'host-audit.jsonl')
const SESSION = path.join(STATE_DIR, 'host-session.json')
const DEFAULT_MAX_STEPS = 20
const RUN_ID = process.env.DSH_HOST_RUN_ID || 'default'
/** P2-2a：confirm 工具必须先 dry-run；预览票据默认 5 分钟有效。 */
const PREVIEW_TTL_MS = Number(process.env.DSH_HOST_PREVIEW_TTL_MS) || 5 * 60 * 1000
const previewTickets = new Map()

function stepBudget() {
  try { return Number(runtime.loadPolicy().max_steps) || DEFAULT_MAX_STEPS } catch { return DEFAULT_MAX_STEPS }
}

const TOOLS = {
  'vision.wizard.status': { title: '智谱看图配置状态', risk: 'read', confirm: false, concurrencySafe: true, args: {} },
  'vision.wizard.apply': { title: '智谱看图一键绑定（只写 env 名）', risk: 'write-config', confirm: false, concurrencySafe: false, args: { dry_run: 'boolean?' } },
  'doctor.check': { title: '配置诊断', risk: 'read', confirm: false, concurrencySafe: true, args: {} },
  'doctor.fix': { title: '清 hot-yml / 强化禁用皮肤', risk: 'write-config', confirm: true, concurrencySafe: false, args: {} },
  'baseline.save': { title: '保存基线快照', risk: 'write-config', confirm: false, concurrencySafe: false, args: {} },
  'fs.list': { title: '列出白名单目录', risk: 'read', confirm: false, concurrencySafe: true, args: { path: 'string' } },
  'fs.read': { title: '读取白名单文件', risk: 'read', confirm: false, concurrencySafe: true, args: { path: 'string', max_bytes: 'number?' } },
  'fs.write': { title: '写入白名单文件', risk: 'write-file', confirm: true, concurrencySafe: false, args: { path: 'string', content: 'string' } },
  'shell.run': { title: '参数化命令（git/node/pnpm）', risk: 'exec', confirm: true, concurrencySafe: false, args: { name: 'git|node|pnpm', argv: 'string[]', cwd: 'string?' } },
  'git.status': { title: 'Git 状态', risk: 'read', confirm: false, concurrencySafe: true, args: {} },
  'git.diff': { title: 'Git diff --stat', risk: 'read', confirm: false, concurrencySafe: true, args: { path: 'string?' } },
  'git.commit': { title: 'Git 提交（明示 files+message；只提交清单内文件）', risk: 'write-git', confirm: true, concurrencySafe: false, args: { files: 'string[]', message: 'string', cwd: 'string?' } },
  'plan.validate': { title: '组合校验（多步计划能不能一起跑）', risk: 'read', confirm: false, concurrencySafe: true, args: { steps: 'array' } },
  'dsh.restart': { title: '清理有害 env 后启动 Desktop', risk: 'exec', confirm: true, concurrencySafe: false, args: {} },
}

function emptyRun() {
  return { started_at: new Date().toISOString(), steps: 0, halted: false, reason: null }
}

/** 兼容旧的单任务文件：读到时自动升级为 runs 结构（只在下次写入时落盘）。 */
function loadStore() {
  try {
    const raw = JSON.parse(fs.readFileSync(SESSION, 'utf8'))
    if (raw && raw.runs && typeof raw.runs === 'object') return raw
    if (raw && typeof raw.steps === 'number') return { version: 2, runs: { default: raw } }
  } catch { /* 首次运行 */ }
  return { version: 2, runs: {} }
}

function loadSession(runId = RUN_ID) {
  const store = loadStore()
  return store.runs[runId] || emptyRun()
}

function saveSession(s, runId = RUN_ID) {
  const store = loadStore()
  store.version = 2
  store.updated_at = new Date().toISOString()
  store.runs[runId] = s
  fs.writeFileSync(SESSION, JSON.stringify(store, null, 2) + '\n', 'utf8')
}

/** 列出全部任务预算（审计/界面用）。 */
function listSessions() {
  return loadStore().runs
}

function redact(value) {
  const text = JSON.stringify(value)
  const scrubbed = text
    .replace(/("?(?:apiKey|password|token|secret|authorization)"?\s*:\s*")[^"]*"/gi, '$1[redacted]"')
    .replace(/[0-9a-f]{16,}\.[A-Za-z0-9_-]+/gi, '[redacted-key]')
  try { return JSON.parse(scrubbed) } catch { return { redacted: true } }
}

function audit(event) {
  // 先整体脱敏再落盘：避免把密钥写进审计文件后再「忘了」清理。
  const safe = redact({ ts: new Date().toISOString(), ...event })
  try {
    fs.appendFileSync(AUDIT, JSON.stringify(safe) + '\n', 'utf8')
  } catch { /* 审计失败不阻断主流程 */ }
  return safe
}

function firstJson(text) {
  const start = String(text || '').indexOf('{')
  const end = String(text || '').lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch {}
  }
  return null
}

function runNode(script, args, cwd) {
  const r = spawnNodeSync(script, args, { cwd })
  return {
    ok: r.status === 0,
    code: r.status,
    report: firstJson(r.stdout),
    stderr: (r.stderr || '').trim() || undefined,
  }
}

const catalogCache = runtime.ttlCache(1000)

function catalog() {
  return catalogCache('catalog', () => {
    const policy = runtime.loadPolicy()
    return {
      ok: true,
      action: 'catalog',
      max_steps: MAX_STEPS,
      rule: '参数化白名单；工具输出不可信；禁止自由 shell；禁 git config / force-push / 推 main。',
      roots: policy.roots,
      commands: Object.keys(policy.commands),
      tools: Object.entries(TOOLS).map(([id, spec]) => ({ id, ...spec })),
    }
  })
}

function impactFor(tool, args) {
  if (tool === 'vision.wizard.apply') return visionApply({ dryRun: true }).impact
  if (tool === 'doctor.fix') return [{ path: 'profile/.dsh-market/hot-*.yml', from: 'maybe present', to: 'deleted' }]
  if (tool === 'baseline.save') return [{ path: 'dsp/dsh-doctor/baselines/current', from: 'previous', to: 'snapshot' }]
  if (tool === 'fs.write') return runtime.impactFsWrite(args)
  if (tool === 'fs.read' || tool === 'fs.list') return [{ path: args.path || runtime.DSP, from: args, to: 'read' }]
  if (tool === 'shell.run') return runtime.impactShell(args)
  if (tool === 'git.commit') return [{ path: (args.files || []).join(', '), from: 'working tree', to: `commit: ${String(args.message || '').slice(0, 80)}（仅清单内文件）` }]
  if (tool === 'plan.validate') return [{ path: '(plan)', from: `${(args.steps || []).length} steps`, to: 'validate only' }]
  if (tool === 'dsh.restart') return [{ path: 'DSH Desktop', from: 'running?', to: 'launch (env stripped)' }]
  return [{ path: '(read-only)', from: args || {}, to: 'no writes' }]
}

function stableArgs(args) {
  const keys = Object.keys(args || {}).sort()
  const out = {}
  for (const k of keys) out[k] = args[k]
  return out
}

function previewFingerprint(tool, args) {
  return crypto.createHash('sha256')
    .update(JSON.stringify({ tool, args: stableArgs(args) }))
    .digest('hex')
    .slice(0, 32)
}

function previewTicketKey(runId, tool, args) {
  return `${runId || 'default'}::${tool}::${previewFingerprint(tool, args)}`
}

function rememberPreview(runId, tool, args) {
  const key = previewTicketKey(runId, tool, args)
  previewTickets.set(key, Date.now())
  return key
}

function consumePreview(runId, tool, args) {
  const key = previewTicketKey(runId, tool, args)
  const at = previewTickets.get(key)
  if (at == null) return false
  if (Date.now() - at > PREVIEW_TTL_MS) {
    previewTickets.delete(key)
    return false
  }
  previewTickets.delete(key)
  return true
}

/** 测试/诊断：清空预览票据。 */
function clearPreviewTickets() {
  previewTickets.clear()
}

function withImpact(tool, args, rows, extra = {}) {
  const impact_summary = buildImpactSummary(tool, args, rows, extra)
  return { impact: impact_summary.rows, impact_summary }
}

function execute(tool, args) {
  if (tool === 'vision.wizard.status') return visionStatus()
  if (tool === 'vision.wizard.apply') return visionApply({ dryRun: !!args.dry_run })
  if (tool === 'doctor.check') return runNode(DOCTOR, ['check'], path.dirname(DOCTOR))
  if (tool === 'doctor.fix') return runNode(DOCTOR, ['fix'], path.dirname(DOCTOR))
  if (tool === 'baseline.save') return runNode(DOCTOR, ['baseline-save'], path.dirname(DOCTOR))
  if (tool === 'fs.list') return runtime.fsList(args)
  if (tool === 'fs.read') return runtime.fsRead(args)
  if (tool === 'fs.write') return runtime.fsWrite(args)
  if (tool === 'shell.run') return runtime.shellRun(args)
  if (tool === 'git.status') return runtime.gitStatus()
  if (tool === 'git.diff') return runtime.gitDiff(args)
  if (tool === 'git.commit') return runtime.gitCommit(args)
  if (tool === 'plan.validate') return validatePlan(args.steps)
  if (tool === 'dsh.restart') return runNode(DOCTOR, ['launch'], path.dirname(DOCTOR))
  return { ok: false, error: 'unknown tool' }
}

function run(tool, args = {}, { dryRun = false, confirm = false, runId = RUN_ID } = {}) {
  const spec = TOOLS[tool]
  if (!spec) {
    const denied = { ok: false, action: 'run', error: 'tool-not-whitelisted', tool }
    audit({ kind: 'deny', ...denied })
    return denied
  }

  const maxSteps = stepBudget()
  const session = loadSession(runId)
  if (session.halted) {
    return { ok: false, action: 'run', error: 'halted', reason: session.reason, steps: session.steps, runId }
  }
  if (session.steps >= maxSteps) {
    session.halted = true
    session.reason = 'max_steps'
    session.halted_at = new Date().toISOString()
    saveSession(session, runId)
    const stopped = { ok: false, action: 'run', error: 'circuit-open', reason: 'max_steps', steps: session.steps, runId }
    audit({ kind: 'halt', ...stopped })
    return stopped
  }

  if (spec.confirm && !confirm && !dryRun) {
    const shaped = withImpact(tool, args, impactFor(tool, args))
    return {
      ok: false,
      action: 'run',
      error: 'confirm-required',
      tool,
      ...shaped,
      note: '危险动作需要 confirm:true。可先 dry_run（dsh_host_preview）。',
    }
  }

  // P2-2a：confirm 工具真正执行前必须有匹配的 dry-run 票据。
  if (spec.confirm && confirm && !dryRun) {
    if (!consumePreview(runId, tool, args)) {
      const shaped = withImpact(tool, args, impactFor(tool, args))
      const denied = {
        ok: false,
        action: 'run',
        error: 'preview-required',
        tool,
        ...shaped,
        note: 'confirm:true 工具必须先 dsh_host_preview / dry_run 同一组参数，再执行。',
      }
      audit({ kind: 'deny', ...denied })
      return denied
    }
  }

  const impactRows = impactFor(tool, args)
  if (dryRun) {
    const preview = {
      ok: true,
      action: 'run',
      dry_run: true,
      tool,
      risk: spec.risk,
      ...withImpact(tool, args, impactRows, tool === 'fs.write' ? { will_snapshot: true } : {}),
    }
    if (tool === 'fs.write') {
      const p = runtime.previewFsWrite(args)
      preview.will_snapshot = p.will_snapshot === true
      preview.existed = !!p.existed
      preview.status = p.status || 'ok'
      preview.warnings = p.warnings || []
      if (p.path) preview.path = p.path
      if (Array.isArray(p.impact)) {
        Object.assign(preview, withImpact(tool, args, p.impact, {
          will_snapshot: p.will_snapshot === true,
          existed: p.existed,
        }))
      }
      if (p.status === 'denied') {
        const deniedPreview = { ...preview, ok: false, error: p.error, detail: p.detail }
        audit({ kind: 'dry-run', tool, ok: false, error: p.error, status: 'denied' })
        return deniedPreview
      }
    }
    if (spec.confirm) rememberPreview(runId, tool, args)
    audit({ kind: 'dry-run', tool, ok: true, impact: preview.impact, will_snapshot: preview.will_snapshot, status: preview.status })
    return preview
  }

  session.steps += 1
  session.updated_at = new Date().toISOString()
  saveSession(session, runId)
  const result = execute(tool, args)
  const out = {
    ok: result && result.ok !== false,
    action: 'run',
    dry_run: false,
    tool,
    runId,
    steps: session.steps,
    max_steps: maxSteps,
    ...withImpact(tool, args, impactRows, result && typeof result === 'object' ? {
      will_snapshot: result.will_snapshot,
      callId: result.callId,
      snapshot_id: result.snapshot_id,
      snapshot_path: result.snapshot_path,
      existed: result.existed,
    } : {}),
    result: redact(result),
  }
  if (tool === 'fs.write' && result && typeof result === 'object') {
    if (result.will_snapshot != null) out.will_snapshot = result.will_snapshot
    if (result.existed != null) out.existed = result.existed
    if (result.callId) out.callId = result.callId
    if (result.snapshot_id) out.snapshot_id = result.snapshot_id
    if (result.snapshot_path) out.snapshot_path = result.snapshot_path
    if (result.path) out.path = result.path
  }
  audit({
    kind: 'run',
    tool,
    ok: out.ok,
    steps: session.steps,
    ...(tool === 'fs.write' ? {
      will_snapshot: out.will_snapshot,
      callId: out.callId,
      snapshot_id: out.snapshot_id,
      existed: out.existed,
      error: result && result.error,
    } : {}),
  })
  return out
}

export { catalog, run, TOOLS, DEFAULT_MAX_STEPS, impactFor, listSessions, stepBudget, clearPreviewTickets, previewFingerprint }

function parseArgsJson(argv) {
  const fileIdx = argv.indexOf('--args-file')
  if (fileIdx >= 0) {
    try { return JSON.parse(fs.readFileSync(argv[fileIdx + 1], 'utf8')) } catch { return { _error: 'bad-args-file' } }
  }
  const i = argv.indexOf('--args-json')
  if (i < 0) return {}
  try { return JSON.parse(argv[i + 1] || '{}') } catch { return { _error: 'bad-args-json' } }
}

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2))
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const cmd = process.argv[2] || 'catalog'
  if (cmd === 'catalog') printJson(catalog())
  else if (cmd === 'run') {
    const tool = process.argv[3]
    const args = parseArgsJson(process.argv)
    if (args._error) {
      printJson({ ok: false, error: args._error })
      process.exit(2)
    }
    printJson(run(tool, args, {
      dryRun: process.argv.includes('--dry-run'),
      confirm: process.argv.includes('--confirm'),
    }))
  } else if (cmd === 'reset-session') {
    saveSession(emptyRun(), RUN_ID)
    printJson({ ok: true, action: 'reset-session', runId: RUN_ID, sessions: Object.keys(listSessions()).length })
  } else if (cmd === 'sessions') {
    printJson({ ok: true, action: 'sessions', runId: RUN_ID, runs: listSessions() })
  } else {
    console.error('Commands: catalog | run <tool> [--dry-run] [--confirm] [--args-json {}] | reset-session')
    process.exit(2)
  }
}
