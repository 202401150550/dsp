#!/usr/bin/env node
/** v102 对比度自动审计：styles.js 令牌 → WCAG 对比度表（可及性 v64+ 的证据化工具） */
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../client/modules/styles.js', import.meta.url), 'utf8')
function lum(hex) {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
const tokens = {}
for (const m of src.matchAll(/(--ow-[a-z0-9-]+):(#[0-9a-fA-F]{3,6})/g)) if (!(m[1] in tokens)) tokens[m[1]] = m[2] // first-wins：只审默认主题（后续为绿/青/白主题变体，各配各底）
const texts = Object.keys(tokens).filter((k) => /text|accent/.test(k))
const bgs = Object.keys(tokens).filter((k) => /bg|panel|deep/.test(k))
const rows = []
let flagged = 0
for (const t of texts) for (const b of bgs) {
  const r = Math.round(ratio(tokens[t], tokens[b]) * 100) / 100
  const pass = r >= 4.5
  if (!pass) flagged += 1
  rows.push(String(r).padEnd(6) + (pass ? 'PASS' : 'flag') + '  ' + t + ' (' + tokens[t] + ') on ' + b + ' (' + tokens[b] + ')')
}
const out = ['对比度审计 · ' + new Date().toISOString(), '令牌 ' + Object.keys(tokens).length + ' · 组合 ' + rows.length + ' · 低于 4.5 的 ' + flagged + ' 项（装饰用途可豁免，正文用色需处理）', '', ...rows].join('\n')
fs.writeFileSync(new URL('../../_scratch/contrast-report.txt', import.meta.url), out + '\n')
console.log('contrast audit written; combos=' + rows.length + ' flagged=' + flagged)
