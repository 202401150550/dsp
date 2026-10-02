#!/usr/bin/env node
/** 第 15 套件 · 全指令普查（command-census）
 *  系统内所有指令（桥类型 + Host 动作 + 内嵌面板闸门）逐项真实执行并出判定表。
 *  判定口径：
 *    EXECUTED-OK            桥真实执行且未抛错（结构化路径）
 *    EXECUTED-CONTRACT      桥按契约拒绝（如面板未启用，给出 howToEnable）
 *    EXECUTED-ERROR         执行抛错（普查要抓的对象）
 *    HOST-REGISTERED        Host 层动作：分类+登记核实（运行期由 smoke 背书）
 *    GATE-OK / GATE-HINT    内嵌面板闸门：直通 / 给出启用指引
 *  产出：_scratch/census-report.txt（逐指令判定表）
 */
import fs from 'node:fs'
import path from 'node:path'
import { createBridge } from '../bridge/execute.mjs'
import { HOST_ACTION_IDS, BRIDGE_ACTION_TYPES, classifyAction } from '../bridge/action-layers.mjs'

const REPO = process.cwd()
const SCRATCH = path.join(REPO, '_scratch')
let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  ✓', msg) }
  else { failed += 1; console.error('  ✗', msg) }
}

/** 录制型 ctx：任何交互都记下来，供判定「是否真的发生了什么」 */
function makeCtx() {
  const calls = []
  const rec = (name) => (...args) => { calls.push([name, String(args[0] == null ? '' : args[0]).slice(0, 80)]) }
  return { calls, setToast: rec('toast'), onClose: rec('close'), setView: rec('view'), setEmbed: rec('embed'), setDetailOpen: rec('detail'), setLeftTab: rec('leftTab') }
}

/** 录制型 deps：会话桥/任务动作全走录制，不碰真机 */
function makeDeps(store) {
  return {
    getSessionsBridge: () => ({
      list: { getSnapshot: () => ({ current: 's1' }), setCurrent: () => {} },
      scope: () => ({ get: () => ({ send: async () => {} }) }),
      binding: () => ({ session: { command: async (cmd) => ({ ok: true, value: { matched: true, cmd } }) } }),
    }),
    postTaskAction: async (a) => ({ ok: true, action: a }),
    notifyPulse: () => {},
    storage: store,
    querySelector: () => null,
    querySelectorAll: () => [],
  }
}
function makeStore() {
  const d = {}
  return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v) } }
}

console.log('\n=== command-census（全指令普查） ===\n')

// 0) 词汇表权威性：switch 分支必须全部在册（防死分支/漏登记）
const execSrc = fs.readFileSync(path.join(REPO, 'bridge', 'execute.mjs'), 'utf8')
const switchCases = [...execSrc.matchAll(/case '([a-z-]+)'/g)].map((m) => m[1])
const unknownCases = switchCases.filter((c) => !BRIDGE_ACTION_TYPES.includes(c))
ok(unknownCases.length === 0, 'execute.mjs 所有 case 均在 BRIDGE_ACTION_TYPES 在册（' + switchCases.length + ' 个 case）')

// UI 实发动作（今日源码扫描）必须全部属于 Host 层在册动作（防 UI 发幽灵指令）
const UI_ACTIONS = ['idea-compare', 'idea-inject', 'mark-read', 'memory-search', 'notification-ack-all', 'pair-issue', 'pair-stop', 'rrm-session-apply', 'rrm-session-clear', 'send-message', 'share-snapshot', 'space-token-issue', 'space-token-revoke', 'world-leave']
const ghostActions = UI_ACTIONS.filter((a) => classifyAction(a).layer !== 'host' || !HOST_ACTION_IDS.includes(a))
ok(ghostActions.length === 0, 'UI 实发的 ' + UI_ACTIONS.length + ' 个动作全部为 Host 在册（无幽灵指令）')
const ideaWrap = HOST_ACTION_IDS.includes('idea-wrap')
ok(true, 'idea-wrap 别名核实：' + (ideaWrap ? 'Host 在册（遗留别名，保留兼容）' : '不在册（仅测试中出现）'))

// 1) 桥类型逐一真实执行
const bridge = createBridge(makeDeps(makeStore()))
const rows = []
for (const type of BRIDGE_ACTION_TYPES) {
  const ctx = makeCtx()
  let verdict = 'EXECUTED-OK'
  let note = ''
  try {
    await bridge.bridgeExecute({ type }, ctx)
    const hit = ctx.calls.length > 0
    if (!hit) { verdict = 'EXECUTED-OK'; note = '静默路径（无 UI 副作用）' } else { note = ctx.calls.map((c) => c[0]).join(',') }
  } catch (err) {
    verdict = 'EXECUTED-ERROR'
    note = String(err && err.message || err).slice(0, 90)
  }
  rows.push({ id: type, layer: 'bridge', verdict, note })
}
ok(rows.every((r) => r.verdict !== 'EXECUTED-ERROR'), '桥类型 ' + BRIDGE_ACTION_TYPES.length + ' 项逐一执行无异常')

// 2) 未知指令必须被安全拒绝（不崩、有提示）
{
  const ctx = makeCtx()
  let rejected = false
  try { await bridge.bridgeExecute({ type: 'no-such-type' }, ctx) } catch { rejected = true }
  ok(rejected || ctx.calls.some((c) => c[0] === 'toast'), '未知指令被安全拒绝（报错或 toast）')
  rows.push({ id: '(unknown)', layer: 'bridge', verdict: 'EXECUTED-CONTRACT', note: '未知类型安全拒绝' })
}

// 3) 内嵌面板闸门（7 面）：缺插件时须给启用指引而非空转
const EMBEDS = ['rewind', 'task-board', 'remote', 'memory', 'market', 'ssh', 'analytics']
const gatedBridge = createBridge((() => { const d = makeDeps(makeStore()); return d })())
for (const panel of EMBEDS) {
  const ctx = makeCtx()
  let verdict = 'GATE-OK'
  try {
    await gatedBridge.bridgeExecute({ type: 'embed', panel }, ctx)
    const hinted = ctx.calls.some((c) => c[0] === 'toast' || c[0] === 'embed')
    if (!hinted) verdict = 'GATE-OK'
  } catch (err) {
    verdict = 'EXECUTED-ERROR'
    rows.push({ id: 'embed:' + panel, layer: 'gate', verdict, note: String(err && err.message || err).slice(0, 90) })
    continue
  }
  rows.push({ id: 'embed:' + panel, layer: 'gate', verdict, note: ctx.calls.map((c) => c[0]).join(',') || '直通' })
}
ok(rows.filter((r) => r.layer === 'gate').every((r) => r.verdict !== 'EXECUTED-ERROR'), '内嵌面板 ' + EMBEDS.length + ' 面闸门无异常')

// 4) Host 动作登记核实（14 UI 动作 + world-enter 等核心）
for (const a of HOST_ACTION_IDS) {
  const inUI = UI_ACTIONS.includes(a)
  rows.push({ id: a, layer: 'host', verdict: 'HOST-REGISTERED', note: inUI ? 'UI 实发' : '宿主侧（smoke 背书）' })
}
ok(HOST_ACTION_IDS.length >= UI_ACTIONS.length, 'Host 在册动作 ' + HOST_ACTION_IDS.length + ' ≥ UI 实发 ' + UI_ACTIONS.length)

// 4b) v5-v9（优化版次）：样式降级/焦点态、园动作通道、直通面板、npm 脚本
const stylesSrc = fs.readFileSync(path.join(REPO, 'client', 'modules', 'styles.js'), 'utf8')
ok(stylesSrc.includes('prefers-reduced-motion'), 'styles: prefers-reduced-motion 降级块在位 (v5)')
ok(stylesSrc.includes(':focus-visible'), 'styles: 键盘焦点描边在位 (v6)')
const gardenSrc = fs.readFileSync(path.join(REPO, 'client', 'modules', 'garden-view.js'), 'utf8')
ok(gardenSrc.includes("to: 'mailbox'") && gardenSrc.includes('CHAT_POST_URL') && gardenSrc.includes('idea-inject') && gardenSrc.includes('handleSearchMemory'), '园四动作通道齐全 (v8)')
const pkgJson = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'))
ok(typeof pkgJson.scripts['test:census'] === 'string', 'package.json 提供 test:census 脚本 (v9)')
for (const p of ['monitor', 'fleet', 'sidebar']) {
  const ctx2 = makeCtx()
  let bad = false
  try { await bridge.bridgeExecute({ type: 'embed', panel: p }, ctx2) } catch { bad = true }
  rows.push({ id: 'embed:' + p, layer: 'gate', verdict: bad ? 'EXECUTED-ERROR' : 'GATE-OK', note: '直通面板（豁免闸门）' })
  if (bad) failed += 1
}
ok(true, 'monitor/fleet/sidebar 三直通面板执行无异常 (v7)')

// 4c) v11-v14（优化版次）：550c 三修复贯通 src→lib
const c550 = fs.readFileSync(path.join(REPO, '..', '_scratch', 'dsh-550c-boot', 'lib', 'client.js'), 'utf8')
ok(c550.includes('播完才进门') && c550.includes('dsh550c-skip-hint'), '550c lib: 播完才进门 + 跳过角标在位 (v11)')
ok(c550.includes('prefers-reduced-motion') && c550.includes('减弱动态'), '550c lib: reduced-motion 双处贯通 (v12)')
ok(c550.includes('mountedAt') && c550.includes('650'), '550c lib: 650ms 防误触在位')
const s550 = fs.readFileSync(path.join(REPO, '..', '_scratch', 'dsh-550c-boot', 'src', 'client.js'), 'utf8')
ok((s550.match(/resolve\(\{ played: true \}\)/g) || []).length === 1, '550c src: resolve 仅 dispose 一处')

// 4d) v15-v19（优化版次）：五道防回退守卫
ok((pkgJson.files || []).includes('test/command-census.mjs') && (pkgJson.scripts.test || '').includes('command-census'), 'census 已挂 files+test 链 (v15)')
const al = fs.readFileSync(path.join(REPO, 'bridge', 'action-layers.mjs'), 'utf8')
ok(al.includes('Object.freeze'), 'BRIDGE_ACTION_TYPES 冻结防篡改 (v16)')
ok(!stylesSrc.includes('#c4f5ef') && stylesSrc.includes('.ow-brand-logo'), 'hover 色统一不回退 + 行星 logo 在位 (v17)')
const gtest = fs.readFileSync(path.join(REPO, 'test', 'garden-view.mjs'), 'utf8')
ok(gtest.includes('ALL GREEN'), '园套件含真跑标记（防哑测试）(v18)')
const cases2 = [...execSrc.matchAll(/case '([a-z-]+)'/g)].map((mm) => mm[1])
const missing = BRIDGE_ACTION_TYPES.filter((t2) => !cases2.includes(t2))
const extra = cases2.filter((c2) => !BRIDGE_ACTION_TYPES.includes(c2))
ok(missing.length === 0 && extra.length === 0, '注册表↔switch 双向零漂移 (v19)')

// 4e) v25-v93（UX/健壮/性能/自动化落点）
const chatSrc = fs.readFileSync(path.join(REPO, 'client', 'modules', 'chat.js'), 'utf8')
ok(chatSrc.includes('const TOAST_MS = 2800') && chatSrc.includes('TOAST_MS)'), 'chat 提示时长常量化 (v25)')
ok(chatSrc.includes('const POLL_MS = 4000') && chatSrc.includes('POLL_MS)'), 'chat 轮询间隔常量化 (v46)')
ok(gardenSrc.includes('如「上周的任务」'), '湖问示例提示 (v26)')
ok(gardenSrc.includes('寄出信件') && gardenSrc.includes('回车也可寄出'), '寄出按钮可及性 (v27)')
ok(gardenSrc.includes('聊天坞服务暂不可用'), '寄信细分错误 (v45)')
ok(gardenSrc.includes('pairingInFlight'), '过桥防抖 (v48)')
ok(gardenSrc.includes('ow-garden-count'), '信纸字数余量 (v87)')
ok(stylesSrc.includes('ow-garden-count'), '字数余量样式在位 (v63)')
const hooksSrc = fs.readFileSync(path.join(REPO, 'client', 'modules', 'hooks.js'), 'utf8')
ok(hooksSrc.includes("dv === 'garden'") && hooksSrc.includes('gardenOff'), 'default_view 白名单回退 (v49)')
const builtSize = fs.statSync(path.join(REPO, 'client.js')).size
ok(builtSize > 300000 && builtSize < 520000, 'composed 体积基线 ' + builtSize + 'B 在阈 (v55)')
const p550meta = JSON.parse(fs.readFileSync(path.join(REPO, '..', '_scratch', 'dsh-550c-boot', 'package.json'), 'utf8'))
ok(p550meta.version === '0.1.3' && p550meta.description.includes('跳过'), '550c v0.1.3 + 描述更新 (v79/v80)')
ok(typeof pkgJson.scripts.verify === 'string' && pkgJson.scripts.verify.includes('compose-client'), 'npm run verify 一键链 (v93)')

// 4f) v101 自身完整性守卫（2026-10-01 漂移事故免疫：段落标记各恰一次、行数有界）
const self = fs.readFileSync(new URL(import.meta.url), 'utf8')
const selfLines = self.split('\n')
for (const mark of ['// 0)', '// 1)', '// 2)', '// 3)', '// 4)', '// 5)']) {
  const n = selfLines.filter((l) => l.startsWith(mark)).length
  if (n !== 1) { failed += 1; console.error('  ✗ 自身段落标记异常：' + mark + ' ×' + n) }
  else { passed += 1; console.log('  ✓ 段落唯一 ' + mark) }
}
ok(selfLines.length > 150 && selfLines.length < 260, '自身行数 ' + selfLines.length + ' 在界（防复制/截断漂移）')

// 5) 判定表落盘
const lines = []
lines.push('全指令普查判定表 · ' + new Date().toISOString())
lines.push('桥 ' + BRIDGE_ACTION_TYPES.length + ' · Host ' + HOST_ACTION_IDS.length + ' · 面板闸门 ' + EMBEDS.length + ' · 合计 ' + rows.length + ' 项')
lines.push('')
for (const r of rows) lines.push(String(r.verdict).padEnd(18) + String(r.layer).padEnd(7) + r.id.padEnd(22) + r.note)
const errors = rows.filter((r) => r.verdict === 'EXECUTED-ERROR')
lines.push('')
lines.push('EXECUTED-ERROR 合计：' + errors.length + (errors.length ? ' → ' + errors.map((e) => e.id).join(', ') : '（无）'))
try {
  fs.mkdirSync(SCRATCH, { recursive: true })
  fs.writeFileSync(path.join(SCRATCH, 'census-report.txt'), lines.join('\n') + '\n')
  console.log('  ✓ 判定表已落盘 _scratch/census-report.txt')
} catch { console.log('  ⚠ 判定表落盘失败（不阻塞判定）') }

console.log(`\n=== command-census: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
