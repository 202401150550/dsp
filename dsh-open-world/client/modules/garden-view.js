// Open World · garden-view（园 · 第四视图：一花一草一木 = 一能力一元素）
// 数据契约：只读 snapshot.{core,nodes,taskBoard,memory,rewind,space,events,mailbox,worldPacks,idea}
// 动作契约：send-message / idea-inject / idea-compare / pair-issue（OWIP 核心动作，不新造）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/garden-view',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const C = require('dsh-open-world/constants')
    /* v4：系统「减弱动态」守卫——流星/花瓣等装饰动画降级 */
    const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const Runtime = require('dsh-open-world/runtime')
    const { useState, useEffect, useRef, useCallback, useMemo } = React
    const { fetchJson } = Runtime

    /** 园开关：worlds.garden === false 时隐藏（yml: worlds.garden） */
    function gardenEnabled(snapshot) {
      const w = snapshot && snapshot.config && snapshot.config.worlds
      return !(w && w.garden === false)
    }

    /** 配对令牌签发（请人过桥；与 chat.js 同一 OW_ACTION_URL 通道） */
    let pairingInFlight = false
    async function postPairIssue() {
      if (pairingInFlight) throw new Error('上一枚令牌还在路上，稍候')
      pairingInFlight = true
      try {
      const res = await fetch(C.OW_ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pair-issue' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status))
      return data
      } finally { window.setTimeout(() => { pairingInFlight = false }, 2000) }
    }

    /** 信纸落聊天坞线程（一套存储两处渲染：聊天坞与园共用 open-world/chat/ 本地文件） */
    async function postChatLetter(text) {
      const res = await fetch(C.CHAT_POST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 'main', text: String(text || '').slice(0, 280), attachments: [], role: 'user' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        const reason = res.status >= 500 ? '聊天坞服务暂不可用' : (res.status === 404 ? '聊天坞接口不存在' : (data.error || ('HTTP ' + res.status)))
        throw new Error(reason)
      }
      return data
    }

    /** 名牌牵连（谁养着谁） */
    const REL = {
      moon: '全园（总况映在月色里）',
      lantern: '舱（核心养着会话）· 塔（话头长成任务）· 桥（带来新话头）',
      capsule: '灯（核心安稳会话才亮）· 石（园丁看护）',
      banner: '全园（有动静它先应）',
      tower: '灯（话头长成任务）· 湖（做完的落进记忆）',
      moongate: '湖（记忆厚才有据）· 塔（忙时先锁门）',
      lake: '塔（成果落进来）· 门（攒出回退）· 桥（见闻起新话头）',
      bridge: '门（存档齐才可信）· 灯（见闻起新话头）',
      stone: '全园（照看）· 湖（练习用记忆）',
      well: '桥（外来园子的门路）',
    }

    /** 园内元素登记（ax/ay 为比例锚点） */
    function buildElements(snap) {
      const core = (snap && snap.core) || {}
      const tb = (snap && snap.taskBoard) || {}
      const mem = (snap && snap.memory) || {}
      const rw = (snap && snap.rewind) || {}
      const sp = (snap && snap.space) || {}
      const packs = (snap && snap.worldPacks) || {}
      const plugins = (snap && snap.plugins) || []
      const canEnter = (id) => !plugins.some((p) => p.id === id && !p.online)
      const online = plugins.filter((p) => p && p.online).length
      // v91 十景对账：月=core总况 灯=sessions 塔=taskBoard 舱=core主体 门=rewind 湖=hindsight 桥=space 幡=events 石=dsh-self 井=worldPacks
      return [
        { id: 'moon', zi: '月', en: 'core · 总况', seal: '月',
          who: '月是园子的总况。满而亮，园子就安；月色缺了，就该叫园丁来查。月盈亏，映的是体检分。',
          now: () => '今晚 ' + (core.healthScore != null ? core.healthScore : '—') + ' 分。',
          acts: () => [{ t: '看体征', run: (ctx) => ctx.runBridge({ type: 'embed', panel: 'monitor' }) }] },
        { id: 'lantern', zi: '灯', en: 'sessions · 会话', seal: '灯',
          who: '灯下坐着正在干活的会话。灯亮着，就是有人在工作。',
          now: () => '会话在册，健康 ' + (core.healthScore != null ? core.healthScore : '—') + '。',
          acts: () => [{ t: '看会话', run: (ctx) => ctx.runBridge({ type: 'embed', panel: 'fleet' }) }] },
        { id: 'capsule', zi: '舱', en: 'core · 系统', seal: '舱',
          who: '查看系统状态。', now: () => '健康 ' + (core.healthScore ?? '—') + '。',
          acts: () => [{ t: '看体征', run: (ctx) => ctx.runBridge({ type: 'embed', panel: 'monitor' }) }] },
        { id: 'tower', zi: '塔', en: 'task-board · 任务', seal: '塔',
          who: '塔里存放要做的事。做完一层，亮一层；塔顶的旗，是有事在做的意思。',
          now: () => tb.available !== true ? '任务服务未启用；历史记录不代表正在执行。' : '在做 ' + (tb.doing != null ? tb.doing : '—') + '，排队 ' + (tb.queued != null ? tb.queued : '—') + '，今日成 ' + (tb.doneToday != null ? tb.doneToday : '—') + '。',
          acts: () => [{ t: tb.available === true ? '看队列' : '任务未启用', disabled: tb.available !== true, run: (ctx) => ctx.runBridge({ type: 'embed', panel: 'task-board' }) }] },
        { id: 'moongate', zi: '门', en: 'rewind · 回退', seal: '门',
          who: '查看可用回退点；执行回退前请确认影响范围。',
          now: () => '存档 ' + (rw.points != null ? rw.points : '—') + ' 份；能否回退以服务检查为准。',
          acts: () => [{ t: '看存档', run: (ctx) => ctx.runBridge({ type: 'embed', panel: 'rewind' }) }] },
        { id: 'lake', zi: '湖', en: 'hindsight · 记忆', seal: '湖',
          who: '湖收着你们说过的话、存过的知识。问它一句，它替你想起。',
          now: () => '存了 ' + (mem.items != null ? mem.items : '—') + ' 条。',
          acts: () => [{ t: '查一件事', ask: 'lake' }] },
        { id: 'bridge', zi: '桥', en: 'space · 连接', seal: '桥',
          who: '桥那头是你的第二屏和伙伴。有人过桥，桥上会亮一盏客灯。',
          now: () => '客 ' + ((sp && sp.peers) || 0) + ' 位，同步：' + ((sp && sp.sync) || '未连接') + '。',
          acts: () => [
            { t: canEnter('remote-web-ui') ? '打开连接' : '远程连接未启用', disabled: !canEnter('remote-web-ui'), run: (ctx) => ctx.runBridge({ type: 'embed', panel: 'remote' }) },
          ] },
        { id: 'banner', zi: '幡', en: 'events · 动静', seal: '幡',
          who: '园里一有动静，幡就应一声。点幡，看最近七件。',
          now: () => '园径在右侧，点开即读。', openPath: true,
          acts: () => [{ t: '看园径', run: (ctx) => ctx.setPathOpen(true) }] },
        { id: 'stone', zi: '石', en: 'dsh-self · 园丁', seal: '石',
          who: '守园的石。园丁住在里面：照看所有器官、收编外来插件、出事时把园子复原。',
          now: () => '在册插件 ' + plugins.length + ' 样，在线 ' + online + '。',
          acts: () => [{ t: canEnter('market') ? '翻园丁簿' : '插件市场未启用', disabled: !canEnter('market'), run: (ctx) => ctx.runBridge({ type: 'embed', panel: 'market' }) }] },
        { id: 'well', zi: '井', en: 'world-packs · 世界包', seal: '井',
          who: '井通着别的园子。装了世界包，井里才映出别家的月色。',
          now: () => packs.enabled ? ('已装 ' + ((packs.packs || []).filter((p) => p.enterable).length) + ' 包。') : '井中无水——还没装任何世界包。',
          dim: !packs.enabled,
          acts: () => [] },
      ]
    }

    /** 元素锚点（比例坐标） */
    const ANCHORS = {
      moon: [.8, .2], lantern: [.235, .62], capsule: [.4, .56], tower: [.565, .6],
      moongate: [.685, .62], lake: [.21, .84], bridge: [.375, .82], banner: [.487, .6],
      stone: [.61, .82], well: [.72, .83],
    }
    const HIT_R = { moon: 40, lantern: 36, capsule: 44, tower: 42, moongate: 40, lake: 46, bridge: 38, banner: 34, stone: 34, well: 34 }

    /** 画园（canvas 2d · 无 WebGL） */
    function drawScene(ctx2, w, h, t, state) {
      const S = Math.max(.55, Math.min(1.1, Math.min(w / 900, h / 560)))
      ctx2.clearRect(0, 0, w, h)
      // 天
      const g = ctx2.createLinearGradient(0, 0, 0, h * .66)
      g.addColorStop(0, '#0C0F13'); g.addColorStop(.7, '#111820'); g.addColorStop(1, '#16202A')
      ctx2.fillStyle = g; ctx2.fillRect(0, 0, w, h * .66)
      // 星
      for (const st of state.stars) {
        ctx2.globalAlpha = st.a; ctx2.fillStyle = '#DCE4E8'
        ctx2.beginPath(); ctx2.arc(st.x * w, st.y * h, st.r, 0, 7); ctx2.fill()
      }
      ctx2.globalAlpha = 1
      // 月（盈亏映体检分）
      const mx = ANCHORS.moon[0] * w, my = ANCHORS.moon[1] * h, mr = 34 * S
      const halo = ctx2.createRadialGradient(mx, my, mr * .4, mx, my, mr * 3.2)
      halo.addColorStop(0, 'rgba(232,223,200,.15)'); halo.addColorStop(1, 'rgba(232,223,200,0)')
      ctx2.fillStyle = halo; ctx2.beginPath(); ctx2.arc(mx, my, mr * 3.2, 0, 7); ctx2.fill()
      ctx2.fillStyle = '#E4DCC4'; ctx2.beginPath(); ctx2.arc(mx, my, mr, 0, 7); ctx2.fill()
      const shade = Math.max(0, Math.min(1, (100 - (state.healthScore == null ? 100 : state.healthScore)) / 25))
      if (shade > 0.02) { ctx2.fillStyle = '#0C0F13'; ctx2.beginPath(); ctx2.arc(mx - mr * 1.15 * shade, my - mr * .25, mr * 1.02, 0, 7); ctx2.fill() }
      // 山三层 + 雾
      const mt = [
        { a: .12, y: .56, amp: .05 }, { a: .2, y: .6, amp: .045 }, { a: .3, y: .65, amp: .04 },
      ]
      for (const L of mt) {
        ctx2.beginPath(); ctx2.moveTo(-10, h)
        const n = 6
        for (let i = 0; i <= n; i++) {
          const x = (i / n) * (w + 20) - 10
          const y = (L.y + Math.sin(i * 2.1 + L.a * 9) * L.amp) * h
          if (i === 0) ctx2.lineTo(x, y)
          else ctx2.quadraticCurveTo(x - (w / n) / 2, y - 18 * S, x, y)
        }
        ctx2.lineTo(w + 10, h); ctx2.closePath()
        const mg = ctx2.createLinearGradient(0, h * .4, 0, h * .72)
        mg.addColorStop(0, 'rgba(150,162,172,' + L.a + ')'); mg.addColorStop(1, 'rgba(150,162,172,0)')
        ctx2.fillStyle = mg; ctx2.fill()
      }
      // 地
      const gg = ctx2.createLinearGradient(0, h * .64, 0, h)
      gg.addColorStop(0, '#131920'); gg.addColorStop(1, '#0C0F12')
      ctx2.fillStyle = gg; ctx2.fillRect(0, h * .64, w, h * .36)
      ctx2.strokeStyle = 'rgba(217,179,108,.1)'; ctx2.lineWidth = 1
      ctx2.beginPath(); ctx2.moveTo(0, h * .655); ctx2.lineTo(w, h * .655); ctx2.stroke()
      // 湖
      const lx = ANCHORS.lake[0] * w, ly = ANCHORS.lake[1] * h
      const lg = ctx2.createLinearGradient(0, ly - 20 * S, 0, ly + 20 * S)
      lg.addColorStop(0, '#1B2C32'); lg.addColorStop(1, '#101C21')
      ctx2.fillStyle = lg; ctx2.beginPath(); ctx2.ellipse(lx, ly, 108 * S, 22 * S, 0, 0, 7); ctx2.fill()
      ctx2.strokeStyle = 'rgba(217,179,108,.16)'; ctx2.lineWidth = 1
      ctx2.beginPath(); ctx2.ellipse(lx, ly, 108 * S, 22 * S, 0, 0, 7); ctx2.stroke()
      // 涟漪
      for (const r of state.ripples) {
        ctx2.globalAlpha = Math.max(0, r.life) * .5; ctx2.strokeStyle = '#9FB8BC'; ctx2.lineWidth = 1
        ctx2.beginPath(); ctx2.arc(r.x, r.y, r.r, 0, 7); ctx2.stroke()
      }
      ctx2.globalAlpha = 1
      // 舱（核心）
      const cx = ANCHORS.capsule[0] * w, cb = h * .7, bw = 82 * S, bh = 128 * S
      const pool = ctx2.createRadialGradient(cx, cb, 4, cx, cb, 96 * S)
      pool.addColorStop(0, 'rgba(240,208,138,.09)'); pool.addColorStop(1, 'rgba(240,208,138,0)')
      ctx2.fillStyle = pool; ctx2.beginPath(); ctx2.ellipse(cx, cb, 96 * S, 22 * S, 0, 0, 7); ctx2.fill()
      const bg = ctx2.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0)
      bg.addColorStop(0, '#1E262C'); bg.addColorStop(.5, '#171E23'); bg.addColorStop(1, '#12181D')
      ctx2.fillStyle = bg
      roundRect(ctx2, cx - bw / 2, cb - bh, bw, bh, bw * .42); ctx2.fill()
      ctx2.strokeStyle = 'rgba(217,179,108,.4)'; ctx2.lineWidth = 1; ctx2.stroke()
      const wx = cx, wy = cb - bh * .68, wr = 12 * S
      const wg = ctx2.createRadialGradient(wx - 3, wy - 3, 2, wx, wy, wr)
      wg.addColorStop(0, '#F6DFA6'); wg.addColorStop(1, '#C89850')
      ctx2.fillStyle = wg; ctx2.beginPath(); ctx2.arc(wx, wy, wr, 0, 7); ctx2.fill()
      // 灯（会话）
      const lx2 = ANCHORS.lantern[0] * w, lb = h * .7
      ctx2.strokeStyle = '#242C32'; ctx2.lineWidth = 3 * S
      ctx2.beginPath(); ctx2.moveTo(lx2, lb); ctx2.lineTo(lx2, lb - 66 * S); ctx2.stroke()
      const ll = 15 * S, lh2 = 19 * S, ly2 = lb - 62 * S
      const lglow = ctx2.createRadialGradient(lx2, ly2 + lh2 / 2, 2, lx2, ly2 + lh2 / 2, 38 * S)
      lglow.addColorStop(0, 'rgba(240,208,138,.2)'); lglow.addColorStop(1, 'rgba(240,208,138,0)')
      ctx2.fillStyle = lglow; ctx2.beginPath(); ctx2.arc(lx2, ly2 + lh2 / 2, 38 * S, 0, 7); ctx2.fill()
      const lg2 = ctx2.createLinearGradient(lx2 - ll, 0, lx2 + ll, 0)
      lg2.addColorStop(0, '#EFCF8F'); lg2.addColorStop(1, '#C79A55')
      roundRect(ctx2, lx2 - ll, ly2, ll * 2, lh2, 4 * S); ctx2.fillStyle = lg2; ctx2.fill()
      ctx2.strokeStyle = 'rgba(20,16,10,.5)'; ctx2.stroke()
      // 塔（任务）
      const tx = ANCHORS.tower[0] * w, tb2 = h * .7
      let ty = tb2
      const tiers = [[64, 0], [48, 1], [34, 2]]
      for (const [tw2, i] of tiers) {
        const th2 = 22 * S
        roundRect(ctx2, tx - tw2 * S / 2, ty - th2, tw2 * S, th2, 3 * S)
        ctx2.fillStyle = i % 2 ? '#171E23' : '#1B2228'; ctx2.fill()
        ctx2.strokeStyle = 'rgba(217,179,108,.26)'; ctx2.lineWidth = 1; ctx2.stroke()
        ctx2.beginPath()
        ctx2.moveTo(tx - tw2 * S / 2 - 8 * S, ty - th2)
        ctx2.quadraticCurveTo(tx, ty - th2 - 8 * S, tx + tw2 * S / 2 + 8 * S, ty - th2)
        ctx2.quadraticCurveTo(tx, ty - th2 - 2 * S, tx - tw2 * S / 2 - 8 * S, ty - th2)
        ctx2.fillStyle = '#232B31'; ctx2.fill()
        ctx2.fillStyle = 'rgba(240,208,138,.5)'
        ctx2.fillRect(tx - 3 * S, ty - th2 + 6 * S, 6 * S, 10 * S)
        ty -= th2 + 6 * S
      }
      // 塔旗（随风）
      const fsway = state.wind * 7 * S + Math.sin(t * 2.6) * 2 * S
      ctx2.strokeStyle = '#39434B'; ctx2.lineWidth = 1.5
      ctx2.beginPath(); ctx2.moveTo(tx, tb2); ctx2.lineTo(tx, ty - 4 * S); ctx2.stroke()
      ctx2.fillStyle = '#C8402F'
      ctx2.beginPath(); ctx2.moveTo(tx, ty - 4 * S); ctx2.lineTo(tx + 22 * S, ty - 1 * S + fsway * .4); ctx2.lineTo(tx, ty + 4 * S)
      ctx2.closePath(); ctx2.fill()
      // 门（回退）
      const gx = ANCHORS.moongate[0] * w, gy = h * .66, gr = 36 * S
      ctx2.strokeStyle = '#2A3238'; ctx2.lineWidth = 8 * S
      ctx2.beginPath(); ctx2.arc(gx, gy, gr, 0, 7); ctx2.stroke()
      ctx2.strokeStyle = 'rgba(217,179,108,.3)'; ctx2.lineWidth = 1
      ctx2.beginPath(); ctx2.arc(gx, gy, gr + 4 * S, 0, 7); ctx2.stroke()
      ctx2.strokeStyle = 'rgba(240,208,138,.5)'; ctx2.lineWidth = 1.6
      ctx2.beginPath(); ctx2.moveTo(gx, gy - gr + 7 * S); ctx2.lineTo(gx, gy + gr - 7 * S); ctx2.stroke()
      // 桥（连接）
      const bx = ANCHORS.bridge[0] * w, by = h * .82, bw2 = 78 * S
      ctx2.strokeStyle = '#2A3238'; ctx2.lineWidth = 5 * S
      ctx2.beginPath(); ctx2.moveTo(bx - bw2 / 2, by)
      ctx2.quadraticCurveTo(bx, by - 30 * S, bx + bw2 / 2, by); ctx2.stroke()
      // 幡（事件）
      const px = ANCHORS.banner[0] * w, pb = h * .68, py = pb - 108 * S
      ctx2.strokeStyle = '#39434B'; ctx2.lineWidth = 2 * S
      ctx2.beginPath(); ctx2.moveTo(px, pb); ctx2.lineTo(px, py); ctx2.stroke()
      const sway = state.wind * 11 * S + Math.sin(t * 2.3) * (1.5 + state.dance * 8) * S + Math.sin(t * .8) * 1.4 * S
      ctx2.beginPath()
      ctx2.moveTo(px, py)
      ctx2.quadraticCurveTo(px + 12 * S + sway * .55, py + 19 * S, px + sway, py + 34 * S)
      ctx2.lineTo(px + sway * 1.08, py + 56 * S); ctx2.lineTo(px, py + 56 * S)
      ctx2.closePath()
      ctx2.fillStyle = 'rgba(233,228,216,.88)'; ctx2.fill()
      // 石（园丁）
      const sx = ANCHORS.stone[0] * w, sy = h * .84
      ctx2.fillStyle = '#1C2329'; ctx2.strokeStyle = 'rgba(217,179,108,.2)'; ctx2.lineWidth = 1
      ctx2.beginPath()
      ctx2.moveTo(sx - 22 * S, sy)
      ctx2.quadraticCurveTo(sx - 30 * S, sy - 26 * S, sx - 9 * S, sy - 34 * S)
      ctx2.quadraticCurveTo(sx + 2 * S, sy - 44 * S, sx + 12 * S, sy - 30 * S)
      ctx2.quadraticCurveTo(sx + 29 * S, sy - 22 * S, sx + 21 * S, sy)
      ctx2.closePath(); ctx2.fill(); ctx2.stroke()
      ctx2.strokeStyle = 'rgba(74,124,111,.75)'; ctx2.lineWidth = 2 * S
      ctx2.beginPath(); ctx2.moveTo(sx - 17 * S, sy - 7 * S); ctx2.quadraticCurveTo(sx - 7 * S, sy - 12 * S, sx + 2 * S, sy - 7 * S); ctx2.stroke()
      // 井（世界包）
      const wx2 = ANCHORS.well[0] * w, wy2 = h * .855
      ctx2.globalAlpha = state.packsOn ? 1 : .55
      ctx2.strokeStyle = state.packsOn ? '#39434B' : '#4A5158'; ctx2.lineWidth = 2.6 * S
      ctx2.beginPath(); ctx2.moveTo(wx2 - 13 * S, wy2); ctx2.lineTo(wx2 - 13 * S, wy2 - 28 * S); ctx2.stroke()
      ctx2.beginPath(); ctx2.moveTo(wx2 + 13 * S, wy2); ctx2.lineTo(wx2 + 13 * S, wy2 - 28 * S); ctx2.stroke()
      ctx2.beginPath(); ctx2.moveTo(wx2 - 20 * S, wy2 - 28 * S); ctx2.lineTo(wx2, wy2 - 37 * S); ctx2.lineTo(wx2 + 20 * S, wy2 - 28 * S); ctx2.stroke()
      ctx2.fillStyle = state.packsOn ? '#1B2C32' : '#101418'
      ctx2.beginPath(); ctx2.ellipse(wx2, wy2 - 5 * S, 12 * S, 5 * S, 0, 0, 7); ctx2.fill()
      ctx2.globalAlpha = 1
      // 草
      ctx2.lineWidth = 1.3
      for (const gr2 of state.grass) {
        const gx2 = gr2.x * w, gy2 = gr2.y * h
        const gsw = (state.wind * 6 + Math.sin(t * 1.6 + gr2.ph) * 1.1) * gr2.s
        ctx2.strokeStyle = 'rgba(58,76,66,.6)'
        ctx2.beginPath(); ctx2.moveTo(gx2, gy2)
        ctx2.quadraticCurveTo(gx2 + gsw * .5, gy2 - 7 * gr2.s, gx2 + gsw, gy2 - 11 * gr2.s)
        ctx2.stroke()
      }
      // 流星（大事件）
      for (const p of state.meteors) {
        const tail = 14 + 24 * p.life
        const mgl = ctx2.createLinearGradient(p.x, p.y, p.x - p.vx * tail * .28, p.y - p.vy * tail * .28)
        mgl.addColorStop(0, 'rgba(236,228,206,' + (.85 * p.life) + ')'); mgl.addColorStop(1, 'rgba(236,228,206,0)')
        ctx2.strokeStyle = mgl; ctx2.lineWidth = 1.5
        ctx2.beginPath(); ctx2.moveTo(p.x, p.y); ctx2.lineTo(p.x - p.vx * tail * .28, p.y - p.vy * tail * .28); ctx2.stroke()
      }
      // 暗元素灰罩
      if (state.dimWell) {
        ctx2.globalAlpha = .5; ctx2.fillStyle = '#0C0F12'
        ctx2.fillRect(wx2 - 24 * S, wy2 - 40 * S, 48 * S, 42 * S)
        ctx2.globalAlpha = 1
      }
    }
    function roundRect(c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2)
      c.beginPath()
      c.moveTo(x + r, y)
      c.arcTo(x + w, y, x + w, y + h, r)
      c.arcTo(x + w, y + h, x, y + h, r)
      c.arcTo(x, y + h, x, y, r)
      c.arcTo(x, y, x + w, y, r)
      c.closePath()
    }

    /** 园 · React 视图（挂在 CenterStage 内） */
    function GardenView({
      snapshot, events, runBridge, setToast,
      handleIdeaInject, handleIdeaCompare, handleSendMessage, handleSearchMemory,
    }) {
      const wrapRef = useRef(null)
      const cvsRef = useRef(null)
      const stateRef = useRef({
        wind: .14, windT: .14, dance: 0, danceMax: 0,
        ripples: [], meteors: [], lastEventId: null,
        stars: [], grass: [],
        healthScore: null, packsOn: false,
      })
      const [card, setCard] = useState(null)
      const [pathOpen, setPathOpen] = useState(false)
      const [letter, setLetter] = useState('')
      const [persona, setPersona] = useState('')
      const [asking, setAsking] = useState(false)
      const els = useMemo(() => buildElements(snapshot), [snapshot])
      const elsRef = useRef(els)
      elsRef.current = els
      const evList = (events && events.length ? events : (snapshot && snapshot.events) || []).slice(0, 7)
      const presets = (snapshot && snapshot.idea && snapshot.idea.presets) || []

      // 初始化静态布景
      useEffect(() => {
        const st = stateRef.current
        if (!st.stars.length) for (let i = 0; i < 36; i++) st.stars.push({ x: Math.random(), y: Math.random() * .38, a: .08 + Math.random() * .28, r: .5 + Math.random() })
        if (!st.grass.length) for (let i = 0; i < 12; i++) st.grass.push({ x: .06 + Math.random() * .88, y: .86 + Math.random() * .08, s: .7 + Math.random() * .6, ph: Math.random() * 6.28 })
      }, [])

      // 大事件 → 流星 + 幡舞
      useEffect(() => {
        const st = stateRef.current
        const first = evList[0]
        if (!first || !first.id) return
        if (st.lastEventId === null) { st.lastEventId = first.id; return }
        if (first.id !== st.lastEventId) {
          st.lastEventId = first.id
          st.danceMax = .8
          if (st.meteors.length < 3 && !reducedMotion()) {
            const cv = cvsRef.current
            const w = cv ? cv.clientWidth : 600
            st.meteors.push({ x: w * (.3 + Math.random() * .5), y: 40 + Math.random() * 60, vx: -(3.4 + Math.random() * 2), vy: 1.8 + Math.random(), life: 1 })
          }
        }
      }, [evList.length, evList[0] && evList[0].id])

      // 主循环
      useEffect(() => {
        let raf = 0
        const T0 = Date.now()
        let last = Date.now()
        const loop = () => {
          const cv = cvsRef.current
          const wrap = wrapRef.current
          if (!cv || !wrap) return
          const now = Date.now()
          const dt = Math.max(1, now - last); last = now
          const t = (now - T0) / 1000
          const st = stateRef.current
          st.wind += (st.windT - st.wind) * .07
          st.windT = Math.max(.12, st.windT * .985)
          st.dance = st.danceMax; st.danceMax *= .96
          const w = wrap.clientWidth, h = wrap.clientHeight
          const DPR = Math.min(window.devicePixelRatio || 1, 2)
          if (cv.width !== Math.round(w * DPR) || cv.height !== Math.round(h * DPR)) {
            cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR)
            cv.style.width = w + 'px'; cv.style.height = h + 'px'
          }
          const ctx2 = cv.getContext('2d')
          if (ctx2) {
            ctx2.setTransform(DPR, 0, 0, DPR, 0, 0)
            const snap = elsRef.current && elsRef.current.length ? snapshot : null
            st.healthScore = snap && snap.core ? snap.core.healthScore : st.healthScore
            st.packsOn = !!(snap && snap.worldPacks && snap.worldPacks.enabled)
            drawScene(ctx2, w, h, t, st)
          }
          for (const r of st.ripples) { r.r += 2; r.life -= .02 }
          st.ripples = st.ripples.filter((r) => r.life > 0)
          for (const p of st.meteors) { p.x += p.vx * dt * .09; p.y += p.vy * dt * .09; p.life -= dt * .0013 }
          st.meteors = st.meteors.filter((p) => p.life > 0 && p.y < h * .6)
          raf = window.requestAnimationFrame(loop)
        }
        raf = window.requestAnimationFrame(loop)
        return () => window.cancelAnimationFrame(raf)
      }, [snapshot])

      const hitAt = useCallback((x, y) => {
        const wrap = wrapRef.current
        if (!wrap) return null
        const w = wrap.clientWidth, h = wrap.clientHeight
        let best = null; let bd = 1e9
        for (const el of elsRef.current) {
          const a = ANCHORS[el.id]
          const ex = a[0] * w, ey = a[1] * h
          const d = Math.hypot(ex - x, ey - y)
          if (d < (HIT_R[el.id] || 36) + 10 && d < bd) { bd = d; best = { el, ex, ey } }
        }
        return best
      }, [])

      const onCvsDown = useCallback((e) => {
        const wrap = wrapRef.current
        if (!wrap) return
        const rect = wrap.getBoundingClientRect()
        const x = e.clientX - rect.left, y = e.clientY - rect.top
        const hit = hitAt(x, y)
        const st = stateRef.current
        st.ripples.push({ x, y, r: 4, life: 1 })
        if (!hit) { setCard(null); return }
        if (hit.el.id === 'banner') { setCard(null); setPathOpen(true); return }
        setCard({ el: hit.el, x: hit.ex, y: hit.ey })
      }, [hitAt])

      const runAct = useCallback(async (el, act) => {
        stateRef.current.ripples.push({ x: ANCHORS[el.id][0] * (wrapRef.current ? wrapRef.current.clientWidth : 0), y: ANCHORS[el.id][1] * (wrapRef.current ? wrapRef.current.clientHeight : 0), r: 4, life: 1 })
        if (act.ask === 'lake') { setAsking(true); setCard(null); return }
        try {
          await act.run({ setToast, setPathOpen, runBridge })
        } catch (err) {
          setToast(String(err && err.message || err))
        }
      }, [runBridge, setToast])

      const sendLetter = useCallback(async () => {
        const text = letter.trim()
        if (!text) { setToast('写句话再寄。'); return }
        setLetter('')
        try {
          if (persona) {
            setToast('正在投递「' + persona + '」…')
            await handleIdeaInject(persona, text)
          } else {
            await handleSendMessage({ action: 'send-message', to: 'mailbox', body: text.slice(0, 280) })
            setToast('信已放进信箱。')
          }
        } catch (err) {
          setToast(String(err && err.message || err))
        }
      }, [letter, persona, handleIdeaInject, handleSendMessage, setToast])

      const compareLetter = useCallback(async () => {
        const text = letter.trim()
        if (!text) { setToast('先写一句话，再请两位各答一遍。'); return }
        if (!handleIdeaCompare) return
        const ids = presets.slice(0, 2).map((p) => p.id)
        if (ids.length < 2) { setToast('可用人格不足两位。'); return }
        setLetter('')
        try {
          await handleIdeaCompare(ids, text)
        } catch (err) {
          setToast(String(err && err.message || err))
        }
      }, [letter, handleIdeaCompare, presets])

      const askLake = useCallback(async () => {
        const q = letter.trim()
        if (!q || !handleSearchMemory) return
        setLetter('')
        try {
          const hits = await handleSearchMemory(q)
          const items = (hits && hits.items) || []
          setToast(items.length ? '湖里捞起 ' + items.length + ' 条，最新：' + String(items[0].text || items[0].body || '').slice(0, 60) : '湖里暂时没有这一条。')
        } catch (err) {
          setToast(String(err && err.message || err))
        }
      }, [letter, handleSearchMemory, setToast])

      const cardStyle = card ? {
        left: Math.max(12, Math.min((wrapRef.current ? wrapRef.current.clientWidth : 600) - 252, card.x - 120)),
        top: Math.max(10, card.y - 150),
      } : {}

      return React.createElement('div', { className: 'ow-garden', ref: wrapRef },
        React.createElement('canvas', {
          ref: cvsRef, className: 'ow-garden-cvs',
          role: 'img', 'aria-label': '园 · 十景：月灯塔舱门湖桥幡石井，点击景物看名牌',
          onPointerDown: onCvsDown,
        }),
        React.createElement('div', { className: 'ow-garden-vtitle' }, '一花一草一木 · 一叶一菩提'),
        React.createElement('div', { className: 'ow-garden-corner' },
          React.createElement('span', { className: 'ow-garden-yu' }, '喻'),
          React.createElement('span', { className: 'ow-garden-note' }, '园中风雨是气象（喻），数字都是真读数'),
        ),
        card && React.createElement('div', { className: 'ow-garden-card', style: cardStyle },
          React.createElement('div', { className: 'ow-gc-head' },
            React.createElement('span', { className: 'ow-gc-zi' }, card.el.zi),
            React.createElement('span', { className: 'ow-gc-en' }, card.el.en),
            React.createElement('span', { className: 'ow-gc-seal' }, card.el.seal),
          ),
          React.createElement('div', { className: 'ow-gc-who' }, card.el.who),
          React.createElement('div', { className: 'ow-gc-now' }, card.el.now()),
          React.createElement('div', { className: 'ow-gc-acts' },
            card.el.acts(card.el).map((a, i) => React.createElement('button', {
              key: i, type: 'button', disabled: !!a.disabled, onClick: () => runAct(card.el, a),
            }, a.t)),
            React.createElement('button', { type: 'button', className: 'ow-gc-x', onClick: () => setCard(null) }, '收起'),
          ),
        ),
        asking && React.createElement('div', { className: 'ow-garden-ask' },
          React.createElement('input', {
            autoFocus: true, placeholder: '问湖一件事，如「上周的任务」…（回车查，Esc 收）',
            value: letter, onChange: (e) => setLetter(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter') askLake(); if (e.key === 'Escape') { setAsking(false); setLetter('') } },
          }),
        ),
        pathOpen && React.createElement('div', { className: 'ow-garden-path' },
          React.createElement('div', { className: 'ow-gp-head' },
            React.createElement('b', null, '园径'),
            React.createElement('span', null, '园里的动静，最近七件'),
            React.createElement('button', { type: 'button', onClick: () => setPathOpen(false) }, '✕'),
          ),
          React.createElement('div', { className: 'ow-gp-list' },
            evList.length ? evList.map((ev) => React.createElement('div', { key: ev.id || ev.ts, className: 'ow-gp-ev' },
              React.createElement('span', { className: 'ow-gp-dot' }),
              React.createElement('span', { className: 'ow-gp-text' }, (ev.title || '') + (ev.detail ? ' · ' + ev.detail : '')),
            )) : React.createElement('div', { className: 'ow-gp-ev' }, React.createElement('span', { className: 'ow-gp-text' }, '园里还很安静。')),
          ),
        ),
        React.createElement('div', { className: 'ow-garden-letter' },
          (presets.length > 0) && React.createElement('div', { className: 'ow-garden-personas' },
            presets.slice(0, 4).map((p) => React.createElement('button', {
              key: p.id, type: 'button',
              className: 'ow-garden-pn' + (persona === p.id ? ' on' : ''),
              onClick: () => setPersona(persona === p.id ? '' : p.id),
            }, p.title || p.id)),
            React.createElement('button', {
              type: 'button', className: 'ow-garden-pn',
              title: '请前两位人格各答一遍', onClick: compareLetter,
            }, '对比'),
          ),
          React.createElement('div', { className: 'ow-garden-paper' },
            React.createElement('input', {
              placeholder: persona ? ('由「' + persona + '」替你答…') : '给园子写句话，落进聊天坞与信箱…',
              value: letter, maxLength: 280, 'aria-label': '给园子写信，回车寄出（280 字内）',
              onChange: (e) => setLetter(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') sendLetter() },
            }),
            React.createElement('span', { className: 'ow-garden-count' }, letter ? String(280 - letter.length) : ''),
            React.createElement('button', { type: 'button', 'aria-label': '寄出信件', title: '回车也可寄出', onClick: sendLetter }, '寄'),
          ),
        ),
      )
    }

    module.exports = {
      gardenEnabled,
      buildElements,
      GardenView,
      REL,
      ANCHORS,
    }
    return module.exports
  },
})
