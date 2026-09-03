#!/usr/bin/env node
/**
 * Refresh vendor copies from the machine's Downloads trees.
 * Skips node_modules / .git. Does not touch plugins.yml.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const WEB_UI_SRC = path.join(process.env.USERPROFILE || '', 'Downloads', 'dsh-web-ui-main', 'packages')
const WEB_UI_DST = path.join(ROOT, 'dsh-web-ui')

const WEB_UI_PKGS = [
  'dsh-web-ui-settings',
  'conversation-exporter',
  'workspace-analyzer',
  'dsh-task-board',
  'dsh-git-graph',
  'dsh-aionui-panel',
  'dsh-live-stats',
  'dsh-ssh',
  'dsh-tool-describe-image',
  'dsh-liangshen',
  'dsh-community-plugins',
  'notification-center',
  'dsh-pet',
  'dsh-remote-web-ui',
]

const EXTRA = [
  {
    src: path.join(process.env.USERPROFILE || '', 'Downloads', 'OpenViking-main', 'examples', 'dsh-memory-plugin'),
    dst: path.join(ROOT, 'openviking-dsh-memory'),
  },
  {
    src: path.join(process.env.USERPROFILE || '', 'Downloads', 'dsh-super-injector'),
    dst: path.join(ROOT, 'dsh-super-injector'),
  },
]

function robocopy(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn(`[skip] missing ${src}`)
    return false
  }
  fs.mkdirSync(dst, { recursive: true })
  const r = spawnSync(
    'robocopy',
    [src, dst, '/E', '/XD', 'node_modules', '.git', '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS'],
    { windowsHide: true, encoding: 'utf8' },
  )
  const code = r.status ?? 1
  if (code >= 8) throw new Error(`robocopy failed ${src} → ${dst} code=${code}`)
  console.log(`[ok] ${path.basename(dst)} (rc=${code})`)
  return true
}

let n = 0
for (const name of WEB_UI_PKGS) {
  if (robocopy(path.join(WEB_UI_SRC, name), path.join(WEB_UI_DST, name))) n++
}
for (const { src, dst } of EXTRA) {
  if (robocopy(src, dst)) n++
}
console.log(`synced ${n} trees → ${ROOT}`)
