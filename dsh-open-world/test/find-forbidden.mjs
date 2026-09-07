#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = [
  'C:/Users/admin/AppData/Local/Programs/DSH Desktop/resources/app.asar.unpacked/node_modules',
  'C:/Users/admin/.dsh/profiles/desktop/node_modules/@deepseek-ai',
]

function walk(dir, depth, acc) {
  if (depth < 0) return
  let ents = []
  try { ents = readdirSync(dir) } catch { return }
  for (const name of ents) {
    const p = join(dir, name)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) {
      if (name === '.git') continue
      walk(p, depth - 1, acc)
    } else if (/\.(js|mjs|cjs)$/.test(name) && st.size < 3e6) acc.push(p)
  }
}

const files = []
for (const r of roots) walk(r, 5, files)
console.log('scanning', files.length)
let n = 0
for (const f of files) {
  let t = ''
  try { t = readFileSync(f, 'utf8') } catch { continue }
  if (!t.includes('forbidden')) continue
  if (!(t.includes('text/plain') || t.includes("end('forbidden')") || t.includes('writeHead(403'))) continue
  console.log('HIT', f)
  n++
  if (n >= 20) break
}
console.log('hits', n)
