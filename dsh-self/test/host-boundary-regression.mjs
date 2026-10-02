/**
 * 边界回归（B1–B9）：把 2026-10-01 评估里复现的 4 类问题固化成用例。
 *
 * 只使用虚构数据：
 *   - 夹具目录位于 DSP/_scratch/（已 gitignore），测试结束删除；
 *   - Git 夹具是「独立的小仓库」，先断言 rev-parse --show-toplevel 命中夹具，
 *     否则立即中止，绝不触碰外层真实仓库；
 *   - 宿主状态（session/audit）通过 DSH_HOST_STATE_DIR 外置到夹具；
 *   - 不读取真实凭证文件：所谓 .env 目录里只有一行虚构标记。
 *
 * Run: node test/host-boundary-regression.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DSP = path.resolve(__dirname, '..', '..')
const FIX = path.join(DSP, '_scratch', `host-boundary-${crypto.randomUUID()}`)

let passed = 0
let failed = 0
const failures = []

function check(cond, name, detail = '') {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    failures.push(name)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function git(cwd, args) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: path.join(FIX, 'empty-gitconfig'),
      GIT_CEILING_DIRECTORIES: path.dirname(FIX),
      GIT_AUTHOR_NAME: 'Fixture', GIT_COMMITTER_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    },
  })
}

function gitOut(cwd, args) {
  const r = git(cwd, args)
  if (r.status !== 0) throw new Error(`fixture git ${args.join(' ')} failed: ${r.stderr || r.stdout}`)
  return String(r.stdout || '').trim()
}

function norm(p) { return String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() }

fs.mkdirSync(FIX, { recursive: true })
fs.writeFileSync(path.join(FIX, 'empty-gitconfig'), '', 'utf8')
process.env.DSH_HOST_STATE_DIR = path.join(FIX, 'host-state')
fs.mkdirSync(process.env.DSH_HOST_STATE_DIR, { recursive: true })
process.env.DSH_REWIND_SNAPSHOT_DIR = path.join(FIX, 'snapshots')
process.env.DSH_HOST_REWIND_SESSION = 'boundary-test'

const runtime = await import(pathToFileURL(path.join(__dirname, '..', 'host-runtime.mjs')).href)
const rewind = await import(pathToFileURL(path.join(__dirname, '..', 'host-rewind-bridge.mjs')).href)
const plan = await import(pathToFileURL(path.join(__dirname, '..', 'plan-validate.mjs')).href)

console.log('\n=== host boundary regression (B1–B9) ===\n')

// ── B1/B2/B3：参数级逃逸面 ──────────────────────────────────────────────
console.log('B1–B3 command argument policy')
{
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-boundary-outside-'))
  fs.writeFileSync(path.join(outside, 'anything.txt'), 'fabricated', 'utf8')
  const b1 = runtime.shellRun({ name: 'git', argv: ['-C', outside, 'rev-parse', '--show-toplevel'], cwd: DSP })
  check(b1.ok === false && (b1.error === 'arg-denied' || b1.error === 'git-cwd-switch-forbidden'),
    'B1 git -C 被拒', JSON.stringify(b1).slice(0, 160))

  const b2 = runtime.shellRun({ name: 'git', argv: [`--git-dir=${path.join(outside, '.git')}`, 'status'], cwd: DSP })
  check(b2.ok === false, 'B2 --git-dir 被拒', JSON.stringify(b2).slice(0, 160))

  const b3 = runtime.shellRun({ name: 'node', argv: ['-e', 'console.log(1)'], cwd: DSP })
  check(b3.ok === false && b3.error === 'arg-denied', 'B3 node -e 被拒', JSON.stringify(b3).slice(0, 160))

  // 正常读取仍要能用（不能把人锁死）
  const ok = runtime.shellRun({ name: 'git', argv: ['rev-parse', '--show-toplevel'], cwd: DSP })
  check(ok.ok === true, 'B1b 正常 git 查询仍可用', JSON.stringify(ok).slice(0, 160))
  fs.rmSync(outside, { recursive: true, force: true })
}

// ── B4：目录联接（junction）别名绕过敏感名 ──────────────────────────────
console.log('B4 effective-path deny check')
{
  const secretDir = path.join(FIX, '.env')
  fs.mkdirSync(secretDir, { recursive: true })
  fs.writeFileSync(path.join(secretDir, 'fixture.txt'), 'FABRICATED_MARKER_NOT_A_REAL_SECRET', 'utf8')
  const direct = runtime.fsRead({ path: path.join(secretDir, 'fixture.txt') })
  check(direct.ok === false && direct.error === 'denied-secret-path', 'B4a 直接路径被拒', JSON.stringify(direct).slice(0, 120))
  let aliasOk = false
  try {
    const alias = path.join(FIX, 'plain-alias')
    fs.symlinkSync(secretDir, alias, 'junction')
    aliasOk = true
  } catch { /* 无权限则跳过 */ }
  if (aliasOk) {
    const viaAlias = runtime.fsRead({ path: path.join(FIX, 'plain-alias', 'fixture.txt') })
    check(viaAlias.ok === false && viaAlias.error === 'denied-secret-path-resolved',
      'B4b 联接别名被拒（realpath 复检）', JSON.stringify(viaAlias).slice(0, 160))
  } else {
    check(false, 'B4b 联接别名被拒（realpath 复检）', 'junction 创建失败')
  }
}

// ── B5：提交范围精确性（不动既有暂存区） ────────────────────────────────
console.log('B5 commit scope')
{
  const repo = path.join(FIX, 'repo')
  fs.mkdirSync(repo, { recursive: true })
  const tpl = path.join(FIX, 'tpl')
  fs.mkdirSync(tpl, { recursive: true })
  git(FIX, ['init', '-q', `--template=${tpl}`, repo])
  const top = gitOut(repo, ['rev-parse', '--show-toplevel'])
  check(norm(top) === norm(repo), 'B5a Git 夹具与外层仓库隔离', `top=${top}`)
  if (norm(top) !== norm(repo)) {
    console.log('  ! 夹具不是独立仓库，跳过 B5')
  } else {
    const selected = path.join(repo, 'selected.txt')
    const unrelated = path.join(repo, 'unrelated.txt')
    fs.writeFileSync(selected, 'v1', 'utf8')
    fs.writeFileSync(unrelated, 'v1', 'utf8')
    gitOut(repo, ['add', '-A'])
    gitOut(repo, ['commit', '-qm', 'fixture baseline'])
    fs.writeFileSync(selected, 'v2', 'utf8')
    fs.writeFileSync(unrelated, 'v2', 'utf8')
    gitOut(repo, ['add', '--', 'unrelated.txt'])

    // 让被调用的 runtime 子进程也拿到夹具身份（否则 git 报 Author identity unknown）
    process.env.GIT_CONFIG_GLOBAL = path.join(FIX, 'empty-gitconfig')
    process.env.GIT_AUTHOR_NAME = 'Fixture'
    process.env.GIT_COMMITTER_NAME = 'Fixture'
    process.env.GIT_AUTHOR_EMAIL = 'fixture@example.invalid'
    process.env.GIT_COMMITTER_EMAIL = 'fixture@example.invalid'
    const res = runtime.gitCommit({ files: [selected], message: 'boundary: only selected', cwd: repo })
    check(res.ok === true, 'B5b 提交成功', JSON.stringify(res).slice(0, 200))
    const committed = gitOut(repo, ['show', '--format=', '--name-only', 'HEAD']).split(/\r?\n/).filter(Boolean)
    check(committed.length === 1 && committed[0] === 'selected.txt',
      'B5c 只提交清单内文件', committed.join(','))
    const staged = gitOut(repo, ['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
    check(staged.includes('unrelated.txt'), 'B5d 既有暂存区保持不变', staged.join(','))
    check(Array.isArray(res.staged_after), 'B5e 提交前后暂存区可审计', JSON.stringify(res.staged_after))
  }
}

// ── B6：二进制目标拒绝（不产生坏快照） ───────────────────────────────────
console.log('B6 binary target')
{
  const bin = path.join(FIX, 'binary-fixture.bin')
  const original = Buffer.from([0, 255, 128, 65])
  fs.writeFileSync(bin, original)
  const w = runtime.fsWrite({ path: bin, content: 'temporary text' })
  check(w.ok === false && w.error === 'binary-target-unsupported', 'B6a 写入被拒', JSON.stringify(w).slice(0, 160))
  check(fs.readFileSync(bin).equals(original), 'B6b 原字节未被改动')
  const p = runtime.previewFsWrite({ path: bin, content: 'x' })
  check(p.status === 'denied', 'B6c 预览即为拒绝', JSON.stringify(p).slice(0, 120))
}

// ── B7：预览状态语义 ────────────────────────────────────────────────────
console.log('B7 preview status')
{
  const outside = path.join(os.tmpdir(), 'dsh-boundary-preview-outside.txt')
  const denied = runtime.previewFsWrite({ path: outside, content: 'x' })
  check(denied.status === 'denied' && denied.ok === false, 'B7a 越界路径 → denied')
  const normal = path.join(FIX, 'normal-preview.txt')
  const pending = runtime.previewFsWrite({ path: normal, content: 'hello' })
  check(pending.status === 'pending-approval' && pending.will_snapshot === true, 'B7b 正常写入 → pending-approval + will_snapshot')
  // 创建 + 回滚闭环（v2 快照带 sha256）
  const created = runtime.fsWrite({ path: normal, content: 'hello v1' })
  check(created.ok === true && 'snapshot_sha256' in created && 'snapshot_bytes' in created,
    'B7c 写入返回快照字节信息（新建文件为 null）', JSON.stringify(created).slice(0, 160))
  const snap = rewind.readCheckpointFile(created.snapshot_path)
  const restored = rewind.applyCheckpointEntry(snap.entry)
  check(restored.ok === true && restored.verified === true && fs.existsSync(normal) === false,
    'B7d created 文件回滚 = 删除且校验通过', JSON.stringify(restored).slice(0, 160))
  fs.writeFileSync(normal, 'hello v2', 'utf8')
  const again = runtime.fsWrite({ path: normal, content: 'hello v3' })
  const snap2 = rewind.readCheckpointFile(again.snapshot_path)
  const back = rewind.applyCheckpointEntry(snap2.entry)
  check(back.ok === true && back.verified === true && fs.readFileSync(normal, 'utf8') === 'hello v2',
    'B7e 文本回滚逐字节一致')
}

// ── B8：组合校验 ────────────────────────────────────────────────────────
console.log('B8 plan.validate')
{
  const target = path.join(FIX, 'plan-target.txt')
  const single = plan.validatePlan([{ tool: 'fs.write', args: { path: target, content: 'x' } }])
  check(single.ok === true && single.summary.confirm === 1, 'B8a 单步写入 → 可执行但需确认')
  const chained = plan.validatePlan([
    { tool: 'fs.write', args: { path: target, content: 'x' } },
    { tool: 'shell.run', args: { name: 'git', argv: ['status'] } },
  ])
  check(chained.ok === false && chained.summary.conflicts.some((c) => c.rule === 'write-then-exec'),
    'B8b 写后执行 → 组合拒绝', JSON.stringify(chained.summary).slice(0, 200))
  const unknown = plan.validatePlan([{ tool: 'shell.free', args: {} }])
  check(unknown.ok === false && unknown.decisions[0].status === 'deny', 'B8c 未登记工具 → 拒绝')
  const secret = plan.validatePlan([{ tool: 'fs.write', args: { path: target, content: 'api_key: sk-abcdef1234567890' } }])
  check(secret.decisions[0].status === 'warn', 'B8d 疑似凭证内容 → 警告', JSON.stringify(secret.decisions[0]).slice(0, 200))
}

// ── B9：任务级步数预算 ──────────────────────────────────────────────────
console.log('B9 run-scoped budget')
{
  const agent = await import(pathToFileURL(path.join(__dirname, '..', 'host-agent.mjs')).href)
  // 兼容旧格式：先写一个旧式单任务文件
  fs.writeFileSync(path.join(process.env.DSH_HOST_STATE_DIR, 'host-session.json'),
    JSON.stringify({ started_at: new Date().toISOString(), steps: 7, halted: false, reason: null }), 'utf8')
  const a = agent.run('plan.validate', { steps: [{ tool: 'shell.free' }] }, { runId: 'run-a' })
  const b = agent.run('plan.validate', { steps: [{ tool: 'shell.free' }] }, { runId: 'run-b' })
  check(a.runId === 'run-a' && a.steps === 1, 'B9a 新任务从 1 开始（旧文件 steps=7 被隔离）', JSON.stringify({ steps: a.steps }))
  check(b.steps === 1, 'B9b 两个任务互不影响', JSON.stringify({ steps: b.steps }))
  const store = JSON.parse(fs.readFileSync(path.join(process.env.DSH_HOST_STATE_DIR, 'host-session.json'), 'utf8'))
  check(store.runs && store.runs['run-a'] && store.runs['run-b'] && store.runs.default && store.runs.default.steps === 7,
    'B9c 旧 default 记录被保留且结构升级', JSON.stringify(Object.keys(store.runs || {})))
}

fs.rmSync(FIX, { recursive: true, force: true })
console.log(`\n=== host-boundary-regression: ${passed} passed, ${failed} failed ===`)
if (failed) console.log(`  failed: ${failures.join(' | ')}`)
process.exit(failed === 0 ? 0 : 1)
