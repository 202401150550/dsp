#!/usr/bin/env node
/** Round 2 extract: hubs / views-space / neural from client-main */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mainPath = join(root, 'client', 'client-main.js')
const modulesDir = join(root, 'client', 'modules')

let main = readFileSync(mainPath, 'utf8')
if (main.includes("require('dsh-open-world/neural')")) {
  console.log('Round 2 already extracted — skip')
  process.exit(0)
}

const lines = main.split(/\r?\n/)

const hubStart = lines.findIndex((l) => l.includes('function MessageHub('))
const hubEnd = lines.findIndex((l, i) => i > hubStart && l.includes('function fmtClock('))
const webglIdx = lines.findIndex((l) => l.includes('const WEBGL_VS ='))
const deepStart = lines.findIndex((l) => l.includes('function DeepSpaceCanvas('))
const neuralConst = lines.findIndex((l) => l.includes('const DEFAULT_NEURAL_LAYERS ='))
const atiField = lines.findIndex((l) => l.includes('function AtiFieldCanvas('))
const archify = lines.findIndex((l) => l.includes('function ArchifyEmbed('))

if ([hubStart, hubEnd, webglIdx, deepStart, neuralConst, atiField, archify].some((n) => n < 0)) {
  throw new Error('range markers missing')
}

const hubSrc = lines.slice(hubStart, hubEnd).join('\n')
// WEBGL_VS through end of CenterGalaxy (= neuralConst)
const spaceSrc = [
  lines[webglIdx],
  ...lines.slice(deepStart, neuralConst),
  ...lines.slice(atiField, archify),
].join('\n')
const neuralSrc = lines.slice(neuralConst, atiField).join('\n')

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

writeFileSync(join(modulesDir, 'hubs.js'), wrap(
  'hubs',
  '',
  hubSrc,
  ['MessageHub', 'IntegrationsHub', 'RewindTimelinePanel'],
), 'utf8')

writeFileSync(join(modulesDir, 'views-space.js'), wrap(
  'views-space',
  `    const C = require('dsh-open-world/constants')
    const { NODE_ZH, NODE_LAYOUT } = C
`,
  spaceSrc,
  ['WEBGL_VS', 'DeepSpaceCanvas', 'CenterGalaxy', 'AtiFieldCanvas'],
), 'utf8')

writeFileSync(join(modulesDir, 'neural.js'), wrap(
  'neural',
  `    const C = require('dsh-open-world/constants')
    const { NEURAL_LAYOUT_KEY, NODE_ZH, NODE_LAYOUT } = C
`,
  neuralSrc,
  ['DEFAULT_NEURAL_LAYERS', 'bezierPoint', 'computeDefaultNeuralPositions', 'readNeuralLayout', 'NeuralGraph'],
), 'utf8')

// Remove ranges bottom-up; WEBGL alone; atiField block; neural block; deep-galaxy; hubs
const removes = [
  [atiField, archify],
  [neuralConst, atiField],
  [deepStart, neuralConst],
  [webglIdx, webglIdx + 1],
  [hubStart, hubEnd],
].sort((a, b) => b[0] - a[0])

let outLines = [...lines]
for (const [s, e] of removes) outLines.splice(s, e - s)

let out = outLines.join('\n')
out = out.replace(
  `    const Manifold = require('dsh-open-world/manifold')
    const React = require('react')`,
  `    const Manifold = require('dsh-open-world/manifold')
    const Hubs = require('dsh-open-world/hubs')
    const ViewsSpace = require('dsh-open-world/views-space')
    const Neural = require('dsh-open-world/neural')
    const React = require('react')`,
)

out = out.replace(
  `    const { MANIFOLD_SHAPES, Manifold3DCanvas } = Manifold`,
  `    const { MANIFOLD_SHAPES, Manifold3DCanvas } = Manifold
    const { MessageHub, IntegrationsHub, RewindTimelinePanel } = Hubs
    const { DeepSpaceCanvas, CenterGalaxy, AtiFieldCanvas } = ViewsSpace
    const { DEFAULT_NEURAL_LAYERS, NeuralGraph } = Neural`,
)

writeFileSync(mainPath, out, 'utf8')
console.log(JSON.stringify({
  hubs: hubEnd - hubStart,
  space: (neuralConst - deepStart) + (archify - atiField) + 1,
  neural: atiField - neuralConst,
  mainAfter: out.split(/\n/).length,
}, null, 2))
