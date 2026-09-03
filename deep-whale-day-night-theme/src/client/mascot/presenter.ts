// @ts-nocheck
/**
 * Whale-musume mascot presenter — Cordis client port.
 *
 * Ported from dsh-whale-musume `assets/dsh-whale-moe.js` (MIT, ©
 * Sutera-Diffusus / dsh-whale-musume contributors). The DOM logic, pose
 * scheduler, interaction and growth plumbing are kept line-for-line; the
 * changes are structural only:
 *
 *  - the IIFE becomes `activateWhaleMascot(ctx)`, returning a disposer so
 *    the Cordis effect can retract every listener, timer, observer, style
 *    tag and DOM node;
 *  - artwork resolves through the embedded `WHALE_MOE_POSE_ART` /
 *    `WHALE_MOE_PEEK_ART` data URIs instead of `/assets/generated/*.webp`,
 *    and peek calibration is imported instead of fetched;
 *  - the DSH-settings injection (apply-theme.mjs) is replaced by a
 *    self-contained settings panel on the mascot itself;
 *  - attribute/class tokens are namespaced to `data-dsh-whale-pet-*` so a
 *    legacy install-script mascot can coexist;
 *  - localStorage keys (`whale-moe:*`) are unchanged, so existing growth
 *    and preference data carries over.
 *
 * See NOTICE for the full attribution chain.
 */
import * as core from './core.ts'
import {
  WHALE_MOE_POSE_ART,
  WHALE_MOE_PEEK_ART,
  WHALE_MOE_PEEK_CALIBRATION,
} from './art.generated.ts'
import { WHALE_MOE_CSS } from './style.ts'
import type { Context } from '@deepseek-ai/cordis'

const VIEW_ATTR = 'data-dsh-whale-pet-view'
const SKIN_OWNER = 'whale-pet'
const DEBOUNCE_MS = 120
const PARTICLE_MAX = 30
const HEART_CHARS = ['♥', '✿', '☆', '♪']

const VIEW_SELECTORS = Object.freeze({
  settings: '[role="dialog"], [data-slot="settings.header"]',
  workbench: '[data-slot="conversation.chat.node"], [data-phase="session"]',
})

/* Structural signal banks: presence-only detection, never reads text.
   data-running / data-state="ongoing" are the real DSH terminal/turn
   indicators (from the web-frontend bundle). data-state="running" is NOT
   a live DSH state — historical step cards keep it forever and would pin
   the mascot as permanently busy. The data-status variants stay only for
   test fixtures and older builds. */
const SIGNAL_BANKS = Object.freeze({
  thinking: ['[aria-busy="true"]', '[data-status="pending"]', '[data-state="loading"]', '[data-slot="conversation.chat.node"] [class*="stream" i]'],
  tool: ['[data-role="tool"]', '[data-tool="true"]', '[data-tool-card="true"]', '[data-status="running"]', '[data-running]', '[data-state="ongoing"]', '[data-state="running"]'],
  error: ['[data-state="error"]:not([class*="turnErrorDot"])', '[data-status="error"]', '[aria-invalid="true"]'],
  success: ['[data-state="success"]', '[data-status="success"]'],
  code: ['pre', '[data-slot="terminal"]', '[data-role="log"]', '[data-terminal]'],
  chat: ['[data-slot="conversation.chat.node"]'],
})

const STATE_HOLD_MS = Object.freeze({ success: 3000, failure: 3500, curious: 2500, tool: 1200, thinking: 1200 })
const STATE_CHIP = Object.freeze({ thinking: '思考中', tool: '工作中', success: '完成', failure: '出错', curious: '好奇' })
const BUSY_STATES = Object.freeze({ thinking: 1, tool: 1, success: 1, failure: 1 })

const IDLE_ACTION_POOL = ['daily-eat', 'daily-coffee', 'daily-stretch', 'daily-pajama', 'daily-shower', 'cool-shades', 'meme-smug']

const PREFS = [
  { key: 'pet', label: '看板娘' },
  { key: 'chat', label: '台词气泡' },
  { key: 'particles', label: '粒子效果' },
]

const MODES = Object.freeze({ auto: 1, bar: 1, side: 1, float: 1, mini: 1 })

/**
 * Activate the whale-musume mascot. Every side effect belongs to the
 * returned disposer, so stopping the plugin (or hot-reloading it) removes
 * the mascot completely.
 */
export function activateWhaleMascot(_ctx: Context): () => void {
  const root = window
  const doc = root.document

  /* ---------- lifecycle bookkeeping ---------- */

  let disposed = false
  const timers = new Set()
  const listeners = []
  let observer = null
  let styleNode = null
  let debugState = { state: 'boot', pose: null, line: '', view: 'home' }

  function setT(fn, ms) {
    const id = root.setTimeout(fn, ms)
    timers.add(id)
    return id
  }
  function clearT(id) {
    if (id === null || id === undefined) return
    timers.delete(id)
    root.clearTimeout(id)
  }
  function setIT(fn, ms) {
    const id = root.setInterval(fn, ms)
    timers.add(id)
    return id
  }
  function on(target, type, handler, options) {
    target.addEventListener(type, handler, options)
    listeners.push({ target, type, handler, options })
  }
  function off(target, type, handler, options) {
    target.removeEventListener(type, handler, options)
  }

  function removeAllPetNodes() {
    const nodes = doc.querySelectorAll('[data-dsh-whale-pet-root], [data-dsh-whale-pet-particle], [data-dsh-whale-pet-fx], [data-dsh-whale-pet-context], [data-dsh-whale-pet-panel]')
    for (let i = 0; i < nodes.length; i += 1) nodes[i].remove()
  }

  function dispose() {
    if (disposed) return
    disposed = true
    for (const id of timers) root.clearTimeout(id)
    timers.clear()
    for (const entry of listeners) entry.target.removeEventListener(entry.type, entry.handler, entry.options)
    listeners.length = 0
    if (observer) observer.disconnect()
    observer = null
    removeAllPetNodes()
    if (doc.body) {
      doc.body.removeAttribute('data-dsh-whale-pet-night')
      doc.body.removeAttribute(VIEW_ATTR)
    }
    doc.documentElement.removeAttribute(VIEW_ATTR)
    if (styleNode && styleNode.isConnected) styleNode.remove()
    styleNode = null
    try { delete root.__dshWhalePetDebug } catch (e) { /* ignore */ }
  }

  /* ---------- prefs / storage ---------- */

  function readPref(key) {
    try {
      const v = root.localStorage.getItem('whale-moe:' + key)
      // Default the floating mascot OFF so theme chrome stays without 桌宠 clutter.
      if (key === 'pet') return v === '1'
      return v !== '0'
    } catch (e) {
      return key !== 'pet'
    }
  }
  function writePref(key, value) {
    try { root.localStorage.setItem('whale-moe:' + key, value ? '1' : '0') } catch (e) { /* storage unavailable */ }
  }
  function readLS(key, fallback) {
    try { const v = root.localStorage.getItem('whale-moe:' + key); return v === null ? fallback : v } catch (e) { return fallback }
  }
  function writeLS(key, value) {
    try { root.localStorage.setItem('whale-moe:' + key, String(value)) } catch (e) { /* storage unavailable */ }
  }
  function prefOn(key, def) {
    return readLS(key, def ? '1' : '0') !== '0'
  }
  function readMode() {
    try {
      const value = root.localStorage.getItem('whale-moe:mode')
      if (value === null) return 'float'
      return MODES[value] ? value : 'float'
    } catch (e) { return 'float' }
  }
  function readFloatPos() {
    try {
      const rawX = root.localStorage.getItem('whale-moe:floatX')
      const rawY = root.localStorage.getItem('whale-moe:floatY')
      if (rawX === null || rawY === null) return null
      const x = Number(rawX)
      const y = Number(rawY)
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y }
    } catch (e) { /* ignore */ }
    return null
  }
  function writeFloatPos(x, y) {
    try {
      root.localStorage.setItem('whale-moe:floatX', String(Math.round(x)))
      root.localStorage.setItem('whale-moe:floatY', String(Math.round(y)))
    } catch (e) { /* storage unavailable */ }
  }

  /* ---------- asset resolution ---------- */

  function poseSrc(pose) {
    return WHALE_MOE_POSE_ART[pose] || WHALE_MOE_POSE_ART['idle-cute']
  }
  function peekSrc(id) {
    return WHALE_MOE_PEEK_ART[id]
  }

  /* ---------- DOM helpers ---------- */

  function isVisible(node) {
    if (!node) return false
    if (typeof node.getBoundingClientRect !== 'function') return true
    const rect = node.getBoundingClientRect()
    if (rect.width <= 1 && rect.height <= 1) return false
    if (node.ownerDocument && node.ownerDocument.defaultView && typeof node.ownerDocument.defaultView.getComputedStyle === 'function') {
      const style = node.ownerDocument.defaultView.getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    }
    return true
  }

  function firstVisible(selector) {
    const nodes = doc.querySelectorAll(selector)
    for (let i = 0; i < nodes.length; i += 1) if (isVisible(nodes[i])) return nodes[i]
    return null
  }
  function anyVisible(selectors) {
    for (let i = 0; i < selectors.length; i += 1) if (firstVisible(selectors[i])) return true
    return false
  }
  function countVisible(selectors) {
    const seen = new Set()
    for (let i = 0; i < selectors.length; i += 1) {
      const nodes = doc.querySelectorAll(selectors[i])
      for (let j = 0; j < nodes.length; j += 1) if (isVisible(nodes[j])) seen.add(nodes[j])
    }
    return seen.size
  }

  function detectView() {
    if (firstVisible(VIEW_SELECTORS.settings)) return 'settings'
    if (firstVisible(VIEW_SELECTORS.workbench)) return 'workbench'
    return 'home'
  }

  function findComposerSurface() {
    const card = firstVisible('[data-composer-card="true"]')
    if (card) return card
    const textarea = firstVisible('[data-slot="conversation.composer.bar"] textarea')
    return textarea && textarea.closest ? textarea.closest('form, [class]') : null
  }

  /* ---------- own layers ---------- */

  function removeRoot() {
    const nodes = doc.querySelectorAll('[data-dsh-whale-pet-root]')
    for (let i = 0; i < nodes.length; i += 1) nodes[i].remove()
    const particles = doc.querySelectorAll('[data-dsh-whale-pet-particle]')
    for (let p = 0; p < particles.length; p += 1) particles[p].remove()
  }

  const layerState = { active: 'a', loaded: { a: '', b: '' }, gen: 0, pendingSwap: '', pendingSince: 0 }

  function setPose(src, animate, soft) {
    const rootNode = doc.querySelector('[data-dsh-whale-pet-root]')
    if (!rootNode) return
    const nextName = layerState.active === 'a' ? 'b' : 'a'
    const current = rootNode.querySelector('[data-dsh-whale-pet-layer="' + layerState.active + '"]')
    const next = rootNode.querySelector('[data-dsh-whale-pet-layer="' + nextName + '"]')
    if (!current || !next) return

    /* A previous blink/transition can leave an inline opacity that would pin
       an inactive layer visible under the new pose — always clear it. */
    current.style.opacity = ''
    next.style.opacity = ''

    /* Stuck-animation recovery: background/throttled tabs can pause WAAPI so
       neither onfinish nor oncancel fires. If a swap has been pending too long,
       land it immediately on the layer that was already loaded for the swap. */
    if (layerState.pendingSwap && Date.now() - layerState.pendingSince > 1600) {
      layerState.gen += 1
      layerState.pendingSwap = ''
      layerState.pendingSince = 0
      next.classList.add('dsh-whale-pet-active')
      current.classList.remove('dsh-whale-pet-active')
      layerState.active = nextName
    }

    if (layerState.loaded[layerState.active] === src) return

    /* Motion-hide swap (industry sprite/VTuber style): old pose squashes down
       quickly, the image is swapped at the heaviest motion point, then the new
       pose pops back with overshoot. No opacity crossfade, and the two layers
       are never active at the same time.
       soft=false → click/reaction poses switch instantly (no transition). */
    function swap() {
      const motionNode = rootNode.querySelector('[data-dsh-whale-pet-motion]')
      function applyLayers() {
        next.classList.add('dsh-whale-pet-active')
        current.classList.remove('dsh-whale-pet-active')
        layerState.active = nextName
        layerState.pendingSwap = ''
        layerState.pendingSince = 0
      }
      if (!soft || motionReduced() || !motionNode || typeof motionNode.animate !== 'function') {
        applyLayers()
        return
      }
      /* 待机微动作和换图动画不能叠在同一节点上，先取消 */
      motionNode.classList.remove('dsh-whale-pet-hop', 'dsh-whale-pet-squint')
      const swapGen = layerState.gen
      layerState.pendingSwap = src
      layerState.pendingSince = Date.now()
      const hide = motionNode.animate(
        [
          { transform: 'translateY(0) scale(1)' },
          { transform: 'translateY(12px) scale(0.86, 0.92)' },
        ],
        { duration: 140, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
      )
      hide.oncancel = function () {
        hide.onfinish = null
        if (swapGen !== layerState.gen) {
          /* 本次换图已被更新的换图取代：只清理属于自己的标记，
             绝不能把新一代动画的 pendingSwap 一起抹掉，否则渲染循环
             会反复重启同一组动画，表现为“抽搐”。 */
          if (layerState.pendingSwap === src) {
            layerState.pendingSwap = ''
            layerState.pendingSince = 0
          }
          return
        }
        applyLayers()
      }
      hide.onfinish = function () {
        hide.onfinish = null
        if (swapGen !== layerState.gen) {
          if (layerState.pendingSwap === src) {
            layerState.pendingSwap = ''
            layerState.pendingSince = 0
          }
          return
        }
        applyLayers()
        motionNode.animate(
          [
            { transform: 'translateY(18px) scale(0.88, 0.94)' },
            { transform: 'translateY(0) scale(1)' },
          ],
          { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        )
      }
    }

    if (!animate || layerState.loaded[layerState.active] === '') {
      layerState.gen += 1
      layerState.pendingSwap = ''
      layerState.pendingSince = 0
      current.setAttribute('src', src)
      current.classList.add('dsh-whale-pet-active')
      next.classList.remove('dsh-whale-pet-active')
      layerState.loaded[layerState.active] = src
      return
    }
    if (layerState.loaded[nextName] === src) {
      if (layerState.pendingSwap === src) return /* already animating this swap */
      layerState.gen += 1
      swap()
      return
    }
    next.setAttribute('src', src)
    layerState.loaded[nextName] = src
    layerState.gen += 1
    const gen = layerState.gen
    next.addEventListener('load', function handler() {
      next.removeEventListener('load', handler)
      if (gen !== layerState.gen) return /* superseded by a newer pose */
      if (layerState.pendingSwap === src) return
      swap()
    }, { once: true })
  }

  function burst(symbol) {
    const rootNode = doc.querySelector('[data-dsh-whale-pet-root]')
    if (!rootNode || motionReduced()) return
    const node = doc.createElement('span')
    node.setAttribute('data-dsh-whale-pet-burst', 'true')
    node.textContent = symbol
    rootNode.appendChild(node)
    node.addEventListener('animationend', function () { node.remove() }, { once: true })
    setT(function () { node.remove() }, 1000)
  }

  function emojiBurst(symbols) {
    const rootNode = doc.querySelector('[data-dsh-whale-pet-root]')
    if (!rootNode || motionReduced() || !symbols || !symbols.length) return
    for (let i = 0; i < symbols.length; i += 1) {
      const node = doc.createElement('span')
      node.setAttribute('data-dsh-whale-pet-burst', 'true')
      node.className = 'dsh-emoji-fly'
      node.textContent = symbols[i]
      const side = i % 2 === 0 ? -1 : 1
      node.style.setProperty('--wmp-dx', String(side * (14 + (i % 3) * 12)) + 'px')
      node.style.setProperty('--wmp-dy', String(-34 - (i % 3) * 16) + 'px')
      node.style.setProperty('--wmp-rot', String(side * (8 + i * 7)) + 'deg')
      node.style.animationDelay = (i * 55) + 'ms'
      rootNode.appendChild(node)
      node.addEventListener('animationend', function () { node.remove() }, { once: true })
      setT(function () { node.remove() }, 1200 + i * 60)
    }
  }

  let typingTimer = null
  let nextTimer = null
  function typeBubble(textNode, line) {
    if (typingTimer) clearT(typingTimer)
    memory.currentTypingLine = line
    if (motionReduced()) {
      textNode.textContent = line
      memory.currentTypingLine = ''
      typingTimer = null
      return
    }
    textNode.textContent = ''
    const caret = doc.createElement('span')
    caret.setAttribute('data-dsh-whale-pet-caret', 'true')
    caret.textContent = '▍'
    textNode.appendChild(caret)
    let index = 0
    ;(function tick() {
      if (index >= line.length) {
        caret.remove()
        typingTimer = null
        memory.currentTypingLine = ''
        return
      }
      const ch = line.charAt(index)
      textNode.insertBefore(doc.createTextNode(ch), caret)
      index += 1
      let delay = 64
      if ('，。！？～…'.indexOf(ch) !== -1) delay = 260
      else if (ch === ' ') delay = 90
      else if (index % 5 === 0) delay = 130
      typingTimer = setT(tick, delay)
    })()
  }

  function ensureRoot() {
    let rootNode = doc.querySelector('[data-dsh-whale-pet-root]')
    if (rootNode) return rootNode
    rootNode = doc.createElement('div')
    rootNode.setAttribute('data-dsh-whale-pet-root', 'true')

    const frame = doc.createElement('div')
    frame.setAttribute('data-dsh-whale-pet-frame', 'true')
    frame.setAttribute('data-dsh-whale-pet-mascot', 'true')
    frame.setAttribute('aria-hidden', 'true')

    const motion = doc.createElement('div')
    motion.setAttribute('data-dsh-whale-pet-motion', 'true')

    const layerA = doc.createElement('img')
    layerA.alt = ''
    layerA.draggable = false
    layerA.setAttribute('data-dsh-whale-pet-layer', 'a')
    layerA.addEventListener('error', function () { layerA.style.display = 'none' })
    layerA.addEventListener('load', function () { layerA.style.display = '' })
    const layerB = doc.createElement('img')
    layerB.alt = ''
    layerB.draggable = false
    layerB.setAttribute('data-dsh-whale-pet-layer', 'b')
    layerB.addEventListener('error', function () { layerB.style.display = 'none' })
    layerB.addEventListener('load', function () { layerB.style.display = '' })
    motion.appendChild(layerA)
    motion.appendChild(layerB)
    frame.appendChild(motion)

    const bubble = doc.createElement('div')
    bubble.setAttribute('data-dsh-whale-pet-bubble', 'true')
    bubble.hidden = true
    const text = doc.createElement('span')
    text.setAttribute('data-dsh-whale-pet-bubble-text', 'true')
    const gear = doc.createElement('button')
    gear.type = 'button'
    gear.setAttribute('data-dsh-whale-pet-gear', 'true')
    gear.setAttribute('aria-label', '鲸鱼娘设置')
    gear.textContent = '⚙'
    gear.addEventListener('click', function (event) {
      event.stopPropagation()
      toggleSettingsPanel()
    })
    bubble.appendChild(text)
    bubble.appendChild(gear)

    const gearMini = doc.createElement('button')
    gearMini.type = 'button'
    gearMini.setAttribute('data-dsh-whale-pet-gear-mini', 'true')
    gearMini.setAttribute('aria-label', '鲸鱼娘设置')
    gearMini.textContent = '⚙'
    gearMini.addEventListener('click', function (event) {
      event.stopPropagation()
      toggleSettingsPanel()
    })

    rootNode.appendChild(frame)
    rootNode.appendChild(bubble)
    rootNode.appendChild(gearMini)
    doc.body.appendChild(rootNode)

    rootNode.addEventListener('click', function (event) { event.stopPropagation() })
    let suppressClick = false
    frame.addEventListener('click', function (event) {
      event.stopPropagation()
      if (suppressClick) { suppressClick = false; return }
      const m = rootNode.querySelector('[data-dsh-whale-pet-motion]')
      if (m && !motionReduced()) {
        m.classList.remove('dsh-whale-pet-react')
        void m.offsetWidth
        m.classList.add('dsh-whale-pet-react')
        setT(function () { m.classList.remove('dsh-whale-pet-react') }, 650)
      }
      patMascot()
    })
    frame.addEventListener('pointerdown', function (event) {
      pressStartedAt = Date.now()
      if (readMode() === 'float' && event.button === 0) startDrag(event, rootNode)
    })
    frame.addEventListener('contextmenu', function (event) {
      event.preventDefault()
      event.stopPropagation()
      showContextMenu(event.clientX, event.clientY)
    })
    rootNode.__dshWhalePetSuppressClick = function () { suppressClick = true }
    return rootNode
  }

  let dragState = null
  function startDrag(event, rootNode) {
    event.preventDefault()
    dragState = {
      node: rootNode,
      dx: event.clientX - rootNode.getBoundingClientRect().left,
      dy: event.clientY - rootNode.getBoundingClientRect().top,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    }
    on(root, 'pointermove', onDrag, true)
    on(root, 'pointerup', endDrag, true)
    on(root, 'pointercancel', endDrag, true)
  }
  function onDrag(event) {
    if (!dragState) return
    const node = dragState.node
    const width = node.getBoundingClientRect().width
    const height = node.getBoundingClientRect().height
    const left = event.clientX - dragState.dx
    const top = event.clientY - dragState.dy
    if (!dragState.moved && (Math.abs(event.clientX - dragState.startX) > 4 || Math.abs(event.clientY - dragState.startY) > 4)) {
      dragState.moved = true
      node.classList.add('dsh-whale-pet-dragging')
      schedule()
    }
    node.style.left = Math.round(clamp(left, 8, root.innerWidth - width - 8)) + 'px'
    node.style.top = Math.round(clamp(top, 8, root.innerHeight - height - 8)) + 'px'
    if (dragState.moved) {
      /* 摇摆跟随光标水平速度，而不是自动动画 */
      const motionNode = node.querySelector('[data-dsh-whale-pet-motion]')
      if (motionNode) {
        const vx = event.clientX - dragState.lastX
        const angle = clamp(vx * 1.1, -16, 16)
        motionNode.style.setProperty('--wmp-drag-angle', angle.toFixed(1) + 'deg')
      }
    }
    dragState.lastX = event.clientX
    dragState.lastY = event.clientY
  }
  function endDrag() {
    off(root, 'pointermove', onDrag, true)
    off(root, 'pointerup', endDrag, true)
    off(root, 'pointercancel', endDrag, true)
    if (dragState && dragState.node) {
      dragState.node.classList.remove('dsh-whale-pet-dragging')
    }
    if (dragState && dragState.moved && dragState.node) {
      writeFloatPos(parseFloat(dragState.node.style.left), parseFloat(dragState.node.style.top))
      const node = dragState.node
      if (node.__dshWhalePetSuppressClick) node.__dshWhalePetSuppressClick()
    }
    dragState = null
    schedule()
  }

  /* ---------- settings panel (Cordis port: self-contained popover) ---------- */

  function settingsCard(title) {
    const card = doc.createElement('div')
    card.className = 'wmp-card'
    const t = doc.createElement('div')
    t.className = 'wmp-card-title'
    t.textContent = title
    card.appendChild(t)
    return card
  }
  function settingsRow(label) {
    const row = doc.createElement('div')
    row.className = 'wmp-row'
    const span = doc.createElement('span')
    span.textContent = label
    row.appendChild(span)
    return row
  }
  function settingsSwitch(label, key, def) {
    const row = settingsRow(label)
    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.className = 'wmp-switch'
    btn.setAttribute('role', 'switch')
    btn.setAttribute('aria-pressed', String(prefOn(key, def)))
    const knob = doc.createElement('span')
    btn.appendChild(knob)
    btn.addEventListener('click', function () {
      const next = !prefOn(key, def)
      writeLS(key, next ? '1' : '0')
      btn.setAttribute('aria-pressed', String(next))
      root.dispatchEvent(new CustomEvent('whale-moe-prefs-change', { detail: { key, value: next ? '1' : '0' } }))
      if (key === 'pet') schedule()
    })
    row.appendChild(btn)
    return row
  }
  function buildStatsGrid() {
    const wrap = doc.createElement('div')
    wrap.className = 'wmp-stats'
    if (!growth) loadGrowth()
    const since = growth && growth.companionSince ? Number(growth.companionSince) : 0
    const days = since > 0 ? Math.max(0, Math.floor((Date.now() - since) / 86400000)) : 0
    const items = [
      ['😊', '心情', Math.round(growth.mood) + ' / 100'],
      ['💗', '好感度', String(Math.round(growth.affinity))],
      ['🍰', '饱食度', Math.round(growth.satiety) + ' / 100'],
      ['⭐', '等级', 'Lv.' + growth.level],
      ['📅', '签到', growth.signinStreak + ' 天'],
      ['⏳', '陪伴', days + ' 天'],
    ]
    for (let i = 0; i < items.length; i += 1) {
      const stat = doc.createElement('div')
      stat.className = 'wmp-stat'
      const icon = doc.createElement('span')
      icon.textContent = items[i][0]
      const label = doc.createElement('span')
      label.className = 'wmp-stat-label'
      label.textContent = items[i][1]
      const value = doc.createElement('span')
      value.className = 'wmp-stat-value'
      value.textContent = items[i][2]
      stat.append(icon, label, value)
      wrap.appendChild(stat)
    }
    return wrap
  }
  function buildAchievementWall() {
    const wrap = doc.createElement('div')
    wrap.className = 'wmp-achieve'
    if (!growth) loadGrowth()
    const have = growth ? growth.achievements : []
    for (let i = 0; i < core.ACHIEVEMENTS.length; i += 1) {
      const ach = core.ACHIEVEMENTS[i]
      const cell = doc.createElement('div')
      cell.className = 'wmp-ach ' + (have.indexOf(ach.id) !== -1 ? 'wmp-unlocked' : 'wmp-locked')
      cell.title = ach.desc
      const icon = doc.createElement('span')
      icon.textContent = ach.icon
      const name = doc.createElement('span')
      name.textContent = ach.name
      cell.append(icon, name)
      wrap.appendChild(cell)
    }
    return wrap
  }
  function buildSettingsPanel() {
    const panel = doc.createElement('div')
    panel.setAttribute('data-dsh-whale-pet-panel', 'true')
    panel.setAttribute('data-skin-owner', SKIN_OWNER)

    const header = doc.createElement('header')
    const title = doc.createElement('span')
    title.textContent = '鲸鱼娘设置'
    const close = doc.createElement('button')
    close.type = 'button'
    close.textContent = '✕'
    close.setAttribute('aria-label', '关闭设置')
    close.addEventListener('click', function () { panel.remove() })
    header.append(title, close)
    panel.appendChild(header)

    /* 基础 */
    const base = settingsCard('基础')
    const titleRow = settingsRow('如何称呼我')
    const titleInput = doc.createElement('input')
    titleInput.type = 'text'
    titleInput.maxLength = 8
    titleInput.placeholder = '主人'
    titleInput.value = readLS('title', '主人')
    titleInput.addEventListener('change', function () {
      writeLS('title', titleInput.value)
      root.dispatchEvent(new CustomEvent('whale-moe-prefs-change', { detail: { key: 'title', value: titleInput.value } }))
    })
    titleRow.appendChild(titleInput)
    base.append(titleRow, settingsSwitch('鲸鱼娘', 'pet', false), settingsSwitch('台词气泡', 'chat', true), settingsSwitch('粒子效果', 'particles', true))
    const modeRow = settingsRow('形态')
    const modeSel = doc.createElement('select')
    const modes = [['auto', '自动'], ['float', '悬浮'], ['side', '侧栏'], ['bar', '输入条'], ['mini', '迷你']]
    for (let i = 0; i < modes.length; i += 1) {
      const opt = doc.createElement('option')
      opt.value = modes[i][0]
      opt.textContent = modes[i][1]
      if (modes[i][0] === readMode()) opt.selected = true
      modeSel.appendChild(opt)
    }
    modeSel.addEventListener('change', function () {
      writeLS('mode', modeSel.value)
      const line = say('interact', 'mode')
      if (line) showLine(line)
      root.dispatchEvent(new CustomEvent('whale-moe-prefs-change', { detail: { key: 'mode', value: modeSel.value } }))
    })
    modeRow.appendChild(modeSel)
    base.appendChild(modeRow)
    panel.appendChild(base)

    /* 智能 */
    const smart = settingsCard('智能')
    smart.append(settingsSwitch('关键词感知（默认关）', 'keywords', false), settingsSwitch('摸鱼提醒', 'idle-nudge', true), settingsSwitch('深夜模式', 'night', true))
    panel.appendChild(smart)

    /* 天气 */
    const weatherCard = settingsCard('天气')
    const cityRow = settingsRow('天气城市')
    const cityInput = doc.createElement('input')
    cityInput.type = 'text'
    cityInput.maxLength = 24
    cityInput.placeholder = '如：上海（留空不联网）'
    cityInput.value = readLS('weatherCity', '')
    cityInput.addEventListener('change', function () {
      writeLS('weatherCity', cityInput.value)
      root.dispatchEvent(new CustomEvent('whale-moe-prefs-change', { detail: { key: 'weatherCity', value: cityInput.value } }))
    })
    cityRow.appendChild(cityInput)
    const keyRow = settingsRow('API Key（选填）')
    const keyInput = doc.createElement('input')
    keyInput.type = 'password'
    keyInput.maxLength = 128
    keyInput.placeholder = 'Open-Meteo 免费无需 Key'
    keyInput.value = readLS('weatherKey', '')
    keyInput.addEventListener('change', function () { writeLS('weatherKey', keyInput.value) })
    keyRow.appendChild(keyInput)
    const testRow = settingsRow('')
    const statusEl = doc.createElement('span')
    statusEl.className = 'wmp-status'
    statusEl.textContent = weatherState.status === 'ok' ? '✅ 已连接' : ''
    const testBtn = doc.createElement('button')
    testBtn.type = 'button'
    testBtn.className = 'wmp-btn'
    testBtn.textContent = '测试连接'
    testBtn.addEventListener('click', function () {
      testBtn.disabled = true
      testBtn.textContent = '测试中…'
      statusEl.textContent = '⏳ 正在连接 Open-Meteo…'
      weatherTest(cityInput.value, keyInput.value).then(function (text) {
        statusEl.textContent = text
        testBtn.disabled = false
        testBtn.textContent = '测试连接'
      }, function (error) {
        statusEl.textContent = '❌ 连接失败：' + (error && error.message ? error.message : '未知错误') + '（无 Key 也可用）'
        testBtn.disabled = false
        testBtn.textContent = '测试连接'
      })
    })
    testRow.append(statusEl, testBtn)
    weatherCard.append(cityRow, keyRow, testRow)
    panel.appendChild(weatherCard)

    /* 养成 */
    const growthCard = settingsCard('养成')
    growthCard.appendChild(buildStatsGrid())
    panel.appendChild(growthCard)

    /* 成就 */
    const achCard = settingsCard('成就')
    achCard.appendChild(buildAchievementWall())
    panel.appendChild(achCard)

    /* 位置与数据 */
    const dataCard = settingsCard('位置与数据')
    const posRow = settingsRow('悬浮位置')
    const posBtn = doc.createElement('button')
    posBtn.type = 'button'
    posBtn.className = 'wmp-btn'
    posBtn.textContent = '重置到默认位置'
    posBtn.addEventListener('click', function () {
      try {
        root.localStorage.removeItem('whale-moe:floatX')
        root.localStorage.removeItem('whale-moe:floatY')
      } catch (e) { /* ignore */ }
      root.dispatchEvent(new CustomEvent('whale-moe-prefs-change', { detail: { key: 'float-reset', value: true } }))
      schedule()
    })
    posRow.appendChild(posBtn)
    const growthRow = settingsRow('养成数据')
    const growthBtn = doc.createElement('button')
    growthBtn.type = 'button'
    growthBtn.className = 'wmp-btn'
    growthBtn.textContent = '重置养成'
    growthBtn.addEventListener('click', function () {
      ;['mood', 'affinity', 'satiety', 'lastSignin', 'signinStreak', 'achievements', 'companionSince', 'level'].forEach(function (k) {
        try { root.localStorage.removeItem('whale-moe:' + k) } catch (e) { /* ignore */ }
      })
      growth = null
      loadGrowth()
      const line = say('interact', 'reset')
      if (line) showLine(line)
      root.dispatchEvent(new CustomEvent('whale-moe-prefs-change', { detail: { key: 'growth-reset', value: true } }))
      schedule()
    })
    growthRow.appendChild(growthBtn)
    dataCard.append(posRow, growthRow)
    panel.appendChild(dataCard)

    return panel
  }
  function toggleSettingsPanel() {
    const existing = doc.querySelector('[data-dsh-whale-pet-panel]')
    if (existing) { existing.remove(); return }
    doc.body.appendChild(buildSettingsPanel())
  }

  /* ---------- context menu ---------- */

  function showContextMenu(x, y) {
    const old = doc.querySelector('[data-dsh-whale-pet-context]')
    if (old) old.remove()
    const menu = doc.createElement('div')
    menu.setAttribute('data-dsh-whale-pet-context', 'true')
    const items = [
      { label: '投喂小点心', action: function () { const out = applyGrowth({ type: 'feed' }, Date.now(), 0); burst('🍰'); showMood('eat', 3000); const line = say('interact', 'feed'); if (line) showLine(line); if (out.unlocks.length) announceUnlocks(out.unlocks) } },
      { label: '戳一下', action: function () { applyGrowth({ type: 'poke' }, Date.now(), 0); burst('💢'); showMood('angry', 3000); const line = say('interact', 'poke'); if (line) showLine(line) } },
      { label: '夸夸 鲸鱼娘', action: function () { applyGrowth({ type: 'praise' }, Date.now(), 0); burst('✨'); showMood('star', 3000); const line = say('interact', 'praise'); if (line) showLine(line) } },
      { label: '回到原位', action: function () { try { root.localStorage.removeItem('whale-moe:floatX'); root.localStorage.removeItem('whale-moe:floatY') } catch (e) { /* ignore */ } reconcile() } },
      { label: '打开设置', action: function () { toggleSettingsPanel() } },
      { label: '关闭菜单', action: function () { menu.remove() } },
    ]
    for (let i = 0; i < items.length; i += 1) {
      ;(function (item) {
        const btn = doc.createElement('button')
        btn.type = 'button'
        btn.textContent = item.label
        btn.addEventListener('click', function (event) { event.stopPropagation(); item.action(); menu.remove() })
        menu.appendChild(btn)
      })(items[i])
    }
    doc.body.appendChild(menu)
    menu.style.left = Math.min(x, root.innerWidth - 180) + 'px'
    menu.style.top = Math.min(y, root.innerHeight - 160) + 'px'
    on(doc, 'pointerdown', function closer(event) {
      if (!menu.contains(event.target)) { menu.remove(); off(doc, 'pointerdown', closer, true) }
    }, true)
  }

  /* ---------- interactions ---------- */

  const patHistory = []
  let celebrateUntil = 0
  let pressStartedAt = 0
  let moodTimer = null
  let lastTripleAt = 0
  let lastPatProcessedAt = 0
  let lastPatSpeechAt = 0
  let lastBalanceLowAt = 0
  let lastNudgeAt = 0
  let nudgeCounter = 0

  function showMood(kind, duration, animate) {
    const rootNode = doc.querySelector('[data-dsh-whale-pet-root]')
    if (!rootNode) return
    memory.moodPose = kind
    memory.moodUntil = Date.now() + (duration || 3000)
    memory.moodAnimate = animate === true
    schedule()
    if (moodTimer) { clearT(moodTimer); moodTimer = null }
    moodTimer = setT(function () {
      moodTimer = null
      memory.moodPose = ''
      memory.moodUntil = 0
      memory.moodAnimate = false
      schedule()
    }, duration || 3000)
  }

  function fxAt(x, y, kind) {
    if (motionReduced() || !readPref('particles')) return
    const span = doc.createElement('span')
    span.setAttribute('data-dsh-whale-pet-fx', 'true')
    span.className = kind
    span.style.left = Math.round(x) + 'px'
    span.style.top = Math.round(y) + 'px'
    doc.body.appendChild(span)
    span.addEventListener('animationend', function () { span.remove() }, { once: true })
    setT(function () { span.remove() }, 1300)
  }

  function patMascot() {
    const now = Date.now()
    if (now < celebrateUntil) return
    patHistory.push(now)
    while (patHistory.length && now - patHistory[0] >= 2000) patHistory.shift()
    if (patHistory.length >= 3 && now - lastTripleAt >= 2600) {
      patHistory.length = 0
      lastTripleAt = now
      lastPatProcessedAt = now
      celebrateUntil = now + 2200
      memory.celebrationVisible = false
      spawnParticles(12, now)
      showMood('star', 2200)
      const trip = applyGrowth({ type: 'triple' }, now, 0)
      if (trip.unlocks.length) announceUnlocks(trip.unlocks)
      const node = doc.querySelector('[data-dsh-whale-pet-root]')
      if (node && !motionReduced()) {
        const motionNode = node.querySelector('[data-dsh-whale-pet-motion]')
        if (motionNode) {
          motionNode.classList.add('dsh-whale-pet-spin')
          setT(function () { motionNode.classList.remove('dsh-whale-pet-spin') }, 850)
        }
      }
    } else {
      /* rapid-fire clicks: keep pose/particle feedback but skip growth and
         speech churn so the bubble never stutters 诶嘿诶嘿 repeatedly */
      const rapid = now - lastPatProcessedAt < 450
      lastPatProcessedAt = now
      const busyNow = BUSY_STATES[memory.state.state] === 1
      showMood(busyNow ? (Math.random() < 0.5 ? 'work-pat' : 'work-ram') : 'blush', busyNow ? 2400 : 2600)
      emojiBurst(busyNow ? ['💻', '💦', '✨'] : ['💖', '✨', '⭐'])
      if (rapid) { reconcile(); return }
      const pat = applyGrowth({ type: 'pat' }, now, patHistory.length)
      if (now - lastPatSpeechAt >= 2500) {
        lastPatSpeechAt = now
        const patLine = say('interact', 'pat')
        if (patLine) showLine(patLine)
      }
      if (pat.unlocks.length) announceUnlocks(pat.unlocks)
    }
    reconcile()
  }

  function showLineNow(line) {
    const rootNode = ensureRoot()
    const bubble = rootNode.querySelector('[data-dsh-whale-pet-bubble]')
    const text = rootNode.querySelector('[data-dsh-whale-pet-bubble-text]')
    if (!bubble || !text) return
    const wasHidden = bubble.hidden
    bubble.classList.remove('dsh-whale-pet-out')
    if (memory.bubbleOutTimer) { clearT(memory.bubbleOutTimer); memory.bubbleOutTimer = null }
    typeBubble(text, localizeLine(line))
    bubble.hidden = false
    memory.bubbleHideAt = Date.now() + 4500
    if (wasHidden) bubble.classList.add('dsh-whale-pet-pop')
  }

  function scheduleNext() {
    if (nextTimer) clearT(nextTimer)
    nextTimer = setT(function () {
      nextTimer = null
      const next = memory.pendingLine
      memory.pendingLine = ''
      if (next) showLineNow(next)
    }, 160)
  }

  function showLine(line) {
    const rootNode = ensureRoot()
    const bubble = rootNode.querySelector('[data-dsh-whale-pet-bubble]')
    const text = rootNode.querySelector('[data-dsh-whale-pet-bubble-text]')
    if (!bubble || !text) return
    /* single-slot queue: never restart the typewriter or stack timers */
    if (!bubble.hidden && (typingTimer || nextTimer)) {
      if (typingTimer) {
        clearT(typingTimer)
        typingTimer = null
        text.textContent = memory.currentTypingLine
        memory.currentTypingLine = ''
      }
      memory.pendingLine = line
      scheduleNext()
      return
    }
    memory.pendingLine = ''
    showLineNow(line)
  }

  function announceUnlocks(ids) {
    const label = core.ACHIEVEMENTS.filter(function (a) { return ids.indexOf(a.id) !== -1 }).map(function (a) { return a.name }).join('、')
    if (!label) return
    burst('🏅')
    showLine('成就达成：' + label + '！')
  }

  function spawnParticles(count, now) {
    if (!readPref('particles') || motionReduced()) return
    const current = doc.querySelectorAll('[data-dsh-whale-pet-particle]').length
    count = Math.max(0, Math.min(count, PARTICLE_MAX - current))
    const kinds = ['dot', 'spark', 'heart']
    for (let i = 0; i < count; i += 1) {
      const span = doc.createElement('span')
      span.setAttribute('data-dsh-whale-pet-particle', 'true')
      span.className = 'dsh-particle-' + kinds[(now + i) % kinds.length]
      const rootNode = ensureRoot()
      const rect = rootNode.getBoundingClientRect()
      const drift = Math.round((Math.random() - 0.5) * 30)
      span.style.left = Math.round(rect.left + rect.width / 2 + drift) + 'px'
      span.style.top = Math.round(rect.top + rect.height * 0.35) + 'px'
      span.style.setProperty('--wmp-drift', drift + 'px')
      doc.body.appendChild(span)
      span.addEventListener('animationend', function () { span.remove() }, { once: true })
      setT(function () { span.remove() }, 1100)
    }
  }

  function motionReduced() {
    try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
  }

  /* ---------- state plumbing ---------- */

  let growth = null
  const dialogueCounters = { daily: {}, work: {}, interact: {}, keyword: {} }
  let keywordScanTimer = null
  let lastChatCount = 0
  let lastCodeCount = 0

  function loadGrowth() {
    try {
      let since = root.localStorage.getItem('whale-moe:companionSince')
      if (since === null) {
        since = String(Date.now())
        try { root.localStorage.setItem('whale-moe:companionSince', since) } catch (e) { /* ignore */ }
      }
      growth = {
        mood: Number(root.localStorage.getItem('whale-moe:mood')) || core.DEFAULT_GROWTH.mood,
        affinity: Number(root.localStorage.getItem('whale-moe:affinity')) || 0,
        satiety: Number(root.localStorage.getItem('whale-moe:satiety')) || core.DEFAULT_GROWTH.satiety,
        lastSignin: root.localStorage.getItem('whale-moe:lastSignin') || '',
        signinStreak: Number(root.localStorage.getItem('whale-moe:signinStreak')) || 0,
        achievements: (root.localStorage.getItem('whale-moe:achievements') || '').split(',').filter(Boolean),
        level: Number(root.localStorage.getItem('whale-moe:level')) || 1,
        companionSince: Number(since) || Date.now(),
      }
    } catch (e) { growth = { ...core.DEFAULT_GROWTH, companionSince: Date.now() } }
  }
  function saveGrowth() {
    try {
      root.localStorage.setItem('whale-moe:mood', String(Math.round(growth.mood)))
      root.localStorage.setItem('whale-moe:affinity', String(Math.round(growth.affinity)))
      root.localStorage.setItem('whale-moe:satiety', String(Math.round(growth.satiety)))
      root.localStorage.setItem('whale-moe:lastSignin', growth.lastSignin)
      root.localStorage.setItem('whale-moe:signinStreak', String(growth.signinStreak))
      root.localStorage.setItem('whale-moe:achievements', growth.achievements.join(','))
      root.localStorage.setItem('whale-moe:level', String(growth.level))
      if (growth.companionSince) root.localStorage.setItem('whale-moe:companionSince', String(growth.companionSince))
    } catch (e) { /* storage unavailable */ }
  }
  function syncCompanionAchievements(now) {
    if (!growth || !growth.companionSince) return
    const days = Math.max(0, Math.floor((now - growth.companionSince) / 86400000))
    const tiers = [{ id: 'day1', days: 1 }, { id: 'day7', days: 7 }, { id: 'day30', days: 30 }]
    const unlocks = tiers.filter(function (tier) { return days >= tier.days && growth.achievements.indexOf(tier.id) === -1 }).map(function (tier) { return tier.id })
    if (unlocks.length) {
      growth.achievements = growth.achievements.concat(unlocks)
      saveGrowth()
      announceUnlocks(unlocks)
    }
  }

  let usageStats = null
  const USAGE_TIERS = Object.freeze({
    'first-tool': { key: 'tools', min: 1 },
    'tools-10': { key: 'tools', min: 10 },
    'tools-50': { key: 'tools', min: 50 },
    'tools-100': { key: 'tools', min: 100 },
    'first-code': { key: 'code', min: 1 },
    'code-20': { key: 'code', min: 20 },
    'first-success': { key: 'successes', min: 1 },
    'success-10': { key: 'successes', min: 10 },
    'first-failure': { key: 'failures', min: 1 },
    'fail-10': { key: 'failures', min: 10 },
    'messages-100': { key: 'messages', min: 100 },
    'messages-500': { key: 'messages', min: 500 },
    'keyword-master': { key: 'keywords', min: 10 },
  })
  function loadUsageStats() {
    try {
      usageStats = JSON.parse(root.localStorage.getItem('whale-moe:usageStats') || 'null') || { tools: 0, code: 0, successes: 0, failures: 0, messages: 0, keywords: 0 }
    } catch (e) { usageStats = { tools: 0, code: 0, successes: 0, failures: 0, messages: 0, keywords: 0 } }
  }
  function saveUsageStats() {
    try { root.localStorage.setItem('whale-moe:usageStats', JSON.stringify(usageStats)) } catch (e) { /* ignore */ }
  }
  function addUsageStat(key, amount) {
    if (!usageStats) loadUsageStats()
    usageStats[key] = (usageStats[key] || 0) + amount
    saveUsageStats()
    const unlocks = []
    for (const id in USAGE_TIERS) {
      const tier = USAGE_TIERS[id]
      if (usageStats[tier.key] >= tier.min && (!growth || growth.achievements.indexOf(id) === -1)) unlocks.push(id)
    }
    if (unlocks.length) {
      if (growth) growth.achievements = growth.achievements.concat(unlocks)
      saveGrowth()
      announceUnlocks(unlocks)
    }
  }
  function applyGrowth(event, now, pats) {
    const out = core.computeGrowth(growth, event, now, pats)
    growth = out.growth
    saveGrowth()
    return out
  }
  function say(bank, event) {
    if (!readPref('chat')) return ''
    dialogueCounters[bank][event] = (dialogueCounters[bank][event] || 0) + 1
    return core.pickDialogue(bank, event, dialogueCounters[bank][event], Math.random)
  }
  function keywordsEnabled() {
    try { return root.localStorage.getItem('whale-moe:keywords') === '1' } catch (e) { return false }
  }
  function title() {
    try { const t = root.localStorage.getItem('whale-moe:title'); return t && t.trim() ? t.trim() : '主人' } catch (e) { return '主人' }
  }
  function localizeLine(line) {
    return String(line).split('主人').join(title())
  }
  function isNight(now) {
    const h = new Date(now || Date.now()).getHours()
    let nightOn = true
    try { nightOn = root.localStorage.getItem('whale-moe:night') !== '0' } catch (e) { /* default on */ }
    return nightOn && (h >= 22 || h < 6)
  }

  function holdSignals(signals, now) {
    if (!signals.error && !signals.tool && !signals.thinking && now < memory.stateHoldUntil) {
      if (memory.lastEventState === 'failure') signals.error = true
      else if (memory.lastEventState === 'success') signals.successAt = now
      else if (memory.lastEventState === 'curious') signals.curiousAt = now
    }
    return signals
  }

  function blinkOnce() {
    const rootNode = doc.querySelector('[data-dsh-whale-pet-root]')
    if (!rootNode || motionReduced() || memory.state.state !== 'idle') return
    const layer = rootNode.querySelector('[data-dsh-whale-pet-layer].dsh-whale-pet-active')
    if (!layer) return
    layer.style.transition = 'opacity 120ms ease'
    layer.style.opacity = '0.94'
    setT(function () { layer.style.opacity = '' }, 140)
    setT(function () { layer.style.transition = '' }, 400)
  }

  function showChip(label, persist) {
    const rootNode = doc.querySelector('[data-dsh-whale-pet-root]')
    if (!rootNode || motionReduced()) return
    const old = rootNode.querySelector('[data-dsh-whale-pet-chip]')
    if (old) old.remove()
    const chip = doc.createElement('span')
    chip.setAttribute('data-dsh-whale-pet-chip', 'true')
    chip.textContent = label
    rootNode.appendChild(chip)
    if (!persist) setT(function () { chip.remove() }, 2200)
  }

  const memory = {
    view: 'home',
    viewChangedAt: -Infinity,
    lastInteractionAt: Date.now(),
    toolWasActive: false,
    toolSeenAt: 0,
    toolGoneAt: 0,
    toolRawSeen: false,
    thinkingSeenAt: 0,
    thinkingGoneAt: 0,
    thinkingRawSeen: false,
    lastSuccessAt: -Infinity,
    state: { state: 'idle', lastSpeechAt: -Infinity },
    idleTick: 0,
    idlePoseIndex: 0,
    idlePoseFor: 9000,
    lastIdlePoseAt: 0,
    nextIdleMicroAt: 0,
    nextIdleActionAt: 0,
    failureStreak: 0,
    lastGrowthTick: 0,
    stateHoldUntil: 0,
    lastEventState: '',
    moodPose: '',
    moodUntil: 0,
    moodAnimate: false,
    celebrationVisible: false,
    currentTypingLine: '',
    pendingLine: '',
    bubbleOutTimer: null,
    lastPoseSrc: '',
    lastLine: '',
    bubbleHideAt: 0,
    errorBaseline: null,
    failed: false,
  }

  function errorVisible() {
    memory.lastErrorMatches = []
    let baseline = memory.errorBaseline
    const firstPass = baseline === null
    if (firstPass) baseline = memory.errorBaseline = []
    for (let i = 0; i < SIGNAL_BANKS.error.length; i += 1) {
      const nodes = doc.querySelectorAll(SIGNAL_BANKS.error[i])
      for (let j = 0; j < nodes.length; j += 1) {
        const n = nodes[j]
        /* Historical DSH log clusters carry data-state="error" for a failed
           step that already finished; they are records, not live failures. */
        if (typeof n.closest === 'function' && n.closest('[class*="dshLogCluster"]')) continue
        /* First pass: seed every pre-existing error node as history.
           Any node created after this pass is live and keeps the failure
           state for as long as it remains visible. */
        if (firstPass) { baseline.push(n); continue }
        if (baseline.indexOf(n) !== -1) continue
        if (!isVisible(n)) continue
        const meaningful = n.getAttribute('role') === 'alert'
          || n.getAttribute('aria-invalid') === 'true'
          || (n.textContent || '').trim().length > 0
        if (!meaningful) continue
        memory.lastErrorMatches.push({
          sel: SIGNAL_BANKS.error[i],
          tag: n.tagName,
          cls: String(n.className).slice(0, 120),
          txt: (n.textContent || '').trim().slice(0, 80),
          role: n.getAttribute('role'),
          ariaInvalid: n.getAttribute('aria-invalid'),
        })
        return true
      }
    }
    return false
  }

  function toolVisible() {
    for (let i = 0; i < SIGNAL_BANKS.tool.length; i += 1) {
      const nodes = doc.querySelectorAll(SIGNAL_BANKS.tool[i])
      for (let j = 0; j < nodes.length; j += 1) {
        const n = nodes[j]
        /* 历史步骤卡片会永久带着 data-state="running"；会话消息流内的
           视为历史，消息流之外的运行标记才代表当前正在工作。 */
        if (SIGNAL_BANKS.tool[i] === '[data-state="running"]') {
          if (typeof n.closest === 'function' && n.closest('[data-slot="conversation.chat.node"]')) continue
        }
        if (isVisible(n)) return true
      }
    }
    return false
  }

  function collectSignals() {
    const now = Date.now()
    const view = detectView()
    const rawTool = toolVisible()
    const rawThinking = anyVisible(SIGNAL_BANKS.thinking)
    /* 消抖：信号必须连续存在 300ms 才算数；消失后按场景保持——
       主页 4s、工作台 8s。工作台的工具面板在任务间会短暂空白，
       拉长保持时间让工作姿势在整段工作期间钉住，不再反复切换。 */
    const goneHold = view === 'workbench' ? 8000 : 4000
    const wasRawTool = memory.toolRawSeen
    if (rawTool) {
      if (!memory.toolSeenAt) memory.toolSeenAt = now
      memory.toolRawSeen = true
    } else {
      memory.toolSeenAt = 0
      /* 只在下沿记录“开始消失的时刻”，中间回来又消失则重新起算 */
      if (wasRawTool || !memory.toolGoneAt) memory.toolGoneAt = now
      memory.toolRawSeen = false
    }
    const wasRawThinking = memory.thinkingRawSeen
    if (rawThinking) {
      if (!memory.thinkingSeenAt) memory.thinkingSeenAt = now
      memory.thinkingRawSeen = true
    } else {
      memory.thinkingSeenAt = 0
      if (wasRawThinking || !memory.thinkingGoneAt) memory.thinkingGoneAt = now
      memory.thinkingRawSeen = false
    }
    /* 关键：信号短暂消失又回来时，seenAt 会归零重算。不能因此把
       active 直接打回 false —— 只要没离开满 goneHold，就一直钉在工作态。 */
    const toolActive = rawTool
      ? (now - memory.toolSeenAt >= 300 || (memory.toolGoneAt !== 0 && now - memory.toolGoneAt < goneHold))
      : memory.toolGoneAt !== 0 && now - memory.toolGoneAt < goneHold
    const thinkingActive = rawThinking
      ? (now - memory.thinkingSeenAt >= 300 || (memory.thinkingGoneAt !== 0 && now - memory.thinkingGoneAt < goneHold))
      : memory.thinkingGoneAt !== 0 && now - memory.thinkingGoneAt < goneHold
    const errorActive = errorVisible()
    memory.lastErrorActive = errorActive
    if (view === 'workbench' && memory.toolWasActive && !toolActive && !errorActive) memory.lastSuccessAt = now
    memory.toolWasActive = toolActive
    const dense = countVisible(SIGNAL_BANKS.code) >= 3
    /* Workbench uses exactly two moods: busy (tool/thinking/success/failure)
       vs calm (idle rotation). The old "waiting" sweat pose no longer fires. */
    return {
      view,
      waiting: false,
      thinking: thinkingActive,
      tool: toolActive,
      successAt: anyVisible(SIGNAL_BANKS.success) ? now : memory.lastSuccessAt,
      error: errorActive,
      curiousAt: memory.viewChangedAt,
      lastInteraction: memory.lastInteractionAt,
      denseCode: dense,
    }
  }

  function render(computed) {
    if (!readPref('pet') || !computed || computed.state === 'hidden') {
      removeRoot()
      if (doc.body) doc.body.removeAttribute(VIEW_ATTR)
      debugState = { state: 'hidden', pose: null, line: '', view: memory.view }
      root.__dshWhalePetDebug = debugState
      return
    }
    const rootNode = ensureRoot()
    const frame = rootNode.querySelector('[data-dsh-whale-pet-frame]')
    const bubble = rootNode.querySelector('[data-dsh-whale-pet-bubble]')
    const bubbleText = rootNode.querySelector('[data-dsh-whale-pet-bubble-text]')
    const view = memory.view

    /* layout routing */
    const layout = resolveLayout(view, computed)
    const moodActive = memory.moodUntil > Date.now() && !!memory.moodPose
    /* 工作态优先级最高：只要在忙，情绪姿势一律让位给 running，
       只有点击互动专用的 work-pat/work-ram 可以短暂覆盖。 */
    const moodAllowed = BUSY_STATES[computed.state] !== 1 || memory.moodPose === 'work-pat' || memory.moodPose === 'work-ram'
    if (!layout || layout.hidden) {
      rootNode.style.display = 'none'
    } else {
      if (moodActive && moodAllowed) {
        layout.src = poseSrc(memory.moodPose)
      }
      if (layout.anchor) placeAnchored(rootNode, layout)
      else placeAt(rootNode, layout.x, layout.y, layout.w, layout.h)
      rootNode.style.width = layout.w + 'px'
      rootNode.style.height = layout.h + 'px'
      frame.style.width = layout.w + 'px'
      frame.style.height = layout.h + 'px'
      frame.style.cursor = layout.kind === 'float' ? 'grab' : 'pointer'
      rootNode.setAttribute('data-dsh-whale-pet-mode', layout.kind)
      if (layout.kind === 'mini') rootNode.setAttribute('data-dsh-whale-pet-dense', 'true')
      else rootNode.removeAttribute('data-dsh-whale-pet-dense')
      /* 忙闲视觉：工作中持续亮状态签 + 光晕，空闲立即撤掉 */
      if (BUSY_STATES[computed.state] === 1) {
        rootNode.setAttribute('data-dsh-whale-pet-busy', 'true')
        const chipNow = rootNode.querySelector('[data-dsh-whale-pet-chip]')
        if (!chipNow || chipNow.textContent !== STATE_CHIP[computed.state]) showChip(STATE_CHIP[computed.state], true)
      } else {
        rootNode.removeAttribute('data-dsh-whale-pet-busy')
        const idleChip = rootNode.querySelector('[data-dsh-whale-pet-chip]')
        if (idleChip) idleChip.remove()
      }
    }
    if (!layout.hidden) setPose(layout.src, true, moodActive ? memory.moodAnimate : true)

    /* celebration override: 3 quick pats — type once, then keep the finished
       bubble stable so repeated renders/reconciles can never re-jump it */
    if (Date.now() < celebrateUntil && view !== 'settings' && readPref('chat')) {
      const celebLine = localizeLine('诶嘿～最喜欢主人啦！')
      if (!memory.celebrationVisible) {
        memory.celebrationVisible = true
        memory.lastLine = celebLine
        typeBubble(bubbleText, celebLine)
        bubble.hidden = false
        memory.bubbleHideAt = Date.now() + 4500
        bubble.classList.remove('dsh-whale-pet-pop')
        void bubble.offsetWidth
        bubble.classList.add('dsh-whale-pet-pop')
      }
      return
    }
    if (memory.celebrationVisible) memory.celebrationVisible = false

    /* speech: only meaningful workbench events speak */
    const eventStates = { failure: 1, success: 1, tool: 1, thinking: 1, curious: 1 }
    if (computed.speak && readPref('chat') && view === 'workbench' && eventStates[computed.state] && !typingTimer) {
      typeBubble(bubbleText, computed.line)
      bubble.hidden = false
      memory.bubbleHideAt = Date.now() + 4500
      if (!motionReduced() && computed.line !== memory.lastLine) {
        bubble.classList.remove('dsh-whale-pet-pop')
        void bubble.offsetWidth
        bubble.classList.add('dsh-whale-pet-pop')
      }
    } else {
      /* keep the current manual line until its expiry; never force-hide here,
         otherwise showLine() lines flicker for a single frame */
    }
    if (!bubble.hidden && Date.now() > memory.bubbleHideAt && !typingTimer && !nextTimer) {
      if (!memory.bubbleOutTimer) {
        bubble.classList.add('dsh-whale-pet-out')
        memory.bubbleOutTimer = setT(function () {
          memory.bubbleOutTimer = null
          bubble.hidden = true
          bubble.classList.remove('dsh-whale-pet-out')
        }, 200)
      }
    }

    /* error shake + success sparkle + ADV attention burst + growth/dialogue, only on state change */
    if (computed.state !== memory.state.state) {
      if (STATE_HOLD_MS[computed.state]) {
        memory.lastEventState = computed.state
        memory.stateHoldUntil = Date.now() + STATE_HOLD_MS[computed.state]
      }
      if (STATE_CHIP[computed.state]) showChip(STATE_CHIP[computed.state], BUSY_STATES[computed.state] === 1)
      if (computed.state === 'failure') {
        memory.failureStreak += 1
        addUsageStat('failures', 1)
        applyGrowth({ type: 'failure' }, Date.now(), 0)
        burst('！')
        if (view === 'workbench') {
          const fLine = say('work', memory.failureStreak >= 3 ? 'gentle' : 'failure')
          if (fLine) showLine(fLine)
        }
        if (!motionReduced()) {
          rootNode.classList.remove('dsh-whale-pet-shake')
          void rootNode.offsetWidth
          rootNode.classList.add('dsh-whale-pet-shake')
          rootNode.addEventListener('animationend', function handler() { rootNode.classList.remove('dsh-whale-pet-shake'); rootNode.removeEventListener('animationend', handler) })
        }
      }
      if (computed.state === 'success') {
        memory.failureStreak = 0
        addUsageStat('successes', 1)
        applyGrowth({ type: 'success' }, Date.now(), 0)
        burst('★')
        spawnParticles(12, Date.now())
        if (view === 'workbench') {
          const sLine = say('work', 'success')
          if (sLine) showLine(sLine)
        }
      }
      if (computed.state === 'tool' || computed.state === 'thinking') {
        addUsageStat('tools', 1)
        if (isNight(Date.now()) && growth && growth.achievements.indexOf('night-work') === -1) {
          growth.achievements.push('night-work')
          saveGrowth()
          announceUnlocks(['night-work'])
        }
        burst('…')
        if (view === 'workbench') {
          const tLine = say('work', computed.state === 'tool' ? 'tool' : 'thinking')
          if (tLine) showLine(tLine)
        }
      }
    }

    memory.state = computed
    memory.lastLine = computed.line
    debugState = {
      state: computed.state, pose: computed.pose, line: computed.line, view,
      mode: readMode(), layout: layout.kind, failed: memory.failed,
      errorMatches: memory.lastErrorMatches, errorActive: memory.lastErrorActive,
      lastEventState: memory.lastEventState, stateHoldUntil: memory.stateHoldUntil,
      holdLeft: Math.max(0, memory.stateHoldUntil - Date.now()),
      moodPose: memory.moodPose, moodUntil: memory.moodUntil, moodAnimate: memory.moodAnimate,
      layers: { active: layerState.active, loaded: layerState.loaded, gen: layerState.gen, pendingSwap: layerState.pendingSwap, pendingSince: layerState.pendingSince },
      toolWasActive: memory.toolWasActive, lastSuccessAt: memory.lastSuccessAt,
      toolGoneAt: memory.toolGoneAt, toolSeenAt: memory.toolSeenAt, at: Date.now(),
      idleChat: { nextAt: idleChat.nextAt, lastGreetAt: idleChat.lastGreetAt, lastGreetBucket: idleChat.lastGreetBucket },
      weather: weatherSummary(),
    }
    root.__dshWhalePetDebug = debugState
  }

  /* 待机 base 稳定为 idle-cute；情绪动作只由随机低频的 showMood 覆盖。
     拖拽中显示“被拎起来”并交给 CSS 左右摇摆。 */
  function statePose(computed, view) {
    if (dragState && dragState.moved) return 'pick-up'
    /* 忙时情绪让位：running 优先，仅点击互动专用的两个姿势可覆盖 */
    const busy = BUSY_STATES[computed.state] === 1
    const moodOk = !busy || memory.moodPose === 'work-pat' || memory.moodPose === 'work-ram'
    if (memory.moodUntil > Date.now() && memory.moodPose && moodOk) return memory.moodPose
    if (computed.state === 'idle') return 'idle-cute'
    return computed.pose
  }

  function peekSize(id, fallbackW, fallbackH) {
    const c = WHALE_MOE_PEEK_CALIBRATION[id]
    if (!c || !c.bboxW || !c.bboxH || !c.w) return { w: fallbackW, h: fallbackH }
    let w = Math.round(fallbackH * (c.bboxW / c.bboxH))
    if (w < 24) w = 24
    return { w, h: fallbackH, padLeftRatio: c.padLeft / c.w }
  }

  function resolveLayout(view, computed) {
    const vw = root.innerWidth
    const vh = root.innerHeight
    if (view === 'settings') return { hidden: true, src: '', kind: 'peek', w: 0, h: 0 }
    const mode = readMode()
    const effective = mode === 'auto' ? (view === 'home' ? 'bar' : 'side') : mode
    const dense = computed.mode === 'mini'

    if (effective === 'bar') {
      const composer = findComposerSurface()
      if (!composer || !isVisible(composer)) return { hidden: true, src: '', kind: 'bar', w: 0, h: 0 }
      const crect = composer.getBoundingClientRect()
      const barSize = peekSize('home-peek', 128, 104)
      return {
        hidden: false, kind: 'bar', anchor: composer,
        w: barSize.w, h: barSize.h,
        src: peekSrc('home-peek'),
        left: crect.right - barSize.w - 6,
        top: crect.top - barSize.h + 16,
      }
    }

    if (effective === 'side') {
      const sidebar = firstVisible('[data-slot="sidebar"] > *') || firstVisible('[data-slot="sidebar"]') || firstVisible('[data-slot="sidebar.workspaces"]')
      if (!sidebar || !isVisible(sidebar)) return { hidden: true, src: '', kind: 'side', w: 0, h: 0 }
      const srect = sidebar.getBoundingClientRect()
      /* 忙闲两态：工作区有任务在跑 → 完整“工作中”立绘；空闲 → 探头 */
      const busy = BUSY_STATES[computed.state] === 1
      if (view === 'workbench' && busy) {
        return {
          hidden: false, kind: 'side', anchor: sidebar,
          w: 112, h: 112, padLeftRatio: 0.5,
          src: poseSrc(statePose(computed, view)),
          left: srect.right - 56 - 8,
          top: srect.bottom - 112 - 96,
        }
      }
      const sideSize = peekSize('workbench-peek', 148, 112)
      return {
        hidden: false, kind: 'side', anchor: sidebar,
        w: sideSize.w, h: sideSize.h,
        src: peekSrc('workbench-peek'),
        left: srect.right - Math.round(sideSize.w * (sideSize.padLeftRatio || 0.5)) - 8,
        top: srect.bottom - sideSize.h - 96,
      }
    }

    if (effective === 'float') {
      const saved = readFloatPos()
      const fw = 200
      const fh = 200
      /* during an active drag, keep the live pointer position; never snap back */
      let fx = saved ? saved.x : vw - fw - 20
      let fy = saved ? saved.y : vh - fh - 20
      if (dragState && dragState.node) {
        fx = parseFloat(dragState.node.style.left) || fx
        fy = parseFloat(dragState.node.style.top) || fy
      }
      return {
        hidden: false, kind: 'float', w: fw, h: fh,
        src: poseSrc(statePose(computed, view)),
        x: clamp(fx, 8, vw - fw - 8),
        y: clamp(fy, 8, vh - fh - 8),
      }
    }

    /* mini corner */
    const mw = 64
    const mh = 64
    return {
      hidden: false, kind: 'mini', w: mw, h: mh,
      src: poseSrc(statePose(computed, view)),
      x: vw - mw - 14,
      y: vh - mh - 14,
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  function placeAnchored(rootNode, layout) {
    const rect = layout.anchor.getBoundingClientRect()
    const left = layout.left !== undefined ? layout.left : rect.right - layout.w - 10
    const top = layout.top !== undefined ? layout.top : rect.top
    rootNode.style.display = 'block'
    rootNode.style.left = Math.round(clamp(left, 8, root.innerWidth - layout.w - 8)) + 'px'
    rootNode.style.top = Math.round(clamp(top, 8, root.innerHeight - layout.h - 8)) + 'px'
  }

  function placeAt(rootNode, x, y, width, height) {
    rootNode.style.display = 'block'
    rootNode.style.left = Math.round(clamp(x, 8, root.innerWidth - width - 8)) + 'px'
    rootNode.style.top = Math.round(clamp(y, 8, root.innerHeight - height - 8)) + 'px'
  }

  /* ---------- reconcile / lifecycle ---------- */

  function safeReconcile() {
    if (disposed) return
    try {
      reconcile()
    } catch (error) {
      if (!memory.failed) {
        memory.failed = true
        if (root.console && root.console.warn) root.console.warn('[dsh-whale-pet] presenter disabled after error:', error)
      }
      debugState = { state: 'hidden', pose: null, line: '', view: memory.view, failed: true, error: String(error) }
      root.__dshWhalePetDebug = debugState
      if (observer) observer.disconnect()
      removeRoot()
      if (doc.body) doc.body.removeAttribute(VIEW_ATTR)
    }
  }

  function reconcile() {
    if (!doc.body) return
    const view = detectView()
    const now = Date.now()
    if (!growth) loadGrowth()
    syncCompanionAchievements(now)
    if (!memory.lastGrowthTick) { memory.lastGrowthTick = now; applyGrowth({ type: 'signin' }, now, 0) }
    else if (now - memory.lastGrowthTick >= 60000) {
      const deltaMin = (now - memory.lastGrowthTick) / 60000
      memory.lastGrowthTick = now
      applyGrowth({ type: 'tick', deltaMin }, now, 0)
    }
    if (isNight(now)) doc.body.setAttribute('data-dsh-whale-pet-night', 'true')
    else doc.body.removeAttribute('data-dsh-whale-pet-night')
    const codeNow = countVisible(SIGNAL_BANKS.code)
    if (codeNow > lastCodeCount) addUsageStat('code', codeNow - lastCodeCount)
    lastCodeCount = codeNow
    const chatNow = countVisible(SIGNAL_BANKS.chat)
    if (chatNow > lastChatCount) {
      addUsageStat('messages', chatNow - lastChatCount)
      if (keywordsEnabled()) scheduleKeywordScan()
    }
    lastChatCount = chatNow
    if (view !== memory.view) {
      memory.view = view
      memory.viewChangedAt = now
    }
    const signals = holdSignals(collectSignals(), now)
    const computed = core.computeState(memory.state, signals, now, Math.random)
    render(computed)
    if (readPref('pet')) idleChatTick(now)
    if (readPref('pet')) {
      if (doc.body) doc.body.setAttribute(VIEW_ATTR, view)
      doc.documentElement.setAttribute(VIEW_ATTR, view)
    }
  }

  function scheduleKeywordScan() {
    if (keywordScanTimer) clearT(keywordScanTimer)
    keywordScanTimer = setT(function () {
      keywordScanTimer = null
      const nodes = doc.querySelectorAll('[data-slot="conversation.chat.node"]')
      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        const text = (nodes[i].textContent || '').slice(0, 2000)
        if (!text) continue
        const id = core.matchKeyword(text, keywordsEnabled())
        if (!id) continue
        const line = say('keyword', id)
        if (line) {
          addUsageStat('keywords', 1)
          showLine(line)
        }
        if (id === 'thanks') {
          const out = applyGrowth({ type: 'thanks' }, Date.now(), 0)
          if (out.unlocks.length) burst('🏅')
        }
        break
      }
    }, 500)
  }

  let scheduled = false
  function schedule() {
    if (disposed || scheduled || memory.failed) return
    scheduled = true
    setT(function () {
      scheduled = false
      safeReconcile()
    }, DEBOUNCE_MS)
  }

  /* ---------- weather service (Open-Meteo, no key required) ---------- */
  const WEATHER_REFRESH_MIN = 30 * 60000
  const WEATHER_REFRESH_MAX = 60 * 60000
  const WEATHER_DATA_MS = 2 * 3600000
  const recentLines = []
  const weatherState = {
    city: readWeather('weatherCity'),
    key: readWeather('weatherKey'),
    coords: readCoords(),
    current: null,
    fetchedAt: 0,
    lastToldKind: '',
    nextRefreshAt: 0,
    retryAt: 0,
    status: '',
  }

  function readWeather(key) {
    try { return root.localStorage.getItem('whale-moe:' + key) || '' } catch (e) { return '' }
  }
  function readCoords() {
    try {
      const lat = root.localStorage.getItem('whale-moe:weatherLat')
      const lon = root.localStorage.getItem('whale-moe:weatherLon')
      if (lat === null || lon === null) return null
      return { lat: Number(lat), lon: Number(lon) }
    } catch (e) { return null }
  }
  function writeCoords(coords) {
    try {
      if (coords) {
        root.localStorage.setItem('whale-moe:weatherLat', String(coords.lat))
        root.localStorage.setItem('whale-moe:weatherLon', String(coords.lon))
      } else {
        root.localStorage.removeItem('whale-moe:weatherLat')
        root.localStorage.removeItem('whale-moe:weatherLon')
      }
    } catch (e) { /* storage unavailable */ }
  }

  function weatherJson(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer = setT(function () {
        if (ctrl) ctrl.abort()
        reject(new Error('weather timeout'))
      }, timeoutMs || 7000)
      root.fetch(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: 'application/json' } }).then(function (res) {
        if (!res.ok) throw new Error('weather http ' + res.status)
        return res.json()
      }).then(function (json) {
        clearT(timer)
        resolve(json)
      }).catch(function (error) {
        clearT(timer)
        reject(error)
      })
    })
  }

  function weatherKeyParam() {
    const key = readWeather('weatherKey').trim()
    return key ? '&apikey=' + encodeURIComponent(key) : ''
  }

  function geocodeCity(city) {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1&language=zh&format=json' + weatherKeyParam()
    return weatherJson(url, 8000).then(function (json) {
      if (!json || !json.results || !json.results.length) throw new Error('city not found')
      return { lat: Number(json.results[0].latitude), lon: Number(json.results[0].longitude), name: json.results[0].name || city }
    })
  }

  function fetchWeather(city, key) {
    const useCity = (city || readWeather('weatherCity')).trim()
    if (!useCity) return Promise.reject(new Error('no city'))
    const cached = weatherState.coords
    const coordsP = cached ? Promise.resolve(cached) : geocodeCity(useCity)
    return coordsP.then(function (coords) {
      weatherState.coords = coords
      writeCoords(coords)
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + coords.lat + '&longitude=' + coords.lon + '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto' + weatherKeyParam()
      return weatherJson(url, 8000).then(function (json) {
        if (!json || !json.current) throw new Error('no current weather')
        weatherState.current = {
          temp: Number(json.current.temperature_2m),
          code: String(json.current.weather_code),
          wind: Number(json.current.wind_speed_10m || 0),
          humidity: Number(json.current.relative_humidity_2m || 0),
        }
        weatherState.fetchedAt = Date.now()
        weatherState.retryAt = 0
        weatherState.nextRefreshAt = weatherState.fetchedAt + WEATHER_REFRESH_MIN + Math.floor(Math.random() * (WEATHER_REFRESH_MAX - WEATHER_REFRESH_MIN))
        weatherState.status = 'ok'
        schedule()
        return weatherState.current
      })
    })
  }

  function weatherEnsure(force) {
    const now = Date.now()
    const city = readWeather('weatherCity').trim()
    if (!city) return Promise.resolve(null)
    if (weatherState.city !== city || weatherState.key !== readWeather('weatherKey')) {
      weatherState.city = city
      weatherState.key = readWeather('weatherKey')
      weatherState.coords = null
      writeCoords(null)
    }
    const fresh = weatherState.current && now - weatherState.fetchedAt < WEATHER_DATA_MS
    if (force || (!fresh && now >= weatherState.nextRefreshAt && now >= weatherState.retryAt)) {
      return fetchWeather(city).catch(function () {
        weatherState.status = 'error'
        weatherState.retryAt = now + 60 * 60000
        return null
      })
    }
    return Promise.resolve(weatherState.current)
  }

  function weatherSummary() {
    if (!weatherState.current) return null
    const w = core.weatherText(weatherState.current.code)
    return { temp: weatherState.current.temp, emoji: w.emoji, label: w.label, kind: w.kind, wind: weatherState.current.wind }
  }

  function weatherLine(now, counter) {
    const summary = weatherSummary()
    if (!summary) return ''
    const line = core.pickDialogueAvoidRecent('weather', summary.kind, counter || 0, Math.random, recentLines)
    if (!line) return ''
    const tail = ' · 现在 ' + Math.round(summary.temp) + '°C ' + summary.label
    return line + tail
  }

  function weatherChangedSinceTold() {
    const summary = weatherSummary()
    return summary && summary.kind !== weatherState.lastToldKind
  }

  function weatherTest(city, key) {
    const useCity = (city || readWeather('weatherCity')).trim()
    if (!useCity) return Promise.reject(new Error('请先填写城市'))
    const beforeCoords = weatherState.coords
    const beforeKey = weatherState.key
    if (key !== undefined && key !== null) {
      try { root.localStorage.setItem('whale-moe:weatherKey', String(key)) } catch (e) { /* ignore */ }
    }
    weatherState.coords = null
    return fetchWeather(useCity, key || '').then(function () {
      const s = weatherSummary()
      return '✅ 已连通：' + useCity + ' ' + Math.round(s.temp) + '°C ' + s.label
    }).catch(function (error) {
      weatherState.coords = beforeCoords
      weatherState.key = beforeKey
      throw error
    })
  }

  /* ---------- idle chat scheduler (5-8 min, context-aware) ---------- */
  const IDLE_CHAT_MIN = 5 * 60000
  const IDLE_CHAT_MAX = 8 * 60000
  const GREET_GAP_MS = 3 * 3600000
  const idleChat = {
    nextAt: Date.now() + IDLE_CHAT_MIN + Math.floor(Math.random() * (IDLE_CHAT_MAX - IDLE_CHAT_MIN)),
    lastGreetAt: -Infinity,
    lastGreetBucket: '',
  }

  function rememberLine(line) {
    if (!line) return
    recentLines.push(line)
    if (recentLines.length > 12) recentLines.shift()
  }

  function latestTaskTopic() {
    try {
      const nodes = doc.querySelectorAll('[data-slot="conversation.chat.node"]')
      if (!nodes.length) return 'general'
      const last = nodes[nodes.length - 1]
      const text = (last.textContent || '').slice(0, 1200)
      return core.classifyTask(text)
    } catch (e) { return 'general' }
  }

  function bubbleFree() {
    try {
      const bubble = doc.querySelector('[data-dsh-whale-pet-bubble]')
      return !bubble || bubble.hidden || !(bubble.textContent || '').trim()
    } catch (e) { return true }
  }

  function showChatLine(line) {
    if (!line) return
    rememberLine(line)
    showLine(line)
  }

  function maybeGreet(now) {
    if (now - idleChat.lastGreetAt < GREET_GAP_MS) return false
    const bucket = core.greetBucket(new Date(now).getHours())
    if (bucket === 'night') return false
    idleChat.lastGreetAt = now
    idleChat.lastGreetBucket = bucket
    let line = core.pickDialogueAvoidRecent('greet', bucket, 0, Math.random, recentLines)
    const summary = weatherSummary()
    if (line && summary) line += ' · 现在 ' + Math.round(summary.temp) + '°C ' + summary.label
    showChatLine(line)
    return true
  }

  function idleChatTick(now) {
    const city = readWeather('weatherCity').trim()
    const view = detectView()
    if (view === 'settings' || memory.state.state !== 'idle' || !readPref('chat') || !bubbleFree() || !readPref('pet')) return
    if (now < idleChat.nextAt) return

    idleChat.nextAt = now + IDLE_CHAT_MIN + Math.floor(Math.random() * (IDLE_CHAT_MAX - IDLE_CHAT_MIN))
    let line = ''
    const bucket = core.greetBucket(new Date(now).getHours())
    if (now - idleChat.lastGreetAt >= GREET_GAP_MS && bucket !== 'night') {
      line = core.pickDialogueAvoidRecent('greet', bucket, 0, Math.random, recentLines)
      idleChat.lastGreetAt = now
      idleChat.lastGreetBucket = bucket
    } else if (city) {
      weatherEnsure(false).then(function () {
        if (disposed) return
        if (memory.state.state !== 'idle' || !bubbleFree() || !weatherChangedSinceTold()) return
        const weatherNow = weatherLine(Date.now(), 0)
        if (weatherNow) {
          const summary = weatherSummary()
          weatherState.lastToldKind = summary ? summary.kind : ''
          showChatLine(weatherNow)
        }
      })
    }
    if (!line) {
      const topic = latestTaskTopic()
      line = core.pickDialogueAvoidRecent('context', topic, 0, Math.random, recentLines)
    }
    if (!line) {
      const memeBank = Math.random() < 0.5 ? 'worker' : (Math.random() < 0.5 ? 'slack' : 'ddl')
      line = core.pickDialogueAvoidRecent('meme', memeBank, 0, Math.random, recentLines)
    }
    if (line) showChatLine(line)
  }

  /* ---------- user activity / wake ---------- */

  function onUserActivity() {
    memory.lastInteractionAt = Date.now()
    schedule()
  }

  /* ---------- start ---------- */

  function init() {
    if (disposed) return
    safeReconcile()
    observer = new root.MutationObserver(schedule)
    observer.observe(doc.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    })
  }

  /* style + listeners + timers + init */
  styleNode = doc.createElement('style')
  styleNode.dataset.skinChrome = 'whale-mascot-style'
  styleNode.dataset.skinOwner = SKIN_OWNER
  styleNode.textContent = WHALE_MOE_CSS
  doc.head.append(styleNode)

  on(root, 'pointerdown', onUserActivity, true)
  on(root, 'keydown', onUserActivity, true)
  on(root, 'resize', schedule)
  on(root, 'storage', schedule)
  on(root, 'whale-moe-prefs-change', schedule)

  if (!motionReduced()) {
    setIT(function () {
      const now = Date.now()
      const node = doc.querySelector('[data-dsh-whale-pet-root]')
      if (node && memory.state.state === 'idle') {
        /* 微动作：随机 18-28s 一次，幅度轻 */
        if (!memory.nextIdleMicroAt) memory.nextIdleMicroAt = now + 18000 + Math.floor(Math.random() * 10000)
        if (now >= memory.nextIdleMicroAt) {
          memory.nextIdleMicroAt = now + 18000 + Math.floor(Math.random() * 10000)
          const motionNode = node.querySelector('[data-dsh-whale-pet-motion]')
          if (motionNode && !layerState.pendingSwap) {
            const cls = Math.random() < 0.5 ? 'dsh-whale-pet-hop' : 'dsh-whale-pet-squint'
            motionNode.classList.remove('dsh-whale-pet-hop', 'dsh-whale-pet-squint')
            void motionNode.offsetWidth
            motionNode.classList.add(cls)
            setT(function () { motionNode.classList.remove('dsh-whale-pet-hop', 'dsh-whale-pet-squint') }, 900)
          }
        }
        /* 大动作：随机 35-60s 一次，无固定顺序，每张停留 4.2-5.8s */
        if (!memory.nextIdleActionAt) memory.nextIdleActionAt = now + 35000 + Math.floor(Math.random() * 25000)
        if (now >= memory.nextIdleActionAt) {
          memory.nextIdleActionAt = now + 35000 + Math.floor(Math.random() * 25000)
          showMood(IDLE_ACTION_POOL[Math.floor(Math.random() * IDLE_ACTION_POOL.length)], 4200 + Math.floor(Math.random() * 1600), true)
        }
      }
      /* 工作状态保持 running 姿势稳定，不再随机切工作小剧场；
         低余额提示也只在不忙时露脸，免得打断工作态。 */
      try {
        const low = root.localStorage.getItem('dsh.balance.low') === '1'
        if (low && !BUSY_STATES[memory.state.state] && now - lastBalanceLowAt > 60000) {
          lastBalanceLowAt = now
          showMood('balance-low', 5000, true)
        }
      } catch (e) { /* ignore */ }
      /* 摸鱼提醒：闲置 10 分钟以上，待机时催一句（默认开） */
      try {
        if (prefOn('idle-nudge', true) && memory.state.state === 'idle' && readPref('chat') && bubbleFree()) {
          const idleMs = now - memory.lastInteractionAt
          if (idleMs >= 10 * 60000 && now - lastNudgeAt >= 5 * 60000) {
            lastNudgeAt = now
            const nudgeLine = localizeLine(core.pickDialogue('daily', 'nudge', nudgeCounter, Math.random))
            nudgeCounter += 1
            if (nudgeLine) showChatLine(nudgeLine)
          }
        }
      } catch (e) { /* ignore */ }
      schedule()
    }, 3000)
  }

  function onBalanceLow() {
    lastBalanceLowAt = Date.now()
    if (!BUSY_STATES[memory.state.state]) showMood('balance-low', 5000, true)
    if (growth && growth.achievements.indexOf('balance-low') === -1) {
      growth.achievements.push('balance-low')
      saveGrowth()
      announceUnlocks(['balance-low'])
    }
  }
  on(root, 'dsh-whale-balance-low', onBalanceLow)

  let gazePending = false
  function onGazeMove(event) {
    if (gazePending || motionReduced()) return
    const mode = readMode()
    if (mode !== 'float' && mode !== 'side') return
    const node = doc.querySelector('[data-dsh-whale-pet-root]')
    if (!node) return
    gazePending = true
    root.requestAnimationFrame(function () {
      gazePending = false
      const rect = node.getBoundingClientRect()
      if (rect.width <= 1) return
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const gx = clamp((event.clientX - cx) / Math.max(rect.width, 48) * 5, -4, 4)
      const gy = clamp((event.clientY - cy) / Math.max(rect.height, 48) * 4, -3, 3)
      node.style.setProperty('--wmp-gaze-x', gx.toFixed(2) + 'px')
      node.style.setProperty('--wmp-gaze-y', gy.toFixed(2) + 'px')
      node.style.setProperty('--wmp-gaze-r', (gx * 0.3).toFixed(2) + 'deg')
    })
  }
  on(root, 'pointermove', onGazeMove, { passive: true })

  debugState = { state: 'boot', pose: null, line: '', view: 'home' }
  root.__dshWhalePetDebug = debugState

  if (doc.readyState === 'loading') on(doc, 'DOMContentLoaded', init, { once: true })
  else init()

  return dispose
}
