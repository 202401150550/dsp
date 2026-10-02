#!/usr/bin/env node
// Optional external boot plugin integration: absence is a failure, not a skip.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
let passed=0, failed=0
function ok(value,label){ if(value){passed++;console.log('PASS '+label)}else{failed++;console.error('FAIL '+label)} }
// 4c) v11-v14（优化版次）：550c 三修复贯通 src→lib
const c550 = fs.readFileSync(path.join(REPO, '..', '_scratch', 'dsh-550c-boot', 'lib', 'client.js'), 'utf8')
ok(c550.includes('播完才进门') && c550.includes('dsh550c-skip-hint'), '550c lib: 播完才进门 + 跳过角标在位 (v11)')
ok(c550.includes('prefers-reduced-motion') && c550.includes('减弱动态'), '550c lib: reduced-motion 双处贯通 (v12)')
ok(c550.includes('mountedAt') && c550.includes('650'), '550c lib: 650ms 防误触在位')
const s550 = fs.readFileSync(path.join(REPO, '..', '_scratch', 'dsh-550c-boot', 'src', 'client.js'), 'utf8')
ok((s550.match(/resolve\(\{ played: true \}\)/g) || []).length === 1, '550c src: resolve 仅 dispose 一处')

const p550meta = JSON.parse(fs.readFileSync(path.join(REPO, '..', '_scratch', 'dsh-550c-boot', 'package.json'), 'utf8'))
ok(p550meta.version === '0.1.3' && p550meta.description.includes('跳过'), '550c v0.1.3 + 描述更新 (v79/v80)')
console.log(`boot-integration: ${passed} passed, ${failed} failed`)
process.exitCode=failed?1:0
