#!/usr/bin/env node
import { createBridge, BRIDGE_CAPABILITY_MAP, describeBridgeStrategy, summarizeBridgeSurface } from '../bridge/execute.mjs'

let passed = 0
let failed = 0

function ok(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

console.log('\n=== bridge/execute.mjs ===\n')

const sent = []
const bridge = createBridge({
  getSessionsBridge: () => ({
    list: { getSnapshot: () => ({ current: 's1' }) },
    scope: () => ({
      get: () => ({
        send: async (text) => { sent.push(text) },
      }),
    }),
    binding: () => ({
      session: {
        command: async (cmd) => ({ ok: true, value: { matched: true, cmd } }),
      },
    }),
  }),
  postTaskAction: async (a) => ({ ok: true, action: a }),
  notifyPulse: () => {},
  storage: {
    _data: {},
    getItem(k) { return this._data[k] || null },
    setItem(k, v) { this._data[k] = v },
  },
  querySelector: () => null,
  querySelectorAll: () => [],
})

ok(typeof bridge.bridgeExecute === 'function', 'createBridge returns bridgeExecute')
ok(BRIDGE_CAPABILITY_MAP['inject-message'] === 'inject-message', 'capability map')

const health = bridge.checkBridgeCapabilities()
ok(health['inject-message'].strategy === 'session-api', 'inject strategy session-api when conversation.send exists')
ok(health['inject-message'].tier === 'api', 'inject tier api')
ok(health['inject-message'].labelZh && health['inject-message'].degraded === false, 'inject enriched labels')
ok(health.settings.strategy === 'event' && health.settings.degraded === false, 'settings probe defaults to event')
ok(health.surface && typeof health.surface.api === 'number', 'surface summary attached')
ok(Array.isArray(health.surface.stillDom), 'surface.stillDom list')
ok(describeBridgeStrategy('dom').degraded === true, 'describeBridgeStrategy dom')
ok(describeBridgeStrategy('api').tier === 'api', 'describeBridgeStrategy api')
ok(describeBridgeStrategy('session-open').tier === 'api', 'session-open counts as api')
ok(describeBridgeStrategy('session-setCurrent').degraded === false, 'session-setCurrent not degraded')
ok(summarizeBridgeSurface(health).degraded >= 1, 'surface marks degraded caps')
ok(!summarizeBridgeSurface(health).stillDom.includes('settings'), 'settings not in stillDom by default')

const focused = []
const focusBridge = createBridge({
  getSessionsBridge: () => ({
    list: {
      getSnapshot: () => ({ current: 's1' }),
      setCurrent: (id) => { focused.push(id) },
    },
    binding: () => ({ session: {} }),
    scope: () => ({ get: () => null }),
  }),
  postTaskAction: async () => ({ ok: true }),
  storage: {
    _data: {},
    getItem(k) { return this._data[k] || null },
    setItem(k, v) { this._data[k] = v },
  },
  querySelector: () => null,
  querySelectorAll: () => [],
})
const focusHealth = focusBridge.checkBridgeCapabilities()
ok(focusHealth['session-focus'].strategy === 'session-api', 'session-focus detects setCurrent')
await focusBridge.bridgeExecute(
  { type: 'session-focus', sessionId: 's9' },
  { onClose: () => {}, setView: () => {}, setToast: () => {} },
)
ok(focused[0] === 's9', 'session-focus via setCurrent')

const afterFocus = focusBridge.readBridgeHealth()
ok(afterFocus && afterFocus.outcomes && afterFocus.outcomes._last, 'outcome _last recorded')
ok(afterFocus.outcomes['session-focus'].ok === true, 'session-focus outcome ok')
ok(String(afterFocus.outcomes['session-focus'].strategy || '').includes('session'), 'session-focus outcome strategy')

await bridge.bridgeExecute(
  { type: 'inject-message', body: 'hello bridge test' },
  { onClose: () => {}, setView: () => {}, setToast: () => {} },
)
ok(sent[0] === 'hello bridge test', 'inject-message via session path')
const afterInject = bridge.readBridgeHealth()
ok(afterInject.outcomes['inject-message'].ok === true, 'inject outcome ok')
ok(afterInject.outcomes['inject-message'].strategy === 'session-api', 'inject outcome strategy')

const rewind = await bridge.execRewindViaSession(42, 'chat')
ok(rewind.ok === true, 'execRewindViaSession ok')

// 探针说 session、实跑走 DOM → probeStale
const staleStore = {
  _data: {},
  getItem(k) { return this._data[k] || null },
  setItem(k, v) { this._data[k] = v },
}
const staleBridge = createBridge({
  getSessionsBridge: () => null,
  postTaskAction: async () => ({ ok: true }),
  storage: staleStore,
  querySelector: () => ({
    focus() {},
    value: '',
    dispatchEvent() { return true },
  }),
  querySelectorAll: () => [],
})
staleStore.setItem('ow-bridge-health', JSON.stringify({
  testedAt: Date.now(),
  'inject-message': { strategy: 'session-api' },
  outcomes: {},
}))
staleBridge.recordBridgeOutcome('inject-message', { ok: true, strategy: 'dom' })
const staleHealth = JSON.parse(staleStore.getItem('ow-bridge-health'))
ok(staleHealth.outcomes['inject-message'].probeStale === true, 'probeStale when session probe but dom run')

const embeds = []
const toasts = []
await bridge.bridgeExecute(
  { type: 'panel', panel: 'fleet', label: '舰队' },
  { onClose: () => {}, setView: () => {}, setToast: (t) => toasts.push(t), setEmbed: (p) => embeds.push(p) },
)
ok(embeds[0] === 'fleet', 'panel prefers embed')
const afterPanel = bridge.readBridgeHealth()
ok(afterPanel.outcomes.panel && afterPanel.outcomes.panel.strategy === 'embed', 'panel embed outcome')

const selCalls = []
const settingsOnly = createBridge({
  getSessionsBridge: () => null,
  postTaskAction: async () => ({ ok: true }),
  delay: async () => {},
  storage: {
    _data: {},
    getItem(k) { return this._data[k] || null },
    setItem(k, v) { this._data[k] = v },
  },
  querySelector: (sel) => { selCalls.push(sel); return null },
  querySelectorAll: () => { selCalls.push('*'); return [] },
  dispatchEvent: () => true,
})
await settingsOnly.bridgeExecute(
  { type: 'settings', label: '设置' },
  { onClose: () => {}, setView: () => {}, setToast: () => {} },
)
ok(selCalls.length === 0, 'settings without hint skips DOM scrape')
ok(settingsOnly.readBridgeHealth().outcomes.settings.strategy === 'event', 'settings plain → event outcome')

const hintClicks = []
const settingsHint = createBridge({
  getSessionsBridge: () => null,
  postTaskAction: async () => ({ ok: true }),
  delay: async () => {},
  storage: {
    _data: {},
    getItem(k) { return this._data[k] || null },
    setItem(k, v) { this._data[k] = v },
  },
  querySelector: () => ({ click() { hintClicks.push('btn') } }),
  querySelectorAll: () => [{ textContent: 'Market', click() { hintClicks.push('tab') } }],
  dispatchEvent: () => true,
})
await settingsHint.bridgeExecute(
  { type: 'settings', label: '插件市场', settingsHint: 'Market' },
  { onClose: () => {}, setView: () => {}, setToast: () => {} },
)
ok(hintClicks.length >= 1, 'settings with hint may use DOM')
ok(settingsHint.readBridgeHealth().outcomes.settings.strategy === 'event+dom', 'settings hint → event+dom')

const rewindEmbeds = []
await bridge.bridgeExecute(
  { type: 'rewind-open', label: '打开 /rewind' },
  { onClose: () => {}, setView: () => {}, setToast: () => {}, setEmbed: (p) => rewindEmbeds.push(p) },
)
ok(rewindEmbeds[0] === 'rewind', 'rewind-open defaults to embed')
ok(bridge.readBridgeHealth().outcomes['rewind-exec'].strategy === 'embed', 'rewind-open embed outcome')

const rewindPrompts = []
const rewindChat = createBridge({
  getSessionsBridge: () => ({
    list: { getSnapshot: () => ({ current: 's1' }) },
    scope: () => ({ get: () => null }),
    binding: () => ({
      session: {
        prompt: async (t) => { rewindPrompts.push(t) },
        command: async () => ({ ok: false }),
      },
    }),
  }),
  postTaskAction: async () => ({ ok: true }),
  delay: async () => {},
  storage: {
    _data: {},
    getItem(k) { return this._data[k] || null },
    setItem(k, v) { this._data[k] = v },
  },
  querySelector: () => null,
  querySelectorAll: () => [],
})
await rewindChat.bridgeExecute(
  { type: 'rewind-open', preferChat: true },
  { onClose: () => {}, setView: () => {}, setToast: () => {}, setEmbed: () => {} },
)
ok(rewindPrompts[0] === '/rewind', 'preferChat uses session.prompt')
ok(rewindChat.readBridgeHealth().outcomes['rewind-exec'].strategy === 'session-prompt', 'preferChat session-prompt outcome')

console.log(`\n=== bridge: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
