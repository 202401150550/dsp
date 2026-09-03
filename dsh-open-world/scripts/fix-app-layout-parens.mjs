#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const p = join(dirname(fileURLToPath(import.meta.url)), '..', 'client', 'modules', 'app-layout.js')
let s = readFileSync(p, 'utf8')

// Drop the wrapping `return (` … extra `)` — keep bare return createElement
s = s.replace(/return \(\n(\s+)React\.createElement/g, 'return React.createElement')

// After each function body, we had an extra closing paren before `    }`
// Pattern: createElement close `),` or `)` then lone `)` then `    }`
s = s.replace(/\n(\s+)\)\n(\s+)\)\n    \}/g, '\n$1)\n    }')

writeFileSync(p, s)
console.log('fixed')
