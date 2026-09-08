#!/usr/bin/env node
/**
 * 带 CDP 启动 DSH Desktop（冷启 / live 联调用）
 *
 * 用法：
 *   1) 完全退出当前 Desktop（托盘也要退）
 *   2) node scripts/launch-desktop-cdp.mjs
 *   3) npm run test:live
 *
 * 环境变量：
 *   OW_CDP_PORT=9333
 *   DSH_DESKTOP_EXE=...（可选，覆盖默认安装路径）
 */
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { connect } from 'node:net'

const PORT = Number(process.env.OW_CDP_PORT || 9333) || 9333
const candidates = [
  process.env.DSH_DESKTOP_EXE,
  `${process.env.LOCALAPPDATA || ''}\\Programs\\DSH Desktop\\DSH Desktop.exe`,
  'C:\\Users\\admin\\AppData\\Local\\Programs\\DSH Desktop\\DSH Desktop.exe',
].filter(Boolean)

const exe = candidates.find((p) => existsSync(p))
if (!exe) {
  console.error('✗ 找不到 DSH Desktop.exe')
  console.error('  设置 DSH_DESKTOP_EXE=完整路径 后重试')
  process.exit(2)
}

async function tcpOpen(port) {
  return new Promise((resolve) => {
    const sock = connect({ port, host: '127.0.0.1' })
    const t = setTimeout(() => { sock.destroy(); resolve(false) }, 250)
    sock.on('connect', () => { clearTimeout(t); sock.destroy(); resolve(true) })
    sock.on('error', () => { clearTimeout(t); resolve(false) })
  })
}

function desktopRunning() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq DSH Desktop.exe"', {
      encoding: 'utf8',
      windowsHide: true,
    })
    return /DSH Desktop\.exe/i.test(out)
  } catch {
    return false
  }
}

if (desktopRunning()) {
  console.error('⚠ 检测到 DSH Desktop 仍在运行（当前多半没有 --remote-debugging-port）')
  console.error('  请先完全退出（托盘图标右键退出），再跑本脚本')
  console.error(`  目标：${exe} --remote-debugging-port=${PORT}`)
  process.exit(3)
}

if (await tcpOpen(PORT)) {
  console.error(`⚠ 端口 ${PORT} 已被占用，换 OW_CDP_PORT 或先释放该口`)
  process.exit(4)
}

console.log(`启动：${exe}`)
console.log(`CDP：--remote-debugging-port=${PORT}`)
const child = spawn(exe, [`--remote-debugging-port=${PORT}`], {
  detached: true,
  stdio: 'ignore',
  windowsHide: false,
})
child.unref()

for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500))
  if (await tcpOpen(PORT)) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`, {
        signal: AbortSignal.timeout(800),
      })).json()
      const pages = (list || []).filter((t) => t.type === 'page')
      console.log(`✓ CDP 就绪 · page targets=${pages.length}`)
      console.log(`  下一步：cd dsh-open-world && npm run test:live`)
      process.exit(0)
    } catch {
      console.log(`· 端口 ${PORT} 已开，等待 DevTools 列表…`)
    }
  }
}

console.log('⚠ 已拉起进程，但 20s 内未见 CDP；稍等再访问')
console.log(`  http://127.0.0.1:${PORT}/json/list`)
process.exit(0)
