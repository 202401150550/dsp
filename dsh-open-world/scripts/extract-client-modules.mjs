#!/usr/bin/env node
/**
 * One-shot: extract IdeaLab / AtiLab / Manifold from client-main into modules.
 * Idempotent if markers already present.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mainPath = join(root, 'client', 'client-main.js')
const modulesDir = join(root, 'client', 'modules')

let main = readFileSync(mainPath, 'utf8')
if (main.includes("require('dsh-open-world/idea')")) {
  console.log('Already extracted — skip')
  process.exit(0)
}

const lines = main.split(/\r?\n/)

function findRange(startPat, endPat) {
  let start = -1
  let end = -1
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && startPat.test(lines[i])) start = i
    if (start >= 0 && endPat.test(lines[i])) {
      // end is exclusive: line after matching end line that closes the function
      // For "function X" ... next "function Y" or const after block
      end = i
      break
    }
  }
  return { start, end }
}

// IdeaLab: from function IdeaLabWorkspace to just before function fmtClock
let ideaStart = lines.findIndex((l) => l.includes('function IdeaLabWorkspace('))
let ideaEnd = lines.findIndex((l, i) => i > ideaStart && l.includes('function fmtClock('))
if (ideaStart < 0 || ideaEnd < 0) throw new Error('IdeaLab range not found')

// Ati lab helpers: hexRing through AtiStageRenderer (inclusive)
let labStart = lines.findIndex((l) => l.includes('function hexRing('))
let labEnd = lines.findIndex((l, i) => i > labStart && l.includes('function AtiFieldCanvas('))
if (labStart < 0 || labEnd < 0) throw new Error('AtiLab range not found')

// Manifold: MANIFOLD_VS through Manifold3DCanvas end, before ArchifyEmbed
let manStart = lines.findIndex((l) => l.includes('const MANIFOLD_VS ='))
let manEnd = lines.findIndex((l, i) => i > manStart && l.includes('function ArchifyEmbed('))
if (manStart < 0 || manEnd < 0) throw new Error('Manifold range not found')

const ideaSrc = lines.slice(ideaStart, ideaEnd).join('\n').replace(/^    /gm, '    ')
const labSrc = lines.slice(labStart, labEnd).join('\n')
const manSrc = lines.slice(manStart, manEnd).join('\n')

function wrapModule(id, requireExtra, body, exportsList) {
  return `// Open World · ${id}
window.__ModuleLoader__.load({
  id: 'dsh-open-world/${id}',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React
${requireExtra}
${body}
    module.exports = {
${exportsList.map((e) => `      ${e},`).join('\n')}
    }
    return module.exports
  },
})
`
}

const ideaMod = wrapModule(
  'idea',
  '',
  ideaSrc,
  ['IdeaLabWorkspace'],
)

const labMod = wrapModule(
  'ati-lab',
  `    const C = require('dsh-open-world/constants')
    const { DL_STACK, ACI_PHASES, ATI_STAGES_FALLBACK } = C
`,
  labSrc,
  [
    'hexRing', 'labLerp', 'quadPoint', 'clamp01',
    'TopoTorus', 'TopoMobius', 'TopoKlein', 'TopoPoincare',
    'MlGradientStage', 'DlAttentionStage', 'ChemMolecularStage', 'PeriodicLatticeStage',
    'AtiEvolutionStage', 'AciLoopStage', 'AtiStageRenderer',
  ],
)

const manMod = wrapModule(
  'manifold',
  '',
  manSrc,
  ['MANIFOLD_SHAPES', 'generateManifoldPoints', 'Manifold3DCanvas'],
)

writeFileSync(join(modulesDir, 'idea.js'), ideaMod, 'utf8')
writeFileSync(join(modulesDir, 'ati-lab.js'), labMod, 'utf8')
writeFileSync(join(modulesDir, 'manifold.js'), manMod, 'utf8')

// Remove ranges from bottom to top
const remove = [
  [manStart, manEnd],
  [labStart, labEnd],
  [ideaStart, ideaEnd],
]
remove.sort((a, b) => b[0] - a[0])
let outLines = [...lines]
for (const [s, e] of remove) {
  outLines.splice(s, e - s)
}

let out = outLines.join('\n')

// Wire requires after Shell require
out = out.replace(
  `    const Shell = require('dsh-open-world/shell')
    const React = require('react')`,
  `    const Shell = require('dsh-open-world/shell')
    const Idea = require('dsh-open-world/idea')
    const AtiLab = require('dsh-open-world/ati-lab')
    const Manifold = require('dsh-open-world/manifold')
    const React = require('react')`,
)

out = out.replace(
  `    const {
      BridgeHealthBar, sourceTag, StatusSummaryChips, LeftSidebarTabs,
      SocialPanel, IntegrationsPanel, pluginAction, socialChannelAction,
      SidebarSummaryView, MemoryBrief, tierBadge, WindowModeBar, ShellDock, EmbeddedAppSurface, FleetPanel,
    } = Shell`,
  `    const {
      BridgeHealthBar, sourceTag, StatusSummaryChips, LeftSidebarTabs,
      SocialPanel, IntegrationsPanel, pluginAction, socialChannelAction,
      SidebarSummaryView, MemoryBrief, tierBadge, WindowModeBar, ShellDock, EmbeddedAppSurface, FleetPanel,
    } = Shell
    const { IdeaLabWorkspace } = Idea
    const { AtiStageRenderer } = AtiLab
    const { MANIFOLD_SHAPES, Manifold3DCanvas } = Manifold`,
)

writeFileSync(mainPath, out, 'utf8')
console.log(JSON.stringify({
  ideaLines: ideaEnd - ideaStart,
  labLines: labEnd - labStart,
  manLines: manEnd - manStart,
  mainBefore: lines.length,
  mainAfter: out.split(/\n/).length,
}, null, 2))
