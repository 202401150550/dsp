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
import { fileURLToPath } from 'node:url'
import { spawnNodeSync } from './node-bin.mjs'
import { status as visionStatus, apply as visionApply } from './wizard-vision.mjs'
import * as runtime from './host-runtime.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..')
const DOCTOR = path.join(DSP, 'dsh-doctor', 'dsh-doctor.mjs')
const AUDIT = path.join(__dirname, 'host-audit.jsonl')
const SESSION = path.join(__dirname, 'host-session.json')
const MAX_STEPS = 20

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
  'git.commit': { title: 'Git 提交（明示 files+message）', risk: 'write-git', confirm: true, concurrencySafe: false, args: { files: 'string[]', message: 'string' } },
  'dsh.restart': { title: '清理有害 env 后启动 Desktop', risk: 'exec', confirm: true, concurrencySafe: false, args: {} },
}

function loadSession() {
  try { return JSON.parse(fs.readFileSync(SESSION, 'utf8')) } catch {
    return { started_at: new Date().toISOString(), steps: 0, halted: false, reason: null }
  }
}

function saveSession(s) {
  fs.writeFileSync(SESSION, JSON.stringify(s, null, 2) + '\n', 'utf8')
}

function redact(value) {
  const text = JSON.stringify(value)
  const scrubbed = text
    .replace(/("?(?:apiKey|password|token|secret|authorization)"?\s*:\s*")[^"]*"/gi, '$1[redacted]"')
    .replace(/[0-9a-f]{16,}\.[A-Za-z0-9_-]+/gi, '[redacted-key]')
  try { return JSON.parse(scrubbed) } catch { return { redacted: true } }
}

function audit(event) {
  fs.appendFileSync(AUDIT, JSON.stringify({ ts: new Date().toISOString(), ...redact(event) }) + '\n', 'utf8')
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
  if (tool === 'git.commit') return [{ path: (args.files || []).join(', '), from: 'working tree', to: `commit: ${String(args.message || '').slice(0, 80)}` }]
  if (tool === 'dsh.restart') return [{ path: 'DSH Desktop', from: 'running?', to: 'launch (env stripped)' }]
  return [{ path: '(read-only)', from: args || {}, to: 'no writes' }]
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
  if (tool === 'dsh.restart') return runNode(DOCTOR, ['launch'], path.dirname(DOCTOR))
  return { ok: false, error: 'unknown tool' }
}

function run(tool, args = {}, { dryRun = false, confirm = false } = {}) {
  const spec = TOOLS[tool]
  if (!spec) {
    const denied = { ok: false, action: 'run', error: 'tool-not-whitelisted', tool }
    audit({ kind: 'deny', ...denied })
    return denied
  }

  const session = loadSession()
  if (session.halted) {
    return { ok: false, action: 'run', error: 'halted', reason: session.reason, steps: session.steps }
  }
  if (session.steps >= MAX_STEPS) {
    session.halted = true
    session.reason = 'max_steps'
    saveSession(session)
    const stopped = { ok: false, action: 'run', error: 'circuit-open', reason: 'max_steps', steps: session.steps }
    audit({ kind: 'halt', ...stopped })
    return stopped
  }

  if (spec.confirm && !confirm && !dryRun) {
    return {
      ok: false,
      action: 'run',
      error: 'confirm-required',
      tool,
      impact: impactFor(tool, args),
      note: '危险动作需要 confirm:true。可先 dry_run。',
    }
  }

  const impact = impactFor(tool, args)
  if (dryRun) {
    const preview = { ok: true, action: 'run', dry_run: true, tool, impact, risk: spec.risk }
    if (tool === 'fs.write') {
      const p = runtime.previewFsWrite(args)
      preview.will_snapshot = p.will_snapshot === true
      preview.existed = !!p.existed
      if (p.path) preview.path = p.path
      if (Array.isArray(p.impact)) preview.impact = p.impact
    }
    audit({ kind: 'dry-run', tool, impact: preview.impact, will_snapshot: preview.will_snapshot })
    return preview
  }

  session.steps += 1
  saveSession(session)
  const result = execute(tool, args)
  const out = {
    ok: result && result.ok !== false,
    action: 'run',
    dry_run: false,
    tool,
    steps: session.steps,
    max_steps: MAX_STEPS,
    impact,
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

export { catalog, run, TOOLS, MAX_STEPS, impactFor }

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
    fs.writeFileSync(SESSION, JSON.stringify({ started_at: new Date().toISOString(), steps: 0, halted: false, reason: null }, null, 2) + '\n')
    printJson({ ok: true, action: 'reset-session' })
  } else {
    console.error('Commands: catalog | run <tool> [--dry-run] [--confirm] [--args-json {}] | reset-session')
    process.exit(2)
  }
}
