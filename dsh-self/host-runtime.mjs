/**
 * Phase 2 受控运行时：白名单路径 / 参数化命令 / Git 纪律。
 * 永不 spawn({ shell: true })；工具输出按不可信数据处理。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { commitBeforeSnapshot } from './host-rewind-bridge.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..')
const POLICY_FILE = path.join(__dirname, 'host-policy.yml')

const ARG_OK = /^[^;&|`$<>\r\n]+$/
const GIT_MSG_OK = /^[^\r\n]{2,200}$/

function loadPolicy() {
  const require = createRequire(import.meta.url)
  const YAML = require(path.join(DSP, 'dsh-desktop-toggle', 'node_modules', 'yaml', 'dist', 'index.js'))
  const raw = YAML.parse(fs.readFileSync(POLICY_FILE, 'utf8')) || {}
  const roots = (raw.roots || []).map((r) => path.resolve(String(r)))
  return {
    max_read_bytes: Number(raw.max_read_bytes) || 131072,
    max_write_bytes: Number(raw.max_write_bytes) || 262144,
    timeout_ms: Number(raw.timeout_ms) || 30000,
    max_output_chars: Number(raw.max_output_chars) || 8000,
    roots: roots.length ? roots : [DSP],
    deny_names: (raw.deny_names || []).map((n) => String(n).toLowerCase()),
    commands: raw.commands || {},
  }
}

function norm(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase()
}

function isDeniedName(abs) {
  const policy = loadPolicy()
  const base = path.basename(abs).toLowerCase()
  const parts = norm(abs).split('/')
  return policy.deny_names.some((n) => base === n || parts.includes(n))
}

function coerceHostPath(input) {
  const raw = String(input || '').trim()
  if (!raw) return DSP
  let p = raw.replace(/\\/g, '/')
  p = p.replace(/^\/+/, '')
  if (p === 'dsp' || p.startsWith('dsp/')) p = p.slice(4) || '.'
  if (/^[a-zA-Z]:[\\/]/.test(raw) || path.isAbsolute(raw)) return path.resolve(raw)
  return path.resolve(DSP, p)
}

export function resolveAllowed(input, { mustExist = false } = {}) {
  if (!input || typeof input !== 'string') return { ok: false, error: 'path-required' }
  const abs = coerceHostPath(input)
  if (isDeniedName(abs)) return { ok: false, error: 'denied-secret-path', path: path.basename(abs) }
  let probe = abs
  if (!fs.existsSync(probe)) {
    if (mustExist) return { ok: false, error: 'not-found' }
    probe = path.dirname(abs)
  }
  let real = probe
  try { real = fs.realpathSync(probe) } catch {
    return { ok: false, error: 'not-found' }
  }
  const n = norm(real)
  const policy = loadPolicy()
  const inside = policy.roots.some((root) => {
    const r = norm(root)
    return n === r || n.startsWith(r + '/')
  })
  if (!inside) return { ok: false, error: 'outside-whitelist' }
  return { ok: true, path: abs, real }
}

function clip(text, max) {
  const s = String(text || '')
  if (s.length <= max) return s
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`
}

function checkArgv(argv) {
  if (!Array.isArray(argv)) return { ok: false, error: 'argv-must-be-array' }
  if (argv.length > 24) return { ok: false, error: 'argv-too-long' }
  for (const a of argv) {
    if (typeof a !== 'string' || a.length === 0 || a.length > 512) {
      return { ok: false, error: 'bad-arg' }
    }
    if (!ARG_OK.test(a)) return { ok: false, error: 'metachar-denied', arg: a.slice(0, 40) }
  }
  return { ok: true }
}

// TTL 去重（WorkBuddy 式 list 缓存）：ttl 内同键重复调用直接复用，避免反复 readdir / 解析 policy。
// 键用解析后的真实路径，值带时间戳，过期自动失效。
export function ttlCache(ttlMs) {
  const store = new Map()
  return function get(key, fn) {
    const now = Date.now()
    const hit = store.get(key)
    if (hit && now - hit.at < ttlMs) return hit.value
    const value = fn()
    store.set(key, { at: now, value })
    return value
  }
}

const listCache = ttlCache(300)

export function fsList(args = {}) {
  const got = resolveAllowed(args.path || DSP, { mustExist: true })
  if (!got.ok) return got
  return listCache(norm(got.real), () => {
    const st = fs.statSync(got.path)
    if (!st.isDirectory()) return { ok: false, error: 'not-a-directory' }
    const names = fs.readdirSync(got.path).slice(0, 200)
    return { ok: true, path: got.path, entries: names }
  })
}

export function fsRead(args = {}) {
  const policy = loadPolicy()
  const got = resolveAllowed(args.path, { mustExist: true })
  if (!got.ok) return got
  const st = fs.statSync(got.path)
  if (!st.isFile()) return { ok: false, error: 'not-a-file' }
  const max = Math.min(Number(args.max_bytes) || policy.max_read_bytes, policy.max_read_bytes)
  if (st.size > max) return { ok: false, error: 'file-too-large', bytes: st.size, max }
  const text = fs.readFileSync(got.path, 'utf8')
  return { ok: true, path: got.path, bytes: st.size, text: clip(text, policy.max_output_chars) }
}

export function previewFsWrite(args = {}) {
  const got = resolveAllowed(args.path, { mustExist: false })
  if (!got.ok) {
    return {
      ok: false,
      will_snapshot: false,
      error: got.error,
      path: String(args.path || ''),
      existed: false,
      impact: [],
    }
  }
  const existed = fs.existsSync(got.path) && fs.statSync(got.path).isFile()
  return {
    ok: true,
    will_snapshot: true,
    path: got.path,
    existed,
    callId: null,
    impact: [{
      path: got.path,
      from: existed ? '(existing file)' : '(create)',
      to: `write ${String(args.content ?? '').length} chars + before-snapshot`,
    }],
  }
}

export function fsWrite(args = {}) {
  const policy = loadPolicy()
  const got = resolveAllowed(args.path, { mustExist: false })
  if (!got.ok) return got
  const content = String(args.content ?? '')
  if (Buffer.byteLength(content, 'utf8') > policy.max_write_bytes) {
    return { ok: false, error: 'payload-too-large' }
  }

  const existed = fs.existsSync(got.path) && fs.statSync(got.path).isFile()
  let before = null
  if (existed) {
    try {
      before = fs.readFileSync(got.path, 'utf8')
    } catch (err) {
      return {
        ok: false,
        error: 'snapshot-failed',
        detail: `read-before-failed: ${err && err.message || err}`,
        path: got.path,
        will_snapshot: true,
        existed: true,
      }
    }
  }

  // S1: snapshot failure refuses the write.
  const snap = commitBeforeSnapshot({ filePath: got.path, before })
  if (!snap.ok) {
    return {
      ok: false,
      error: 'snapshot-failed',
      detail: snap.detail || snap.error,
      path: got.path,
      will_snapshot: true,
      existed,
      callId: snap.callId,
    }
  }

  try {
    fs.mkdirSync(path.dirname(got.path), { recursive: true })
    fs.writeFileSync(got.path, content, 'utf8')
  } catch (err) {
    return {
      ok: false,
      error: 'write-failed',
      detail: String(err && err.message || err),
      path: got.path,
      will_snapshot: true,
      existed,
      callId: snap.callId,
      snapshot_path: snap.snapshot_path,
      snapshot_id: snap.callId,
    }
  }

  return {
    ok: true,
    path: got.path,
    bytes: Buffer.byteLength(content, 'utf8'),
    will_snapshot: true,
    existed,
    callId: snap.callId,
    snapshot_id: snap.callId,
    snapshot_path: snap.snapshot_path,
    anchorSeq: snap.anchorSeq,
  }
}

function spawnBin(bin, argv, cwd) {
  const policy = loadPolicy()
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const r = spawnSync(bin, argv, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: policy.timeout_ms,
    windowsHide: true,
    shell: false,
  })
  return {
    ok: r.status === 0,
    code: r.status,
    stdout: clip(r.stdout, policy.max_output_chars),
    stderr: clip(r.stderr, Math.floor(policy.max_output_chars / 2)) || undefined,
    cwd,
    bin,
    argv,
  }
}

function gitDenied(argv) {
  const head = String(argv[0] || '').toLowerCase()
  if (head === 'config') return 'git-config-forbidden'
  if (head === 'push' && argv.some((a) => a === '--force' || a === '-f' || a.startsWith('--force'))) {
    return 'force-push-forbidden'
  }
  if (head === 'push') {
    const joined = argv.join(' ').toLowerCase()
    if (/\b(main|master)\b/.test(joined)) return 'push-main-forbidden'
    return 'git-push-deferred'
  }
  if (head === 'rebase' || head === 'filter-branch' || head === 'reset') {
    if (argv.includes('--hard')) return 'hard-reset-forbidden'
  }
  if (argv.includes('--no-verify') || argv.includes('--no-gpg-sign')) return 'skip-hooks-forbidden'
  if (argv.includes('-i') || argv.includes('--interactive')) return 'interactive-forbidden'
  return null
}

function gitToplevel(cwd) {
  const r = spawnBin('git', ['rev-parse', '--show-toplevel'], cwd)
  if (!r.ok) return { ok: false, error: 'not-a-git-repo', stderr: r.stderr }
  const top = String(r.stdout || '').trim().split(/\r?\n/)[0]
  const allowed = resolveAllowed(top, { mustExist: true })
  if (!allowed.ok) {
    return {
      ok: false,
      error: 'git-root-outside-whitelist',
      note: '当前 Git 仓库根不在 dsp 白名单内（常见于桌面整盘当仓库）。拒绝执行，以免扫到白名单外文件。',
    }
  }
  return { ok: true, path: allowed.path }
}

export function shellRun(args = {}) {
  const policy = loadPolicy()
  const name = String(args.name || '')
  const spec = policy.commands[name]
  if (!spec) return { ok: false, error: 'command-not-whitelisted', name }
  const argv = Array.isArray(args.argv) ? args.argv : []
  const chk = checkArgv(argv)
  if (!chk.ok) return chk
  const cwdArg = args.cwd ? resolveAllowed(args.cwd, { mustExist: true }) : { ok: true, path: DSP }
  if (!cwdArg.ok) return cwdArg
  if (!fs.statSync(cwdArg.path).isDirectory()) return { ok: false, error: 'cwd-not-directory' }
  if (name === 'git') {
    const why = gitDenied(argv)
    if (why) return { ok: false, error: why, note: 'Git 纪律：禁 config / force-push / 推 main / 跳过 hook。' }
    const top = gitToplevel(cwdArg.path)
    if (!top.ok) return top
  }
  if (name === 'node' && argv[0]) {
    const script = resolveAllowed(path.isAbsolute(argv[0]) ? argv[0] : path.join(cwdArg.path, argv[0]), { mustExist: true })
    if (!script.ok) return script
    const next = [script.path, ...argv.slice(1)]
    return spawnBin(spec.bin, next, cwdArg.path)
  }
  return spawnBin(spec.bin, argv, cwdArg.path)
}

export function gitStatus() {
  return shellRun({ name: 'git', argv: ['status', '--porcelain=v1', '-b'], cwd: DSP })
}

export function gitDiff(args = {}) {
  const argv = ['diff', '--stat']
  if (args.path) {
    const got = resolveAllowed(args.path)
    if (!got.ok) return got
    argv.push('--', got.path)
  }
  return shellRun({ name: 'git', argv, cwd: DSP })
}

export function gitCommit(args = {}) {
  const message = String(args.message || '').trim()
  if (!GIT_MSG_OK.test(message) || message.length < 2) {
    return { ok: false, error: 'bad-commit-message' }
  }
  const files = Array.isArray(args.files) ? args.files : []
  if (files.length === 0) return { ok: false, error: 'files-required', note: '必须列出要提交的白名单文件。' }
  const resolved = []
  for (const f of files) {
    const got = resolveAllowed(f, { mustExist: true })
    if (!got.ok) return got
    resolved.push(got.path)
  }
  const add = shellRun({ name: 'git', argv: ['add', '--', ...resolved], cwd: DSP })
  if (!add.ok) return add
  return shellRun({
    name: 'git',
    argv: ['commit', '-m', message],
    cwd: DSP,
  })
}

export function impactFsWrite(args = {}) {
  return previewFsWrite(args).impact
}

export function impactShell(args = {}) {
  return [{ path: `cmd:${args.name || '?'}`, from: args.argv || [], to: 'spawn shell:false' }]
}

export { loadPolicy, DSP }
