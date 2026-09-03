#!/usr/bin/env node
/** One-shot: extract CSS + leave runtime helpers for manual module */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mainPath = join(root, 'client', 'client-main.js')
const src = readFileSync(mainPath, 'utf8')

const startMark = '    const CSS = `'
const endMark = '`\n\n    async function postTaskAction'
const start = src.indexOf(startMark)
const end = src.indexOf(endMark)
if (start < 0 || end < 0) {
  console.error('CSS markers not found', { start, end })
  process.exit(1)
}
const cssBody = src.slice(start + startMark.length, end)

const stylesMod = `// Open World · styles（从 client-main 抽出）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/styles',
  factory: () => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const CSS = \`${cssBody}\`
    module.exports = { CSS }
    return module.exports
  },
})
`
writeFileSync(join(root, 'client', 'modules', 'styles.js'), stylesMod, 'utf8')
console.log('Wrote styles.js, css chars', cssBody.length)
