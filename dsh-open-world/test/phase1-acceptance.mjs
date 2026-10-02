#!/usr/bin/env node
/**
 * Phase 1 守成验收（CDP + 本地静态）。
 * 对应 ARCHITECTURE_PLAN §11 P1-1 / P1-2 / P1-5；P1-3/P1-6 由 check:client 与 test:live-cdp 承担。
 *
 *   Desktop --remote-debugging-port=9333
 *   node test/phase1-acceptance.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'
import { freshnessReport, ROOT } from '../scripts/client-build-meta.mjs'
import { HOST_ACTION_IDS, actionLayersSummary } from '../bridge/action-layers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CDP = (process.env.OW_CDP_URL || 'http://127.0.0.1:9333').replace(/\/$/, '')
const EXPECT_VER = '2.78'

let passed = 0
let failed = 0
function ok(cond, msg, detail = '') {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${msg}`)
  } else {
    failed += 1
    console.error(`  ✗ ${msg}${detail ? ` — ${detail}` : ''}`)
  }
}

async function connectPage() {
  const list = await (await fetch(`${CDP}/json/list`)).json()
  const page = list.find((t) => t.type === 'page' && /127\.0\.0\.1:\d+/.test(t.url || ''))
    || list.find((t) => t.type === 'page')
  if (!page?.webSocketDebuggerUrl) throw new Error(`CDP 无 page · ${CDP}`)
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej) })
  let id = 0
  function send(method, params = {}) {
    const mid = ++id
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout ${method}`)), 25000)
      function onMsg(data) {
        const msg = JSON.parse(data.toString())
        if (msg.id !== mid) return
        clearTimeout(t)
        ws.off('message', onMsg)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
      ws.on('message', onMsg)
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
  }
  return { page, ws, send }
}

console.log('\n=== Phase 1 acceptance ===\n')

console.log('P1-3 / P1-5 static')
{
  const fresh = freshnessReport()
  ok(fresh.ok === true, `check:client fresh · build=${fresh.expected}`)
  ok(String(fresh.clientVer || '').includes(EXPECT_VER) || fresh.clientVer === `v${EXPECT_VER}`,
    `clientVer=${fresh.clientVer}`)

  const docs = ['QUICKSTART.md', 'SYSOP_v0.1.md', 'CHECKLIST.md', 'package.json', 'dsh.plugin.json']
  for (const name of docs) {
    const p = join(ROOT, name)
    ok(existsSync(p), `doc exists ${name}`)
    const text = readFileSync(p, 'utf8')
    ok(text.includes(EXPECT_VER) || text.includes(`v${EXPECT_VER}`), `${name} mentions ${EXPECT_VER}`)
  }
  const qs = readFileSync(join(ROOT, 'QUICKSTART.md'), 'utf8')
  ok(/日常三步/.test(qs), 'QUICKSTART has 日常三步')
  ok(/状态[\s\S]{0,80}任务[\s\S]{0,80}事件|左栏看状态/.test(qs), 'QUICKSTART daily path mentions 状态/任务/事件')
}

console.log('\nP1-4 host action registry')
{
  const summary = actionLayersSummary()
  ok(Array.isArray(summary.host?.actions) && summary.host.actions.length >= 10, 'actionLayers host.actions')
  const ids = new Set(summary.host.actions)
  let missing = 0
  for (const id of HOST_ACTION_IDS) {
    if (!ids.has(id)) missing += 1
  }
  ok(missing === 0 && ids.size === HOST_ACTION_IDS.length, `HOST_ACTION_IDS ↔ actionLayers 一一对应 (missing=${missing})`)
  ok(HOST_ACTION_IDS.includes('world-enter') && HOST_ACTION_IDS.includes('send-message'), 'core host actions present')
}

console.log('\nP1-1 / P1-2 live CDP (状态三问 + 世界地图)')
let ws
let cdpUnavailable = false
try {
  const conn = await connectPage()
  ws = conn.ws
  const send = conn.send
  console.log(`CDP page: ${conn.page.url}`)

  const evalJson = async (expression) => {
    const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails))
    return r.result?.value
  }

  const started = Date.now()
  const ui = await evalJson(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const shellRoot = () => [...document.querySelectorAll('.ow-overlay.ow-root')]
      .find((el) => el.querySelector('.ow-shell'))
    const openShell = async () => {
      for (let i = 0; i < 10; i++) {
        const root = shellRoot()
        if (root && !root.classList.contains('is-minimized')) return true
        const opener = document.querySelector('.ow-dock-chip') || document.querySelector('button.ow-trigger')
        if (opener) opener.click()
        await sleep(600)
      }
      return !!shellRoot()
    }
    const clickTab = async (re) => {
      const root = shellRoot()
      const tabs = [...(root?.querySelectorAll('.ow-side-tab') || [])]
      const t = tabs.find((el) => re.test(el.innerText || ''))
      if (!t) return false
      t.click()
      await sleep(500)
      return true
    }
    await openShell()

    // 三问 1：状态
    await clickTab(/状态/)
    const statusText = shellRoot()?.innerText || ''
    const q1 = {
      health: /健康|health|负载|Bridge|连接/i.test(statusText),
      map: !!document.querySelector('[data-ow-world-map]') || /世界地图|进入\\s*·\\s*任务/.test(statusText),
      watermark: /OPEN-WORLD\\s+v2\\.\\d+/.test(statusText),
    }

    // 三问 2：动作
    await clickTab(/动作/)
    const actionText = shellRoot()?.innerText || ''
    const q2 = {
      actions: /扩展|回退|说话风格|系统调用|更多/i.test(actionText),
      rewindOrExt: /回退|Rewind|扩展/i.test(actionText),
    }

    // 三问 3：事件
    await clickTab(/事件/)
    const eventText = shellRoot()?.innerText || ''
    const q3 = {
      events: /事件|日志|信箱|消息|mailbox/i.test(eventText),
    }

    // 世界地图：回状态后点任务 / 回退入口
    await clickTab(/状态/)
    const enter = document.querySelector('[data-ow-enter-world]')
      || [...(shellRoot()?.querySelectorAll('button,[role=button]') || [])]
        .find((el) => /进入\\s*·\\s*任务|进入任务/.test((el.innerText || '').replace(/\\s+/g, '')))
    if (enter) { enter.click(); await sleep(800) }
    const afterEnter = (shellRoot()?.innerText || document.body.innerText || '')
    const enteredOrHonest = /任务|task-board|返回开放世界|如何启用|未启用|离线/i.test(afterEnter)

    // 尝试回退入口（动作页或地图）
    await clickTab(/动作/)
    const rewindBtn = [...(shellRoot()?.querySelectorAll('button,[role=button],div') || [])]
      .find((el) => /回退|Rewind/.test((el.innerText || '').trim()) && (el.innerText || '').trim().length < 24)
    if (rewindBtn) { rewindBtn.click(); await sleep(700) }
    const afterRewind = (shellRoot()?.innerText || document.body.innerText || '')
    const rewindHonest = /回退|Rewind|如何启用|未启用|离线|时间轴|checkpoint/i.test(afterRewind)

    // 灰态诚实：离线节点带未启用，不空壳崩
    const offlineNodes = document.querySelectorAll('.ow-nn-offline, [class*=offline]').length
    const stillAlive = !!shellRoot() && !(shellRoot().innerText || '').includes('Something went wrong')

    return {
      opened: !!shellRoot(),
      q1, q2, q3,
      enteredOrHonest,
      rewindHonest,
      offlineNodes,
      stillAlive,
    }
  })()`)

  const elapsedMs = Date.now() - started
  ok(ui.opened === true, 'OW shell opened')
  ok(ui.q1?.health === true, 'P1-1 状态三问① 资源/健康/Bridge')
  ok(ui.q1?.map === true || ui.q1?.watermark === true, 'P1-1 状态页有地图或水印')
  ok(ui.q2?.actions === true, 'P1-1 状态三问② 动作页可操作面')
  ok(ui.q3?.events === true, 'P1-1 状态三问③ 事件/信箱')
  ok(ui.enteredOrHonest === true, 'P1-2 进任务世界或诚实灰态')
  ok(ui.rewindHonest === true, 'P1-2 回退入口或诚实灰态')
  ok(ui.stillAlive === true, 'P1-2 壳未崩')
  ok(elapsedMs < 90000, `P1-1 within 90s · ${elapsedMs}ms`)
} catch (err) {
  cdpUnavailable = /fetch failed|CDP 无 page|ECONNREFUSED/i.test(String(err && err.message || err))
  if (cdpUnavailable) {
    console.error(`  · CDP 不可用：${err.message}`)
    console.error('  · 请先：完全退出 Desktop → npm run desktop:cdp → 再跑 test:phase1')
  } else {
    ok(false, `CDP phase1 failed: ${err.message}`)
  }
} finally {
  try { ws?.close() } catch {}
}

console.log(`\n=== Phase 1 acceptance: ${passed} passed, ${failed} failed${cdpUnavailable ? ' · CDP skipped' : ''} ===\n`)
if (cdpUnavailable) process.exit(2)
process.exit(failed ? 1 : 0)
