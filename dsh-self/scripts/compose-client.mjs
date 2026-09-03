#!/usr/bin/env node
/** Compose dsh-self/client.js from organ modules + client-main.js */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DSP = join(ROOT, '..')
const OUT = join(ROOT, 'client.js')

const ORGAN_SOURCES = [
  {
    src: join(DSP, 'dsh-file-drop', 'client.js'),
    from: "'dsh-file-drop'",
    to: "'dsh-self/file-drop'",
  },
  {
    src: join(DSP, 'dsh-plugin-smooth-stream', 'lib', 'client.js'),
    from: "'dsh-plugin-smooth-stream'",
    to: "'dsh-self/smooth-stream'",
  },
  {
    src: join(DSP, 'dsh-deepseek-usage-patch', 'client.js'),
    from: '"dsh-deepseek-usage"',
    to: '"dsh-self/usage"',
  },
]

function patchOrgan(src, from, to) {
  return src.replace(from, to)
}

const parts = [
  '// dsh-self · Client — composed (npm run build:client)',
  '// Organs: file-drop · smooth-stream · usage',
  '',
]

for (const { src, from, to } of ORGAN_SOURCES) {
  if (!existsSync(src)) {
    console.warn(`[compose] skip missing ${src}`)
    continue
  }
  parts.push(patchOrgan(readFileSync(src, 'utf8'), from, to))
  parts.push('')
}

const mainPath = join(ROOT, 'client', 'client-main.js')
if (!existsSync(mainPath)) {
  throw new Error(`missing ${mainPath}`)
}
parts.push(readFileSync(mainPath, 'utf8'))

writeFileSync(OUT, `${parts.join('\n')}\n`, 'utf8')
console.log(`Wrote ${OUT} (${ORGAN_SOURCES.length + 1} sections)`)
