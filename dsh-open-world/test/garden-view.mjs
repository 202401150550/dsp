#!/usr/bin/env node
/** 园（garden-view）· 第 14 套件：真数据 / 真动作 / 诚实标注 / 接线完整 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  ✓', msg) }
  else { failed += 1; console.error('  ✗', msg) }
}

console.log('\n=== garden-view ===\n')

const src = readFileSync(join(ROOT, 'client', 'modules', 'garden-view.js'), 'utf8')

// 1) 模块契约
ok(src.includes("id: 'dsh-open-world/garden-view'"), 'module id registered')
ok(/module\.exports\s*=\s*\{[\s\S]*GardenView/.test(src) && src.includes('gardenEnabled'), 'exports GardenView + gardenEnabled')
ok(!src.includes("getContext('webgl')"), 'canvas 2d only (no WebGL context)')

// 2) 数据契约：只读白名单 snapshot 字段
const snapFields = [...src.matchAll(/snap(pshot)?(?:\s*&&\s*snap(?:shot)?)?\.([a-zA-Z]+)/g)].map((m) => m[2])
const allowed = new Set(['config', 'core', 'nodes', 'taskBoard', 'memory', 'rewind', 'space', 'events', 'mailbox', 'worldPacks', 'idea', 'framework', 'presets', 'plugins'])
const badFields = snapFields.filter((f) => !allowed.has(f))
ok(badFields.length === 0, 'snapshot fields within whitelist (' + (badFields.join(',') || 'ok') + ')')

// 3) 动作契约：只调核心动作
const actionCalls = [...src.matchAll(/action:\s*'([a-z-]+)'/g)].map((m) => m[1])
const allowedActions = new Set(['send-message', 'pair-issue'])
ok(actionCalls.every((a) => allowedActions.has(a)), 'direct actions ⊆ core (' + [...new Set(actionCalls)].join(',') + ')')
ok(src.includes('handleIdeaInject') && src.includes('handleIdeaCompare'), 'persona via idea-inject/idea-compare handlers')
ok(src.includes('handleSearchMemory'), 'lake query via memory-search handler')
ok(src.includes('OW_ACTION_URL'), 'letter posts to OW_ACTION_URL')

// 4) 诚实与克制
ok(!src.includes('NEXORA') && !/Betti|gradientNorm|梯度范数/.test(src), 'no jargon strings')
ok(src.includes('喻'), 'metaphor honesty tag present (weather=喻)')
ok(src.includes('worlds.garden'), 'feature flag documented in module')
ok(/gardenEnabled/.test(src) && /=== false/.test(src), 'garden gate flips off on worlds.garden=false')

// 5) 接线
const hooks = readFileSync(join(ROOT, 'client', 'modules', 'hooks.js'), 'utf8')
ok(/id:\s*'garden'/.test(hooks), 'VIEW_MODES has garden')
const layout = readFileSync(join(ROOT, 'client', 'modules', 'app-layout.js'), 'utf8')
ok(layout.includes("require('dsh-open-world/garden-view')"), 'app-layout requires garden-view')
ok(layout.includes("view === 'garden'"), 'CenterStage renders garden view')
const main = readFileSync(join(ROOT, 'client', 'client-main.js'), 'utf8')
ok(/handleSendMessage,\s*handleSearchMemory/.test(main), 'client-main passes letter+memory handlers')
const meta = readFileSync(join(ROOT, 'scripts', 'client-build-meta.mjs'), 'utf8')
ok(meta.includes("'garden-view.js'"), 'MODULE_ORDER includes garden-view.js')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
ok(pkg.scripts.test.includes('test/garden-view.mjs'), 'test chain includes garden-view suite')
ok((pkg.files || []).includes('test/garden-view.mjs'), 'package files ships garden suite')
const registry = readFileSync(join(ROOT, 'bridge', 'capability-registry.mjs'), 'utf8')
ok(/owSurfaces:\s*\[[^\]]*'garden'/.test(registry), 'capability registry has garden surface')
const host = readFileSync(join(ROOT, 'index.js'), 'utf8')
ok(/worlds:\s*config\.worlds/.test(host), 'snapshot.config carries worlds (full)')
ok(/worlds:\s*snap\.config\?\.worlds/.test(host), 'snapshot.config carries worlds (shell slim)')

// 6) 风格守护
ok(!/hsl\(|#[0-9a-fA-F]{6}/.test(src.replace(/#0C0F13|#111820|#16202A|#131920|#0C0F12|#DCE4E8|#E4DCC4|#1B2C32|#101C21|#9FB8BC|#1E262C|#171E23|#12181D|#F6DFA6|#C89850|#EFCF8F|#C79A55|#242C32|#2A3238|#39434B|#232B31|#1B2228|#C8402F|#1C2328|#1C2329|#101418|#0D1013|#4A5158/g, '')), 'colors confined to garden palette')

// 7) P2 聊天合一（信纸落聊天坞线程）
ok(src.includes('CHAT_POST_URL'), 'letter also lands in chat thread (chat-store)')
ok(src.includes("threadId: 'main'") && src.includes("role: 'user'"), 'chat post shape matches dock')

// 7b) v2-v4（优化版次）：280 硬上限 / 画布可及性 / reduced-motion 守卫
ok(src.includes('maxLength: 280'), 'letter input hard cap 280 (maxLength)')
ok(src.includes("role: 'img'") && src.includes('aria-label'), 'canvas a11y (role=img + aria-label 十景)')
ok(src.includes('reducedMotion') && src.includes('prefers-reduced-motion'), 'reduced-motion guard for meteors')

// 7c) v26-v48：湖问示例/寄钮/细分错误/防抖/字数
ok(src.includes('如「上周的任务」'), '湖问 placeholder 带示例 (v26)')
ok(src.includes("'寄出信件'"), '寄出按钮 aria (v27)')
ok(src.includes('聊天坞服务暂不可用'), '寄信细分错误 (v45)')
ok(src.includes('pairingInFlight'), '过桥防抖 (v48)')
ok(src.includes('ow-garden-count'), '字数余量显示 (v87)')

// 8) P3 default_view 水合（无历史视图时：小白=园 / 主人默认=厅）
ok(hooks.includes("default_view") && hooks.includes("gardenOff"), 'default_view hydration (garden per config)')
ok(hooks.includes("dv === 'garden' && !gardenOff") || hooks.includes("dv === 'garden'&&!gardenOff") || hooks.includes("dv==='garden'"), 'garden default gated by worlds.garden flag')

console.log('\n--- SUMMARY ---')
console.log('passed:', passed, 'failed:', failed)
if (failed > 0) process.exit(1)
console.log('=== GARDEN VIEW ALL GREEN ===')
