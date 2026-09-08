/**
 * Bridge 执行层（syscall）— Node 可测；compose 进 client。
 * 策略：关键路径 API 优先（conversation.send / session.command / task-board）。
 * DOM 仍是 settings/panel/remote/session-focus 等的降级面——缩面请改本文件策略表，勿在 UI 硬点。
 * @param {object} deps
 */

export const BRIDGE_HEALTH_KEY = 'ow-bridge-health'
export const BRIDGE_HEALTH_TTL = 5 * 60 * 1000

export const BRIDGE_CAPABILITY_MAP = {
  'inject-message': 'inject-message',
  'agent-prompt': 'agent-prompt',
  'rewind-exec': 'rewind-exec',
  'rewind-open': 'rewind-exec',
  'task-run': 'task-run',
  'task-create': 'task-run',
  'session-focus': 'session-focus',
  'settings': 'settings',
  panel: 'panel',
  remote: 'remote',
}

/** 策略诚实标签：API / 事件 / DOM 降级 / 不可用 */
export function describeBridgeStrategy(strategy) {
  const map = {
    'session-api': { tier: 'api', labelZh: 'Session API', degraded: false },
    'session-api-started': { tier: 'api', labelZh: 'Session API（已开跑）', degraded: false },
    'session-prompt': { tier: 'api', labelZh: 'session.prompt', degraded: false },
    'session-send': { tier: 'api', labelZh: 'session.send', degraded: false },
    'session-draft': { tier: 'api', labelZh: '草稿 API', degraded: false },
    'session-open': { tier: 'api', labelZh: 'session.open', degraded: false },
    'session-select': { tier: 'api', labelZh: 'session.select', degraded: false },
    'session-focus': { tier: 'api', labelZh: 'session.focus', degraded: false },
    'session-activate': { tier: 'api', labelZh: 'session.activate', degraded: false },
    'session-setCurrent': { tier: 'api', labelZh: 'list.setCurrent', degraded: false },
    api: { tier: 'api', labelZh: 'Host API', degraded: false },
    embed: { tier: 'event', labelZh: '壳内嵌入', degraded: false },
    'event+dom': { tier: 'event', labelZh: '事件优先·DOM 降级', degraded: true },
    'embed+event': { tier: 'event', labelZh: '壳内嵌入·事件', degraded: false },
    event: { tier: 'event', labelZh: '事件', degraded: false },
    dom: { tier: 'dom', labelZh: 'DOM 降级', degraded: true },
    'dom-open-only': { tier: 'dom', labelZh: 'DOM 仅打开', degraded: true },
    unavailable: { tier: 'none', labelZh: '不可用', degraded: true },
    unknown: { tier: 'none', labelZh: '未知', degraded: true },
  }
  if (map[strategy]) return map[strategy]
  // session-* 实跑变体一律视为 API，避免被当成「未知·降级」
  if (strategy && String(strategy).startsWith('session')) {
    return { tier: 'api', labelZh: String(strategy), degraded: false }
  }
  return {
    tier: 'none',
    labelZh: strategy || '—',
    degraded: true,
  }
}

/** 探针面汇总：还有哪些能力仍标 DOM/事件降级（供 UI / 测试） */
export function summarizeBridgeSurface(health = {}) {
  const ids = [...new Set(Object.values(BRIDGE_CAPABILITY_MAP))]
  let api = 0
  let degraded = 0
  let none = 0
  const stillDom = []
  for (const id of ids) {
    const cap = health[id]
    if (!cap) continue
    const meta = describeBridgeStrategy(cap.strategy)
    if (!cap.available || meta.tier === 'none') {
      none += 1
      continue
    }
    if (meta.degraded || meta.tier === 'dom') {
      degraded += 1
      if (meta.tier === 'dom' || String(cap.strategy || '').includes('dom')) stillDom.push(id)
      continue
    }
    api += 1
  }
  return { api, degraded, none, stillDom }
}

function enrichCap(strategy, extra = {}) {
  const meta = describeBridgeStrategy(strategy)
  return {
    strategy,
    tier: meta.tier,
    labelZh: meta.labelZh,
    degraded: meta.degraded,
    available: strategy !== 'unavailable',
    ...extra,
  }
}

export function createBridge(deps) {
  const {
    getSessionsBridge = () => null,
    postTaskAction,
    delay = (ms) => new Promise((r) => setTimeout(r, ms)),
    notifyPulse = () => {},
    querySelector = (sel) => (typeof document !== 'undefined' ? document.querySelector(sel) : null),
    querySelectorAll = (sel) => (typeof document !== 'undefined' ? document.querySelectorAll(sel) : []),
    dispatchEvent = (ev) => (typeof document !== 'undefined' ? document.documentElement.dispatchEvent(ev) : false),
    storage = typeof localStorage !== 'undefined' ? localStorage : null,
    requestAnimationFrame: raf = typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 0),
  } = deps

  function getActiveSessionFace() {
    const sessionsBridge = getSessionsBridge()
    if (!sessionsBridge) return null
    try {
      const sessionId = sessionsBridge.list?.getSnapshot?.()?.current
      if (!sessionId) return null
      return sessionsBridge.binding?.(sessionId)?.session ?? null
    } catch { return null }
  }

  async function execRewindViaSession(seq, mode) {
    const session = getActiveSessionFace()
    if (!session || typeof session.command !== 'function') {
      return { ok: false, error: 'session-api-unavailable' }
    }
    const result = await session.command(`/rewind @${seq} ${mode}`)
    if (!result?.ok || result.value?.matched !== true) {
      return { ok: false, error: result?.value?.message || 'command-not-matched' }
    }
    return { ok: true }
  }

  async function sendViaSession(text, { submit = true } = {}) {
    if (!text) return { ok: false, error: 'empty' }
    const sessionsBridge = getSessionsBridge()
    try {
      const sessionId = sessionsBridge?.list?.getSnapshot?.()?.current
      if (sessionId && typeof sessionsBridge.scope === 'function') {
        const scope = sessionsBridge.scope(sessionId)
        const conversation = scope?.get?.('conversation')
        if (conversation && typeof conversation.send === 'function' && submit) {
          // conversation.send 常会等到整轮 Agent 结束；UI 不能干等
          const pending = conversation.send(text)
          const raced = await Promise.race([
            Promise.resolve(pending).then(() => ({ ok: true, strategy: 'session-api' })),
            new Promise((resolve) => {
              setTimeout(() => resolve({ ok: true, strategy: 'session-api-started' }), 2000)
            }),
          ])
          // 后台继续，错误只打日志
          Promise.resolve(pending).catch((err) => {
            console.warn('[open-world] conversation.send', err)
          })
          return raced
        }
        if (conversation?.input?.for && !submit) {
          const input = conversation.input.for(scope)
          if (input?.setDraft) {
            input.setDraft(text)
            return { ok: true, strategy: 'session-draft' }
          }
        }
      }
      const session = getActiveSessionFace()
      if (session) {
          if (submit && typeof session.prompt === 'function') {
            const pending = session.prompt(text)
            const raced = await Promise.race([
              Promise.resolve(pending).then(() => ({ ok: true, strategy: 'session-prompt' })),
              new Promise((resolve) => setTimeout(() => resolve({ ok: true, strategy: 'session-prompt-started' }), 2000)),
            ])
            Promise.resolve(pending).catch((err) => console.warn('[open-world] session.prompt', err))
            return raced
          }
          if (submit && typeof session.send === 'function') {
            const pending = session.send(text)
            const raced = await Promise.race([
              Promise.resolve(pending).then(() => ({ ok: true, strategy: 'session-send' })),
              new Promise((resolve) => setTimeout(() => resolve({ ok: true, strategy: 'session-send-started' }), 2000)),
            ])
            Promise.resolve(pending).catch((err) => console.warn('[open-world] session.send', err))
            return raced
          }
      }
    } catch (err) {
      return { ok: false, error: err.message || 'session-send-failed' }
    }
    return { ok: false, error: 'session-api-unavailable' }
  }

  function _setTextareaValue(ta, text) {
    if (!ta) return
    const desc = Object.getOwnPropertyDescriptor(
      typeof window !== 'undefined' ? window.HTMLTextAreaElement.prototype : {},
      'value',
    )
    if (desc && desc.set) desc.set.call(ta, text)
    else ta.value = text
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function _submitTextarea(ta) {
    if (!ta) return
    ta.focus()
    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }
    ta.dispatchEvent(new KeyboardEvent('keydown', opts))
    ta.dispatchEvent(new KeyboardEvent('keypress', opts))
    ta.dispatchEvent(new KeyboardEvent('keyup', opts))
  }

  function _fillAndSubmit(text, { submit = false } = {}) {
    // 勿选中 Open World 自己的 textarea（IDEA / 信箱），否则「注入」只改面板内输入框、看起来没反应
    const all = [...(querySelectorAll('textarea') || [])]
    const ta = all.find((el) => !el.closest('.ow-overlay, .ow-root, [data-plugin="dsh-open-world"]'))
      || null
    if (!ta) return { ok: false, error: 'textarea-not-found' }
    _setTextareaValue(ta, text)
    if (submit) {
      return new Promise((resolve) => {
        raf(() => {
          try { _submitTextarea(ta); resolve({ ok: true }) }
          catch (err) { resolve({ ok: false, error: err.message }) }
        })
      })
    }
    return { ok: true }
  }

  async function sendText(text, { submit = true } = {}) {
    const via = await sendViaSession(text, { submit })
    if (via.ok) return via
    const dom = await _fillAndSubmit(text, { submit })
    if (dom && typeof dom.then === 'function') {
      const submitted = await dom
      return { ...submitted, strategy: 'dom' }
    }
    return { ...dom, strategy: 'dom' }
  }

  function readBridgeHealthStore() {
    if (!storage) return null
    try {
      const raw = storage.getItem(BRIDGE_HEALTH_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  function readBridgeHealth() {
    const parsed = readBridgeHealthStore()
    if (!parsed) return null
    if (Date.now() - (parsed.testedAt || 0) > BRIDGE_HEALTH_TTL) return null
    return parsed
  }

  function saveBridgeHealth(health) {
    if (!storage) return
    try {
      const prev = readBridgeHealthStore()
      const outcomes = health.outcomes != null
        ? health.outcomes
        : ((prev && prev.outcomes) || {})
      storage.setItem(BRIDGE_HEALTH_KEY, JSON.stringify({
        ...health,
        outcomes,
        testedAt: Date.now(),
      }))
    } catch { /* ignore */ }
  }

  /** 记录最近一次 Bridge 执行结果（探针能力旁的实跑证据） */
  function recordBridgeOutcome(actionType, result = {}) {
    const key = BRIDGE_CAPABILITY_MAP[actionType] || actionType || 'unknown'
    const store = readBridgeHealthStore() || {}
    const outcomes = { ...(store.outcomes || {}) }
    const probeStrategy = store[key] && store[key].strategy
    const entry = {
      ok: !!result.ok,
      strategy: result.strategy || null,
      error: result.error ? String(result.error).slice(0, 120) : null,
      at: Date.now(),
      probeStrategy: probeStrategy || null,
    }
    if (
      entry.strategy === 'dom'
      && probeStrategy
      && String(probeStrategy).startsWith('session')
    ) {
      entry.probeStale = true
    }
    outcomes[key] = entry
    outcomes._last = { action: key, ...entry }
    const next = { ...store, outcomes }
    saveBridgeHealth(next)
    return entry
  }

  function checkBridgeCapabilities() {
    const results = {}
    const prev = readBridgeHealthStore()
    const sessionsBridge = getSessionsBridge()
    const hasTextarea = !!querySelector('textarea')
    const hasSession = !!(sessionsBridge && typeof sessionsBridge.binding === 'function')
    let hasConversation = false
    let hasSessionPrompt = false
    let hasSessionSend = false
    try {
      const sessionId = sessionsBridge?.list?.getSnapshot?.()?.current
      if (sessionId && typeof sessionsBridge.scope === 'function') {
        const conversation = sessionsBridge.scope(sessionId)?.get?.('conversation')
        hasConversation = !!(conversation && typeof conversation.send === 'function')
      }
      const face = getActiveSessionFace()
      if (face) {
        hasSessionPrompt = typeof face.prompt === 'function'
        hasSessionSend = typeof face.send === 'function'
      }
    } catch { /* ignore */ }

    let injectStrategy = 'unavailable'
    if (hasConversation) injectStrategy = 'session-api'
    else if (hasSessionPrompt) injectStrategy = 'session-prompt'
    else if (hasSessionSend) injectStrategy = 'session-send'
    else if (hasTextarea) injectStrategy = 'dom'

    results['inject-message'] = enrichCap(injectStrategy)
    results['agent-prompt'] = enrichCap(injectStrategy)
    results['rewind-exec'] = enrichCap(
      hasSession ? 'session-api' : (hasTextarea ? 'dom-open-only' : 'unavailable'),
      {
        note: 'rewind-open 默认壳内 embed；preferChat 时 session.prompt → DOM',
      },
    )
    results.settings = enrichCap('event', {
      note: '默认关壳 + dsh-open-settings；带 settingsHint/forceDom 才 DOM 点标签',
    })
    results['task-run'] = enrichCap(
      typeof postTaskAction === 'function' ? 'api' : 'unavailable',
    )
    const canFocusApi = !!(sessionsBridge && (
      typeof sessionsBridge.open === 'function'
      || typeof sessionsBridge.select === 'function'
      || typeof sessionsBridge.focus === 'function'
      || typeof sessionsBridge.activate === 'function'
      || (sessionsBridge.list && typeof sessionsBridge.list.setCurrent === 'function')
    ))
    results['session-focus'] = enrichCap(
      canFocusApi
        ? 'session-api'
        : (!!querySelector('[data-session-id], [data-session]') ? 'dom' : 'unavailable'),
    )
    results.panel = enrichCap('event+dom', {
      note: '已知面板优先壳内 embed；无 selector 时只广播事件',
    })
    results.remote = enrichCap('embed+event')
    results.outcomes = (prev && prev.outcomes) || {}
    results.surface = summarizeBridgeSurface(results)
    saveBridgeHealth(results)
    return results
  }

  function getBridgeCapability(cap) {
    if (!cap) return { strategy: 'unknown', available: false, ...describeBridgeStrategy('unknown') }
    const meta = describeBridgeStrategy(cap.strategy)
    return {
      ...cap,
      ...meta,
      available: cap.available != null ? cap.available : cap.strategy !== 'unavailable',
    }
  }

  function bridgeCapabilityFor(action) {
    const key = BRIDGE_CAPABILITY_MAP[action && action.type]
    if (!key) return null
    const health = readBridgeHealth()
    if (!health) return null
    return getBridgeCapability(health[key])
  }

  async function bridgeExecute(action, ctx) {
    if (!action) return
    const cap = bridgeCapabilityFor(action)
    if (cap && !cap.available) {
      recordBridgeOutcome(action.type, { ok: false, strategy: 'unavailable', error: 'capability-unavailable' })
      const meta = describeBridgeStrategy(cap.strategy)
      ctx.setToast(`${action.label || action.type} 不可用（${meta.labelZh}）· 请先返回聊天界面`)
      return
    }
    const { onClose, setView, setToast } = ctx
    const afterClose = async (fn) => {
      onClose()
      await delay(180)
      if (fn) fn()
    }
    switch (action.type) {
      case 'close':
        onClose()
        break
      case 'composer': {
        let focused = false
        await afterClose(() => {
          const el = querySelector('textarea, [contenteditable="true"]')
          if (el) {
            el.focus()
            focused = true
          }
        })
        recordBridgeOutcome('inject-message', {
          ok: focused,
          strategy: 'dom',
          error: focused ? null : 'no-composer',
        })
        if (!focused) setToast('未找到输入框（DOM）')
        break
      }
      case 'monitor':
        setView('monitor')
        setToast(action.label || '已切换监视视图')
        break
      case 'rewind-panel':
        if (ctx.setEmbed) ctx.setEmbed('rewind')
        setToast('已进入回退时间轴')
        break
      case 'enter-app':
      case 'embed':
        if (ctx.setEmbed) ctx.setEmbed(action.panel || 'task-board')
        setToast(action.label || `已进入 ${action.panel || '应用'}`)
        break
      case 'idea-panel':
        setView('idea')
        setToast('IDEA · 人格前缀试玩')
        break
      case 'panel': {
        const embedable = new Set(['task-board', 'rewind', 'market', 'memory', 'ssh', 'remote', 'analytics', 'monitor', 'fleet', 'sidebar'])
        if (action.panel && embedable.has(action.panel) && ctx.setEmbed) {
          ctx.setEmbed(action.panel)
          recordBridgeOutcome('panel', { ok: true, strategy: 'embed' })
          setToast(action.label || `已进入 ${action.panel}`)
          break
        }
        let usedDom = false
        await afterClose(() => {
          if (action.panel) {
            dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: action.panel }))
          }
          // 无 selector / forceDom：只广播事件，不刮按钮
          if (!action.selector && !action.forceDom) {
            if (!action.panel) setToast(`未找到入口：${action.label}`)
            else setToast(`已广播打开面板：${action.panel}（纯事件）`)
            return
          }
          const btn = action.selector && querySelector(action.selector)
          if (btn) {
            btn.click()
            usedDom = true
          }
          else if (!action.panel) setToast(`未找到入口：${action.label}`)
          else setToast(`已请求打开面板：${action.panel}`)
        })
        recordBridgeOutcome('panel', {
          ok: true,
          strategy: usedDom ? 'event+dom' : 'event',
        })
        break
      }
      case 'settings': {
        const hint = action.settingsHint || null
        const forceDom = !!action.forceDom
        let usedDom = false
        await afterClose(async () => {
          dispatchEvent(new CustomEvent('dsh-open-settings', {
            detail: { hint: hint || action.label || null },
          }))
          // 无 hint：只广播事件，不再刮侧栏设置按钮（缩 DOM 面）
          if (!hint && !forceDom) {
            setToast('已广播打开设置（纯事件·未点 DOM）')
            return
          }
          const settingsBtn = querySelector('[class*="settingsArea"] button, [data-slot="sidebar.settings"] button')
          if (settingsBtn) {
            settingsBtn.click()
            usedDom = true
          }
          if (hint) {
            await delay(350)
            const hit = [...querySelectorAll('button, [role="tab"], li, span')].find((el) => {
              const t = (el.textContent || '').trim()
              return t.includes(hint)
                || (hint === 'Market' && /market|市场|插件/i.test(t))
            })
            if (hit) {
              hit.click()
              usedDom = true
            }
          }
          if (!usedDom) setToast(`已广播打开设置（hint=${hint}；若无反应请回聊天点设置）`)
        })
        recordBridgeOutcome('settings', {
          ok: true,
          strategy: usedDom ? 'event+dom' : 'event',
        })
        break
      }
      case 'task-create': {
        const title = action.title || '开放世界新任务'
        try {
          await postTaskAction({
            kind: 'create',
            id: `ow-${Date.now()}`,
            input: { title, description: '由开放世界创建', prompt: title },
          })
          recordBridgeOutcome('task-run', { ok: true, strategy: 'api' })
          setToast(`已创建任务：${title}`)
          notifyPulse(['ai-engine->task-board'])
        } catch (err) {
          recordBridgeOutcome('task-run', { ok: false, strategy: 'api', error: err.message || 'task-create-failed' })
          setToast(`创建任务失败：${err.message || err}`)
          break
        }
        if (action.inline) break
        if (ctx.setEmbed) ctx.setEmbed('task-board')
        else setToast('任务已创建 · 无壳内嵌入，请到官方任务看板查看（未点 DOM）')
        break
      }
      case 'task-run': {
        if (!action.taskId) break
        try {
          await postTaskAction({ kind: 'run', taskId: action.taskId })
          recordBridgeOutcome('task-run', { ok: true, strategy: 'api' })
          setToast('已触发任务运行')
          notifyPulse(['task-board->runtime', 'task-board->storage'])
        } catch (err) {
          recordBridgeOutcome('task-run', { ok: false, strategy: 'api', error: err.message || 'task-run-failed' })
          setToast(`任务运行失败：${err.message || err}`)
          break
        }
        if (action.inline) break
        if (ctx.setEmbed) ctx.setEmbed('task-board')
        else setToast('任务已触发 · 无壳内嵌入，请到官方任务看板查看（未点 DOM）')
        break
      }
      case 'agent-prompt': {
        const text = action.prompt || ''
        const submitted = await sendText(text, { submit: action.autoSubmit !== false })
        recordBridgeOutcome('agent-prompt', {
          ok: !!submitted.ok,
          strategy: submitted.strategy || null,
          error: submitted.error || null,
        })
        if (submitted.ok) {
          const viaSession = submitted.strategy?.startsWith('session')
          setToast(
            viaSession
              ? (submitted.strategy?.endsWith('-started')
                ? '指令已提交（Agent 生成中）'
                : '指令已经 session 发送')
              : (action.autoSubmit === false ? '指令已填入' : '指令已发送（DOM）'),
          )
          if (viaSession) onClose()
        } else {
          setToast(`发送失败：${submitted.error || 'unknown'}`)
        }
        break
      }
      case 'remote': {
        if (ctx.setEmbed) {
          ctx.setEmbed('remote')
          recordBridgeOutcome('remote', { ok: true, strategy: 'embed' })
          setToast('已进入移动端远程表面')
          break
        }
        let usedDom = false
        await afterClose(() => {
          dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'remote' }))
          const hit = [...querySelectorAll('button,[role="button"]')].find((el) => {
            const t = (el.getAttribute('title') || el.textContent || '').trim()
            return /远程|remote|mobile/i.test(t)
          })
          if (hit) {
            hit.click()
            usedDom = true
          }
        })
        recordBridgeOutcome('remote', {
          ok: true,
          strategy: usedDom ? 'event+dom' : 'event',
        })
        setToast(usedDom ? '正在打开移动端远程（DOM）' : '已广播打开远程（若无反应请回聊天）')
        break
      }
      case 'session-focus': {
        const sessionId = action.sessionId
        if (!sessionId) break
        const sessionsBridge = getSessionsBridge()
        let opened = false
        let via = null
        if (sessionsBridge) {
          try {
            if (typeof sessionsBridge.open === 'function') {
              sessionsBridge.open(sessionId)
              opened = true
              via = 'open'
            } else if (typeof sessionsBridge.select === 'function') {
              sessionsBridge.select(sessionId)
              opened = true
              via = 'select'
            } else if (typeof sessionsBridge.focus === 'function') {
              sessionsBridge.focus(sessionId)
              opened = true
              via = 'focus'
            } else if (typeof sessionsBridge.activate === 'function') {
              sessionsBridge.activate(sessionId)
              opened = true
              via = 'activate'
            } else if (sessionsBridge.list && typeof sessionsBridge.list.setCurrent === 'function') {
              sessionsBridge.list.setCurrent(sessionId)
              opened = true
              via = 'setCurrent'
            }
          } catch {
            opened = false
          }
        }
        if (opened) {
          recordBridgeOutcome('session-focus', { ok: true, strategy: `session-${via}` })
          setToast(`已切换会话（${via}）`)
          break
        }
        await afterClose(() => {
          const el = querySelector(`[data-session-id="${sessionId}"]`)
            || querySelector(`[data-session="${sessionId}"]`)
          el?.click()
        })
        recordBridgeOutcome('session-focus', { ok: true, strategy: 'dom' })
        setToast('已尝试切换会话（DOM 降级）')
        break
      }
      case 'inject-message': {
        const text = action.body || ''
        const submitted = await sendText(text, { submit: action.autoSubmit !== false })
        recordBridgeOutcome('inject-message', {
          ok: !!submitted.ok,
          strategy: submitted.strategy || null,
          error: submitted.error || null,
        })
        if (submitted.ok) {
          const viaSession = submitted.strategy?.startsWith('session')
          setToast(viaSession
            ? (submitted.strategy === 'session-api-started'
              ? '消息已提交发送（Agent 生成中）'
              : '消息已经 session 注入')
            : (action.autoSubmit === false ? '消息已填入' : '消息已发送（DOM）'))
          if (viaSession) onClose()
        } else {
          setToast(`注入失败：${submitted.error || 'unknown'}`)
        }
        break
      }
      case 'rewind-open': {
        // 默认进壳内时间轴；preferChat/forceDom 才关壳开官方 /rewind
        if (!action.preferChat && !action.forceDom && ctx.setEmbed) {
          ctx.setEmbed('rewind')
          recordBridgeOutcome('rewind-exec', { ok: true, strategy: 'embed' })
          setToast('已进入壳内回退时间轴')
          break
        }
        const face = getActiveSessionFace()
        if (face && typeof face.prompt === 'function') {
          await afterClose(async () => {
            try {
              await face.prompt('/rewind')
              recordBridgeOutcome('rewind-exec', { ok: true, strategy: 'session-prompt' })
              setToast('已经 session.prompt 打开 /rewind')
            } catch (err) {
              recordBridgeOutcome('rewind-exec', {
                ok: false,
                strategy: 'session-prompt',
                error: (err && err.message) || 'prompt-failed',
              })
              setToast(`打开 /rewind 失败：${(err && err.message) || err}`)
            }
          })
          break
        }
        await afterClose(async () => {
          const result = await _fillAndSubmit('/rewind', { submit: true })
          if (!result.ok) {
            recordBridgeOutcome('rewind-exec', {
              ok: false,
              strategy: 'dom',
              error: 'no-composer',
            })
            setToast('打不开回退菜单：找不到输入框（DOM）')
            return
          }
          recordBridgeOutcome('rewind-exec', {
            ok: !!result.ok,
            strategy: 'dom',
          })
          setToast(result.ok ? '已打开 /rewind 候选面板（DOM）' : '已填入 /rewind，请按回车')
        })
        break
      }
      case 'rewind-exec': {
        const mode = action.mode === 'chat' ? 'chat' : 'both'
        const seq = action.seq ?? action.anchorSeq ?? action.index
        if (seq == null) {
          setToast('回退失败：缺少锚点 seq')
          break
        }
        await afterClose(async () => {
          const viaSession = await execRewindViaSession(seq, mode)
          if (viaSession.ok) {
            recordBridgeOutcome('rewind-exec', { ok: true, strategy: 'session-api' })
            setToast(`已执行回退 @${seq} (${mode})`)
            notifyPulse(['storage->core', 'storage->task-board'])
            return
          }
          recordBridgeOutcome('rewind-exec', {
            ok: false,
            strategy: 'unavailable',
            error: viaSession.error || 'rewind-failed',
          })
          setToast('回退请用消息旁 ↶ 按钮，或先点「打开 /rewind」选锚点')
        })
        break
      }
      default:
        setToast(`未知动作：${action.type}`)
    }
  }

  return {
    getActiveSessionFace,
    execRewindViaSession,
    sendViaSession,
    sendText,
    readBridgeHealth,
    saveBridgeHealth,
    checkBridgeCapabilities,
    getBridgeCapability,
    bridgeCapabilityFor,
    bridgeExecute,
    recordBridgeOutcome,
    BRIDGE_CAPABILITY_MAP,
    describeBridgeStrategy,
    summarizeBridgeSurface,
  }
}
