#!/usr/bin/env node
/**
 * Extract LeftRail / CenterStage / RightRail from client-main into app-layout.js
 * and replace the blocks with component calls.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mainPath = join(root, 'client', 'client-main.js')
let src = readFileSync(mainPath, 'utf8')

const leftStart = src.indexOf("            React.createElement('div', { className: 'ow-side ow-side-left' },")
const centerStart = src.indexOf("            React.createElement('div', { className: 'ow-center' },")
const rightStart = src.indexOf("            React.createElement('div', { className: 'ow-side ow-side-right' },")
const bottomStart = src.indexOf("          React.createElement('div', { className: 'ow-bottom' },")

if (leftStart < 0 || centerStart < 0 || rightStart < 0 || bottomStart < 0) {
  console.error('markers missing', { leftStart, centerStart, rightStart, bottomStart })
  process.exit(1)
}

// bodies are the createElement(...) calls including trailing comma/newline before next sibling
const leftBody = src.slice(leftStart, centerStart).replace(/,\s*$/, '').trimEnd()
const centerBody = src.slice(centerStart, rightStart).replace(/,\s*$/, '').trimEnd()
const rightBody = src.slice(rightStart, bottomStart).replace(/,\s*$/, '').trimEnd()

const indentBody = (body) => body.split('\n').map((l) => (l ? `      ${l}` : l)).join('\n')

const mod = `// Open World · app-layout（左栏 / 中区 / 右栏，从 client-main 抽出）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/app-layout',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const C = require('dsh-open-world/constants')
    const Shell = require('dsh-open-world/shell')
    const Idea = require('dsh-open-world/idea')
    const Hubs = require('dsh-open-world/hubs')
    const AtiView = require('dsh-open-world/ati-view')
    const Chrome = require('dsh-open-world/chrome')
    const Runtime = require('dsh-open-world/runtime')

    const { NODE_ZH, NODE_LAYOUT, EVENT_COLORS, QUICK_ACTIONS } = C
    const {
      BridgeHealthBar, StatusSummaryChips, LeftSidebarTabs,
      SocialPanel, IntegrationsPanel, pluginAction, socialChannelAction,
      MemoryBrief, tierBadge, FleetPanel, sourceTag,
    } = Shell
    const { IdeaLabWorkspace } = Idea
    const { MessageHub, IntegrationsHub, RewindTimelinePanel } = Hubs
    const { Sparkline, SectorRadar, ArchifyEmbed, AtiCortex, ResourceDonut } = AtiView
    const {
      iconSvg, Panel, ViewportWrap, renderEmbedSurface, enterActionLabel, NodeDetailCard,
    } = Chrome
    const { taskProgress } = Runtime

    function LeftRail({
      leftTab, onLeftTab,
      snapshot, plugins, hist, health, healthCirc, loadRows, nodes,
      bridgeHealth, setBridgeHealth, checkBridgeCapabilities,
      runBridge, setEmbed, setToast,
      hub, handleEmbedArchify,
      idea, handleIdeaInject, handleIdeaCompare,
      events, social,
      mailbox, handleSendMessage, handleMarkRead, handleShareSnapshot,
      handleInjectAgent, handleSearchMemory,
    }) {
      return (
${indentBody(leftBody)}
      )
    }

    function CenterStage({
      view, setView,
      idea, handleIdeaInject, handleIdeaCompare, runBridge,
      viewport, nodes, synapses, ati, selected, setSelected, tick,
      atiPreset, onAtiPresetChange, pulseBoost, lab,
      archifyEmbed, setArchifyEmbed,
      detailOpen, setDetailOpen, selectedNode, selectedAction, activateSelectedAction,
      events, usage, embed, setEmbed, tasks, snapshot, plugins, hub, setToast, taskState,
    }) {
      return (
${indentBody(centerBody)}
      )
    }

    function RightRail({ nodes, tasks, runBridge }) {
      return (
${indentBody(rightBody)}
      )
    }

    module.exports = { LeftRail, CenterStage, RightRail }
    return module.exports
  },
})
`

writeFileSync(join(root, 'client', 'modules', 'app-layout.js'), mod, 'utf8')

const replacement = `            React.createElement(LeftRail, {
              leftTab, onLeftTab,
              snapshot, plugins, hist, health, healthCirc, loadRows, nodes,
              bridgeHealth, setBridgeHealth, checkBridgeCapabilities,
              runBridge, setEmbed, setToast,
              hub, handleEmbedArchify,
              idea, handleIdeaInject, handleIdeaCompare,
              events, social,
              mailbox, handleSendMessage, handleMarkRead, handleShareSnapshot,
              handleInjectAgent, handleSearchMemory,
            }),
            React.createElement(CenterStage, {
              view, setView,
              idea, handleIdeaInject, handleIdeaCompare, runBridge,
              viewport, nodes, synapses, ati, selected, setSelected, tick,
              atiPreset, onAtiPresetChange, pulseBoost, lab,
              archifyEmbed, setArchifyEmbed,
              detailOpen, setDetailOpen, selectedNode, selectedAction, activateSelectedAction,
              events, usage, embed, setEmbed, tasks, snapshot, plugins, hub, setToast, taskState,
            }),
            React.createElement(RightRail, { nodes, tasks, runBridge }),
`

src = src.slice(0, leftStart) + replacement + src.slice(bottomStart)

// inject require + destructure
const injectAfter = `    const Styles = require('dsh-open-world/styles')
    const Runtime = require('dsh-open-world/runtime')
`
const inject = `    const Styles = require('dsh-open-world/styles')
    const Runtime = require('dsh-open-world/runtime')
    const AppLayout = require('dsh-open-world/app-layout')
`
if (!src.includes(injectAfter)) {
  console.error('require inject marker missing')
  process.exit(1)
}
src = src.replace(injectAfter, inject)

const destAfter = `    } = Runtime
`
const dest = `    } = Runtime
    const { LeftRail, CenterStage, RightRail } = AppLayout
`
if (!src.includes(destAfter)) {
  console.error('destructure marker missing')
  process.exit(1)
}
src = src.replace(destAfter, dest)

writeFileSync(mainPath, src, 'utf8')
console.log('app-layout written; client-main lines', src.split('\\n').length)
