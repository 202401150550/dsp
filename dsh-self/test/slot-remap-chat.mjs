#!/usr/bin/env node
/**
 * Regression: dsh-self slot-remap must not collapse keyed conversation.chat.node
 * entries that share an undefined id (was: 整页「未知 surface 事件」).
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'client.js'), 'utf8')

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

console.log('\n=== dsh-self slot-remap chat.node ===\n')

ok(!/const key = String\(mapped\) \+ ':' \+ String\(slotId\)/.test(src), 'old global seen key removed')
ok(src.includes('conversation.chat.node'), 'fix comment mentions chat.node')
ok(src.includes('shouldDedupe'), 'dedupe scoped via shouldDedupe')

const registered = []
const fakeSlots = {
  __dshSelfPatched: false,
  inject(name, factory) {
    try { return factory() } catch { return () => {} }
  },
  register(opts) {
    registered.push({ name: opts.name, key: opts.key, id: opts.id })
    return () => {}
  },
}

let applyFn = null
const sandbox = {
  window: {
    __ModuleLoader__: {
      load({ factory }) {
        const result = factory((id) => {
          if (id === 'react') {
            return {
              useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
              useEffect: () => {},
              useRef: () => ({ current: null }),
              createElement: () => null,
            }
          }
          throw new Error('unexpected require: ' + id)
        })
        applyFn = result.apply
      },
    },
    __dshSelfBodyGuard: false,
    dispatchEvent() {},
  },
  document: {
    body: {},
    documentElement: { appendChild() {} },
    getElementById() { return null },
    createElement() {
      return { style: {}, setAttribute() {}, appendChild() {} }
    },
    querySelectorAll() { return [] },
  },
  Element: { prototype: { appendChild() {}, append() {} } },
  fetch: () => Promise.reject(new Error('offline')),
  console,
  setTimeout,
  clearTimeout,
}

vm.runInNewContext(src, sandbox, { filename: 'client.js' })
ok(typeof applyFn === 'function', 'apply exported')

applyFn({
  slots: fakeSlots,
  effect: () => {},
  conversation: null,
  inject: null,
})

const kinds = ['user', 'steering', 'context', 'assistant-step', 'turn-process', 'turn-tail', 'unknown']
for (const key of kinds) {
  fakeSlots.register({ name: 'conversation.chat.node', key, locale: 'chat' }, () => null)
}
const chatRegs = registered.filter((r) => r.name === 'conversation.chat.node')
ok(chatRegs.length === kinds.length, `all ${kinds.length} chat.node keys registered (got ${chatRegs.length})`)
ok(new Set(chatRegs.map((r) => r.key)).size === kinds.length, 'chat.node keys unique')

// settings cards still dedupe by id
registered.length = 0
fakeSlots.register({ name: 'settings.plugin.item', id: 'dup', key: 'dup' }, () => null)
fakeSlots.register({ name: 'settings.plugin.item', id: 'dup', key: 'dup' }, () => null)
ok(registered.filter((r) => r.id === 'dup').length === 1, 'settings.plugin.item still deduped by id')

console.log(`\n=== slot-remap: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
