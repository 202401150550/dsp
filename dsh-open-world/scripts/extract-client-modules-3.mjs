#!/usr/bin/env node
/** Round 3: extract ati-view + chrome from client-main */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mainPath = join(root, 'client', 'client-main.js')
const modulesDir = join(root, 'client', 'modules')

let main = readFileSync(mainPath, 'utf8')
if (main.includes("require('dsh-open-world/ati-view')")) {
  console.log('Round 3 already extracted — skip')
  process.exit(0)
}

const lines = main.split(/\r?\n/)
const spark = lines.findIndex((l) => l.includes('function Sparkline('))
const icon = lines.findIndex((l) => l.includes('function iconSvg('))
const openApp = lines.findIndex((l) => l.includes('function OpenWorldApp('))

if ([spark, icon, openApp].some((n) => n < 0)) throw new Error('markers missing')

const atiSrc = lines.slice(spark, icon).join('\n')
const chromeSrc = lines.slice(icon, openApp).join('\n')

function wrap(id, requireExtra, body, exportsList) {
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

writeFileSync(join(modulesDir, 'ati-view.js'), wrap(
  'ati-view',
  `    const C = require('dsh-open-world/constants')
    const { ATI_PRESETS, NODE_ZH, NODE_LAYOUT } = C
    const Shell = require('dsh-open-world/shell')
    const { sourceTag } = Shell
    const AtiLab = require('dsh-open-world/ati-lab')
    const { AtiStageRenderer } = AtiLab
`,
  atiSrc,
  ['Sparkline', 'SectorRadar', 'ArchifyEmbed', 'AtiCortex', 'groupClassForPreset', 'ResourceDonut'],
), 'utf8')

writeFileSync(join(modulesDir, 'chrome.js'), wrap(
  'chrome',
  `    const C = require('dsh-open-world/constants')
    const { APP_SURFACES, NODE_ZH, NODE_LAYOUT } = C
    const Shell = require('dsh-open-world/shell')
    const { EmbeddedAppSurface } = Shell
`,
  chromeSrc,
  [
    'iconSvg', 'Panel', 'exportSvgPng', 'useViewport', 'ViewportWrap',
    'CommandPalette', 'EmbeddedTaskPanel', 'renderEmbedSurface',
    'enterActionLabel', 'formatUsageMoney', 'NodeDetailCard',
  ],
), 'utf8')

let outLines = [...lines]
outLines.splice(spark, openApp - spark)
let out = outLines.join('\n')

out = out.replace(
  `    const Neural = require('dsh-open-world/neural')
    const React = require('react')`,
  `    const Neural = require('dsh-open-world/neural')
    const AtiView = require('dsh-open-world/ati-view')
    const Chrome = require('dsh-open-world/chrome')
    const React = require('react')`,
)

out = out.replace(
  `    const { DEFAULT_NEURAL_LAYERS, NeuralGraph } = Neural`,
  `    const { DEFAULT_NEURAL_LAYERS, NeuralGraph } = Neural
    const { Sparkline, SectorRadar, ArchifyEmbed, AtiCortex, ResourceDonut } = AtiView
    const {
      iconSvg, Panel, exportSvgPng, useViewport, ViewportWrap,
      CommandPalette, renderEmbedSurface, enterActionLabel, formatUsageMoney, NodeDetailCard,
    } = Chrome`,
)

// Drop unused AtiStageRenderer import from main if present
out = out.replace(
  `    const { AtiStageRenderer } = AtiLab\n`,
  '',
)

writeFileSync(mainPath, out, 'utf8')
console.log(JSON.stringify({
  atiView: icon - spark,
  chrome: openApp - icon,
  mainAfter: out.split(/\n/).length,
}, null, 2))
