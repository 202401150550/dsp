#!/usr/bin/env node
/** 从 client.js 生成 client/client-main.js（去掉已抽到 modules 的段落） */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let src = readFileSync(join(root, 'client.js'), 'utf8')

// 去掉文件头，主入口保留
src = src.replace(/^\/\/ dsh-open-world[^\n]*\n/, '')

const factoryNeedle = `    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React

    const SNAPSHOT_URL`

const factoryReplace = `    const C = require('dsh-open-world/constants')
    const BridgeLib = require('dsh-open-world/bridge')
    const Shell = require('dsh-open-world/shell')
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React

    const {
      SNAPSHOT_URL, TASK_BOARD_URL, POLL_MS, CLIENT_VER, ACTION_URL, PULSE_URL,
      OW_ACTION_URL, MESSAGES_URL, STREAM_URL, MEMORY_SEARCH_URL, INTEGRATIONS_URL,
      DEEPSEEK_USAGE_URL, NEURAL_LAYOUT_KEY, ATI_PRESET_KEY, LEFT_TAB_KEY,
      ATI_PRESETS, ACI_PHASES, ATI_STAGES_FALLBACK, DL_STACK, NODE_ZH, NODE_LAYOUT,
      EVENT_COLORS, LOAD_COLORS, QUICK_ACTIONS,
    } = C
    const {
      BridgeHealthBar, sourceTag, StatusSummaryChips, LeftSidebarTabs,
      SocialPanel, IntegrationsPanel, pluginAction, socialChannelAction,
      SidebarSummaryView,
    } = Shell

    const SNAPSHOT_URL__REMOVE`

if (!src.includes(factoryNeedle.split('\n')[0])) {
  console.error('client.js factory header not found — already migrated?')
  process.exit(1)
}

// 删除常量块（SNAPSHOT_URL 到 LOAD_COLORS 后的空行）
src = src.replace(
  /    const SNAPSHOT_URL[\s\S]*?const LOAD_COLORS = \[[^\]]+\]\n\n/,
  '',
)

// 在 postTaskAction 之前插入 bridge 绑定
const bridgeInsert = `    let sessionsBridge = null

    function notifyPulse(edges) {
      if (!edges || edges.length === 0) return
      fetch(PULSE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ edges }),
      }).catch(() => {})
    }

    const {
      bridgeExecute, readBridgeHealth, checkBridgeCapabilities,
    } = BridgeLib.createBridge({
      getSessionsBridge: () => sessionsBridge,
      postTaskAction,
      notifyPulse,
    })

`

src = src.replace(
  /    async function postTaskAction\(action\) \{/,
  `${bridgeInsert}    async function postTaskAction(action) {`,
)

// 删除旧 bridge 块（从 BRIDGE 注释到 bridgeExecute 结束）
src = src.replace(
  /    \/\/ ── Bridge 辅助层[\s\S]*?    async function bridgeExecute\(action, ctx\) \{[\s\S]*?    \}\n\n    async function postOpenWorldAction/,
  '    async function postOpenWorldAction',
)

// 删除 shell 组件（StatusSummaryChips 到 IntegrationsPanel 后 QUICK_ACTIONS）
src = src.replace(
  /    function StatusSummaryChips\([\s\S]*?    function IntegrationsPanel\([\s\S]*?    \}\n\n    const QUICK_ACTIONS = \[[\s\S]*?    \]\n\n/,
  '',
)

// 删除重复的 sourceTag（AtiCortex 前）
src = src.replace(
  /    function sourceTag\(source\) \{\n      if \(source === 'metaphor'\) \{[\s\S]*?      return null\n    \}\n\n    function AtiCortex/,
  '    function AtiCortex',
)

// 删除后面重复的 notifyPulse
src = src.replace(
  /    function notifyPulse\(edges\) \{\n      if \(!edges \|\| edges\.length === 0\) return\n      fetch\(PULSE_URL,[\s\S]*?    \}\n\n    function exportSvgPng/,
  '    function exportSvgPng',
)

// 包装为 main loader
const main = `window.__ModuleLoader__.load({
  id: 'dsh-open-world',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
${src.replace(/^window\.__ModuleLoader__\.load\(\{\n  id: 'dsh-open-world',\n  factory: \(require\) => \{\n    const module = \{ exports: \{\} \}\n    const exports = module\.exports\n    Object\.defineProperty\(exports, Symbol\.toStringTag, \{ value: 'Module' \}\)\n\n/, '')}`

// Fix: the src still has outer wrapper - let me re-read approach

writeFileSync(join(root, 'client', 'client-main.js'), main, 'utf8')
console.log('Wrote client/client-main.js — review before compose')
