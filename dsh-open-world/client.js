// CLIENT_BUILD c142f73f6f 2026-09-29T13:11:45.549Z v2.78
// dsh-open-world · Client — composed from client/modules + client-main
// Run: npm run build:client  |  Check: npm run check:client

// AUTO-GENERATED from bridge/execute.mjs
window.__ModuleLoader__.load({
  id: 'dsh-open-world/bridge',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    /**
     * Bridge 执行层（syscall）— Node 可测；compose 进 client。
     * 策略：关键路径 API 优先（conversation.send / session.command / task-board）。
     * DOM 仍是 settings/panel/remote/session-focus 等的降级面——缩面请改本文件策略表，勿在 UI 硬点。
     * @param {object} deps
     */
    
    const BRIDGE_HEALTH_KEY = 'ow-bridge-health'
    const BRIDGE_HEALTH_TTL = 5 * 60 * 1000
    
    /** 与 capability-registry EMBED_PLUGIN_ID 对齐（compose 进 client，禁止 ES import） */
    const EMBED_PLUGIN_ID = {
      rewind: 'rewind',
      'task-board': 'task-board',
      remote: 'remote-web-ui',
      memory: 'hindsight',
      market: 'market',
      ssh: 'ssh',
      analytics: 'workspace-analyzer',
    }
    
    function resolveEmbedGate(panel, plugins = []) {
      const id = String(panel || '')
      if (!id || id === 'monitor' || id === 'fleet' || id === 'sidebar') {
        return { ok: true, panel: id }
      }
      const pluginId = EMBED_PLUGIN_ID[id]
      if (!pluginId) return { ok: true, panel: id }
      const list = plugins || []
      if (list.length === 0) return { ok: true, panel: id }
      const plug = list.find((p) => p.id === pluginId)
      if (!plug) return { ok: true, panel: id }
      if (plug.online) return { ok: true, panel: id, plugin: plug }
      const hint = (plug && plug.howToEnable)
        || `${id}未启用 · 在 plugins.yml 启用对应 feature 后 apply 并重启 Desktop`
      return { ok: false, panel: id, plugin: plug || null, howToEnable: hint }
    }
    
    const BRIDGE_CAPABILITY_MAP = {
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
    function describeBridgeStrategy(strategy) {
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
    function summarizeBridgeSurface(health = {}) {
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
    
    function createBridge(deps) {
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
        const trySetEmbed = (panel, toastLabel) => {
          const gate = resolveEmbedGate(panel, ctx.plugins || [])
          if (!gate.ok) {
            setToast(gate.howToEnable || `${panel} 未在线`)
            recordBridgeOutcome(action.type || 'embed', { ok: false, strategy: 'unavailable', error: 'embed-offline' })
            return false
          }
          if (ctx.setEmbed) ctx.setEmbed(panel)
          if (toastLabel) setToast(toastLabel)
          return true
        }
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
            trySetEmbed('rewind', '已进入回退时间轴')
            break
          case 'enter-app':
          case 'embed':
            trySetEmbed(action.panel || 'task-board', action.label || `已进入 ${action.panel || '应用'}`)
            break
          case 'enter-world': {
            const panel = action.panel || 'task-board'
            const worldId = action.worldId || (panel === 'rewind' ? 'rewind' : 'tasks')
            const label = action.label || (worldId === 'tasks' ? '已进入任务世界' : `已进入 ${panel}`)
            const ok = trySetEmbed(panel, label)
            if (ok) {
              recordBridgeOutcome('enter-world', { ok: true, strategy: 'embed', worldId, panel })
              // 审计事件（Host）；失败不挡进场
              try {
                fetch('/api/open-world/action', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ action: 'world-enter', worldId, panel }),
                }).catch(() => {})
              } catch { /* ignore */ }
            }
            break
          }
          case 'idea-panel':
            setView('idea')
            setToast('IDEA · 人格前缀试玩')
            break
          case 'panel': {
            const embedable = new Set(['task-board', 'rewind', 'market', 'memory', 'ssh', 'remote', 'analytics', 'monitor', 'fleet', 'sidebar'])
            if (action.panel && embedable.has(action.panel) && ctx.setEmbed) {
              if (trySetEmbed(action.panel, action.label || `已进入 ${action.panel}`)) {
                recordBridgeOutcome('panel', { ok: true, strategy: 'embed' })
              }
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
            if (!trySetEmbed('task-board')) setToast('任务已创建 · 无壳内嵌入，请到官方任务看板查看（未点 DOM）')
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
            if (!trySetEmbed('task-board')) setToast('任务已触发 · 无壳内嵌入，请到官方任务看板查看（未点 DOM）')
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
            if (trySetEmbed('remote', '已进入移动端远程表面')) {
              recordBridgeOutcome('remote', { ok: true, strategy: 'embed' })
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
              if (trySetEmbed('rewind', '已进入壳内回退时间轴')) {
                recordBridgeOutcome('rewind-exec', { ok: true, strategy: 'embed' })
              }
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
    
    module.exports = {
      createBridge,
      BRIDGE_CAPABILITY_MAP,
      BRIDGE_HEALTH_KEY,
      BRIDGE_HEALTH_TTL,
      describeBridgeStrategy,
      summarizeBridgeSurface,
    };
    return module.exports;
  },
});


// Open World · 共享常量（Client 子模块）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/constants',
  factory: () => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    exports.SNAPSHOT_URL = '/api/open-world/snapshot?view=shell'
    exports.SNAPSHOT_FULL_URL = '/api/open-world/snapshot'
    exports.TASK_BOARD_URL = '/api/task-board/state'
    exports.POLL_MS = 2500
    exports.CLIENT_VER = 'v2.78'
    /** compose 时写入内容哈希；源码里占位为 dev */
    exports.CLIENT_BUILD = 'c142f73f6f'
    exports.CLIENT_BUILT_AT = '2026-09-29T13:11:45.549Z'
    exports.ACTION_URL = '/api/task-board/action'
    exports.PULSE_URL = '/api/open-world/pulse'
    exports.OW_ACTION_URL = '/api/open-world/action'
    exports.MESSAGES_URL = '/api/open-world/messages'
    exports.STREAM_URL = '/api/open-world/stream'
    exports.SPACE_VIEW_URL = '/api/open-world/space/view'
    exports.SPACE_SECOND_SCREEN_URL = '/api/open-world/space/second-screen'
    exports.MEMORY_URL = '/api/open-world/memory'
    exports.MEMORY_SEARCH_URL = '/api/open-world/memory/search'
    exports.MEMORY_ARCHIVES_URL = '/api/open-world/memory/archives'
    exports.MEMORY_COMPARE_URL = '/api/open-world/memory/compare'
    exports.INTEGRATIONS_URL = '/api/open-world/integrations'
    exports.WORLD_STATE_URL = '/api/open-world/world-state'
    exports.DEEPSEEK_USAGE_URL = '/api/deepseek-usage/state'
    exports.NEURAL_LAYOUT_KEY = 'dsh-open-world-neural-layout'
    exports.ATI_PRESET_KEY = 'dsh-open-world-ati-preset'
    exports.LEFT_TAB_KEY = 'dsh-open-world-left-tab'
    /** Shell WM: fullscreen | split | float | minimized */
    exports.WM_MODE_KEY = 'dsh-open-world-wm-mode'
    exports.WM_LAST_MODE_KEY = 'dsh-open-world-wm-last'
    exports.WM_MODES = ['fullscreen', 'split', 'float', 'minimized']
    /** 壳内应用表面（ATI 节点进入） */
    exports.APP_SURFACES = {
      'task-board': { title: '任务看板', titleEn: 'TASK BOARD' },
      rewind: { title: '回退时间轴', titleEn: 'REWIND' },
      market: { title: '插件市场', titleEn: 'MARKET' },
      memory: { title: '长期记忆', titleEn: 'HINDSIGHT' },
      ssh: { title: 'SSH 远程', titleEn: 'SSH' },
      remote: { title: '移动端远程', titleEn: 'REMOTE' },
      analytics: { title: '工作区分析', titleEn: 'ANALYTICS' },
      monitor: { title: '系统监视', titleEn: 'MONITOR' },
      fleet: { title: '进程舰队', titleEn: 'FLEET' },
      sidebar: { title: '侧栏开放世界', titleEn: 'SIDEBAR' },
    }

    exports.ATI_PRESETS = [
      { id: 'ati-unified', label: '统一场', sub: 'UNIFIED FIELD', group: 'ATI' },
      { id: 'manifold-torus', label: '环面', sub: 'TORUS · g=1', group: '拓扑' },
      { id: 'manifold-mobius', label: '莫比乌斯', sub: 'MÖBIUS · 不可定向', group: '拓扑' },
      { id: 'manifold-klein', label: '克莱因瓶', sub: 'KLEIN · 4D', group: '拓扑' },
      { id: 'poincare-disk', label: '庞加莱圆盘', sub: 'POINCARÉ · 双曲', group: '拓扑' },
      { id: 'ml-gradient', label: '机器学习', sub: 'GRADIENT · LOSS', group: 'ML' },
      { id: 'deep-attention', label: '深度学习', sub: 'ATTENTION · TRANSFORMER', group: 'DL' },
      { id: 'molecular-graph', label: '分子图', sub: 'MOLECULAR GRAPH', group: '化学' },
      { id: 'periodic-lattice', label: '元素周期', sub: 'PERIODIC LATTICE', group: '化学' },
      { id: 'ati-evolution', label: 'ATI 演化', sub: 'EMERGENCE', group: 'ATI' },
      { id: 'aci-loop', label: 'ACI 循环', sub: 'THINK LOOP', group: 'ACI' },
    ]

    exports.ACI_PHASES = [
      { id: 'plan', zh: '规划', en: 'PLAN', color: '#5eead4' },
      { id: 'execute', zh: '执行', en: 'EXECUTE', color: '#f5d67a' },
      { id: 'evaluate', zh: '评估', en: 'EVALUATE', color: '#a78bfa' },
      { id: 'adjust', zh: '调整', en: 'ADJUST', color: '#f472b6' },
    ]

    exports.ATI_STAGES_FALLBACK = [
      { id: 'seed', zh: '拓扑胚' },
      { id: 'ml', zh: '机器学习' },
      { id: 'dl', zh: '深度学习' },
      { id: 'chem', zh: '化学计算' },
      { id: 'ati', zh: 'ATI 涌现' },
    ]

    exports.DL_STACK = [
      { id: 'user-hub', label: 'TOKENIZER', zh: '词元化' },
      { id: 'network', label: 'EMBEDDING', zh: '嵌入层' },
      { id: 'ai-engine', label: 'ATTENTION', zh: '多头注意力' },
      { id: 'analytics', label: 'FFN', zh: '前馈网络' },
      { id: 'task-board', label: 'OPTIMIZER', zh: '梯度优化' },
      { id: 'core', label: 'ATI HEAD', zh: '输出头' },
    ]

    exports.NODE_ZH = {
      core: '核心系统',
      'ai-engine': 'AI 引擎',
      'task-board': '任务队列',
      storage: '存储中心',
      network: '网络服务',
      security: '安全防护',
      analytics: '数据分析',
      'user-hub': '用户中心',
      runtime: '设备管理',
      memory: '长期记忆',
      'session-active': '当前会话',
    }

    exports.NODE_LAYOUT = {
      core: { orbit: 0, angle: 0, en: 'CORE SYSTEM', color: '#ffffff' },
      analytics: { orbit: 4, angle: -70, en: 'DATA ANALYTICS', color: '#bfe38e' },
      'ai-engine': { orbit: 3, angle: 20, en: 'AI ENGINE', color: '#f5d67a' },
      security: { orbit: 3, angle: 95, en: 'SECURITY', color: '#5eead4' },
      network: { orbit: 4, angle: 145, en: 'NETWORK', color: '#bfe38e' },
      storage: { orbit: 4, angle: 215, en: 'STORAGE', color: '#7ab8f5' },
      'user-hub': { orbit: 3.5, angle: 250, en: 'USER HUB', color: '#f4a261' },
      'task-board': { orbit: 3, angle: -130, en: 'TASK QUEUE', color: '#38bdf8' },
      runtime: { orbit: 3.5, angle: 170, en: 'RUNTIME', color: '#7c8ea6' },
      memory: { orbit: 2.5, angle: -40, en: 'MEMORY BANK', color: '#a78bfa' },
    }

    exports.EVENT_COLORS = ['green', 'gold', 'cyan', 'orange', 'purple']
    exports.LOAD_COLORS = ['#5eead4', '#bfe38e', '#f5d67a', '#7ab8f5']

    exports.QUICK_ACTIONS = [
      { icon: 'plus', label: '新建任务', action: { type: 'task-create', title: '开放世界 · 新任务' } },
      { icon: 'backup', label: '任务看板', action: { type: 'embed', label: '任务看板', panel: 'task-board' } },
      { icon: 'diagnosis', label: '回退', action: { type: 'embed', label: '回退时间轴', panel: 'rewind' } },
    ]

    /** 壳顶用法条：关闭后写入 localStorage */
    exports.SHELL_GUIDE_KEY = 'dsh-open-world-shell-guide-dismissed'

    return module.exports
  },
})


// Open World · styles（从 client-main 抽出）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/styles',
  factory: () => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const CSS = `
.ow-root,.ow-root *{box-sizing:border-box}
.ow-root{
  --ow-bg-deep:#05070d;--ow-bg-panel:rgba(18,26,38,.55);--ow-border:rgba(94,234,212,.18);
  --ow-border-strong:rgba(94,234,212,.35);--ow-text:#e6f1ff;--ow-text-2:#7c8ea6;
  --ow-text-muted:#4a5a70;--ow-cyan:#5eead4;--ow-gold:#f5d67a;--ow-green:#bfe38e;
  --ow-orange:#f4a261;--ow-blue:#7ab8f5;--ow-glow:0 0 12px rgba(94,234,212,.45);
  --ow-mono:Consolas,'Courier New',ui-monospace,monospace;
  --ow-display:Consolas,'Segoe UI','Microsoft YaHei UI',sans-serif;
  font-family:'Segoe UI','Microsoft YaHei UI',system-ui,sans-serif;color:var(--ow-text);
}
.ow-trigger{display:grid;place-items:center;width:28px;height:28px;border:none;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,#aab);cursor:pointer;font-size:15px;transition:all .2s}
.ow-trigger:hover{background:rgba(94,234,212,.12);color:var(--ow-cyan);box-shadow:var(--ow-glow)}
.ow-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;overflow:hidden;background:var(--ow-bg-deep);color:var(--ow-text);isolation:isolate;transition:width .2s ease,height .2s ease,inset .2s ease,border-radius .2s ease,box-shadow .2s ease}
.ow-overlay.is-split{inset:0 0 0 auto;width:min(56vw,960px);border-left:1px solid var(--ow-border-strong);box-shadow:-16px 0 48px rgba(0,0,0,.5)}
.ow-overlay.is-float{inset:auto;top:7vh;left:10vw;width:min(80vw,1180px);height:86vh;border-radius:8px;border:1px solid var(--ow-border-strong);box-shadow:0 24px 64px rgba(0,0,0,.55)}
.ow-overlay.is-float.is-dragging{transition:none;user-select:none}
.ow-overlay.is-minimized{inset:auto;left:14px;bottom:14px;width:auto;height:auto;background:transparent;border:none;box-shadow:none;overflow:visible;isolation:auto}
.ow-overlay.is-split .ow-body,.ow-overlay.is-float .ow-body{grid-template-columns:240px 1fr;padding:12px 14px}
.ow-overlay.is-split .ow-side-right,.ow-overlay.is-float .ow-side-right{display:none}
.ow-wm-bar{display:flex;align-items:center;gap:6px}
.ow-wm-btn{border:1px solid var(--ow-border);background:rgba(8,14,24,.65);color:var(--ow-text-2);border-radius:4px;padding:6px 10px;cursor:pointer;font-size:11px;letter-spacing:.04em;transition:all .15s}
.ow-wm-btn:hover{color:var(--ow-cyan);border-color:var(--ow-cyan)}
.ow-wm-btn.on{color:var(--ow-cyan);border-color:var(--ow-cyan);background:rgba(94,234,212,.1);box-shadow:var(--ow-glow)}
.ow-dock{display:flex;align-items:center;gap:6px;padding:6px;border-radius:999px;background:rgba(8,14,24,.92);border:1px solid var(--ow-border-strong);box-shadow:var(--ow-glow);backdrop-filter:blur(8px)}
.ow-dock-chip{display:inline-flex;align-items:center;gap:8px;border:none;background:transparent;color:var(--ow-cyan);cursor:pointer;font-size:12px;font-family:var(--ow-mono);padding:4px 10px;letter-spacing:.08em}
.ow-dock-chip:hover{color:#fff}
.ow-dock-mark{font-size:14px}
.ow-dock-unread{min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#f472b6;color:#fff;font-size:10px;display:grid;place-items:center}
.ow-dock-close{width:24px;height:24px;border:none;border-radius:999px;background:transparent;color:#7c8ea6;cursor:pointer;font-size:14px}
.ow-dock-close:hover{color:#ffb8b8;background:rgba(80,20,20,.35)}
.ow-fleet{display:flex;flex-direction:column;gap:4px}
.ow-fleet-summary{font-size:11px;color:#5eead4;margin-bottom:6px;font-family:var(--ow-mono)}
.ow-fleet-hint{font-size:10px;color:#64748b;margin-bottom:6px;line-height:1.4}
.ow-fleet-row{display:grid;grid-template-columns:52px 1fr auto auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid rgba(94,234,212,.12);border-radius:4px;font-size:11px}
.ow-fleet-row.ow-clickable:hover{background:rgba(94,234,212,.06)}
.ow-fleet-row-static{cursor:default;opacity:.92}
.ow-fleet-row.status-running,.ow-fleet-row.status-active,.ow-fleet-row.status-busy{border-color:rgba(94,234,212,.35)}
.ow-fleet-kind{color:#7c8ea6;font-size:10px;letter-spacing:.04em}
.ow-fleet-main{min-width:0;display:flex;flex-direction:column;gap:3px}
.ow-fleet-title{color:#e6f1ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-fleet-stages{display:flex;flex-wrap:wrap;gap:3px}
.ow-fleet-stage{font-size:9px;color:#94a3b8;padding:1px 5px;border:1px solid rgba(148,163,184,.25);border-radius:3px;max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-fleet-pct{color:#f5d67a;font-family:var(--ow-mono);font-size:10px}
.ow-fleet-status{color:#5eead4;font-size:10px}
.ow-topbar.is-float-drag{cursor:grab}
.ow-topbar.is-float-drag:active{cursor:grabbing}
.ow-bg-canvas{position:absolute;inset:0;z-index:0;pointer-events:none;width:100%;height:100%;display:block}
.ow-fx-vig{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(ellipse 84% 78% at 50% 50%,rgba(0,0,0,0) 46%,rgba(0,0,0,.34) 76%,rgba(0,0,0,.80) 100%)}
.ow-fx-scan{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.22;background:repeating-linear-gradient(180deg,rgba(255,255,255,.03) 0 1px,rgba(0,0,0,0) 1px 3px)}
.ow-fx-sweep{position:absolute;left:0;right:0;height:44vh;z-index:1;pointer-events:none;opacity:.09;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(159,228,255,.10),rgba(0,0,0,0));animation:owSweep 14s linear infinite}
@keyframes owSweep{0%{transform:translateY(-50vh)}100%{transform:translateY(120vh)}}
.ow-starfield{position:absolute;inset:0;z-index:0;pointer-events:none;background:
  radial-gradient(ellipse at 50% 50%,rgba(30,58,70,.25) 0%,transparent 55%),
  radial-gradient(ellipse at 20% 80%,rgba(15,40,60,.3) 0%,transparent 45%),
  var(--ow-bg-deep)}
.ow-starfield::before,.ow-starfield::after{content:'';position:absolute;inset:0;animation:owTwinkle 6s ease-in-out infinite alternate}
.ow-starfield::before{background-image:
  radial-gradient(1px 1px at 10% 20%,rgba(255,255,255,.6),transparent),
  radial-gradient(1.5px 1.5px at 45% 35%,rgba(255,255,255,.7),transparent),
  radial-gradient(1px 1px at 80% 15%,rgba(255,255,255,.5),transparent),
  radial-gradient(1px 1px at 65% 60%,rgba(200,230,255,.4),transparent)}
.ow-starfield::after{animation-delay:-3s;animation-duration:8s;background-image:
  radial-gradient(1px 1px at 30% 25%,rgba(200,230,255,.45),transparent),
  radial-gradient(1px 1px at 70% 25%,rgba(180,210,240,.5),transparent),
  radial-gradient(1px 1px at 50% 70%,rgba(255,255,255,.4),transparent)}
@keyframes owTwinkle{0%{opacity:.4}100%{opacity:1}}
.ow-shell{position:relative;z-index:2;display:flex;flex-direction:column;height:100%}
.ow-ver{position:absolute;top:8px;right:140px;font-size:9px;color:rgba(94,234,212,.35);letter-spacing:.15em;z-index:3;pointer-events:none;font-family:var(--ow-mono)}
.ow-stale{position:absolute;top:28px;left:50%;transform:translateX(-50%);z-index:6;max-width:min(92vw,640px);padding:8px 14px;border:1px solid rgba(245,214,122,.45);border-radius:2px;background:rgba(40,28,8,.92);color:#f5d67a;font-size:11px;font-family:var(--ow-mono);text-align:center;pointer-events:none;letter-spacing:.02em}
.ow-bridge-health{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;padding:6px 8px;border:1px solid rgba(94,234,212,.1);border-radius:4px;background:rgba(4,8,16,.45);font-size:9px}
.ow-bridge-label{color:#7c8ea6;letter-spacing:1px;margin-right:4px}
.ow-bridge-chip{padding:2px 6px;border-radius:3px;border:1px solid rgba(94,234,212,.15);color:#7c8ea6}
.ow-bridge-chip.ok{border-color:rgba(94,234,212,.35);color:#5eead4}
.ow-bridge-chip.warn{border-color:rgba(251,191,36,.4);color:#fbbf24}
.ow-bridge-chip.bad{border-color:rgba(255,120,120,.35);color:#ff9090}
.ow-bridge-refresh{margin-left:auto;padding:2px 6px;border:1px solid rgba(94,234,212,.2);background:transparent;color:#5eead4;border-radius:3px;cursor:pointer;font-size:10px}
.ow-metaphor-tag{display:inline-block;margin-left:8px;padding:1px 6px;font-size:8px;letter-spacing:.5px;border:1px solid rgba(167,139,250,.35);color:#a78bfa;border-radius:3px;vertical-align:middle}
.ow-derived-tag{display:inline-block;margin-left:6px;padding:1px 5px;font-size:8px;border:1px solid rgba(94,234,212,.2);color:#7c8ea6;border-radius:3px}
.ow-topbar{height:60px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ow-border);background:linear-gradient(to bottom,rgba(10,18,28,.8),rgba(10,18,28,.3));position:relative}
.ow-topbar::before{content:'';position:absolute;left:50%;bottom:-1px;transform:translateX(-50%);width:40%;height:1px;background:linear-gradient(to right,transparent,var(--ow-cyan),transparent);box-shadow:var(--ow-glow)}
.ow-topbar-left,.ow-topbar-right{display:flex;align-items:center;gap:22px}
.ow-brand{display:flex;align-items:center;gap:10px}
.ow-brand-logo{width:28px;height:28px;border:1.5px solid var(--ow-cyan);border-radius:50%;position:relative;display:flex;align-items:center;justify-content:center}
.ow-brand-logo::before{content:'';width:14px;height:14px;border:1px solid var(--ow-cyan);border-radius:50%}
.ow-brand-name{font-family:var(--ow-display);font-size:18px;font-weight:700;letter-spacing:3px;color:var(--ow-text)}
.ow-icon-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ow-border);border-radius:4px;color:var(--ow-text-2);cursor:default;background:transparent;transition:all .2s}
.ow-icon-btn:hover{color:var(--ow-cyan);border-color:var(--ow-cyan);box-shadow:var(--ow-glow)}
.ow-topbar-center{display:flex;flex-direction:column;align-items:center;position:absolute;left:50%;transform:translateX(-50%);top:8px}
.ow-topbar-time{font-family:var(--ow-mono);font-size:18px;font-weight:500;letter-spacing:2px;color:var(--ow-text)}
.ow-topbar-date{font-size:11px;color:var(--ow-text-2);letter-spacing:1px;font-family:var(--ow-mono)}
.ow-close{border:1px solid rgba(255,100,100,.3);background:rgba(80,20,20,.35);color:#ffb8b8;border-radius:4px;padding:7px 14px;cursor:pointer;font-size:12px;font-weight:600;letter-spacing:.06em;transition:all .2s}
.ow-close:hover{background:rgba(120,30,30,.5);box-shadow:0 0 16px rgba(255,80,80,.2)}
.ow-body{flex:1;display:grid;grid-template-columns:300px 1fr 300px;gap:0;padding:16px 20px;min-height:0}
.ow-side{display:flex;flex-direction:column;overflow-y:auto;min-height:0}
.ow-side-left{padding-right:4px}
.ow-side-tabs{display:flex;gap:4px;margin-bottom:10px;padding:0 2px;position:sticky;top:0;z-index:3;background:linear-gradient(180deg,rgba(6,10,18,.98) 70%,transparent)}
.ow-side-tab{flex:1;border:1px solid var(--ow-border);background:rgba(8,14,24,.65);color:var(--ow-text-muted);font-size:11px;padding:7px 4px;cursor:pointer;border-radius:2px;letter-spacing:.4px;transition:border-color .15s,color .15s}
.ow-side-tab:hover{color:var(--ow-text-2)}
.ow-side-tab.on{border-color:var(--ow-cyan);color:var(--ow-cyan);background:rgba(94,234,212,.08)}
.ow-side-hint{font-size:10px;color:#5a6a80;line-height:1.55;margin-bottom:8px;padding:0 4px}
.ow-status-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.ow-status-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(94,234,212,.15);border-radius:3px;color:#9fb4cc}
.ow-status-chip.ok{border-color:rgba(94,234,212,.35);color:#5eead4}
.ow-status-chip.off{opacity:.55}
.ow-side-right{padding-left:4px}
.ow-side::-webkit-scrollbar{width:3px}
.ow-side::-webkit-scrollbar-thumb{background:var(--ow-border-strong);border-radius:2px}
.ow-panel{background:var(--ow-bg-panel);border:1px solid var(--ow-border);border-radius:2px;position:relative;backdrop-filter:blur(4px);margin-bottom:14px}
.ow-panel::before,.ow-panel::after{content:'';position:absolute;width:10px;height:10px;border-color:var(--ow-cyan);border-style:solid;border-width:0;pointer-events:none}
.ow-panel::before{top:-1px;left:-1px;border-top-width:1.5px;border-left-width:1.5px}
.ow-panel::after{bottom:-1px;right:-1px;border-bottom-width:1.5px;border-right-width:1.5px}
.ow-panel-head{padding:12px 16px 8px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ow-border)}
.ow-panel-title{display:flex;flex-direction:column;gap:2px}
.ow-panel-title-zh{font-size:13px;font-weight:500;color:var(--ow-text);letter-spacing:1px}
.ow-panel-title-en{font-size:10px;color:var(--ow-text-muted);letter-spacing:1.5px;font-family:var(--ow-mono);text-transform:uppercase}
.ow-panel-more{font-size:11px;color:var(--ow-text-muted);cursor:pointer}
.ow-panel-body{padding:14px 16px}
.ow-center{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0}
.ow-galaxy-wrap{position:relative;width:100%;height:100%;max-width:720px;max-height:720px;aspect-ratio:1/1}
.ow-galaxy-title{position:absolute;top:8%;left:50%;transform:translateX(-50%);font-family:var(--ow-display);font-size:13px;color:var(--ow-text-muted);letter-spacing:8px;text-transform:uppercase;opacity:.6;z-index:1}
.ow-galaxy-svg{width:100%;height:100%}
.ow-orbit-ring{fill:none;stroke:rgba(94,234,212,.08);stroke-width:1;stroke-dasharray:4 6}
.ow-orbit-ring.hl{stroke:rgba(94,234,212,.18);stroke-dasharray:none}
.ow-rotate-slow{animation:owSpin 120s linear infinite;transform-origin:350px 350px}
.ow-rotate-slow2{animation:owSpin 180s linear infinite reverse;transform-origin:350px 350px}
.ow-rotate-rev{animation:owSpin 90s linear infinite reverse;transform-origin:350px 350px}
@keyframes owSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.ow-core-pulse{animation:owPulse 3s ease-in-out infinite}
@keyframes owPulse{0%,100%{opacity:.85}50%{opacity:1}}
.ow-node{cursor:pointer}
.ow-node:hover{filter:brightness(1.15)}
.ow-orbit-hint{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);padding:8px 18px;border-radius:2px;background:rgba(8,16,28,.85);border:1px solid var(--ow-border);font-size:12px;color:var(--ow-cyan);white-space:nowrap;backdrop-filter:blur(8px);z-index:2;font-family:var(--ow-mono)}
.ow-health-wrap{display:flex;align-items:center;justify-content:center;padding:4px 0 10px;position:relative}
.ow-health-ring{position:relative;width:110px;height:110px}
.ow-health-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.ow-health-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ow-health-val{font-family:var(--ow-display);font-size:32px;font-weight:600;color:var(--ow-cyan);line-height:1;text-shadow:var(--ow-glow)}
.ow-health-unit{font-size:11px;color:var(--ow-text-muted);font-family:var(--ow-mono);margin-top:2px}
.ow-health-label{text-align:center;margin-top:2px}
.ow-health-label-main{font-size:12px;color:var(--ow-text-2);letter-spacing:1px}
.ow-health-label-sub{font-size:10px;color:var(--ow-text-muted);letter-spacing:1.5px;font-family:var(--ow-mono);margin-top:2px}
.ow-spark{width:100%;height:36px;display:block;margin-top:8px}
.ow-load-item{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(94,234,212,.07)}
.ow-load-item:last-child{border-bottom:none}
.ow-load-label{font-family:var(--ow-mono);font-size:12px;color:var(--ow-text-2);letter-spacing:1px;width:44px}
.ow-load-wave{flex:1;height:24px;margin:0 8px}
.ow-load-val{font-family:var(--ow-mono);font-size:13px;color:var(--ow-text);font-weight:500;width:60px;text-align:right}
.ow-event-list{display:flex;flex-direction:column;gap:10px}
.ow-event-item{display:flex;align-items:center;gap:10px;font-size:12px}
.ow-event-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;box-shadow:0 0 6px currentColor}
.ow-event-dot.green{background:var(--ow-green);color:var(--ow-green)}
.ow-event-dot.gold{background:var(--ow-gold);color:var(--ow-gold)}
.ow-event-dot.cyan{background:var(--ow-cyan);color:var(--ow-cyan)}
.ow-event-dot.orange{background:var(--ow-orange);color:var(--ow-orange)}
.ow-event-dot.purple{background:#a78bfa;color:#a78bfa}
.ow-event-text{flex:1;color:var(--ow-text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-event-time{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);flex-shrink:0}
.ow-radar{width:100%;height:120px}
.ow-sector-foot{display:flex;align-items:center;justify-content:space-between;padding:6px 4px 2px;font-size:12px;color:var(--ow-text-2)}
.ow-sector-arrow{color:var(--ow-cyan);font-size:14px}
.ow-donut-wrap{display:flex;flex-direction:column;align-items:center;padding:4px 0 10px}
.ow-donut{position:relative;width:120px;height:120px}
.ow-donut svg{width:100%;height:100%;transform:rotate(-90deg)}
.ow-donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.ow-donut-total{font-family:var(--ow-display);font-size:26px;font-weight:600;color:var(--ow-text);line-height:1}
.ow-donut-label{font-size:11px;color:var(--ow-text-muted);margin-top:4px;letter-spacing:1px}
.ow-res-list{display:flex;flex-direction:column;gap:8px;margin-top:8px;width:100%}
.ow-res-item{display:flex;align-items:center;gap:8px;font-size:12px}
.ow-res-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.ow-res-name{flex:1;color:var(--ow-text-2)}
.ow-res-val{font-family:var(--ow-mono);color:var(--ow-text);font-weight:500}
.ow-res-pct{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);width:38px;text-align:right}
.ow-task-list{display:flex;flex-direction:column;gap:12px}
.ow-task-item{display:flex;flex-direction:column;gap:6px}
.ow-task-head{display:flex;align-items:center;justify-content:space-between;font-size:12px}
.ow-task-name{color:var(--ow-text-2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-task-status{font-family:var(--ow-mono);font-size:10px;padding:1px 6px;border-radius:2px;margin-left:8px;letter-spacing:.5px}
.ow-task-status.running{color:var(--ow-cyan);background:rgba(94,234,212,.1);border:1px solid rgba(94,234,212,.25)}
.ow-task-status.pending{color:var(--ow-text-muted);background:rgba(74,90,112,.15);border:1px solid rgba(74,90,112,.3)}
.ow-task-pct{font-family:var(--ow-mono);font-size:11px;color:var(--ow-gold);margin-left:6px;width:32px;text-align:right}
.ow-task-bar{height:3px;background:rgba(94,234,212,.1);border-radius:2px;overflow:hidden}
.ow-task-fill{height:100%;border-radius:2px;transition:width 1s ease}
.ow-task-fill.cyan{background:linear-gradient(to right,#2dd4bf,var(--ow-cyan));box-shadow:0 0 6px rgba(94,234,212,.5)}
.ow-task-fill.gold{background:linear-gradient(to right,#d4a74b,var(--ow-gold));box-shadow:0 0 6px rgba(245,214,122,.5)}
.ow-task-fill.dim{background:var(--ow-text-muted);opacity:.4}
.ow-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ow-action-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 4px;border:1px solid var(--ow-border);border-radius:2px;background:rgba(94,234,212,.03);cursor:pointer;transition:all .2s;color:var(--ow-text-2)}
.ow-action-btn:hover{border-color:var(--ow-cyan);color:var(--ow-cyan);background:rgba(94,234,212,.08);box-shadow:var(--ow-glow)}
.ow-action-label{font-size:11px;letter-spacing:.5px}
.ow-bottom{height:110px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;padding:0 28px;border-top:1px solid var(--ow-border);background:linear-gradient(to top,rgba(10,18,28,.8),rgba(10,18,28,.3));position:relative}
.ow-bottom::before{content:'';position:absolute;left:50%;top:-1px;transform:translateX(-50%);width:40%;height:1px;background:linear-gradient(to right,transparent,var(--ow-cyan),transparent);box-shadow:var(--ow-glow)}
.ow-log-wrap{display:flex;flex-direction:column;gap:6px;max-height:80px;overflow:hidden}
.ow-log-head{display:flex;align-items:center;justify-content:space-between}
.ow-log-title{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);letter-spacing:1.5px}
.ow-log-line{display:flex;gap:10px;align-items:center;font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-2)}
.ow-log-time{color:var(--ow-cyan);font-size:11px}
.ow-log-dot{width:5px;height:5px;border-radius:50%;background:var(--ow-green);box-shadow:0 0 4px var(--ow-green)}
.ow-view-switch{display:flex;gap:0;align-items:center;position:relative}
.ow-deep-toggle{position:absolute;top:-46px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:8px 22px;background:linear-gradient(to bottom,rgba(18,26,38,.95),rgba(10,18,28,.95));border:1px solid var(--ow-border);border-bottom:none;border-radius:2px 2px 0 0;white-space:nowrap}
.ow-deep-icon{color:var(--ow-gold)}
.ow-deep-label{display:flex;flex-direction:column;gap:2px}
.ow-deep-zh{font-size:12px;color:var(--ow-text);letter-spacing:2px}
.ow-deep-en{font-family:var(--ow-mono);font-size:9px;color:var(--ow-text-muted);letter-spacing:1.5px}
.ow-deep-switch{position:relative;width:36px;height:20px;background:rgba(74,90,112,.3);border:1px solid var(--ow-border);border-radius:10px;cursor:pointer;transition:all .3s}
.ow-deep-switch.on{background:rgba(191,227,142,.25);border-color:var(--ow-green);box-shadow:0 0 8px rgba(191,227,142,.3)}
.ow-deep-switch::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--ow-text-muted);transition:all .3s}
.ow-deep-switch.on::after{left:18px;background:var(--ow-green);box-shadow:0 0 6px var(--ow-green)}
.ow-view-btn{position:relative;width:140px;height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;color:var(--ow-text-2);transition:all .25s;background:transparent;border:none;padding:0}
.ow-view-hex{position:absolute;inset:0}
.ow-view-hex polygon{fill:rgba(12,20,32,.6);stroke:var(--ow-border);stroke-width:1;transition:all .25s}
.ow-view-btn:hover .ow-view-hex polygon{stroke:var(--ow-cyan);fill:rgba(94,234,212,.06)}
.ow-view-btn.on{color:var(--ow-cyan)}
.ow-view-btn.on .ow-view-hex polygon{fill:rgba(94,234,212,.1);stroke:var(--ow-cyan);stroke-width:1.5;filter:drop-shadow(0 0 4px rgba(94,234,212,.4))}
.ow-view-content{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:2px}
.ow-view-label{font-size:12px;letter-spacing:1px}
.ow-view-sub{font-family:var(--ow-mono);font-size:9px;color:var(--ow-text-muted);letter-spacing:1px}
.ow-bottom-right{display:flex;align-items:center;justify-content:flex-end;gap:30px}
.ow-metric{display:flex;flex-direction:column;gap:4px}
.ow-metric-label{display:flex;flex-direction:column;gap:2px}
.ow-metric-zh{font-size:11px;color:var(--ow-text-2);letter-spacing:1px}
.ow-metric-en{font-family:var(--ow-mono);font-size:9px;color:var(--ow-text-muted);letter-spacing:1px}
.ow-metric-val{font-family:var(--ow-mono);font-size:22px;font-weight:500;color:var(--ow-text);line-height:1}
.ow-metric-val .u{font-size:12px;color:var(--ow-text-2);margin-left:2px}
.ow-metric-bar{height:3px;background:rgba(94,234,212,.1);border-radius:2px;overflow:hidden;width:100px}
.ow-metric-fill{height:100%;border-radius:2px;transition:width 1s ease}
.ow-monitor{padding:24px;width:100%;max-width:860px;z-index:2}
.ow-monitor pre{background:rgba(0,0,0,.4);border:1px solid var(--ow-border);border-radius:2px;padding:16px;font-size:11px;overflow:auto;max-height:58vh;color:var(--ow-cyan);font-family:var(--ow-mono)}
.ow-error{color:#ff9090;font-size:12px;padding:8px 18px;background:rgba(80,20,20,.3);z-index:3}
.ow-integ-list{display:flex;flex-direction:column;gap:8px}
.ow-integ-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--ow-border);border-radius:2px;background:rgba(94,234,212,.02);cursor:pointer;transition:all .2s}
.ow-integ-item:hover{border-color:var(--ow-cyan);background:rgba(94,234,212,.08);box-shadow:var(--ow-glow)}
.ow-integ-item.offline{opacity:.55;cursor:default}
.ow-integ-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.ow-integ-dot.online{background:var(--ow-green);box-shadow:0 0 6px var(--ow-green)}
.ow-integ-dot.idle{background:var(--ow-gold);box-shadow:0 0 6px var(--ow-gold)}
.ow-integ-dot.missing{background:var(--ow-text-muted)}
.ow-integ-name{flex:1;font-size:12px;color:var(--ow-text)}
.ow-integ-en{font-family:var(--ow-mono);font-size:9px;color:var(--ow-text-muted);letter-spacing:.08em}
.ow-action-bar{display:flex;align-items:center;gap:10px;margin-top:8px}
.ow-action-bar button{flex:1;padding:8px 12px;border:1px solid var(--ow-border);border-radius:2px;background:rgba(94,234,212,.06);color:var(--ow-cyan);font-size:11px;cursor:pointer;transition:all .2s}
.ow-action-bar button:hover{border-color:var(--ow-cyan);box-shadow:var(--ow-glow)}
.ow-action-bar button.sec{color:var(--ow-text-2);background:transparent}
.ow-orbit-hint{display:flex;flex-direction:column;align-items:center;gap:8px}
.ow-clickable{cursor:pointer}
.ow-clickable:hover .ow-task-name{color:var(--ow-cyan)}
.ow-toast{position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:12px 22px;border:1px solid var(--ow-border-strong);border-radius:2px;background:rgba(10,18,28,.96);color:var(--ow-cyan);font-size:13px;font-family:var(--ow-mono);box-shadow:var(--ow-glow);pointer-events:none;max-width:min(92vw,520px);text-align:center}
.ow-topo{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:24px;width:100%;max-width:920px;z-index:2}
.ow-topo-card{padding:14px;border:1px solid var(--ow-border);border-radius:2px;background:rgba(8,14,24,.8);cursor:pointer;transition:all .2s}
.ow-topo-card:hover{border-color:var(--ow-cyan);box-shadow:0 0 20px rgba(94,234,212,.08)}
.ow-neural-wrap{position:relative;width:100%;height:100%;max-width:860px;max-height:560px;aspect-ratio:860/560}
.ow-neural-title{position:absolute;top:4%;left:50%;transform:translateX(-50%);font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);letter-spacing:6px;z-index:1}
.ow-neural-svg{width:100%;height:100%}
.ow-nn-layer-label{font-family:var(--ow-mono);font-size:8px;fill:#4a5a70;letter-spacing:1.5px}
.ow-nn-layer-label-zh{font-size:9px;fill:#6d8eb0}
.ow-nn-edge{fill:none;stroke-width:1.5;opacity:.35;transition:opacity .3s,stroke-width .3s}
.ow-nn-edge.active{opacity:.85;stroke-width:2}
.ow-nn-edge-glow{fill:none;stroke-width:4;opacity:.12;filter:blur(2px)}
.ow-nn-node{cursor:grab;transition:filter .2s}
.ow-nn-node:hover{filter:brightness(1.2)}
.ow-nn-node.dragging{cursor:grabbing;filter:brightness(1.35)}
.ow-neural-toolbar{position:absolute;top:4%;right:8%;display:flex;gap:6px;z-index:2}
.ow-neural-btn{font-family:var(--ow-mono);font-size:9px;padding:4px 10px;border:1px solid rgba(94,234,212,.25);background:rgba(8,14,24,.75);color:var(--ow-text-muted);cursor:pointer;border-radius:3px;letter-spacing:1px}
.ow-neural-btn:hover{border-color:var(--ow-cyan);color:var(--ow-cyan)}
.ow-nn-edge-hit{fill:none;stroke:transparent;stroke-width:12;pointer-events:stroke;cursor:pointer}
.ow-nn-tooltip{position:fixed;pointer-events:none;padding:6px 10px;background:rgba(8,14,24,.92);border:1px solid rgba(94,234,212,.3);border-radius:4px;font-family:var(--ow-mono);font-size:10px;color:#e6f1ff;z-index:9999;white-space:nowrap}
.ow-nn-tooltip-w{font-size:11px;color:#f5d67a;margin-top:2px}
.ow-neural-hint{position:absolute;bottom:2%;left:50%;transform:translateX(-50%);font-size:9px;color:#4a5a70;font-family:var(--ow-mono);letter-spacing:1px;z-index:1}
.ow-nn-neuron{stroke:rgba(255,255,255,.2);stroke-width:1}
.ow-nn-neuron.sel{stroke:#fff;stroke-width:2.5}
.ow-nn-label{font-size:10px;fill:#e6f1ff;font-weight:500}
.ow-nn-metric{font-size:9px;fill:#f5d67a;font-family:var(--ow-mono)}
.ow-nn-pulse{filter:drop-shadow(0 0 4px #5eead4)}
.ow-vp-wrap{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none}
.ow-vp-inner{position:absolute;inset:0;transform-origin:50% 50%;will-change:transform}
.ow-vp-bg{position:absolute;inset:-40%;pointer-events:none}
.ow-cmd-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh}
.ow-cmd{min-width:min(520px,92vw);background:rgba(10,18,28,.96);border:1px solid var(--ow-border-strong);border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden}
.ow-cmd-input{width:100%;padding:14px 16px;border:none;background:transparent;color:var(--ow-text);font-size:14px;outline:none;font-family:var(--ow-mono)}
.ow-cmd-list{max-height:320px;overflow-y:auto;border-top:1px solid var(--ow-border)}
.ow-cmd-item{padding:10px 16px;cursor:pointer;display:flex;justify-content:space-between;gap:12px;font-size:13px}
.ow-cmd-item:hover,.ow-cmd-item.sel{background:rgba(94,234,212,.08)}
.ow-cmd-item span:last-child{font-size:10px;color:var(--ow-text-muted);font-family:var(--ow-mono)}
.ow-embed{position:absolute;inset:8% 6%;z-index:5;background:rgba(8,14,24,.94);border:1px solid var(--ow-border-strong);border-radius:6px;display:flex;flex-direction:column;backdrop-filter:blur(8px)}
.ow-embed-head{padding:10px 14px;border-bottom:1px solid var(--ow-border);display:flex;justify-content:space-between;align-items:center}
.ow-embed-body{flex:1;overflow:auto;padding:12px 14px}
.ow-detail-card{position:absolute;top:12px;right:12px;width:240px;z-index:4;background:rgba(8,14,24,.92);border:1px solid var(--ow-border-strong);border-radius:6px;padding:12px 14px;backdrop-filter:blur(6px)}
.ow-detail-title{font-size:13px;font-weight:600;color:var(--ow-text);margin-bottom:4px}
.ow-detail-sub{font-size:10px;color:var(--ow-text-muted);font-family:var(--ow-mono);margin-bottom:10px}
.ow-detail-row{display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid rgba(94,234,212,.06)}
.ow-detail-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.ow-detail-actions button{font-size:10px;padding:5px 10px;border:1px solid var(--ow-border);background:rgba(94,234,212,.08);color:var(--ow-cyan);cursor:pointer;border-radius:3px}
.ow-ati-wrap{position:relative;width:100%;height:100%;max-width:920px;max-height:600px;aspect-ratio:920/600}
.ow-ati-title{position:absolute;top:2%;left:50%;transform:translateX(-50%);font-family:var(--ow-mono);font-size:12px;color:#c4b5fd;letter-spacing:10px;z-index:2;text-shadow:0 0 20px rgba(167,139,250,.6)}
.ow-ati-sub{position:absolute;top:6%;left:50%;transform:translateX(-50%);font-size:9px;color:#6d8eb0;letter-spacing:4px;z-index:2;font-family:var(--ow-mono)}
.ow-ati-svg{width:100%;height:100%}
.ow-ati-poincare{fill:rgba(8,12,24,.4);stroke:rgba(94,234,212,.12);stroke-width:1}
.ow-ati-geodesic{fill:none;stroke:rgba(94,234,212,.08);stroke-width:.8}
.ow-ati-torus{fill:none;stroke:rgba(167,139,250,.15);stroke-width:1;stroke-dasharray:6 8}
.ow-ati-dl-box{fill:rgba(12,20,36,.7);stroke:rgba(245,214,122,.35);stroke-width:1}
.ow-ati-dl-box.hl{stroke:#f5d67a;filter:drop-shadow(0 0 6px rgba(245,214,122,.4))}
.ow-ati-dl-label{font-family:var(--ow-mono);font-size:7px;fill:#f5d67a;letter-spacing:1px}
.ow-ati-dl-zh{font-size:8px;fill:#7c8ea6}
.ow-ati-hex{fill:none;stroke:rgba(52,211,153,.4);stroke-width:1.2}
.ow-ati-hex-node{fill:rgba(52,211,153,.25);stroke:#34d399;stroke-width:1}
.ow-ati-bar{fill:rgba(94,234,212,.25)}
.ow-ati-singularity{filter:url(#owAtiGlow)}
.ow-ati-metric{font-family:var(--ow-mono);font-size:8px;fill:#a78bfa}
.ow-ati-preset-bar{position:absolute;bottom:2%;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:4px;z-index:3;max-width:640px}
.ow-ati-preset{font-size:8px;padding:3px 7px;border:1px solid rgba(167,139,250,.3);background:rgba(8,14,24,.82);color:#9ca3af;cursor:pointer;border-radius:3px;font-family:var(--ow-mono);letter-spacing:.5px;transition:all .18s}
.ow-ati-preset:hover{border-color:#5eead4;color:#c4f5ef}
.ow-ati-preset.on{border-color:#a78bfa;color:#e9d5ff;box-shadow:0 0 14px rgba(167,139,250,.4),inset 0 0 8px rgba(167,139,250,.15)}
.ow-ati-preset.g-top.on{border-color:#5eead4;color:#c4f5ef;box-shadow:0 0 14px rgba(94,234,212,.4)}
.ow-ati-preset.g-ml.on{border-color:#f5d67a;color:#fdf0c2;box-shadow:0 0 14px rgba(245,214,122,.4)}
.ow-ati-preset.g-chem.on{border-color:#34d399;color:#c8f7e3;box-shadow:0 0 14px rgba(52,211,153,.4)}
.ow-ati-lab-details{position:relative}
.ow-ati-lab-details>summary{list-style:none}
.ow-ati-lab-details>summary::-webkit-details-marker{display:none}
.ow-ati-lab-presets{position:absolute;bottom:120%;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;gap:4px;width:max-content;max-width:360px;padding:6px;background:rgba(8,14,24,.94);border:1px solid rgba(167,139,250,.25);border-radius:6px}
.ow-shell-guide{display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;padding:8px 10px;border:1px solid rgba(94,234,212,.25);background:rgba(94,234,212,.06);border-radius:6px}
.ow-shell-guide-text{flex:1;font-size:11px;line-height:1.45;color:#94a3b8}
.ow-shell-guide-text strong{color:#5eead4;font-weight:600}
.ow-shell-guide-x{flex-shrink:0;font-size:10px;padding:4px 8px;border:1px solid rgba(148,163,184,.35);background:transparent;color:#94a3b8;border-radius:4px;cursor:pointer}
.ow-shell-guide-x:hover{border-color:#5eead4;color:#c4f5ef}
.ow-empty-cue{margin:0 0 10px;padding:12px 12px 10px;border:1px dashed rgba(94,234,212,.28);border-radius:8px;background:linear-gradient(160deg,rgba(94,234,212,.07),rgba(8,14,24,.4))}
.ow-empty-cue-slim{padding:8px 10px;margin-bottom:8px}
.ow-empty-cue-art{position:relative;width:44px;height:44px;margin:0 0 8px}
.ow-empty-cue-ring{position:absolute;inset:4px;border:1.5px solid rgba(94,234,212,.35);border-radius:50%}
.ow-empty-cue-dot{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#5eead4;box-shadow:0 0 10px rgba(94,234,212,.45)}
.ow-empty-cue-ray{position:absolute;left:50%;top:2px;width:1.5px;height:12px;margin-left:-0.75px;background:rgba(94,234,212,.55);transform-origin:bottom center;animation:ow-empty-pulse 2.4s ease-in-out infinite}
@keyframes ow-empty-pulse{0%,100%{opacity:.35;transform:scaleY(.7)}50%{opacity:1;transform:scaleY(1)}}
.ow-empty-cue-title{font-size:12px;color:#e2e8f0;font-weight:600;margin-bottom:4px}
.ow-empty-cue-body{font-size:11px;line-height:1.5;color:#94a3b8;margin-bottom:8px}
.ow-empty-cue-actions{display:flex;flex-wrap:wrap;gap:6px}
.ow-memory-tabs{margin-bottom:8px}
.ow-adv-fold{border-top:1px solid rgba(148,163,184,.12)}
.ow-ati-hud{position:absolute;top:10%;left:2.5%;font-family:var(--ow-mono);font-size:8px;color:#6d8eb0;line-height:1.7;z-index:2;max-width:300px}
.ow-ati-hud b{color:#c4b5fd;font-weight:500}
.ow-ati-stage-tag{position:absolute;top:9%;right:2.5%;z-index:2;font-family:var(--ow-mono);font-size:8px;color:#7c8ea6;text-align:right;line-height:1.8}
.ow-ati-stage-tag b{color:#5eead4;font-weight:500;letter-spacing:1px}
.ow-lab-wire{fill:none;stroke-width:1;opacity:.85}
.ow-lab-wire.cyan{stroke:#5eead4}
.ow-lab-wire.violet{stroke:#a78bfa}
.ow-lab-wire.gold{stroke:#f5d67a}
.ow-lab-wire.green{stroke:#34d399}
.ow-lab-wire.pink{stroke:#f472b6}
.ow-lab-wire-dim{fill:none;stroke-width:.7;stroke:#5eead4;opacity:.16}
.ow-lab-loss{fill:none;stroke:#5eead4;stroke-width:2;filter:drop-shadow(0 0 5px rgba(94,234,212,.55))}
.ow-lab-loss-area{fill:rgba(94,234,212,.08)}
.ow-lab-contour{fill:rgba(167,139,250,.05);stroke:#a78bfa;stroke-width:.8;stroke-dasharray:3 5}
.ow-lab-axis{stroke:rgba(124,142,166,.25);stroke-width:.7}
.ow-lab-tick{font-family:var(--ow-mono);font-size:7px;fill:#4a5a70}
.ow-lab-title{font-family:var(--ow-mono);font-size:9px;fill:#e6f1ff;letter-spacing:2px;text-shadow:0 0 10px rgba(94,234,212,.5)}
.ow-lab-title.dim{font-size:7px;fill:#6d8eb0}
.ow-lab-elem{stroke:#34d399;stroke-width:1;transition:filter .2s}
.ow-lab-elem:hover{filter:brightness(1.25)}
.ow-lab-elem.metal{stroke:#f4a261}
.ow-lab-elem.nonmetal{stroke:#5eead4}
.ow-lab-elem.carbon{stroke:#a78bfa}
.ow-lab-elem-symbol{font-family:var(--ow-mono);font-size:15px;font-weight:700;text-anchor:middle}
.ow-lab-elem-z{font-family:var(--ow-mono);font-size:6px;fill:#7c8ea6;text-anchor:middle}
.ow-lab-elem-name{font-family:var(--ow-mono);font-size:6px;fill:#6d8eb0;text-anchor:middle}
.ow-lab-elem-metric{font-family:var(--ow-mono);font-size:6px;fill:#f5d67a;text-anchor:middle}
.ow-lab-bond{fill:none;stroke:rgba(52,211,153,.45);stroke-width:1}
.ow-lab-bond.double{stroke-width:1.6}
.ow-lab-atom{fill:rgba(8,14,24,.9);stroke:#34d399;stroke-width:1.2}
.ow-lab-electron{fill:#5eead4;opacity:.9}
.ow-lab-att-cell{stroke:rgba(8,12,24,.8);stroke-width:1}
.ow-lab-att-token{font-family:var(--ow-mono);font-size:7px;fill:#7c8ea6;text-anchor:middle}
.ow-lab-evo-ring{fill:none;stroke:rgba(124,142,166,.18);stroke-width:1}
.ow-lab-evo-ring.on{stroke:rgba(167,139,250,.7);stroke-width:1.6;filter:drop-shadow(0 0 6px rgba(167,139,250,.6))}
.ow-lab-evo-label{font-family:var(--ow-mono);font-size:7px;fill:#7c8ea6;text-anchor:middle;letter-spacing:1px}
.ow-lab-evo-label.on{fill:#e9d5ff}
.ow-lab-evo-val{font-family:var(--ow-mono);font-size:18px;fill:#e6f1ff;text-anchor:middle;font-weight:700}
.ow-lab-grad-arrow{stroke:#5eead4;stroke-width:1.4;fill:none;marker-end:url(#owLabArrow)}
.ow-lab-node{fill:rgba(8,12,24,.55);stroke:rgba(245,214,122,.5);stroke-width:1}
.ow-lab-node.on{stroke:#f5d67a;filter:drop-shadow(0 0 6px rgba(245,214,122,.5))}
.ow-social-tag{font-size:9px;color:#6d8eb0;margin-top:2px;letter-spacing:.5px;max-width:200px;line-height:1.4}
.ow-social-list{display:flex;flex-direction:column;gap:8px}
.ow-social-presence{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;border:1px solid rgba(94,234,212,.1);cursor:pointer;transition:background .2s}
.ow-social-presence:hover{background:rgba(94,234,212,.06)}
.ow-social-presence.active{border-color:rgba(167,139,250,.4);background:rgba(167,139,250,.08)}
.ow-social-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#5eead4,#a78bfa);display:grid;place-items:center;font-size:11px;font-weight:700;color:#05070d;flex-shrink:0}
.ow-social-name{font-size:12px;color:#e6f1ff}
.ow-social-sub{font-size:10px;color:#7c8ea6;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-social-channel{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1px solid rgba(94,234,212,.12);border-radius:4px;cursor:pointer;font-size:12px}
.ow-social-channel:hover{border-color:var(--ow-cyan)}
.ow-social-channel.off{opacity:.45;cursor:default}
.ow-social-feed-item{font-size:11px;padding:6px 0;border-bottom:1px solid rgba(94,234,212,.06);display:flex;gap:8px}
.ow-social-kind{font-size:9px;color:#a78bfa;font-family:var(--ow-mono);min-width:42px}
.ow-msg-hub{display:flex;flex-direction:column;gap:10px}
.ow-msg-compose textarea{width:100%;min-height:64px;background:rgba(8,14,24,.8);border:1px solid var(--ow-border);border-radius:4px;color:#e6f1ff;padding:8px;font-size:12px;resize:vertical;font-family:inherit}
.ow-msg-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ow-msg-select,.ow-msg-btn{font-size:10px;padding:5px 8px;border:1px solid var(--ow-border);background:rgba(8,14,24,.75);color:var(--ow-text-muted);border-radius:3px;font-family:var(--ow-mono)}
.ow-msg-btn:disabled{opacity:.4;cursor:not-allowed}
.ow-msg-btn.primary{border-color:#a78bfa;color:#e9d5ff;cursor:pointer}
.ow-msg-btn.primary:hover{box-shadow:0 0 10px rgba(167,139,250,.3)}
.ow-msg-btn.primary:disabled:hover{box-shadow:none}
.ow-msg-item{padding:8px;border:1px solid rgba(94,234,212,.1);border-radius:4px;font-size:11px;cursor:pointer}
.ow-msg-item.unread{border-color:rgba(167,139,250,.45);background:rgba(167,139,250,.06)}
.ow-msg-meta{font-size:9px;color:#7c8ea6;margin-top:4px}
.ow-msg-attach{font-size:10px;color:#a78bfa;margin-top:4px}
.ow-hub{display:flex;flex-direction:column;gap:10px}
.ow-hub-sec{border:1px solid rgba(94,234,212,.12);border-radius:4px;padding:8px;background:rgba(8,14,24,.55)}
.ow-hub-fold>summary{list-style:none;outline:none}
.ow-hub-fold>summary::-webkit-details-marker{display:none}
.ow-hub-fold>summary::before{content:'▸ ';color:#64748b;font-size:10px}
.ow-hub-fold[open]>summary::before{content:'▾ '}
.ow-hub-title{font-size:9px;color:#4a5a70;letter-spacing:1px;margin-bottom:6px}
.ow-hub-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ow-hub-stat{font-size:11px;color:#e6f1ff}
.ow-hub-link{font-size:10px;color:#5eead4;word-break:break-all;max-height:48px;overflow:auto}
.ow-hub-item{padding:6px 8px;border:1px solid rgba(94,234,212,.1);border-radius:3px;font-size:11px;cursor:pointer;margin-top:4px}
.ow-hub-item:hover{border-color:var(--ow-cyan)}
.ow-hub-mem{font-size:10px;color:#7c8ea6;line-height:1.4;max-height:64px;overflow:auto;margin-top:4px}
.ow-archify-embed{position:absolute;inset:12px 12px 80px;z-index:4;border:1px solid rgba(167,139,250,.35);border-radius:4px;background:rgba(5,7,13,.92);display:flex;flex-direction:column;overflow:hidden}
.ow-archify-head{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(94,234,212,.15);font-size:11px;color:#e6f1ff}
.ow-archify-frame{flex:1;border:none;width:100%;background:#05070d}
.ow-rewind-tl{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto}
.ow-rewind-item{padding:8px 10px;border:1px solid rgba(94,234,212,.12);border-radius:4px;font-size:11px;cursor:pointer;background:rgba(8,14,24,.5)}
.ow-rewind-item:hover{border-color:var(--ow-cyan);background:rgba(94,234,212,.06)}
.ow-rewind-item.active{border-color:rgba(167,139,250,.5)}
.ow-rewind-meta{font-size:9px;color:#7c8ea6;margin-top:4px}
.ow-rewind-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.ow-idea-center{padding:20px 24px 32px;overflow:auto;height:100%;max-width:920px;margin:0 auto}
.ow-idea-hero{margin-bottom:20px}
.ow-idea-hero h2{margin:0;font-size:18px;letter-spacing:3px;color:#e6f1ff}
.ow-idea-tag{font-size:11px;color:#5eead4;margin:6px 0 10px}
.ow-idea-overview{font-size:12px;color:#7c8ea6;line-height:1.55;margin-bottom:8px}
.ow-idea-bullet{font-size:11px;color:#9aa8bc;line-height:1.5;margin-top:4px}
.ow-idea-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px;margin-top:8px}
.ow-idea-card{padding:10px;border:1px solid rgba(94,234,212,.12);border-radius:4px;cursor:pointer;background:rgba(8,14,24,.45);transition:border-color .15s}
.ow-idea-card:hover{border-color:rgba(94,234,212,.35)}
.ow-idea-card.active{border-color:var(--ow-cyan);background:rgba(94,234,212,.08)}
.ow-idea-card.compare{box-shadow:inset 0 0 0 1px rgba(167,139,250,.45)}
.ow-idea-card strong{display:block;font-size:12px;color:#e6f1ff}
.ow-idea-sub{font-size:9px;color:#7c8ea6;margin-top:4px;letter-spacing:.5px}
.ow-idea-treat-row{display:flex;flex-wrap:wrap;gap:6px}
.ow-idea-chip{font-size:10px;padding:4px 8px;border:1px solid rgba(94,234,212,.15);border-radius:12px;background:transparent;color:#7c8ea6;cursor:pointer}
.ow-idea-chip.on{border-color:var(--ow-cyan);color:#5eead4;background:rgba(94,234,212,.08)}
.ow-idea-instruction{font-size:11px;color:#9aa8bc;line-height:1.45;margin:12px 0;padding:10px;border:1px dashed rgba(94,234,212,.15);border-radius:4px}
.ow-idea-prompt{width:100%;margin-top:10px;padding:10px;border:1px solid rgba(94,234,212,.15);border-radius:4px;background:rgba(4,8,16,.7);color:#e6f1ff;font-size:12px;line-height:1.45;resize:vertical;min-height:72px;font-family:inherit}
.ow-unread-badge{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#a78bfa;color:#05070d;font-size:9px;font-weight:700;display:grid;place-items:center}
.ow-trigger-wrap{position:relative;display:inline-grid}
    `
    module.exports = { CSS }
    return module.exports
  },
})


// Open World · runtime（WM / world-state / fetch 助手，从 client-main 抽出）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/runtime',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const C = require('dsh-open-world/constants')
    const {
      WM_MODE_KEY, WM_LAST_MODE_KEY, WM_MODES,
      LEFT_TAB_KEY, ATI_PRESET_KEY,
      WORLD_STATE_URL, ACTION_URL, PULSE_URL, OW_ACTION_URL, MESSAGES_URL,
    } = C

    function readWmMode() {
      try {
        const m = localStorage.getItem(WM_MODE_KEY)
        if (m && WM_MODES.includes(m) && m !== 'minimized') return m
      } catch { /* ignore */ }
      return 'split'
    }

    function readWmLastMode() {
      try {
        const m = localStorage.getItem(WM_LAST_MODE_KEY)
        if (m && WM_MODES.includes(m) && m !== 'minimized') return m
      } catch { /* ignore */ }
      return 'split'
    }

    function persistWmMode(mode) {
      try {
        localStorage.setItem(WM_MODE_KEY, mode)
        if (mode !== 'minimized') localStorage.setItem(WM_LAST_MODE_KEY, mode)
      } catch { /* ignore */ }
    }

    async function fetchWorldState() {
      try {
        const res = await fetch(WORLD_STATE_URL, { cache: 'no-store', credentials: 'include' })
        if (!res.ok) return null
        const data = await res.json()
        return data && data.world ? data.world : null
      } catch {
        return null
      }
    }

    async function postWorldState(patch) {
      try {
        const res = await fetch(WORLD_STATE_URL, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) return null
        const data = await res.json()
        return data && data.world ? data.world : null
      } catch {
        return null
      }
    }

    function applyWorldLocalCaches(world) {
      if (!world) return
      const mode = world.shell && world.shell.wmMode
      if (mode) persistWmMode(mode)
      const left = world.ui && world.ui.leftTab
      if (left) {
        try { localStorage.setItem(LEFT_TAB_KEY, left) } catch { /* ignore */ }
      }
      const ati = world.ui && world.ui.atiPreset
      if (ati) {
        try { localStorage.setItem(ATI_PRESET_KEY, ati) } catch { /* ignore */ }
      }
    }

    async function postTaskAction(action) {
      const res = await fetch(ACTION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
        credentials: 'same-origin',
        body: JSON.stringify({ requestId: `ow-${Date.now()}`, action }),
      })
      if (!res.ok) throw new Error(`task-board ${res.status}`)
      return res.json()
    }

    function delay(ms) {
      return new Promise((r) => setTimeout(r, ms))
    }

    function notifyPulse(edges) {
      if (!edges || edges.length === 0) return
      fetch(PULSE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ edges }),
      }).catch(() => {})
    }

    async function postOpenWorldAction(action) {
      let res
      try {
        res = await fetch(OW_ACTION_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(action),
        })
      } catch (err) {
        const tip = err && err.message === 'Failed to fetch'
          ? `网络中断：打不开 ${OW_ACTION_URL}（请确认仍在 DSH Desktop 窗口，地址栏端口未变，然后 Ctrl+Shift+R）`
          : String(err && err.message || err)
        throw new Error(tip)
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || `action ${res.status}`)
      return data
    }

    async function fetchJson(url) {
      let res
      try {
        res = await fetch(url, { cache: 'no-store' })
      } catch (err) {
        if (err && err.message === 'Failed to fetch') {
          throw new Error(`网络中断：${url}（请用 DSH Desktop，勿用外部浏览器裸开；Ctrl+Shift+R）`)
        }
        throw err
      }
      if (!res.ok) throw new Error(`${url} ${res.status}`)
      return res.json()
    }

    async function fetchMessages() {
      return fetchJson(MESSAGES_URL)
    }

    function fmtClock(d) {
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      const ss = String(d.getSeconds()).padStart(2, '0')
      const y = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return { time: `${hh}:${mm}:${ss}`, date: `${y} / ${mo} / ${day} · UTC+8` }
    }

    function taskProgress(t) {
      if (t.running || t.status === 'running') return 72
      if (t.status === 'done' || t.status === 'succeeded') return 100
      if (t.status === 'queued' || t.status === 'pending') return 28
      return 45
    }

    module.exports = {
      readWmMode,
      readWmLastMode,
      persistWmMode,
      fetchWorldState,
      postWorldState,
      applyWorldLocalCaches,
      postTaskAction,
      delay,
      notifyPulse,
      postOpenWorldAction,
      fetchJson,
      fetchMessages,
      fmtClock,
      taskProgress,
    }
    return module.exports
  },
})


// Open World · 壳层 UI（三栏 / 集成 / 社交）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/shell',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useState, useEffect } = React
    const C = require('dsh-open-world/constants')
    const { MEMORY_URL, MEMORY_COMPARE_URL, MEMORY_ARCHIVES_URL, MEMORY_SEARCH_URL, OW_ACTION_URL, SHELL_GUIDE_KEY } = C

    async function postOwAction(payload) {
      const res = await fetch(OW_ACTION_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      return { ok: res.ok && data.ok !== false, status: res.status, data }
    }

    function ShellGuide() {
      const [dismissed, setDismissed] = useState(() => {
        try { return localStorage.getItem(SHELL_GUIDE_KEY) === '1' } catch { return false }
      })
      if (dismissed) return null
      return React.createElement('div', { className: 'ow-shell-guide' },
        React.createElement('div', { className: 'ow-shell-guide-text' },
          React.createElement('strong', null, '三步上手'),
          ' · ① 看稳不稳 · ② 点「进入 · 任务」干活 · ③ 回来看刚才发生了什么',
        ),
        React.createElement('button', {
          type: 'button',
          className: 'ow-shell-guide-x',
          title: '关闭后不再显示',
          onClick: () => {
            try { localStorage.setItem(SHELL_GUIDE_KEY, '1') } catch { /* ignore */ }
            setDismissed(true)
          },
        }, '知道了'),
      )
    }

    /** 60% 主路径：世界地图（任务 / 回退）+ 默认一键进入 */
    function EnterWorldCta({ worlds, worldPacks, onEnter, onOffline }) {
      const nodes = (worlds && worlds.nodes) || []
      const pick = (worlds && (worlds.pick || worlds.default))
        || nodes.find((n) => n.id === 'tasks')
        || null
      const packChips = ((worldPacks && worldPacks.packs) || [])
        .filter((p) => p && p.optedIn && p.enterable)
        .map((p) => ({
          id: p.id,
          title: p.title,
          titleFull: p.titleFull,
          panel: p.panel,
          cta: p.cta || `进入 · ${p.title}`,
          enterable: true,
          online: true,
          mode: p.mode || 'placeholder',
        }))
      const ordered = nodes.length
        ? nodes.slice().sort((a, b) => (a.cost || 99) - (b.cost || 99))
        : [
          { id: 'tasks', title: '任务', panel: 'task-board', cta: '进入 · 任务', enterable: true, online: true },
          { id: 'rewind', title: '回退', panel: 'rewind', cta: '进入 · 回退', enterable: false, online: false },
        ]
      const mapNodes = ordered.concat(packChips)
      const hint = pick && pick.enterable
        ? `主路径：${pick.cta || '进入'} · ${pick.defaultAction || '办一件真事再回来'}`
        : ((pick && pick.howToEnable) || '扩展未在线时点卡片会提示怎么打开')

      const enterOne = (w) => {
        if (!w) return
        if (!w.enterable) {
          onOffline && onOffline(w)
          return
        }
        onEnter && onEnter(w)
      }

      return React.createElement('div', {
        className: 'ow-enter-world',
        'data-ow-enter-world': (pick && pick.id) || 'tasks',
        'data-ow-world-map': '1',
        style: {
          marginTop: 12,
          padding: '10px 12px',
          border: '1px solid rgba(94,234,212,.28)',
          borderRadius: 8,
          background: 'rgba(94,234,212,.06)',
        },
      },
        React.createElement('div', {
          style: { fontSize: 11, color: '#94a3b8', marginBottom: 8, lineHeight: 1.45 },
        }, hint),
        React.createElement('div', {
          className: 'ow-world-map',
          style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
        },
          mapNodes.map((w) => React.createElement('button', {
            key: w.id,
            type: 'button',
            className: `ow-msg-btn ${w.enterable ? '' : 'ow-world-offline'}`,
            'data-ow-world': w.id,
            'data-enterable': w.enterable ? '1' : '0',
            style: {
              flex: '1 1 88px',
              padding: '8px 10px',
              fontSize: 12,
              opacity: w.enterable ? 1 : 0.55,
              borderColor: w.enterable ? undefined : 'rgba(251,191,36,.35)',
              color: w.enterable ? undefined : '#fbbf24',
            },
            title: w.enterable
              ? (w.cta || w.titleFull || w.title)
              : (w.howToEnable || `${w.title} 未在线`),
            onClick: () => enterOne(w),
          }, w.enterable ? (w.title || w.id) : `${w.title || w.id} · 未启用`)),
          React.createElement('button', {
            key: 'connect',
            type: 'button',
            className: 'ow-msg-btn',
            'data-ow-world': 'connect',
            style: { flex: '1 1 88px', padding: '8px 10px', fontSize: 12, opacity: 0.85 },
            title: '跨机连接在动作页「更多」',
            onClick: () => onOffline && onOffline({
              id: 'connect',
              howToEnable: '跨机（Space / Pair）在左栏「动作 → 更多」；默认不进主路径',
            }),
          }, '连接'),
        ),
        React.createElement('button', {
          type: 'button',
          className: 'ow-msg-btn primary',
          style: { width: '100%', padding: '10px 12px', fontSize: 14 },
          title: pick && !pick.enterable ? (pick.howToEnable || '') : ((pick && pick.cta) || '进入 · 任务'),
          onClick: () => enterOne(pick || mapNodes[0]),
        }, (pick && pick.cta) || '进入 · 任务'),
      )
    }

    /** 无在线插件时：教人用动作 / 中区节点（首启空状态） */
    function ActionsEmptyState({ plugins, onIdea, onTasks, onRewind }) {
      const list = plugins || []
      const online = list.filter((p) => p && p.online).length
      if (online > 0) return null
      const scanned = list.length > 0
      return React.createElement('div', { className: 'ow-empty-cue', role: 'status' },
        React.createElement('div', { className: 'ow-empty-cue-art', 'aria-hidden': true },
          React.createElement('span', { className: 'ow-empty-cue-ring' }),
          React.createElement('span', { className: 'ow-empty-cue-dot' }),
          React.createElement('span', { className: 'ow-empty-cue-ray' }),
        ),
        React.createElement('div', { className: 'ow-empty-cue-title' },
          scanned ? '还没有可用的扩展' : '还没有可点的扩展'),
        React.createElement('div', { className: 'ow-empty-cue-body' },
          '先点中间的圆点，或用下面三个按钮。扩展离线时点它会提示怎么打开。',
          scanned
            ? ' 一般要在插件设置里启用后，完全退出再开桌面。'
            : ' 装好任务看板、对话回退等扩展后，会出现在上方。'),
        React.createElement('div', { className: 'ow-empty-cue-actions' },
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn primary',
            onClick: () => onIdea && onIdea(),
          }, '试一句话风格'),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn',
            onClick: () => onTasks && onTasks(),
          }, '任务看板'),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn',
            onClick: () => onRewind && onRewind(),
          }, '对话回退'),
        ),
      )
    }

    function EventsEmptyState({ events }) {
      if (events && events.length > 0) return null
      return React.createElement('div', { className: 'ow-empty-cue ow-empty-cue-slim', role: 'status' },
        React.createElement('div', { className: 'ow-empty-cue-title' }, '事件还是空的'),
        React.createElement('div', { className: 'ow-empty-cue-body' },
          '点动作或中间节点干一件事后，这里会出现最近日志。'),
      )
    }

    function MemoryHub({ memory, onToast, onSearchMemory }) {
      const [tab, setTab] = useState('local')
      const [q, setQ] = useState('')
      const [hits, setHits] = useState([])
      const [source, setSource] = useState('')
      const [busy, setBusy] = useState(false)

      const search = async () => {
        const query = String(q || '').trim()
        if (!query) {
          onToast && onToast('输入关键词再搜 Hindsight')
          return
        }
        setBusy(true)
        try {
          let data
          if (typeof onSearchMemory === 'function') {
            data = await onSearchMemory(query)
          } else {
            const res = await fetch(`${MEMORY_SEARCH_URL}?q=${encodeURIComponent(query)}`, { credentials: 'same-origin' })
            data = await res.json().catch(() => ({}))
          }
          const items = (data && (data.items || data.hits || data.results)) || []
          setHits(Array.isArray(items) ? items : [])
          setSource((data && data.source) || (data && data.ok === false ? 'offline' : 'hindsight'))
          if (!items.length) onToast && onToast('Hindsight 无结果（需 daemon 或缓存）')
        } catch (err) {
          onToast && onToast(String(err.message || err))
        } finally {
          setBusy(false)
        }
      }

      return React.createElement('div', { className: 'ow-memory-hub' },
        React.createElement('div', { className: 'ow-side-tabs ow-memory-tabs' },
          React.createElement('button', {
            type: 'button',
            className: tab === 'local' ? 'on' : '',
            onClick: () => setTab('local'),
          }, '本地 RRM'),
          React.createElement('button', {
            type: 'button',
            className: tab === 'hindsight' ? 'on' : '',
            onClick: () => setTab('hindsight'),
          }, 'Hindsight'),
        ),
        tab === 'local' && React.createElement(MemoryBrief, { memory, onToast }),
        tab === 'hindsight' && React.createElement('div', { className: 'ow-hub' },
          React.createElement('div', { style: { fontSize: 10, color: '#64748b', marginBottom: 6 } },
            '长期记忆搜索 · 需本机 Hindsight；与本地 RRM 归档不是同一条路'),
          React.createElement('div', { className: 'ow-msg-row' },
            React.createElement('input', {
              className: 'ow-msg-select', style: { flex: 1 },
              placeholder: '搜 Hindsight…', value: q,
              onChange: (ev) => setQ(ev.target.value),
              onKeyDown: (ev) => { if (ev.key === 'Enter') search() },
            }),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn primary', disabled: busy, onClick: search,
            }, busy ? '…' : '搜索'),
          ),
          source && React.createElement('div', { style: { fontSize: 9, color: '#64748b', marginTop: 4 } }, `来源 · ${source}`),
          hits.slice(0, 5).map((m, i) => React.createElement('div', {
            key: (m && m.id) || i,
            style: { fontSize: 11, color: '#cbd5e1', marginTop: 6, lineHeight: 1.4 },
          }, `· ${String((m && (m.text || m.body || m.title)) || '').slice(0, 100)}`)),
        ),
      )
    }

    function BridgeHealthBar({ health, onRefresh }) {
      if (!health) return null
      const BridgeLib = require('dsh-open-world/bridge')
      const describe = BridgeLib.describeBridgeStrategy || ((s) => ({
        tier: s === 'unavailable' ? 'none' : 'api',
        labelZh: s || '—',
        degraded: s === 'dom' || s === 'event+dom' || s === 'unavailable',
      }))
      const items = [
        { id: 'inject-message', label: '聊天投递' },
        { id: 'rewind-exec', label: '回退' },
        { id: 'task-run', label: '任务' },
        { id: 'settings', label: '设置' },
        { id: 'session-focus', label: '会话' },
      ]
      const chipTone = (cap, outcome) => {
        const meta = describe(cap && cap.strategy)
        if (!cap || cap.strategy === 'unavailable') return { cls: 'bad', tone: 'none' }
        if (outcome && outcome.ok === false) return { cls: 'bad', tone: 'fail' }
        if (outcome && (outcome.probeStale || outcome.strategy === 'dom' || outcome.strategy === 'event+dom')) {
          return { cls: 'warn', tone: outcome.probeStale ? 'stale' : 'dom' }
        }
        if (meta.degraded || meta.tier === 'dom') return { cls: 'warn', tone: 'probe-deg' }
        return { cls: 'ok', tone: 'api' }
      }
      let apiN = 0
      let degN = 0
      let badN = 0
      if (health.surface && typeof health.surface.api === 'number') {
        apiN = health.surface.api
        degN = health.surface.degraded
        badN = health.surface.none
      } else {
        items.forEach(({ id }) => {
          const tone = chipTone(health[id], health.outcomes && health.outcomes[id]).tone
          if (tone === 'none' || tone === 'fail') badN++
          else if (tone === 'stale' || tone === 'dom' || tone === 'probe-deg') degN++
          else apiN++
        })
      }
      const stillDom = (health.surface && health.surface.stillDom) || []
      const surfaceTitle = stillDom.length
        ? `仍 DOM 降级：${stillDom.join(', ')}`
        : 'API 可用 · DOM/陈旧/探针降级 · 失败或不可用（实跑优先）'
      const last = health.outcomes && health.outcomes._last
      const lastMeta = last && describe(last.strategy)
      const lastText = last
        ? `${last.ok ? '✓' : '✗'}${last.action}${lastMeta ? `·${lastMeta.labelZh}` : ''}${last.probeStale ? '·探针陈旧' : ''}`
        : null
      return React.createElement('div', { className: 'ow-bridge-health' },
        React.createElement('span', {
          className: 'ow-bridge-label',
          title: '连接诊断：绿=正常 · 黄=凑合 · 红=不通。这是状态灯，不是按钮；干活请点中间圆点或「动作」。',
        }, '连接'),
        items.map(({ id, label }) => {
          const cap = health[id]
          const meta = describe(cap && cap.strategy)
          const outcome = health.outcomes && health.outcomes[id]
          const { cls, tone } = chipTone(cap, outcome)
          const suffix = tone === 'stale' ? '·陈' : tone === 'dom' ? '·DOM' : tone === 'fail' ? '·败' : ''
          const outcomeHint = outcome
            ? ` · 最近${outcome.ok ? '成功' : '失败'} ${outcome.strategy || ''}${outcome.probeStale ? '（探针陈旧→实跑 DOM）' : ''}`
            : ''
          return React.createElement('span', {
            key: id,
            className: `ow-bridge-chip ${cls}`,
            title: cap
              ? `${label} · ${meta.labelZh}（${cap.strategy}）${outcomeHint}`
              : label,
          }, `${label}${suffix}`)
        }),
        React.createElement('span', {
          className: 'ow-bridge-summary',
          style: { fontSize: 9, color: '#94a3b8', marginLeft: 4, fontFamily: 'var(--ow-mono)' },
          title: surfaceTitle,
        }, `${apiN}通 · ${degN}弱 · ${badN}无`),
        lastText && React.createElement('span', {
          className: 'ow-bridge-last',
          style: {
            fontSize: 9, marginLeft: 6, fontFamily: 'var(--ow-mono)',
            color: last.ok ? '#5eead4' : '#ff9090',
          },
          title: last.error
            ? `最近实跑：${last.action} · ${last.error}`
            : `最近实跑：${last.action} · ${last.strategy || '—'}`,
        }, lastText),
        React.createElement('button', {
          type: 'button',
          className: 'ow-bridge-refresh',
          title: '重新检测 Bridge（DSH API/DOM）',
          onClick: onRefresh,
        }, '↻'),
      )
    }

    function sourceTag(source) {
      if (!source) return null
      const labels = { metaphor: '隐喻', derived: '推算', probe: null }
      const label = labels[source]
      if (!label) return null
      return React.createElement('span', {
        className: `ow-source-tag ow-source-${source}`,
        style: {
          fontSize: 7, padding: '1px 4px', marginLeft: 6, borderRadius: 2,
          verticalAlign: 'middle', fontFamily: 'var(--ow-mono)',
          background: source === 'metaphor' ? 'rgba(244,114,182,.15)' : 'rgba(94,234,212,.12)',
          color: source === 'metaphor' ? '#f472b6' : '#5eead4',
          border: `1px solid ${source === 'metaphor' ? 'rgba(244,114,182,.25)' : 'rgba(94,234,212,.2)'}`,
        },
        title: source === 'metaphor' ? '叙事隐喻，非实时 ML/DL' : '由真实状态推算',
      }, label)
    }

    function StatusSummaryChips({ snapshot, plugins }) {
      const integ = (snapshot && snapshot.integrations) || {}
      const mem = (snapshot && snapshot.memory) || {}
      const plug = (plugins || [])
      const chip = (label, on) => React.createElement('span', {
        key: label,
        className: `ow-status-chip ${on ? 'ok' : 'off'}`,
      }, label)
      const chips = [
        chip(`任务 ${integ.taskBoard ? '开' : '关'}`, integ.taskBoard),
        chip(`回退 ${integ.rewind ? '开' : '关'}`, integ.rewind),
        chip(`长期记忆 ${integ.hindsightDaemon ? '在线' : (integ.hindsight ? '开' : '关')}`, integ.hindsight),
        chip(`扩展 ${plug.filter((p) => p.online).length}/${plug.length}`, plug.some((p) => p.online)),
      ]
      const core = (snapshot && snapshot.core) || {}
      if (core.sessionCount != null) chips.push(chip(`会话 ${core.sessionCount}`, core.sessionCount > 0))
      const fleet = (snapshot && snapshot.fleet && snapshot.fleet.counts) || null
      if (fleet) {
        chips.push(chip(`进行中 ${fleet.running || 0}`, (fleet.running || 0) > 0))
      }
      if (mem.hint) {
        chips.push(chip(mem.hint, mem.meta && mem.meta.exact > 0))
      }
      if (mem.active && mem.active.source === 'session') {
        const lab = (mem.active.session && mem.active.session.label) || 'session'
        chips.push(chip(`RRM 会话 · ${lab}`, true))
      }
      if (mem.mailbox && mem.mailbox.hint) {
        chips.push(chip(mem.mailbox.hint, true))
      }
      if (mem.tasks && mem.tasks.hint) {
        chips.push(chip(mem.tasks.hint, true))
      }
      if (mem.archives && mem.archives.hint) {
        chips.push(chip(mem.archives.hint, mem.archives.totalLines > 0))
      }
      return React.createElement('div', { className: 'ow-status-chips' }, chips)
    }

    function MemoryBrief({ memory, onToast }) {
      const [overlay, setOverlay] = useState(null)
      const [compare, setCompare] = useState((memory && memory.compare) || null)
      const [refreshing, setRefreshing] = useState(false)
      const [busy, setBusy] = useState('')
      const [archQ, setArchQ] = useState('')
      const [archHits, setArchHits] = useState(null)
      const [archBusy, setArchBusy] = useState(false)
      useEffect(() => {
        setOverlay(null)
        setCompare((memory && memory.compare) || null)
        setArchHits(null)
      }, [memory])

      const view = overlay ? { ...memory, ...overlay } : memory
      if (!view || !view.meta) {
        return React.createElement('div', { style: { fontSize: 12, color: '#7c8ea6' } }, 'RRM 记忆未就绪')
      }
      const m = view.meta
      const f = view.falsify || {}
      const mb = view.mailbox
      const act = view.active || {}
      const cmp = compare || view.compare
      const sessionOn = act.source === 'session'
      const archives = view.archives

      const applyMemoryPayload = (data) => {
        const mem = (data && data.memory) || data || {}
        const nextCompare = mem.compare || data.compare || null
        setOverlay({
          hint: mem.hint,
          meta: mem.meta,
          falsify: mem.falsify,
          active: mem.active,
          mailbox: mem.mailbox,
          tasks: mem.tasks,
          archives: mem.archives,
          compare: nextCompare,
          neuralStub: mem.neuralStub,
        })
        if (nextCompare) setCompare(nextCompare)
        return nextCompare
      }

      const refreshCompare = async () => {
        setRefreshing(true)
        try {
          let res = await fetch(MEMORY_URL, { credentials: 'same-origin' })
          let data = await res.json().catch(() => ({}))
          if (res.ok && (data.memory || data.compare)) {
            const next = applyMemoryPayload(data)
            onToast && onToast(`记忆已刷新 · 胜出 ${next && next.winner && next.winner.label}`)
          } else {
            res = await fetch(MEMORY_COMPARE_URL, { credentials: 'same-origin' })
            data = await res.json().catch(() => ({}))
            if (res.ok && data.compare) {
              setCompare(data.compare)
              onToast && onToast(`对照已刷新 · 胜出 ${data.compare.winner && data.compare.winner.label}`)
            } else {
              onToast && onToast((data && data.error) || '对照刷新失败')
            }
          }
        } catch (err) {
          onToast && onToast(String(err.message || err))
        } finally {
          setRefreshing(false)
        }
      }

      const applyWinner = async (winner, labelHint) => {
        const w = winner || (cmp && cmp.winner)
        if (!w) {
          onToast && onToast('尚无胜出参数 · 先刷新对照')
          return
        }
        setBusy(labelHint || 'apply')
        try {
          const { ok, data } = await postOwAction({
            action: 'rrm-session-apply',
            alpha: w.alpha,
            tau_ms: w.tau_ms,
            byte_budget: w.byte_budget,
            label: w.label || labelHint || 'winner',
          })
          if (ok) {
            onToast && onToast(`已试用「${w.label}」· 会话覆盖（未改 yml）`)
            try {
              const res = await fetch(MEMORY_URL, { credentials: 'same-origin' })
              const body = await res.json().catch(() => ({}))
              if (res.ok) applyMemoryPayload(body)
            } catch { /* ignore */ }
          } else {
            onToast && onToast((data && data.error) || '应用失败')
          }
        } catch (err) {
          onToast && onToast(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

      const clearSession = async () => {
        setBusy('clear')
        try {
          const { ok, data } = await postOwAction({ action: 'rrm-session-clear' })
          if (ok) {
            onToast && onToast('已恢复 open-world.yml 基线')
            try {
              const res = await fetch(MEMORY_URL, { credentials: 'same-origin' })
              const body = await res.json().catch(() => ({}))
              if (res.ok) applyMemoryPayload(body)
            } catch { /* ignore */ }
          } else {
            onToast && onToast((data && data.error) || '清除失败')
          }
        } catch (err) {
          onToast && onToast(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

      const searchArchives = async () => {
        const q = String(archQ || '').trim()
        if (!q) {
          onToast && onToast('先输入归档关键词')
          return
        }
        setArchBusy(true)
        try {
          const res = await fetch(`${MEMORY_ARCHIVES_URL}?q=${encodeURIComponent(q)}`, {
            credentials: 'same-origin',
          })
          const data = await res.json().catch(() => ({}))
          if (res.ok && data.channels) {
            setArchHits(data)
            const n = ['events', 'mailbox', 'tasks'].reduce((acc, ch) => {
              return acc + ((data.channels[ch] && data.channels[ch].hits && data.channels[ch].hits.length) || 0)
            }, 0)
            onToast && onToast(n ? `归档命中 ${n} 条（末尾扫描）` : '归档无命中（仅扫末尾）')
          } else {
            onToast && onToast((data && data.error) || '归档检索失败')
          }
        } catch (err) {
          onToast && onToast(String(err.message || err))
        } finally {
          setArchBusy(false)
        }
      }

      const archLine = (name, row) => {
        if (!row) return null
        return React.createElement('div', { key: name },
          `${name} · ${row.exists ? `${row.lines}行 / ${row.bytes}B` : '无文件'}`,
        )
      }

      return React.createElement('div', { className: 'ow-memory-brief', style: { fontSize: 11, color: '#7c8ea6', lineHeight: 1.55 } },
        React.createElement('div', { style: { color: '#5eead4', marginBottom: 6 } }, view.hint || '事件记忆'),
        React.createElement('div', {
          style: { fontSize: 9, color: '#64748b', marginBottom: 6 },
        }, '本地 RRM 壳层 · ≠ Hindsight（信箱/集成枢纽走「搜 Hindsight」）'),
        React.createElement('div', null, `精确 ${m.exact} · 压缩 ${m.compressed} · 地标 ${m.landmarks}`),
        f.bytesSaved != null && React.createElement('div', null, `证伪节省 ${f.bytesSaved}B · 比 ${f.ratio}`),
        (act.tau_ms != null || act.byte_budget != null) && React.createElement('div', {
          style: { marginTop: 8, fontFamily: 'var(--ow-mono)', fontSize: 10, color: sessionOn ? '#fbbf24' : '#94a3b8' },
        },
          `生效 · α=${act.alpha ?? '—'} · τ=${act.tau_ms ?? '—'}ms · B=${act.byte_budget ?? '—'}`,
          React.createElement('div', { style: { marginTop: 2 } },
            sessionOn
              ? `来源 · 会话覆盖${act.session && act.session.label ? `（${act.session.label}）` : ''} · 未写 yml`
              : '来源 · open-world.yml',
          ),
        ),
        mb && mb.meta && React.createElement('div', { style: { marginTop: 8, color: '#94a3b8' } },
          mb.hint || '信箱',
          ` · 未读钉住 ${mb.meta.unreadPinned || 0}`,
        ),
        view.tasks && view.tasks.meta && React.createElement('div', { style: { marginTop: 6, color: '#94a3b8' } },
          view.tasks.hint || '任务',
          ` · 热钉住 ${view.tasks.hotPinned || view.tasks.meta.hotPinned || 0}`,
        ),
        archives && React.createElement('div', { style: { marginTop: 8, color: '#94a3b8' } },
          React.createElement('div', { style: { color: '#5eead4', marginBottom: 2 } }, archives.hint || '归档'),
          archLine('事件', archives.events),
          archLine('信箱', archives.mailbox),
          archLine('任务', archives.tasks),
          archives.recent && React.createElement('div', { style: { marginTop: 6 } },
            React.createElement('div', { style: { color: '#5eead4', marginBottom: 2 } }, '最近归档（尾预览）'),
            ['events', 'mailbox', 'tasks'].map((ch) => {
              const zh = ch === 'events' ? '事件' : ch === 'mailbox' ? '信箱' : '任务'
              const list = (archives.recent[ch] || []).slice(-3)
              if (!list.length) {
                return React.createElement('div', { key: ch, style: { fontSize: 9, opacity: 0.7 } }, `${zh} · —`)
              }
              return React.createElement('div', { key: ch, style: { marginBottom: 4 } },
                React.createElement('div', { style: { fontSize: 9, color: '#64748b' } }, zh),
                list.map((it, i) => React.createElement('div', {
                  key: `${ch}-${it.id || i}`,
                  style: { fontFamily: 'var(--ow-mono)', fontSize: 9 },
                }, `· ${it.title}`)),
              )
            }),
            archives.recent.note && React.createElement('div', {
              style: { marginTop: 2, fontSize: 9, color: '#64748b' },
            }, archives.recent.note),
          ),
          React.createElement('div', {
            style: { marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
          },
            React.createElement('input', {
              type: 'text',
              value: archQ,
              placeholder: '归档关键词…',
              onChange: (e) => setArchQ(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') searchArchives() },
              style: {
                flex: '1 1 120px', minWidth: 100, fontSize: 10, padding: '2px 6px',
                background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', borderRadius: 3,
              },
            }),
            React.createElement('button', {
              type: 'button',
              className: 'ow-msg-btn',
              style: { padding: '1px 8px', fontSize: 9 },
              disabled: archBusy,
              onClick: searchArchives,
              title: '本地 RRM 归档末尾扫描 · 非 Hindsight',
            }, archBusy ? '检索中…' : '搜归档'),
          ),
          archHits && archHits.channels && React.createElement('div', {
            style: { marginTop: 6, fontSize: 9, color: '#94a3b8' },
          },
            React.createElement('div', { style: { color: '#5eead4', marginBottom: 2 } },
              archHits.note || '归档命中'),
            ['events', 'mailbox', 'tasks'].map((ch) => {
              const zh = ch === 'events' ? '事件' : ch === 'mailbox' ? '信箱' : '任务'
              const row = archHits.channels[ch] || {}
              const list = row.hits || []
              if (!list.length) {
                return React.createElement('div', { key: `hit-${ch}`, style: { opacity: 0.65 } },
                  `${zh} · —${row.truncated ? `（扫${row.truncated}行）` : ''}`,
                )
              }
              return React.createElement('div', { key: `hit-${ch}`, style: { marginBottom: 4 } },
                React.createElement('div', { style: { color: '#64748b' } },
                  `${zh} · ${list.length} 条${row.truncated ? ` · 尾扫` : ''}`),
                list.map((it, i) => React.createElement('div', {
                  key: `hit-${ch}-${it.id || i}`,
                  style: { fontFamily: 'var(--ow-mono)' },
                }, `· ${it.title}`)),
              )
            }),
          ),
        ),
        React.createElement('div', { style: { marginTop: 10 } },
          React.createElement('div', {
            style: { color: '#5eead4', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
          },
            '参数证伪对照',
            React.createElement('button', {
              type: 'button',
              className: 'ow-msg-btn',
              style: { padding: '1px 8px', fontSize: 9 },
              disabled: refreshing,
              onClick: refreshCompare,
            }, refreshing ? '刷新中…' : '刷新记忆'),
            React.createElement('button', {
              type: 'button',
              className: 'ow-msg-btn',
              style: { padding: '1px 8px', fontSize: 9 },
              disabled: !!busy || !(cmp && cmp.winner),
              onClick: () => applyWinner(cmp && cmp.winner, 'events'),
              title: '按事件通道胜出试用（全局 α/τ/B）',
            }, busy === 'events' ? '应用中…' : '试用事件胜出'),
            cmp && cmp.channels && cmp.channels.mailbox && cmp.channels.mailbox.winner && React.createElement('button', {
              type: 'button',
              className: 'ow-msg-btn',
              style: { padding: '1px 8px', fontSize: 9 },
              disabled: !!busy,
              onClick: () => applyWinner(cmp.channels.mailbox.winner, 'mailbox'),
              title: '用信箱通道胜出的 α/τ/B 做会话覆盖',
            }, busy === 'mailbox' ? '应用中…' : '试用信箱胜出'),
            cmp && cmp.channels && cmp.channels.tasks && cmp.channels.tasks.winner && React.createElement('button', {
              type: 'button',
              className: 'ow-msg-btn',
              style: { padding: '1px 8px', fontSize: 9 },
              disabled: !!busy,
              onClick: () => applyWinner(cmp.channels.tasks.winner, 'tasks'),
              title: '用任务通道胜出的 α/τ/B 做会话覆盖',
            }, busy === 'tasks' ? '应用中…' : '试用任务胜出'),
            sessionOn && React.createElement('button', {
              type: 'button',
              className: 'ow-msg-btn',
              style: { padding: '1px 8px', fontSize: 9 },
              disabled: !!busy,
              onClick: clearSession,
            }, busy === 'clear' ? '恢复中…' : '恢复 yml'),
          ),
          cmp && cmp.winner && React.createElement('div', { style: { marginBottom: 4 } },
            `事件胜出 · ${cmp.winner.label} · 比 ${cmp.winner.ratio}`,
          ),
          cmp && cmp.rows && cmp.rows.map((row) => React.createElement('div', {
            key: row.label,
            style: {
              fontFamily: 'var(--ow-mono)', fontSize: 10,
              opacity: cmp.winner && cmp.winner.label === row.label ? 1 : 0.75,
              color: cmp.winner && cmp.winner.label === row.label ? '#5eead4' : undefined,
            },
          }, `${row.label}: α=${row.alpha} τ=${row.tau_ms} · ${row.liveBytes}B / ${row.naiveBytes}B = ${row.ratio}`)),
          cmp && cmp.channels && React.createElement('div', {
            style: { marginTop: 8, fontSize: 10, color: '#94a3b8' },
          },
            React.createElement('div', { style: { color: '#5eead4', marginBottom: 2 } }, '三通道旁注'),
            cmp.channels.mailbox && cmp.channels.mailbox.winner && React.createElement('div', null,
              `信箱胜出 · ${cmp.channels.mailbox.winner.label} · 比 ${cmp.channels.mailbox.winner.ratio}`,
            ),
            cmp.channels.tasks && cmp.channels.tasks.winner && React.createElement('div', null,
              `任务胜出 · ${cmp.channels.tasks.winner.label} · 比 ${cmp.channels.tasks.winner.ratio}`,
            ),
            !cmp.channels.mailbox && !cmp.channels.tasks && React.createElement('div', {
              style: { fontSize: 9, color: '#64748b' },
            }, '信箱/任务暂无样本可对照'),
          ),
          cmp && cmp.note && React.createElement('div', {
            style: { marginTop: 4, fontSize: 9, color: '#64748b' },
          }, cmp.note),
          !cmp && React.createElement('div', { style: { fontSize: 10 } }, '尚无对照 · 点刷新或等下一帧 snapshot'),
        ),
        view.neuralStub && React.createElement('div', { style: { marginTop: 8, fontSize: 10, color: '#64748b' } },
          `神经 RRA：未实现（${view.neuralStub.stage || 'L0'} · ${view.neuralStub.protocol || 'stub'}）`,
          view.neuralStub.adapter && React.createElement('div', {
            style: { marginTop: 2, fontSize: 9, color: '#475569' },
          },
            view.neuralStub.adapter.probe
              ? `适配器 · 已探测${view.neuralStub.adapter.proto && view.neuralStub.adapter.proto.version ? ` rra-proto@${view.neuralStub.adapter.proto.version}` : ''}${view.neuralStub.adapter.error ? ` · ${view.neuralStub.adapter.error}` : ''} · 神经仍关`
              : '适配器 · 未探测（rra.probe=false）· 神经仍关',
          ),
          view.neuralStub.nextCut && React.createElement('div', {
            style: { marginTop: 2, fontSize: 9, color: '#475569' },
          }, `下一刀 · ${view.neuralStub.nextCut}`),
        ),
      )
    }

    function tierBadge(tier) {
      const label = tier === 'exact' ? '精确' : tier === 'compressed' ? '压缩' : tier === 'landmark' ? '地标' : ''
      if (!label) return null
      const color = tier === 'exact' ? '#5eead4' : tier === 'compressed' ? '#fbbf24' : '#a78bfa'
      return React.createElement('span', {
        className: 'ow-tier-badge',
        style: {
          fontSize: 9, padding: '1px 5px', borderRadius: 3, marginRight: 6,
          border: `1px solid ${color}55`, color, fontFamily: 'var(--ow-mono)',
        },
      }, label)
    }

    function LeftSidebarTabs({ tab, onTab }) {
      const tabs = [
        { id: 'status', label: '状态' },
        { id: 'actions', label: '动作' },
        { id: 'events', label: '事件' },
      ]
      const hints = {
        status: '看现在稳不稳：健康 · 连接 · 进程 · 负载',
        actions: '干活入口：任务 / 回退世界 · 扩展 · 连接',
        events: '刚才发生了什么：记忆 · 日志 · 消息',
      }
      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'ow-side-tabs' },
          tabs.map((t) => React.createElement('button', {
            key: t.id,
            type: 'button',
            className: `ow-side-tab ${tab === t.id ? 'on' : ''}`,
            onClick: () => onTab(t.id),
          }, t.label)),
        ),
        React.createElement('div', { className: 'ow-side-hint' }, hints[tab] || ''),
      )
    }

    function pluginAction(plugin) {
      const map = {
        'task-board': { type: 'enter-world', worldId: 'tasks', panel: 'task-board', label: '已进入任务世界' },
        rewind: { type: 'enter-world', worldId: 'rewind', panel: 'rewind', label: '已进入回退世界' },
        ssh: { type: 'embed', label: '进入 SSH', panel: 'ssh' },
        market: { type: 'embed', label: '进入插件市场', panel: 'market' },
        'workspace-analyzer': { type: 'embed', label: '进入工作区分析', panel: 'analytics' },
        'live-stats': { type: 'embed', label: '进入进程舰队', panel: 'fleet' },
        'git-graph': { type: 'embed', label: '进入工作区分析', panel: 'analytics' },
        hindsight: { type: 'embed', label: '进入长期记忆', panel: 'memory' },
        aionui: { type: 'embed', label: '进入插件中心', panel: 'market' },
        'open-world': { type: 'embed', label: '进入侧栏摘要', panel: 'sidebar' },
        'remote-web-ui': { type: 'embed', label: '进入移动端远程', panel: 'remote' },
        'community-plugins': { type: 'embed', label: '进入插件市场', panel: 'market' },
        'ventus-progress': { type: 'embed', label: '进入进程舰队', panel: 'fleet' },
      }
      return map[plugin.id] || { type: 'embed', label: `进入 ${plugin.title}`, panel: 'sidebar' }
    }

    function socialChannelAction(channelId) {
      const map = {
        market: { type: 'embed', label: '进入插件市场', panel: 'market' },
        'community-plugins': { type: 'embed', label: '进入插件市场', panel: 'market' },
        ssh: { type: 'embed', label: '进入 SSH', panel: 'ssh' },
        'remote-web-ui': { type: 'embed', label: '进入移动端远程', panel: 'remote' },
        'task-collab': { type: 'enter-world', worldId: 'tasks', panel: 'task-board', label: '已进入任务世界' },
      }
      return map[channelId] || { type: 'embed', label: channelId, panel: 'sidebar' }
    }

    function SocialPanel({ social, onChannel, onSession }) {
      if (!social) {
        return React.createElement('div', { style: { fontSize: 12, color: '#7c8ea6' } }, '社交层加载中…')
      }
      const presence = social.presence || []
      const channels = social.channels || []
      const feed = social.feed || []
      return React.createElement('div', { className: 'ow-social-list' },
        React.createElement('div', { className: 'ow-social-tag' }, social.tagline),
        presence.length > 0 && React.createElement('div', { style: { marginTop: 8 } },
          React.createElement('div', { style: { fontSize: 10, color: '#4a5a70', marginBottom: 6, letterSpacing: 1 } }, `在线会话 · ${social.presenceCount}`),
          presence.map((p) => React.createElement('div', {
            key: p.id,
            className: `ow-social-presence ${p.active ? 'active' : ''}`,
            onClick: () => onSession(p),
            title: p.cwd || p.id,
          },
            React.createElement('div', { className: 'ow-social-avatar' }, (p.label || '?').slice(0, 1).toUpperCase()),
            React.createElement('div', null,
              React.createElement('div', { className: 'ow-social-name' }, p.label),
              React.createElement('div', { className: 'ow-social-sub' }, p.cwd || p.id),
            ),
          )),
        ),
        React.createElement('div', { style: { marginTop: 10 } },
          React.createElement('div', { style: { fontSize: 10, color: '#4a5a70', marginBottom: 6, letterSpacing: 1 } }, `社交频道 · ${social.channelCount}`),
          channels.map((ch) => React.createElement('div', {
            key: ch.id,
            className: `ow-social-channel ${ch.installed ? '' : 'off'}`,
            onClick: () => ch.installed && onChannel(ch.id),
          },
            React.createElement('span', null, ch.title),
            React.createElement('span', { style: { fontSize: 9, color: ch.online ? '#5eead4' : '#7c8ea6' } },
              ch.online ? '在线' : (ch.installed ? '就绪' : '未装')),
          )),
        ),
        feed.length > 0 && React.createElement('div', { style: { marginTop: 10 } },
          React.createElement('div', { style: { fontSize: 10, color: '#4a5a70', marginBottom: 6, letterSpacing: 1 } }, '动态流'),
          feed.slice(0, 5).map((item) => React.createElement('div', { key: item.id, className: 'ow-social-feed-item' },
            React.createElement('span', { className: 'ow-social-kind' }, item.kind),
            React.createElement('span', null,
              React.createElement('div', { style: { color: '#e6f1ff' } }, item.title),
              item.detail && React.createElement('div', { style: { color: '#7c8ea6', fontSize: 10 } }, item.detail),
            ),
          )),
        ),
      )
    }

    function IntegrationsPanel({ plugins, onActivate, onOffline }) {
      const list = plugins || []
      const statusLabel = (p) => {
        if (p.status === 'missing' || (!p.installed && !p.online)) return '未启用'
        if (p.online) return '在线'
        if (p.installed) return '已装·离线'
        return p.status || '—'
      }
      return React.createElement('div', { className: 'ow-integ-list' },
        list.length === 0
          ? React.createElement('div', { style: { fontSize: 12, color: '#7c8ea6' } }, '扫描插件目录…')
          : list.map((p) => React.createElement('div', {
            key: p.id,
            className: `ow-integ-item ${p.online ? '' : 'offline'}`,
            onClick: () => {
              if (p.online) onActivate && onActivate(p)
              else if (onOffline) onOffline(p)
            },
            title: p.howToEnable || p.hint || `${p.dep || ''} · ${statusLabel(p)}`,
          },
            React.createElement('span', { className: `ow-integ-dot ${p.online ? 'online' : (p.installed ? 'idle' : 'missing')}` }),
            React.createElement('span', { className: 'ow-integ-name' }, p.title),
            React.createElement('span', { className: 'ow-integ-en' }, statusLabel(p)),
          )),
      )
    }

    /** better-sidebar 摘要 Tab 内容（无 React 树时返回纯数据） */
    function buildSidebarSummary(snapshot) {
      if (!snapshot) return { health: '—', sessions: '—', plugins: '—' }
      const core = snapshot.core || {}
      const plugins = snapshot.plugins || []
      return {
        health: core.healthScore != null ? `${core.healthScore}` : '—',
        sessions: core.sessionCount != null ? `${core.sessionCount}` : '—',
        plugins: `${plugins.filter((p) => p.online).length}/${plugins.length}`,
      }
    }

    function SidebarSummaryView({ snapshot }) {
      const s = buildSidebarSummary(snapshot)
      return React.createElement('div', { className: 'ow-sidebar-summary', style: { padding: 12, fontSize: 12, color: '#7c8ea6' } },
        React.createElement('div', { style: { color: '#5eead4', marginBottom: 8, letterSpacing: 1 } }, '开放世界摘要'),
        React.createElement('div', null, `健康 ${s.health} · 会话 ${s.sessions}`),
        React.createElement('div', { style: { marginTop: 4 } }, `插件在线 ${s.plugins}`),
      )
    }

    /** 壳窗口模式切换（阶段 B · 最小 WM） */
    function WindowModeBar({ mode, onMode, onClose }) {
      const modes = [
        { id: 'split', label: '并置', title: '右侧并置，左侧继续聊天' },
        { id: 'float', label: '浮窗', title: '可拖动浮窗' },
        { id: 'fullscreen', label: '全屏', title: '全屏指挥舱（盖住聊天）' },
        { id: 'minimized', label: '—', title: '最小化到角落，回到聊天' },
      ]
      return React.createElement('div', { className: 'ow-wm-bar', role: 'toolbar', 'aria-label': '窗口模式' },
        modes.map((m) => React.createElement('button', {
          key: m.id,
          type: 'button',
          className: `ow-wm-btn ${mode === m.id ? 'on' : ''}`,
          title: m.title,
          'aria-pressed': mode === m.id,
          onClick: () => onMode && onMode(m.id),
        }, m.label)),
        React.createElement('button', {
          type: 'button',
          className: 'ow-close',
          title: '关闭开放世界',
          onClick: onClose,
        }, '返回聊天'),
      )
    }

    function fleetStageLabel(s) {
      if (s == null) return null
      if (typeof s === 'string' || typeof s === 'number') return String(s)
      if (typeof s !== 'object') return null
      return s.name || s.label || s.title || s.text || s.stage || null
    }

    function FleetPanel({ fleet, onAction, compact }) {
      const f = fleet || { counts: {}, processes: [] }
      const counts = f.counts || {}
      const list = f.processes || []
      const kindZh = { session: '会话', task: '任务', subagent: '子代理' }
      const statusZh = {
        active: '活跃', running: '运行', busy: '忙碌', idle: '空闲',
        pending: '等待', queued: '排队', done: '完成', succeeded: '成功',
      }
      const hints = []
      if (f.taskBoardAvailable === false) hints.push('task-board 未接入 · 任务行可能为空')
      if (!f.ventusAvailable) hints.push('ventus-progress 未接入 · 子代理进度可能为空')
      return React.createElement('div', { className: 'ow-fleet' },
        React.createElement('div', { className: 'ow-fleet-summary' },
          `舰队 ${counts.running || 0} 运行 · 会话 ${counts.sessions || 0} · 任务 ${counts.tasks || 0} · 子代理 ${counts.subagents || 0}`),
        hints.map((h) => React.createElement('div', {
          key: h,
          className: 'ow-fleet-hint',
        }, h)),
        compact
          ? React.createElement('div', { style: { fontSize: 11, color: '#64748b', marginTop: 6 } },
            '摘要 · 点「展开舰队」看进程列表与操作')
          : (list.length === 0
            ? React.createElement('div', { style: { fontSize: 12, color: '#7c8ea6' } }, '暂无进程')
            : list.slice(0, 24).map((p) => {
              const clickable = (p.kind === 'session' && p.sessionId)
                || (p.kind === 'task' && p.taskId)
              const stageLabels = (Array.isArray(p.stages) ? p.stages : [])
                .map(fleetStageLabel)
                .filter(Boolean)
                .slice(0, 6)
              const tip = [p.detail, stageLabels.length ? `阶段: ${stageLabels.join(' · ')}` : '']
                .filter(Boolean).join('\n') || p.title
              return React.createElement('div', {
                key: p.id,
                className: `ow-fleet-row status-${p.status || 'idle'}${clickable ? ' ow-clickable' : ' ow-fleet-row-static'}`,
                title: tip,
                onClick: clickable ? () => {
                  if (!onAction) return
                  if (p.kind === 'session') onAction({ type: 'session-focus', sessionId: p.sessionId, label: '切换会话' })
                  else if (p.kind === 'task') onAction({ type: 'task-run', taskId: p.taskId, inline: true })
                } : undefined,
              },
                React.createElement('span', { className: 'ow-fleet-kind' }, kindZh[p.kind] || p.kind),
                React.createElement('div', { className: 'ow-fleet-main' },
                  React.createElement('span', { className: 'ow-fleet-title' }, p.title),
                  stageLabels.length > 0 && React.createElement('div', { className: 'ow-fleet-stages' },
                    stageLabels.map((lab) => React.createElement('span', {
                      key: lab,
                      className: 'ow-fleet-stage',
                    }, lab)),
                  ),
                ),
                p.percent != null && React.createElement('span', { className: 'ow-fleet-pct' }, `${Math.round(p.percent)}%`),
                React.createElement('span', { className: 'ow-fleet-status' }, statusZh[p.status] || p.status),
              )
            })),
        !compact && React.createElement('div', { className: 'ow-fleet-hint', style: { marginTop: 8 } },
          '点击：会话切换 · 任务运行 · 子代理只读（无假入口）'),
      )
    }

    function ShellDock({ unread, onRestore, onClose }) {
      return React.createElement('div', { className: 'ow-dock' },
        React.createElement('button', {
          type: 'button',
          className: 'ow-dock-chip',
          title: '恢复开放世界',
          onClick: onRestore,
        },
          React.createElement('span', { className: 'ow-dock-mark' }, '✦'),
          React.createElement('span', null, '开放世界'),
          unread > 0 && React.createElement('span', { className: 'ow-dock-unread' }, unread > 9 ? '9+' : unread),
        ),
        React.createElement('button', {
          type: 'button',
          className: 'ow-dock-close',
          title: '关闭',
          onClick: onClose,
        }, '×'),
      )
    }

      const SURFACE_META = {
      'task-board': { title: '任务世界', en: 'TASKS WORLD' },
      rewind: { title: '回退世界', en: 'REWIND WORLD' },
      'all-in-all': { title: '元宇宙世界包 · 占位', en: 'ALL-IN-ALL' },
      market: { title: '插件中心 · 内嵌', en: 'MARKET' },
      memory: { title: '长期记忆 · 内嵌', en: 'HINDSIGHT' },
      ssh: { title: 'SSH 远程 · 内嵌', en: 'SSH' },
      remote: { title: '移动端远程 · 内嵌', en: 'REMOTE' },
      analytics: { title: '工作区分析 · 内嵌', en: 'ANALYTICS' },
      monitor: { title: '系统监视 · 内嵌', en: 'MONITOR' },
      fleet: { title: '进程舰队 · 内嵌', en: 'FLEET' },
      sidebar: { title: '侧栏开放世界 · 内嵌', en: 'SIDEBAR' },
    }

    /** 壳内应用表面：ATI 节点 / 插件进入，不退出指挥舱 */
    function EmbeddedAppSurface({
      panel, tasks, snapshot, plugins, hub, memory, onClose, onAction, onRunTask, onCreateTask,
    }) {
      const meta = SURFACE_META[panel] || { title: panel || '应用', en: 'APP' }
      const rewind = (snapshot && snapshot.rewind) || {}
      const timeline = (rewind.timeline && rewind.timeline.anchors) || rewind.anchors || []
      const sessions = (snapshot && snapshot.sessions) || {}
      const core = (snapshot && snapshot.core) || {}
      const integ = (snapshot && snapshot.integrations) || {}
      const plug = plugins || []

      const officialBtn = (label, action) => React.createElement('button', {
        type: 'button',
        className: 'ow-neural-btn',
        onClick: () => onAction && onAction(action),
      }, label)

      let body
      if (panel === 'task-board') {
        body = React.createElement(React.Fragment, null,
          (tasks || []).length === 0
            ? React.createElement('div', { style: { color: '#7c8ea6', fontSize: 12 } },
              integ.taskBoard ? '暂无任务' : '任务看板离线 · 可点下方到官方入口')
            : (tasks || []).map((t) => React.createElement('div', {
              key: t.id,
              className: 'ow-task-item ow-clickable',
              style: { marginBottom: 8 },
              onClick: () => onRunTask && onRunTask(t.id),
            },
              React.createElement('div', { className: 'ow-task-head' },
                tierBadge(t.tier),
                React.createElement('span', { className: 'ow-task-name' }, t.title),
                React.createElement('span', { className: `ow-task-status ${t.running ? 'running' : 'pending'}` },
                  t.running ? '进行中' : (t.status || '等待')),
              ),
            )),
          React.createElement('div', { className: 'ow-embed-official', style: { marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            React.createElement('button', { type: 'button', className: 'ow-neural-btn', onClick: onCreateTask }, '新建任务'),
          ),
        )
      } else if (panel === 'rewind') {
        const items = Array.isArray(timeline) ? timeline.slice(0, 12) : []
        const offlineHint = (plug.find((p) => p.id === 'rewind') || {}).howToEnable
          || '对话回退未启用 · 在 plugins.yml 将 web-ui-rewind: enabled 设为 true，运行 apply.cmd 后重启 Desktop'
        body = React.createElement(React.Fragment, null,
          React.createElement('div', {
            style: { fontSize: 12, color: rewind.available ? '#7c8ea6' : '#fbbf24', marginBottom: 8, lineHeight: 1.5 },
          },
            rewind.available
              ? `${rewind.anchors || items.length || 0} 锚点 · ${rewind.snapshots || 0} 快照`
              : offlineHint),
          !rewind.available
            ? React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              React.createElement('button', {
                type: 'button', className: 'ow-neural-btn',
                onClick: () => {
                  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(offlineHint)
                },
              }, '复制说明'),
              React.createElement('button', {
                type: 'button', className: 'ow-neural-btn',
                onClick: () => onAction && onAction({ type: 'settings', label: 'Rewind', settingsHint: '插件' }),
              }, '打开设置'),
            )
            : React.createElement(React.Fragment, null,
              items.length === 0
                ? React.createElement('div', { style: { color: '#7c8ea6', fontSize: 12 } }, '暂无锚点 · 可在对话里用 /rewind')
                : items.map((a, i) => React.createElement('div', {
                  key: a.seq != null ? a.seq : i,
                  className: 'ow-task-item',
                  style: { marginBottom: 8 },
                },
                  React.createElement('div', { className: 'ow-task-head' },
                    React.createElement('span', { className: 'ow-task-name' }, a.title || a.preview || `锚点 @${a.seq}`),
                    React.createElement('span', { className: 'ow-task-pct' }, a.seq != null ? `@${a.seq}` : ''),
                  ),
                  a.seq != null && React.createElement('button', {
                    type: 'button',
                    className: 'ow-neural-btn',
                    style: { marginTop: 6 },
                    onClick: () => onAction && onAction({ type: 'rewind-exec', seq: a.seq, mode: 'both' }),
                  }, '回退到此'),
                )),
              React.createElement('div', { style: { marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' } },
                officialBtn('聊天里打开 /rewind', { type: 'rewind-open', preferChat: true, label: '聊天里打开 /rewind' }),
              ),
            ),
        )
      } else if (panel === 'market') {
        body = React.createElement(React.Fragment, null,
          React.createElement('div', { style: { fontSize: 12, color: '#7c8ea6', marginBottom: 8 } },
            `插件 ${plug.filter((p) => p.online).length}/${plug.length} 在线`),
          React.createElement('div', { className: 'ow-integ-list' },
            plug.slice(0, 16).map((p) => React.createElement('div', {
              key: p.id,
              className: `ow-integ-item ${p.online ? '' : 'offline'}`,
            },
              React.createElement('span', { className: `ow-integ-dot ${p.online ? 'online' : (p.installed ? 'idle' : 'missing')}` }),
              React.createElement('span', { className: 'ow-integ-name' }, p.title),
              React.createElement('span', { className: 'ow-integ-en' }, p.online ? '在线' : (p.installed ? '已装' : '未启用')),
            )),
          ),
          React.createElement('div', { style: { marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            officialBtn('打开插件市场', { type: 'settings', label: '插件市场', settingsHint: 'Market' }),
            officialBtn('打开设置', { type: 'settings', label: '设置', settingsHint: '通用' }),
          ),
        )
      } else if (panel === 'memory') {
        body = React.createElement(React.Fragment, null,
          React.createElement('div', { style: { fontSize: 11, color: '#94a3b8', marginBottom: 8 } },
            '双通路：上方本地 RRM（刷新记忆 / 搜归档）；Hindsight 长期记忆在集成枢纽或事件页信箱「搜 Hindsight」。'),
          React.createElement(MemoryBrief, { memory: memory || (snapshot && snapshot.memory) }),
          React.createElement('div', { style: { marginTop: 12, fontSize: 12, color: '#7c8ea6' } },
            integ.hindsightDaemon ? 'Hindsight daemon 在线' : (integ.hindsight ? 'Hindsight 已装' : 'Hindsight 未启用')),
          React.createElement('div', { style: { marginTop: 12, display: 'flex', gap: 8 } },
            officialBtn('到设置找 Hindsight', { type: 'settings', label: 'Hindsight', settingsHint: '插件' }),
          ),
        )
      } else if (panel === 'ssh') {
        body = React.createElement(React.Fragment, null,
          React.createElement('div', { style: { fontSize: 12, color: '#e6f1ff', lineHeight: 1.6 } },
            'SSH 会话仍由官方面板承载。这里保留壳内入口，避免把指挥舱关掉才找按钮。'),
          React.createElement('div', { style: { marginTop: 10, fontSize: 12, color: '#7c8ea6' } },
            `网络节点 · sessions ${sessions.count != null ? sessions.count : (core.sessionCount || 0)}`),
          React.createElement('div', { style: { marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            officialBtn('打开官方 SSH', { type: 'panel', label: 'SSH', panel: 'ssh', selector: '[data-dsh-ssh-entry]' }),
            officialBtn('移动端远程', { type: 'remote', label: '远程' }),
          ),
        )
      } else if (panel === 'remote') {
        const space = (snapshot && snapshot.space) || {}
        body = React.createElement(React.Fragment, null,
          React.createElement('div', { style: { fontSize: 12, color: '#e6f1ff', lineHeight: 1.6 } },
            '移动端 / Pair 远程由 Host 驱动提供。LAN 第二屏：/api/open-world/space/view（SSE 同步）。'),
          hub && hub.pair && React.createElement('div', { style: { marginTop: 8, fontSize: 12, color: '#7c8ea6' } },
            hub.pair.available
              ? `Pair · ${hub.pair.paired ? '已配对' : '未配对'} · 在线 ${hub.pair.onlineCount || 0}`
              : 'Pair 不可用'),
          React.createElement('div', { style: { marginTop: 8, fontSize: 12, color: '#5eead4' } },
            space.enabled === false
              ? 'Space 未启用'
              : `Space · ${space.hasToken ? '令牌就绪' : '待签发'} · ${space.protocol || 'owip/0.3-draft'}${space.sync === false ? '' : ' · sync'}`),
          React.createElement('div', { style: { marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            officialBtn('打开远程面板', { type: 'remote', label: '远程' }),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              onClick: () => {
                const tok = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ow-space-token')) || ''
                const url = `${window.location.origin}/api/open-world/space/view${tok ? `?token=${encodeURIComponent(tok)}` : ''}`
                window.open(url, '_blank', 'noopener,noreferrer')
              },
            }, '打开第二屏'),
          ),
        )
      } else if (panel === 'analytics') {
        body = React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'ow-detail-row' },
            React.createElement('span', null, '健康'), React.createElement('span', null, core.healthScore != null ? core.healthScore : '—')),
          React.createElement('div', { className: 'ow-detail-row' },
            React.createElement('span', null, '会话'), React.createElement('span', null, core.sessionCount != null ? core.sessionCount : '—')),
          React.createElement('div', { className: 'ow-detail-row' },
            React.createElement('span', null, 'CWD'), React.createElement('span', { style: { maxWidth: 180, textAlign: 'right' } }, sessions.activeCwd || '—')),
          React.createElement('div', { style: { marginTop: 12, display: 'flex', gap: 8 } },
            officialBtn('打开工作区分析', { type: 'settings', label: '工作区分析', settingsHint: '插件' }),
          ),
        )
      } else if (panel === 'monitor') {
        const load = (snapshot && snapshot.load) || {}
        body = React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'ow-detail-row' },
            React.createElement('span', null, 'Heap'), React.createElement('span', null, `${load.heapUsedMb || '—'} MB`)),
          React.createElement('div', { className: 'ow-detail-row' },
            React.createElement('span', null, 'RSS'), React.createElement('span', null, `${load.rssMb || '—'} MB`)),
          React.createElement('div', { className: 'ow-detail-row' },
            React.createElement('span', null, 'Uptime'), React.createElement('span', null, `${load.uptimeSec || '—'} s`)),
          React.createElement('div', { style: { marginTop: 12, fontSize: 12, color: '#7c8ea6' } },
            '完整监视仍看左栏「状态」；进程列表见「进程舰队」。'),
          React.createElement('div', { style: { marginTop: 12 } },
            React.createElement('button', {
              type: 'button', className: 'ow-neural-btn',
              onClick: () => onAction && onAction({ type: 'embed', panel: 'fleet', label: '进程舰队' }),
            }, '打开进程舰队'),
          ),
        )
      } else if (panel === 'fleet') {
        body = React.createElement(FleetPanel, {
          fleet: (snapshot && snapshot.fleet) || null,
          onAction,
          compact: false,
        })
      } else if (panel === 'all-in-all') {
        const packs = (snapshot && snapshot.worldPacks && snapshot.worldPacks.packs) || []
        const pack = packs.find((p) => p.id === 'all-in-all') || null
        const opted = !!(pack && pack.optedIn) || !!(snapshot && snapshot.worldPacks && snapshot.worldPacks.enabled)
        body = React.createElement('div', {
          className: 'ow-world-pack-placeholder',
          'data-ow-world-pack': 'all-in-all',
          'data-mode': 'placeholder',
          style: { fontSize: 13, color: '#cbd5e1', lineHeight: 1.55 },
        },
          React.createElement('div', { style: { fontSize: 15, color: '#5eead4', marginBottom: 8 } },
            opted ? 'ALL-IN-ALL · 诚实占位' : 'ALL-IN-ALL · 默认关闭'),
          React.createElement('div', null,
            opted
              ? '配置已选开，但本机尚未安装真实世界包。这里不会假装有元宇宙素材，也不会空壳进 ATI。'
              : '后置世界包默认关闭，不进 60% 主路径。需要时在 open-world.yml 设 worlds.packs.all-in-all: true。'),
          React.createElement('div', { style: { marginTop: 10, fontSize: 12, color: '#64748b' } },
            'package 预留名：dsh-open-world-pack-all-in-all · source=reserved'),
        )
      } else {
        body = React.createElement(React.Fragment, null,
          React.createElement(SidebarSummaryView, { snapshot }),
          React.createElement('div', { style: { marginTop: 12, fontSize: 12, color: '#7c8ea6' } },
            'better-sidebar 的开放世界 Tab 也可看摘要。'),
        )
      }

      return React.createElement('div', { className: 'ow-embed', 'data-ow-surface': panel || '' },
        React.createElement('div', { className: 'ow-embed-head' },
          React.createElement('div', null,
            React.createElement('strong', null, meta.title),
            React.createElement('span', { style: { marginLeft: 8, fontSize: 10, color: '#7c8ea6', letterSpacing: 1 } }, meta.en),
          ),
          React.createElement('button', {
            type: 'button',
            className: 'ow-neural-btn',
            onClick: () => {
              const worldId = panel === 'rewind' ? 'rewind' : (panel === 'task-board' ? 'tasks' : panel)
              try {
                postOwAction({ action: 'world-leave', worldId, panel })
              } catch { /* ignore */ }
              onClose && onClose()
            },
          }, '返回开放世界'),
        ),
        React.createElement('div', { className: 'ow-embed-body' }, body),
      )
    }

    module.exports = {
      BridgeHealthBar,
      ShellGuide,
      EnterWorldCta,
      ActionsEmptyState,
      EventsEmptyState,
      MemoryHub,
      sourceTag,
      StatusSummaryChips,
      LeftSidebarTabs,
      pluginAction,
      socialChannelAction,
      SocialPanel,
      IntegrationsPanel,
      buildSidebarSummary,
      SidebarSummaryView,
      MemoryBrief,
      tierBadge,
      WindowModeBar,
      ShellDock,
      EmbeddedAppSurface,
      FleetPanel,
    }
    return module.exports
  },
})


// Open World · idea
window.__ModuleLoader__.load({
  id: 'dsh-open-world/idea',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React

    function IdeaLabWorkspace({ idea, compact, onInject, onCompare, onAction }) {
      const presets = (idea && idea.presets) || []
      const overview = (idea && idea.overview) || {}
      const treats = (idea && idea.treatSuggestions) || []
      const [presetId, setPresetId] = useState((presets[0] && presets[0].id) || 'xiaofeiyu')
      const [treatAs, setTreatAs] = useState('')
      const [body, setBody] = useState('')
      const [compareIds, setCompareIds] = useState([])
      const [injecting, setInjecting] = useState(false)

      useEffect(() => {
        const hit = presets.find((p) => p.id === presetId)
        if (!hit && presets[0]) {
          setPresetId(presets[0].id)
          setTreatAs(presets[0].treatHint || '')
        }
      }, [presets, presetId])

      const selected = presets.find((p) => p.id === presetId)

      const pickPreset = (p) => {
        setPresetId(p.id)
        if (p.treatHint && !treatAs) setTreatAs(p.treatHint)
      }

      const toggleCompare = (id, ev) => {
        ev.stopPropagation()
        setCompareIds((prev) => (
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 4)
        ))
      }

      if (!idea || idea.enabled === false) {
        return React.createElement('div', { style: { fontSize: 11, color: '#7c8ea6' } },
          'IDEA Lab 已关闭 · 可在 open-world.yml 设 idea.enabled: true')
      }

      return React.createElement('div', { className: compact ? 'ow-hub' : 'ow-idea-center' },
        !compact && React.createElement('div', { className: 'ow-idea-hero' },
          React.createElement('h2', null, overview.title || 'IDEA Lab'),
          React.createElement('p', { className: 'ow-idea-tag' }, overview.subtitle || '调试人格沙箱'),
          overview.tagline && React.createElement('p', { className: 'ow-idea-overview' }, overview.tagline),
          (overview.bullets || []).map((b, i) => React.createElement('div', { key: i, className: 'ow-idea-bullet' }, `· ${b}`)),
        ),
        React.createElement('div', {
          className: 'ow-hub-stat',
          style: { marginBottom: compact ? 6 : 10, color: '#f5d67a', lineHeight: 1.5 },
        },
          '把人格前缀包进消息，再投递到官方聊天。',
          ' 不是切换 Agent；要换真预设请点「真换 Agent 预设」。',
          !compact && ' 成功后会收起指挥舱，请看聊天窗回复。'),
        compact && React.createElement('div', { className: 'ow-hub-stat' }, overview.subtitle || '人格试玩 · Treat me like'),
        React.createElement('div', { className: 'ow-hub-title' }, `人格 · ${presets.length} 种${compareIds.length ? ` · 已选对比 ${compareIds.length}` : ''}`),
        React.createElement('div', { className: 'ow-idea-grid' },
          presets.map((p) => React.createElement('div', {
            key: p.id,
            className: `ow-idea-card ${presetId === p.id ? 'active' : ''} ${compareIds.includes(p.id) ? 'compare' : ''}`,
            onClick: () => pickPreset(p),
            title: '双击加入/移出对比组',
            onDoubleClick: (ev) => toggleCompare(p.id, ev),
          },
            React.createElement('strong', null, p.title),
            React.createElement('div', { className: 'ow-idea-sub' }, p.sub),
          )),
        ),
        React.createElement('div', { className: 'ow-hub-sec', style: { marginTop: compact ? 8 : 16 } },
          React.createElement('div', { className: 'ow-hub-title' }, 'Treat me like · 把我当作'),
          React.createElement('div', { className: 'ow-idea-treat-row' },
            treats.slice(0, 8).map((t) => React.createElement('button', {
              key: t, type: 'button', className: `ow-idea-chip ${treatAs === t ? 'on' : ''}`,
              onClick: () => setTreatAs(t),
            }, t)),
          ),
          React.createElement('input', {
            className: 'ow-msg-select', style: { width: '100%', marginTop: 6 },
            value: treatAs, placeholder: '自定义角色，例如：赶 ddl 的研究生',
            onChange: (ev) => setTreatAs(ev.target.value),
          }),
        ),
        selected && React.createElement('div', { className: 'ow-idea-instruction' },
          React.createElement('div', { className: 'ow-hub-title' }, `当前 · ${selected.title}`),
          selected.instruction,
        ),
        React.createElement('textarea', {
          className: 'ow-idea-prompt',
          rows: compact ? 3 : 5,
          value: body,
          placeholder: '输入要测试的问题，例如：帮我 review 这段 Open World 的消息总线设计',
          onChange: (ev) => setBody(ev.target.value),
        }),
        React.createElement('div', { className: 'ow-rewind-actions' },
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn primary',
            disabled: !body.trim() || injecting,
            title: '包装人格前缀后投递到官方聊天',
            onClick: () => {
              if (!onInject || !body.trim() || injecting) return
              setInjecting(true)
              const watchdog = setTimeout(() => setInjecting(false), 8000)
              Promise.resolve(onInject(presetId, body, treatAs))
                .catch(() => {})
                .finally(() => {
                  clearTimeout(watchdog)
                  setInjecting(false)
                })
            },
          }, injecting ? '投递中…' : '投递到官方聊天'),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn',
            disabled: !body.trim(),
            title: '结果写入信箱，不投递聊天',
            onClick: () => {
              const ids = compareIds.length
                ? compareIds
                : presets.slice(0, 3).map((p) => p.id)
              onCompare(ids, body, treatAs)
            },
          }, compareIds.length ? `对比 ${compareIds.length} 种` : '对比默认 3 种'),
          compact && React.createElement('button', {
            type: 'button', className: 'ow-msg-btn',
            onClick: () => onAction({ type: 'idea-panel' }),
          }, '全屏'),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn',
            title: '打开官方设置里的 Agent 预设（真切换）',
            onClick: () => onAction({ type: 'settings', label: 'Agent 预设', settingsHint: 'Agent' }),
          }, '真换 Agent 预设'),
        ),
      )
    }

    module.exports = {
      IdeaLabWorkspace,
    }
    return module.exports
  },
})


// Open World · ati-lab
window.__ModuleLoader__.load({
  id: 'dsh-open-world/ati-lab',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React
    const C = require('dsh-open-world/constants')
    const { DL_STACK, ACI_PHASES, ATI_STAGES_FALLBACK } = C

    function hexRing(cx, cy, r) {
      return Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
      })
    }

    function labLerp(a, b, t) { return a + (b - a) * t }
    function quadPoint(p0, p1, p2, t) {
      const u = 1 - t
      return {
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
      }
    }
    function clamp01(v) { return Math.max(0, Math.min(1, v)) }

    function TopoTorus({ tick, cx, cy }) {
      const R = 168
      const r = 66
      const vSteps = 11
      const uSteps = 18
      const phase = tick * 0.012
      const rings = []
      for (let vi = 0; vi <= vSteps; vi++) {
        const v = (vi / vSteps) * Math.PI * 2 + phase
        const pts = []
        for (let ui = 0; ui <= uSteps; ui++) {
          const u = (ui / uSteps) * Math.PI * 2
          const depth = Math.sin(u)
          pts.push(`${cx + (R + r * Math.cos(u)) * Math.cos(v)},${cy + (R + r * Math.cos(u)) * Math.sin(v) * 0.46}`)
        }
        rings.push(React.createElement('polyline', {
          key: `ring-${vi}`,
          points: pts.join(' '),
          className: `ow-lab-wire ${vi % 2 ? 'violet' : 'cyan'}`,
          opacity: 0.22 + 0.5 * Math.abs(Math.sin(vi / vSteps * Math.PI)),
          strokeDasharray: vi % 3 === 0 ? '3 4' : undefined,
        }))
      }
      return React.createElement('g', { className: 'ow-ati-stage' },
        React.createElement('circle', { cx, cy, r: R + r + 4, fill: 'none', stroke: 'rgba(94,234,212,.1)', strokeDasharray: '2 6' }),
        React.createElement('ellipse', { cx, cy, rx: R + r, ry: (R + r) * 0.46, fill: 'rgba(8,12,24,.35)', stroke: 'rgba(167,139,250,.25)' }),
        rings,
        React.createElement('text', { x: cx + R, y: cy + 8, fill: '#5eead4', fontSize: 8, fontFamily: 'Consolas,monospace' }, 'T² = S¹ × S¹'),
        React.createElement('text', { x: cx - R - 10, y: cy - 8, textAnchor: 'end', fill: '#7c8ea6', fontSize: 7, fontFamily: 'Consolas,monospace' }, 'g = 1 · χ = 0'),
      )
    }

    function TopoMobius({ tick, cx, cy }) {
      const phase = tick * 0.007
      const rows = []
      for (let k = 0; k < 5; k++) {
        const v = -0.55 + k * 0.275
        const pts = []
        for (let i = 0; i <= 72; i++) {
          const u = (i / 72) * Math.PI * 2 + phase
          const f = 1 + (v / 2) * Math.cos(u / 2)
          pts.push(`${cx + 185 * f * Math.cos(u)},${cy + 170 * f * Math.sin(u) * 0.52}`)
        }
        const isEdge = k === 0 || k === 4
        rows.push(React.createElement('polyline', {
          key: `mb-${k}`,
          points: pts.join(' '),
          className: `ow-lab-wire ${isEdge ? (k === 0 ? 'pink' : 'cyan') : 'violet'}`,
          opacity: isEdge ? 0.95 : 0.2,
          strokeWidth: isEdge ? 1.6 : 0.8,
        }))
      }
      return React.createElement('g', { className: 'ow-ati-stage' },
        React.createElement('ellipse', { cx, cy, rx: 190, ry: 105, fill: 'rgba(8,12,24,.4)', stroke: 'rgba(244,114,182,.18)' }),
        rows,
        React.createElement('text', { x: cx - 150, y: cy + 118, fill: '#f472b6', fontSize: 8, fontFamily: 'Consolas,monospace' }, '单面 · 单边 · 不可定向'),
        React.createElement('text', { x: cx + 90, y: cy - 110, fill: '#7c8ea6', fontSize: 7, fontFamily: 'Consolas,monospace' }, 'χ = 0 · H₁ = ℤ'),
      )
    }

    function TopoKlein({ tick, cx, cy }) {
      const phase = tick * 0.006
      const loops = []
      const vSteps = 10
      const uSteps = 26
      for (let vi = 0; vi <= vSteps; vi++) {
        const v = (vi / vSteps) * Math.PI * 2
        const pts = []
        let maxZ = 0
        for (let ui = 0; ui <= uSteps; ui++) {
          const u = (ui / uSteps) * Math.PI * 2 + phase
          const cu = Math.cos(u)
          const su = Math.sin(u)
          const cv = Math.cos(v)
          const sv = Math.sin(v)
          const p = 2 + Math.cos(v / 2) * su - Math.sin(v / 2) * Math.sin(2 * u)
          const x = p * cv
          const y = p * sv
          const z = Math.sin(v / 2) * su + Math.cos(v / 2) * Math.sin(2 * u)
          maxZ = Math.max(maxZ, Math.abs(z))
          pts.push(`${cx + x * 52},${cy + y * 46}`)
        }
        loops.push(React.createElement('polyline', {
          key: `kl-${vi}`,
          points: pts.join(' '),
          className: 'ow-lab-wire',
          stroke: vi % 2 ? '#a78bfa' : '#5eead4',
          opacity: 0.14 + 0.55 * (0.4 + maxZ / 3),
        }))
      }
      return React.createElement('g', { className: 'ow-ati-stage' },
        React.createElement('circle', { cx, cy, r: 118, fill: 'rgba(8,12,24,.35)', stroke: 'rgba(167,139,250,.2)' }),
        loops,
        React.createElement('text', { x: cx - 108, y: cy + 118, fill: '#a78bfa', fontSize: 8, fontFamily: 'Consolas,monospace' }, '自交必须发生在 ℝ⁴'),
        React.createElement('text', { x: cx + 60, y: cy - 108, fill: '#7c8ea6', fontSize: 7, fontFamily: 'Consolas,monospace' }, '不可定向 · 边界为空'),
      )
    }

    function TopoPoincare({ tick, cx, cy }) {
      const R = 188
      const arcs = []
      const dots = []
      for (let i = 0; i < 10; i++) {
        const a0 = i * Math.PI / 5 + tick * 0.0012
        const a1 = a0 + 1.15
        const mid = (a0 + a1) / 2
        const p0 = { x: cx + R * Math.cos(a0), y: cy + R * Math.sin(a0) }
        const p1 = { x: cx + R * Math.cos(a1), y: cy + R * Math.sin(a1) }
        const pc = { x: cx + R * 0.38 * Math.cos(mid), y: cy + R * 0.38 * Math.sin(mid) }
        const t = ((tick * 0.012) + i / 10) % 1
        const dot = quadPoint(p0, pc, p1, t)
        arcs.push(React.createElement('path', {
          key: `geo-${i}`,
          d: `M ${p0.x} ${p0.y} Q ${pc.x} ${pc.y} ${p1.x} ${p1.y}`,
          className: 'ow-lab-wire cyan',
          opacity: 0.12 + (i % 3) * 0.1,
        }))
        dots.push(React.createElement('circle', {
          key: `geo-dot-${i}`,
          cx: dot.x, cy: dot.y, r: 2.4,
          fill: '#5eead4', opacity: 0.9,
          style: { filter: 'drop-shadow(0 0 4px #5eead4)' },
        }))
      }
      return React.createElement('g', { className: 'ow-ati-stage' },
        React.createElement('circle', { cx, cy, r: R, fill: 'rgba(8,12,24,.5)', stroke: 'rgba(94,234,212,.4)', strokeWidth: 1.4 }),
        React.createElement('circle', { cx, cy, r: R - 8, fill: 'none', stroke: 'rgba(94,234,212,.1)', strokeDasharray: '1 5' }),
        arcs,
        dots,
        React.createElement('text', { x: cx, y: cy + 26, textAnchor: 'middle', fill: '#5eead4', fontSize: 8, fontFamily: 'Consolas,monospace', letterSpacing: 2 }, 'ℍ² 双曲测地线'),
      )
    }

    function MlGradientStage({ tick, cx, cy, lab }) {
      const ml = (lab && lab.ml) || {}
      const minX = cx + 255
      const minY = cy - 105
      const contours = []
      for (let i = 1; i <= 5; i++) {
        const rx = 28 + i * 30
        contours.push(React.createElement('ellipse', {
          key: `ct-${i}`,
          cx: minX, cy: minY, rx, ry: rx * 0.62,
          className: 'ow-lab-contour',
          transform: `rotate(-18 ${minX} ${minY})`,
          opacity: 0.25 + i * 0.1,
        }))
      }
      const steps = [
        { x: cx - 340, y: cy + 152 },
        { x: cx - 210, y: cy + 86 },
        { x: cx - 96, y: cy + 34 },
        { x: cx + 40, y: cy - 28 },
        { x: cx + 150, y: cy - 78 },
        { x: minX, y: minY },
      ]
      const arrows = steps.slice(0, -1).map((p, i) => React.createElement('line', {
        key: `grad-${i}`,
        x1: p.x, y1: p.y,
        x2: steps[i + 1].x, y2: steps[i + 1].y,
        className: 'ow-lab-grad-arrow',
        strokeDasharray: '5 4',
        opacity: 0.55 + i * 0.09,
      }))
      const history = (ml.history && ml.history.length > 2)
        ? ml.history
        : Array.from({ length: 28 }, (_, i) => 3.0 * Math.exp(-i / 7))
      const lossX0 = 58
      const lossY0 = 438
      const lossW = 230
      const lossH = 62
      const minLoss = Math.min(...history)
      const maxLoss = Math.max(...history)
      const span = Math.max(0.0001, maxLoss - minLoss)
      const lossPts = history.map((v, i) => (
        `${lossX0 + (i / Math.max(1, history.length - 1)) * lossW},${lossY0 + lossH - ((v - minLoss) / span) * lossH}`
      ))
      const lossArea = `${lossX0},${lossY0 + lossH} ${lossPts.join(' ')} ${lossX0 + lossW},${lossY0 + lossH}`
      const bounce = Math.sin(tick * 0.16) * 3
      return React.createElement('g', { className: 'ow-ati-stage' },
        contours,
        arrows,
        React.createElement('circle', { cx: minX, cy: minY, r: 5 + bounce * 0.1, fill: '#f5d67a', style: { filter: 'drop-shadow(0 0 6px #f5d67a)' } }),
        React.createElement('text', { x: minX + 16, y: minY - 16, className: 'ow-lab-title dim' }, 'θ* GLOBAL MIN'),
        React.createElement('polygon', { points: lossArea, className: 'ow-lab-loss-area' }),
        React.createElement('polyline', { points: lossPts.join(' '), className: 'ow-lab-loss' }),
        React.createElement('line', { x1: lossX0, y1: lossY0 + lossH, x2: lossX0 + lossW, y2: lossY0 + lossH, className: 'ow-lab-axis' }),
        React.createElement('line', { x1: lossX0, y1: lossY0, x2: lossX0, y2: lossY0 + lossH, className: 'ow-lab-axis' }),
        React.createElement('text', { x: lossX0, y: lossY0 - 6, className: 'ow-lab-title dim' }, `LOSS ${ml.loss != null ? ml.loss.toFixed(3) : history[history.length - 1].toFixed(3)}`),
        React.createElement('text', { x: lossX0 + lossW, y: lossY0 + lossH + 12, textAnchor: 'end', className: 'ow-lab-tick' }, `acc ${ml.accuracy ?? '—'}% · AdamW`),
        React.createElement('text', { x: cx - 340, y: cy + 186, className: 'ow-lab-title dim' }, '梯度下降 · 损失流形横截面'),
      )
    }

    function DlAttentionStage({ tick, cx, cy, nodeMap, lab }) {
      const dl = (lab && lab.dl) || {}
      const rows = (dl.attention && dl.attention.length)
        ? dl.attention
        : [
          { token: '会', values: [0.9, 0.4, 0.2, 0.1, 0.1, 0.1] },
          { token: '任', values: [0.4, 0.9, 0.4, 0.2, 0.1, 0.1] },
          { token: '记', values: [0.2, 0.4, 0.9, 0.4, 0.2, 0.1] },
          { token: '网', values: [0.1, 0.2, 0.4, 0.9, 0.4, 0.2] },
          { token: '插', values: [0.1, 0.1, 0.2, 0.4, 0.9, 0.4] },
          { token: '安', values: [0.1, 0.1, 0.1, 0.2, 0.4, 0.9] },
        ]
      const stack = (dl.stack && dl.stack.length) ? dl.stack : DL_STACK
      const cell = 44
      const gap = 3
      const gx0 = 596
      const gy0 = 66
      const cells = []
      rows.forEach((row, ri) => {
        row.values.forEach((v, ci) => {
          const alpha = 0.06 + v * 0.9
          const isDiag = ri === ci
          cells.push(React.createElement('rect', {
            key: `att-${ri}-${ci}`,
            x: gx0 + ci * (cell + gap),
            y: gy0 + ri * (cell + gap),
            width: cell, height: cell,
            rx: 2,
            className: 'ow-lab-att-cell',
            fill: isDiag ? `rgba(94,234,212,${alpha})` : `rgba(167,139,250,${alpha})`,
          }))
        })
      })
      const scanY = gy0 + ((tick * 2.2) % (rows.length * (cell + gap)))
      const stackNodes = stack.map((layer, i) => {
        const y = 74 + i * 72
        const node = nodeMap[layer.node]
        const active = !node || node.status !== 'offline'
        return React.createElement('g', {
          key: `dl-${layer.label}`,
          className: 'ow-nn-node',
          onClick: () => layer.node && node && node.id,
        },
          React.createElement('rect', {
            x: 26, y: y - 20, width: 104, height: 40, rx: 4,
            className: `ow-ati-dl-box ${i === 2 ? 'hl' : ''}`,
            opacity: active ? 1 : 0.4,
          }),
          React.createElement('text', { x: 78, y: y - 6, textAnchor: 'middle', className: 'ow-ati-dl-label' }, layer.label),
          React.createElement('text', { x: 78, y: y + 8, textAnchor: 'middle', className: 'ow-ati-dl-zh' }, layer.zh),
          node && React.createElement('text', { x: 78, y: y + 18, textAnchor: 'middle', className: 'ow-ati-metric' }, `${node.metric}%`),
        )
      })
      return React.createElement('g', { className: 'ow-ati-stage' },
        React.createElement('text', { x: 26, y: 42, className: 'ow-lab-title' }, 'TRANSFORMER STACK'),
        React.createElement('text', { x: gx0, y: 42, className: 'ow-lab-title' }, 'MULTI-HEAD ATTENTION'),
        stackNodes,
        cells,
        React.createElement('rect', {
          x: gx0 - 4, y: scanY, width: rows.length * (cell + gap) + 2, height: 1.2,
          fill: '#5eead4', opacity: 0.8,
          style: { filter: 'drop-shadow(0 0 4px #5eead4)' },
        }),
        rows.map((row, ri) => React.createElement('text', {
          key: `tok-r-${ri}`,
          x: gx0 - 10, y: gy0 + ri * (cell + gap) + cell / 2 + 3,
          textAnchor: 'end', className: 'ow-lab-att-token',
        }, row.token)),
        rows.map((row, ci) => React.createElement('text', {
          key: `tok-c-${ci}`,
          x: gx0 + ci * (cell + gap) + cell / 2, y: gy0 - 8,
          textAnchor: 'middle', className: 'ow-lab-att-token',
        }, row.token)),
        React.createElement('text', { x: gx0, y: gy0 + rows.length * (cell + gap) + 16, className: 'ow-lab-tick' },
          `heads ${dl.heads ?? 8} · depth ${dl.depth ?? 6} · ${dl.params != null ? (dl.params >= 1000 ? `${(dl.params / 1000).toFixed(1)}K` : dl.params) : '—'} params · ${dl.flashAttention ? 'FA✓' : 'MHA'}`),
        React.createElement('text', { x: 26, y: 474, className: 'ow-lab-tick' },
          `temperature ${dl.temperature ?? '—'} · dropout ${dl.dropout ?? '—'}`),
      )
    }

    function ChemMolecularStage({ tick, cx, cy, nodeMap, lab }) {
      const chem = (lab && lab.chemistry) || {}
      const elements = (chem.elements && chem.elements.length) ? chem.elements : []
      const hx = cx + 205
      const hy = cy - 30
      const ring = hexRing(hx, hy, 46)
      const bondLines = ring.map((p, i) => {
        const q = ring[(i + 1) % 6]
        return React.createElement('line', {
          key: `bond-${i}`,
          x1: p[0], y1: p[1], x2: q[0], y2: q[1],
          className: `ow-lab-bond ${i % 2 ? 'double' : ''}`,
        })
      })
      const electrons = ring.map((p, i) => {
        const a = tick * 0.06 + i * Math.PI / 3
        return React.createElement('circle', {
          key: `el-${i}`,
          cx: hx + 62 * Math.cos(a), cy: hy + 62 * Math.sin(a), r: 2,
          className: 'ow-lab-electron',
        })
      })
      const atoms = elements.slice(0, 8).map((el, i) => {
        const a = -Math.PI / 2 + i * Math.PI / 4
        const px = hx + 118 * Math.cos(a)
        const py = hy + 96 * Math.sin(a)
        const metaNode = nodeMap[el.node]
        const color = el.category === 'metal' ? '#f4a261' : (el.category === 'carbon' ? '#a78bfa' : '#5eead4')
        return React.createElement('g', { key: `atom-${el.symbol}` },
          React.createElement('line', {
            x1: hx + 46 * Math.cos(a), y1: hy + 46 * Math.sin(a),
            x2: px, y2: py,
            className: 'ow-lab-bond',
            stroke: color,
            opacity: 0.6,
          }),
          React.createElement('circle', { cx: px, cy: py, r: 13, className: 'ow-lab-atom', stroke: color }),
          React.createElement('text', {
            x: px, y: py + 4, className: 'ow-lab-elem-symbol',
            fill: color, fontSize: 9,
          }, el.symbol),
          React.createElement('text', { x: px, y: py - 18, className: 'ow-lab-elem-name' }, metaNode ? `${metaNode.metric}%` : '—'),
        )
      })
      const molecules = chem.molecules || []
      return React.createElement('g', { className: 'ow-ati-stage' },
        bondLines,
        ring.map((p, i) => React.createElement('circle', {
          key: `ring-c-${i}`,
          cx: p[0], cy: p[1], r: 4.5,
          fill: 'rgba(8,12,24,.85)', stroke: '#34d399', strokeWidth: 1.2,
        })),
        electrons,
        atoms,
        React.createElement('text', { x: hx, y: hy - 74, textAnchor: 'middle', className: 'ow-lab-title' }, 'C₆ · 苯环记忆场'),
        React.createElement('text', { x: hx, y: hy + 148, textAnchor: 'middle', className: 'ow-lab-tick' },
          `ΔG = ${chem.freeEnergy ?? '—'} kJ/mol · ΔS = ${chem.entropy ?? '—'} J/K · k = ${chem.reactionRate ?? '—'}`),
        molecules.slice(0, 3).map((m, i) => React.createElement('text', {
          key: `mol-${m.formula}`,
          x: 44, y: 96 + i * 40,
          className: 'ow-lab-title dim',
        }, `${m.formula}  ${m.name}`)),
      )
    }

    function PeriodicLatticeStage({ tick, cx, cy, nodeMap, lab }) {
      const chem = (lab && lab.chemistry) || {}
      const elements = (chem.elements && chem.elements.length) ? chem.elements : []
      const cards = elements.map((el, i) => {
        const col = i % 4
        const row = Math.floor(i / 4)
        const x = 108 + col * 175
        const y = 92 + row * 132
        const color = el.category === 'metal' ? '#f4a261' : (el.category === 'carbon' ? '#a78bfa' : '#5eead4')
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.05 + i)
        return React.createElement('g', { key: `pe-${el.symbol}`, className: 'ow-nn-node' },
          React.createElement('rect', {
            x: x - 34, y: y - 30, width: 68, height: 68,
            rx: 4,
            className: `ow-lab-elem ${el.category}`,
            fill: 'rgba(8,12,24,.55)',
            opacity: el.metric > 0 ? 1 : 0.45,
          }),
          React.createElement('text', { x: x + 26, y: y - 18, className: 'ow-lab-elem-z' }, String(el.z)),
          React.createElement('text', { x: x, y: y + 6, className: 'ow-lab-elem-symbol', fill: color }, el.symbol),
          React.createElement('text', { x: x, y: y + 16, className: 'ow-lab-elem-name' }, el.name.split('·')[0]),
          React.createElement('text', { x: x, y: y + 28, className: 'ow-lab-elem-metric' }, `${el.metric}%`),
          React.createElement('circle', {
            cx: x + 26, cy: y + 26, r: 3,
            fill: color, opacity: 0.35 + pulse * 0.65,
            style: { filter: `drop-shadow(0 0 4px ${color})` },
          }),
        )
      })
      return React.createElement('g', { className: 'ow-ati-stage' },
        React.createElement('text', { x: 108, y: 52, className: 'ow-lab-title' }, 'ORGAN PERIODIC LATTICE'),
        React.createElement('text', { x: 620, y: 52, className: 'ow-lab-title dim' }, '元素 ↔ DSH 器官映射'),
        cards,
        React.createElement('text', { x: 108, y: 420, className: 'ow-lab-tick' },
          `共价键 ${(chem.bonds || []).length} 条 · 轨道能 ${chem.orbitalEnergy ?? '—'} eV · 反应速率 ${chem.reactionRate ?? '—'}`),
      )
    }

    function AtiEvolutionStage({ tick, cx, cy, lab }) {
      const evo = (lab && lab.evolution) || null
      const stages = evo && evo.stages ? evo.stages : ATI_STAGES_FALLBACK
      const stageIndex = evo ? evo.stageIndex : 0
      const readiness = evo ? evo.readiness : 20
      const radii = [64, 104, 146, 188, 230]
      const rings = stages.map((s, i) => {
        const a = -Math.PI / 2 + i * (2 * Math.PI / stages.length)
        const on = i <= stageIndex
        return React.createElement('g', { key: `evo-${s.id}` },
          React.createElement('circle', {
            cx, cy, r: radii[i],
            className: `ow-lab-evo-ring ${on ? 'on' : ''}`,
            strokeDasharray: on ? undefined : '2 6',
          }),
          React.createElement('text', {
            x: cx + Math.cos(a) * radii[i], y: cy + Math.sin(a) * radii[i] + 2.5,
            className: `ow-lab-evo-label ${on ? 'on' : ''}`,
          }, `${i} · ${s.zh}`),
        )
      })
      const circ = 2 * Math.PI * 230
      const prog = evo ? evo.progress : 0
      const arcColor = '#a78bfa'
      const particles = Array.from({ length: 26 }, (_, i) => {
        const a = i * (2 * Math.PI / 26) + tick * 0.008 * (1 + (i % 3) * 0.2)
        const r = 40 + ((i * 37 + tick * 1.2) % 190)
        return React.createElement('circle', {
          key: `evo-p-${i}`,
          cx: cx + Math.cos(a) * r,
          cy: cy + Math.sin(a) * r * 0.92,
          r: 1.2 + (i % 3) * 0.6,
          fill: i % 2 ? '#a78bfa' : '#5eead4',
          opacity: 0.2 + (i % 5) * 0.12,
        })
      })
      return React.createElement('g', { className: 'ow-ati-stage' },
        rings,
        particles,
        React.createElement('circle', {
          cx, cy, r: 230, fill: 'none',
          stroke: 'rgba(167,139,250,.25)', strokeWidth: 6,
          strokeDasharray: `${circ * prog} ${circ * (1 - prog)}`,
          strokeLinecap: 'round',
          transform: `rotate(-90 ${cx} ${cy})`,
          style: { filter: 'drop-shadow(0 0 8px rgba(167,139,250,.6))' },
        }),
        React.createElement('circle', { cx, cy, r: 58 + Math.sin(tick * 0.05) * 4, fill: 'rgba(167,139,250,.15)', stroke: arcColor, strokeWidth: 1.2 }),
        React.createElement('circle', { cx, cy, r: 24, fill: 'none', stroke: '#fff', strokeWidth: 1, opacity: 0.7 }),
        React.createElement('circle', { cx, cy, r: 8, fill: '#fff', style: { filter: 'drop-shadow(0 0 10px #fff)' } }),
        React.createElement('text', { x: cx, y: cy - 70, textAnchor: 'middle', className: 'ow-lab-title' }, 'ATI EVOLUTION'),
        React.createElement('text', { x: cx, y: cy + 40, textAnchor: 'middle', className: 'ow-lab-evo-val' }, `${readiness}`),
        React.createElement('text', { x: cx, y: cy + 54, textAnchor: 'middle', className: 'ow-lab-evo-label on' }, `/ 100 · ${evo ? evo.stage.zh : '拓扑胚'}`),
      )
    }

    function AciLoopStage({ tick, cx, cy, nodeMap, lab }) {
      const phases = ACI_PHASES
      const R = 150
      const phaseCount = phases.length
      // 当前活跃阶段（每 80 tick 切换一次 = 模拟 think 循环节奏）
      const activePhase = Math.floor(tick / 20) % phaseCount
      // 粒子沿环运动
      const particles = Array.from({ length: 16 }, (_, i) => {
        const t = ((tick * 0.008) + i / 16) % 1
        const angle = t * Math.PI * 2 - Math.PI / 2
        return {
          x: cx + Math.cos(angle) * R,
          y: cy + Math.sin(angle) * R * 0.72,
          color: phases[Math.floor(t * phaseCount) % phaseCount].color,
        }
      })

      const nodes = phases.map((p, i) => {
        const a = -Math.PI / 2 + i * (2 * Math.PI / phaseCount)
        return { ...p, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.72, idx: i }
      })

      const evo = lab && lab.evolution
      const score = evo ? evo.readiness : null
      const trend = score != null ? (score > 70 ? '↗ improving' : score > 40 ? '→ stable' : '↘ seed') : ''

      const edgesBetween = []
      for (let i = 0; i < phaseCount; i++) {
        const cur = nodes[i]
        const next = nodes[(i + 1) % phaseCount]
        const mx = (cur.x + next.x) / 2
        const my = (cur.y + next.y) / 2 - 24
        const isActive = i === activePhase
        edgesBetween.push(React.createElement('path', {
          key: `edge-${i}`,
          d: `M ${cur.x} ${cur.y} Q ${mx} ${my} ${next.x} ${next.y}`,
          fill: 'none',
          stroke: isActive ? cur.color : 'rgba(124,142,166,.15)',
          strokeWidth: isActive ? 2 : 1,
          strokeDasharray: isActive ? undefined : '4 6',
          opacity: isActive ? 0.9 : 0.3,
          style: isActive ? { filter: `drop-shadow(0 0 6px ${cur.color})` } : undefined,
        }))
        // 流动粒子
        if (isActive) {
          const t = (tick * 0.03) % 1
          const px = (1 - t) * (1 - t) * cur.x + 2 * (1 - t) * t * mx + t * t * next.x
          const py = (1 - t) * (1 - t) * cur.y + 2 * (1 - t) * t * my + t * t * next.y
          edgesBetween.push(React.createElement('circle', {
            key: `pulse-${i}`,
            cx: px, cy: py, r: 4, fill: cur.color,
            style: { filter: `drop-shadow(0 0 6px ${cur.color})` },
          }))
        }
      }

      return React.createElement('g', { className: 'ow-ati-stage' },
        React.createElement('ellipse', { cx, cy, rx: R + 30, ry: R * 0.72 + 30, fill: 'rgba(8,12,24,.5)', stroke: 'rgba(94,234,212,.1)' }),
        // 阶段节点
        nodes.map((n) => React.createElement('g', { key: `phase-${n.id}` },
          React.createElement('circle', {
            cx: n.x, cy: n.y,
            r: n.idx === activePhase ? 28 : 20,
            fill: n.idx === activePhase ? `${n.color}22` : 'rgba(8,12,24,.7)',
            stroke: n.color,
            strokeWidth: n.idx === activePhase ? 2.5 : 1,
            style: n.idx === activePhase ? { filter: `drop-shadow(0 0 12px ${n.color})` } : undefined,
          }),
          React.createElement('text', {
            x: n.x, y: n.y - 2, textAnchor: 'middle',
            fill: n.color, fontSize: n.idx === activePhase ? 10 : 8,
            fontFamily: 'Consolas,monospace', fontWeight: 'bold',
          }, n.en),
          React.createElement('text', {
            x: n.x, y: n.y + 10, textAnchor: 'middle',
            fill: '#7c8ea6', fontSize: 7,
          }, n.zh),
        )),
        edgesBetween,
        // 外围流动粒子
        particles.map((p, i) => React.createElement('circle', {
          key: `pt-${i}`, cx: p.x, cy: p.y, r: 2, fill: p.color, opacity: 0.5,
        })),
        // 中心：当前阶段指示器 + 分数
        React.createElement('circle', { cx, cy, r: 52, fill: 'rgba(8,12,24,.85)', stroke: 'rgba(94,234,212,.25)', strokeWidth: 1 }),
        React.createElement('text', {
          x: cx, y: cy - 14, textAnchor: 'middle',
          fill: phases[activePhase].color, fontSize: 11,
          fontFamily: 'Consolas,monospace', fontWeight: 'bold',
        }, phases[activePhase].en),
        React.createElement('text', {
          x: cx, y: cy, textAnchor: 'middle',
          fill: '#e6f1ff', fontSize: 18,
          fontFamily: 'Consolas,monospace', fontWeight: '700',
        }, score != null ? String(score) : '—'),
        React.createElement('text', {
          x: cx, y: cy + 16, textAnchor: 'middle',
          fill: '#7c8ea6', fontSize: 7,
        }, trend || 'ACI READYNESS'),
        // 底部标签
        React.createElement('text', {
          x: cx, y: cy + 190, textAnchor: 'middle',
          className: 'ow-lab-title dim',
        }, 'PLAN → EXECUTE → EVALUATE → ADJUST → repeat'),
      )
    }

    function AtiStageRenderer({ preset, tick, W, H, cx, cy, nodeMap, lab }) {
      const id = preset || 'ati-unified'
      if (id === 'manifold-torus') return React.createElement(TopoTorus, { tick, cx, cy })
      if (id === 'manifold-mobius') return React.createElement(TopoMobius, { tick, cx, cy })
      if (id === 'manifold-klein') return React.createElement(TopoKlein, { tick, cx, cy })
      if (id === 'poincare-disk') return React.createElement(TopoPoincare, { tick, cx, cy })
      if (id === 'ml-gradient') return React.createElement(MlGradientStage, { tick, cx, cy, lab })
      if (id === 'deep-attention') return React.createElement(DlAttentionStage, { tick, cx, cy, nodeMap, lab })
      if (id === 'molecular-graph') return React.createElement(ChemMolecularStage, { tick, cx, cy, nodeMap, lab })
      if (id === 'periodic-lattice') return React.createElement(PeriodicLatticeStage, { tick, cx, cy, nodeMap, lab })
      if (id === 'ati-evolution') return React.createElement(AtiEvolutionStage, { tick, cx, cy, lab })
      if (id === 'aci-loop') return React.createElement(AciLoopStage, { tick, cx, cy, nodeMap, lab })
      const unified = [
        React.createElement('g', { key: 'u-manifold', opacity: 0.55 },
          React.createElement('circle', { cx, cy, r: 218, className: 'ow-ati-poincare' }),
          Array.from({ length: 9 }).map((_, i) => {
            const r = 86 + i * 17
            return React.createElement('ellipse', {
              key: `u-t-${i}`, cx, cy, rx: r * 1.12, ry: r * 0.52,
              className: 'ow-ati-torus',
              transform: `rotate(${tick * 0.12 + i * 9} ${cx} ${cy})`,
            })
          }),
        ),
        React.createElement('g', { key: 'u-dl', opacity: 0.5 },
          DL_STACK.map((layer, i) => {
            const y = 86 + i * 74
            const node = nodeMap[layer.id]
            const active = !node || node.status !== 'offline'
            return React.createElement('g', { key: `u-dl-${layer.id}`, className: 'ow-nn-node' },
              React.createElement('rect', {
                x: 26, y: y - 20, width: 106, height: 40, rx: 4,
                className: 'ow-ati-dl-box', opacity: active ? 1 : 0.4,
              }),
              React.createElement('text', { x: 79, y: y - 4, textAnchor: 'middle', className: 'ow-ati-dl-label' }, layer.label),
              React.createElement('text', { x: 79, y: y + 10, textAnchor: 'middle', className: 'ow-ati-dl-zh' }, layer.zh),
            )
          }),
        ),
        React.createElement('g', { key: 'u-chem', opacity: 0.6 },
          (() => {
            const ring = hexRing(cx + 220, cy - 20, 42)
            return React.createElement(React.Fragment, null,
              React.createElement('polygon', {
                points: ring.map((p) => p.join(',')).join(' '),
                className: 'ow-ati-hex',
              }),
              ring.map((p, i) => React.createElement('circle', {
                key: `u-hex-${i}`, cx: p[0], cy: p[1], r: 4, className: 'ow-ati-hex-node',
              })),
              React.createElement('text', {
                x: cx + 220, y: cy - 74, textAnchor: 'middle',
                fill: '#34d399', fontSize: 8, fontFamily: 'Consolas,monospace', letterSpacing: 2,
              }, 'C₆ MEMORY RING'),
            )
          })(),
        ),
      ]
      return React.createElement('g', null, unified)
    }

    module.exports = {
      hexRing,
      labLerp,
      quadPoint,
      clamp01,
      TopoTorus,
      TopoMobius,
      TopoKlein,
      TopoPoincare,
      MlGradientStage,
      DlAttentionStage,
      ChemMolecularStage,
      PeriodicLatticeStage,
      AtiEvolutionStage,
      AciLoopStage,
      AtiStageRenderer,
    }
    return module.exports
  },
})


// Open World · hubs
window.__ModuleLoader__.load({
  id: 'dsh-open-world/hubs',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React
    const C = require('dsh-open-world/constants')
    const { SPACE_VIEW_URL, OW_ACTION_URL } = C

    async function postOpenWorldAction(action) {
      const res = await fetch(OW_ACTION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(action),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || data.code || `action ${res.status}`)
      return data
    }

    function MessageHub({ mailbox, hub, onSend, onRead, onShare, onInjectAgent, onSearchMemory }) {
      const [body, setBody] = useState('')
      const [to, setTo] = useState('broadcast')
      const [attachTopo, setAttachTopo] = useState(true)
      const [attachMem, setAttachMem] = useState(false)
      const [memQuery, setMemQuery] = useState('')
      const [memHits, setMemHits] = useState([])
      const [memSource, setMemSource] = useState(null)
      const [sending, setSending] = useState(false)
      const messages = (mailbox && mailbox.messages) || []
      const unread = (mailbox && mailbox.unread) || 0
      const remoteReady = hub && hub.pair && (hub.pair.paired || hub.remoteMessaging?.paired)

      const searchMem = async () => {
        if (!onSearchMemory) return
        const data = await onSearchMemory(memQuery)
        setMemHits((data && data.items) || [])
        setMemSource((data && data.source) || (data && data.daemon ? 'daemon' : 'offline'))
        setAttachMem(true)
      }

      const send = async () => {
        if (!body.trim() || sending) return
        setSending(true)
        try {
          const attachments = []
          if (attachMem && memHits.length > 0) {
            attachments.push({ type: 'memory', items: memHits.slice(0, 5), source: memSource || 'hindsight' })
          }
          if (to === 'agent') {
            const memNote = attachMem && memHits.length
              ? `\n\n[Hindsight 附件 · ${memSource || '—'}]\n${memHits.slice(0, 3).map((m) => m.text).join('\n')}`
              : ''
            await onInjectAgent(body + memNote)
          } else if (to === 'clipboard') {
            const data = await onSend({
              action: 'send-message', to: 'clipboard', body, attachSnapshot: attachTopo, attachments,
            })
            if (data.share && navigator.clipboard) {
              await navigator.clipboard.writeText(JSON.stringify(data.share, null, 2))
            }
          } else {
            await onSend({
              action: 'send-message',
              to,
              body,
              attachSnapshot: attachTopo,
              attachments,
              attachMemory: attachMem && memHits.length ? memHits.slice(0, 5) : undefined,
            })
          }
          setBody('')
        } finally { setSending(false) }
      }

      return React.createElement('div', { className: 'ow-msg-hub' },
        React.createElement('div', { style: { fontSize: 10, color: '#7c8ea6' } },
          `信箱 · ${messages.length} 条 · 未读 ${unread}${remoteReady ? ' · 跨机就绪' : ''}`),
        React.createElement('textarea', {
          placeholder: '输入消息… 可广播、跨机、投递到官方聊天、附记忆/拓扑',
          value: body,
          onChange: (ev) => setBody(ev.target.value),
        }),
        React.createElement('div', { className: 'ow-msg-row' },
          React.createElement('input', {
            className: 'ow-msg-select', style: { flex: 1, minWidth: 100 },
            placeholder: 'Hindsight 检索…', value: memQuery,
            title: '走 /memory/search · 非本地 RRM 归档',
            onChange: (ev) => setMemQuery(ev.target.value),
            onKeyDown: (ev) => { if (ev.key === 'Enter') searchMem() },
          }),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn', onClick: searchMem,
            title: 'Hindsight daemon/cache · 与 MemoryBrief「搜归档」不是同一通路',
          }, '搜 Hindsight'),
        ),
        React.createElement('div', {
          style: { fontSize: 9, color: '#64748b', marginTop: 2 },
        }, memSource
          ? `来源 · Hindsight · ${memSource} · 非本地 RRM 归档`
          : '来源 · Hindsight（daemon/cache/offline）· 本地归档请用上方 MemoryBrief「搜归档」'),
        memHits.length > 0 && React.createElement('div', { className: 'ow-hub-mem' },
          memHits.slice(0, 3).map((m) => React.createElement('div', { key: m.id }, `· ${m.text.slice(0, 80)}`)),
        ),
        React.createElement('div', { className: 'ow-msg-row' },
          React.createElement('select', {
            className: 'ow-msg-select', value: to,
            onChange: (ev) => setTo(ev.target.value),
          },
            React.createElement('option', { value: 'broadcast' }, '全体广播'),
            React.createElement('option', { value: 'sessions' }, '全部会话'),
            remoteReady && React.createElement('option', { value: 'remote' }, '跨机外发（本地 outbox，非手机实时）'),
            React.createElement('option', { value: 'agent' }, '投递到官方聊天'),
            React.createElement('option', { value: 'clipboard' }, '复制分享包'),
            React.createElement('option', { value: 'external' }, '导出外发文件'),
          ),
          React.createElement('label', { style: { fontSize: 10, color: '#7c8ea6' } },
            React.createElement('input', {
              type: 'checkbox', checked: attachTopo,
              onChange: (ev) => setAttachTopo(ev.target.checked),
              style: { marginRight: 4 },
            }),
            '附拓扑'),
          React.createElement('label', { style: { fontSize: 10, color: '#7c8ea6' } },
            React.createElement('input', {
              type: 'checkbox', checked: attachMem,
              onChange: (ev) => setAttachMem(ev.target.checked),
              style: { marginRight: 4 },
            }),
            '附 Hindsight'),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn primary', onClick: send, disabled: sending,
          }, sending ? '…' : '发送'),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn', onClick: () => onShare(),
          }, '分享快照'),
        ),
        messages.slice(0, 8).map((m) => React.createElement('div', {
          key: m.id,
          className: `ow-msg-item ${m.direction === 'in' && !m.read ? 'unread' : ''}`,
          onClick: () => m.direction === 'in' && !m.read && onRead([m.id]),
        },
          React.createElement('div', { style: { color: '#e6f1ff' } }, m.body),
          m.payload && m.payload.attachments && React.createElement('div', { className: 'ow-msg-attach' }, '📎 含附件'),
          m.kind === 'notification' && React.createElement('div', { className: 'ow-msg-attach' }, '🔔 通知中心'),
          React.createElement('div', { className: 'ow-msg-meta' },
            `${m.direction === 'in' ? '收' : '发'} · ${m.toLabel || m.to} · ${new Date(m.ts).toLocaleTimeString('zh-CN')}`),
        )),
      )
    }

    function IntegrationsHub({ hub, space, onAction, onEmbedArchify, onToast }) {
      const TTL_CHOICES = [
        { hours: 24, label: '24h' },
        { hours: 168, label: '7d' },
        { hours: 720, label: '30d' },
        { hours: 0, label: '永不过期' },
      ]
      const [pairUrl, setPairUrl] = useState('')
      const [memQ, setMemQ] = useState('')
      const [memItems, setMemItems] = useState((hub && hub.hindsight && hub.hindsight.items) || [])
      const [memSource, setMemSource] = useState(null)
      const [spaceTok, setSpaceTok] = useState('')
      const [spaceInfo, setSpaceInfo] = useState(space || null)
      const [spaceRole, setSpaceRole] = useState(() => (space && space.role) || 'second-screen')
      const [ttlHours, setTtlHours] = useState(() => {
        const n = space && space.token_ttl_hours
        return Number.isFinite(Number(n)) ? Number(n) : 168
      })
      useEffect(() => { setSpaceInfo(space || null) }, [space])
      useEffect(() => {
        if (space && space.role) setSpaceRole(space.role)
      }, [space && space.role])
      useEffect(() => {
        if (space && space.token_ttl_hours != null && Number.isFinite(Number(space.token_ttl_hours))) {
          setTtlHours(Number(space.token_ttl_hours))
        }
      }, [space && space.token_ttl_hours])
      if (!hub) {
        return React.createElement('div', { style: { fontSize: 12, color: '#7c8ea6' } }, '集成层加载中…')
      }
      const pair = hub.pair || {}
      const notif = hub.notifications || {}
      const archify = (hub.archify && hub.archify.items) || []
      const sp = spaceInfo || {}

      const issuePair = async () => {
        try {
          const data = await postOpenWorldAction({ action: 'pair-issue' })
          if (data.ok && data.url) {
            setPairUrl(data.url)
            onToast && onToast('配对链接已生成')
          } else {
            onToast && onToast(data.code || data.error || '配对失败 · 检查 web-ui-remote-web-ui 是否启用')
          }
        } catch (err) {
          onToast && onToast(String(err.message || err))
        }
      }

      const stopPair = async () => {
        try {
          const data = await postOpenWorldAction({ action: 'pair-stop' })
          if (data && data.ok) {
            setPairUrl('')
            onToast && onToast('Pair 已停止')
          } else {
            onToast && onToast((data && (data.error || data.code)) || '停止失败')
          }
        } catch (err) {
          onToast && onToast(String(err.message || err))
        }
      }

      const issueSpaceToken = async (rotate, roleOverride) => {
        const role = roleOverride || 'second-screen'
        try {
          const data = await postOpenWorldAction({
            action: 'space-token-issue',
            rotate: !!rotate,
            reveal: true,
            role,
            label: role,
            ttl_hours: ttlHours,
          })
          if (data && data.ok) {
            if (data.space) setSpaceInfo(data.space)
            if (data.role) setSpaceRole(data.role)
            if (data.token) {
              setSpaceTok(data.token)
              try {
                sessionStorage.setItem('ow-space-token', data.token)
                sessionStorage.setItem('ow-space-role', data.role || role)
              } catch { /* ignore */ }
            }
            onToast && onToast(role === 'peer'
              ? `已签发可回写令牌（send-message / mark-read / memory-search / world-state-get / request-local）${rotate ? ' · 已轮换' : ''}`
              : (rotate
                ? `第二屏只读令牌已轮换（TTL ${ttlHours > 0 ? `${ttlHours}h` : '永不过期'}）`
                : '第二屏只读令牌已签发'))
          } else {
            onToast && onToast((data && (data.error || data.code)) || '令牌失败')
          }
        } catch (err) {
          onToast && onToast(String(err.message || err))
        }
      }

      const revokeSpaceTok = async () => {
        try {
          const data = await postOpenWorldAction({ action: 'space-token-revoke' })
          if (data && data.ok) {
            setSpaceTok('')
            try {
              sessionStorage.removeItem('ow-space-token')
              sessionStorage.removeItem('ow-space-role')
            } catch { /* ignore */ }
            if (data.space) setSpaceInfo(data.space)
            setSpaceRole('second-screen')
            onToast && onToast('第二屏令牌已吊销')
          } else {
            onToast && onToast((data && data.error) || '吊销失败')
          }
        } catch (err) {
          onToast && onToast(String(err.message || err))
        }
      }

      const secondScreenUrl = (tok) => {
        const base = `${window.location.origin}${SPACE_VIEW_URL}`
        return tok ? `${base}?token=${encodeURIComponent(tok)}` : base
      }

      const openSecondScreen = () => {
        const tok = spaceTok || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ow-space-token')) || ''
        window.open(secondScreenUrl(tok), '_blank', 'noopener,noreferrer')
      }

      const copySecondScreenLink = async () => {
        let tok = spaceTok
        if (!tok) {
          try {
            const data = await postOpenWorldAction({
              action: 'space-token-issue',
              reveal: true,
              role: 'second-screen',
              label: 'second-screen',
              ttl_hours: ttlHours,
            })
            if (data && data.token) {
              tok = data.token
              setSpaceTok(tok)
              if (data.space) setSpaceInfo(data.space)
            }
          } catch { /* ignore */ }
        }
        const url = secondScreenUrl(tok)
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url)
          onToast && onToast('第二屏链接已复制（页内用 Bearer 换 SSE ticket；勿把长寿命 token 当唯一凭证）')
        } else {
          onToast && onToast(url)
        }
      }

      const searchMem = async () => {
        const data = await postOpenWorldAction({ action: 'memory-search', query: memQ })
        setMemItems((data && data.items) || [])
        setMemSource((data && data.source) || (data && data.daemon ? 'daemon' : 'offline'))
      }

      const spaceOff = sp.enabled === false
      const pairOfflineHint = !pair.available
        ? 'Pair 未启用 · 在 plugins.yml 将 web-ui-remote-web-ui: enabled 设为 true，运行 apply.cmd 后重启 Desktop'
        : null
      const roleLabel = (sp.role || spaceRole) === 'peer' ? 'peer（受限回写）' : 'second-screen（只读）'

      return React.createElement('div', { className: 'ow-hub' },
        React.createElement('div', {
          className: 'ow-hub-sec',
          style: { marginBottom: 10, padding: '8px 10px', border: '1px solid rgba(94,234,212,.2)', borderRadius: 6 },
        },
          React.createElement('div', { className: 'ow-hub-title' }, '跨机 · 观察/回写（Space）'),
          React.createElement('div', { className: 'ow-hub-stat' },
            'OW 第二屏：局域网观察 + 可选白名单回写（含 request-local→share-snapshot）。与 Pair 不是同一条协议。'),
          React.createElement('div', { className: 'ow-hub-stat', style: { marginTop: 4 } },
            spaceOff
              ? 'space 未启用（open-world.yml → space.enabled）'
              : `${sp.hasToken ? '令牌就绪' : (sp.expired ? '令牌已过期' : '尚无令牌')} · ${roleLabel} · ${sp.protocol || 'owip/0.3-draft'}${sp.token_ttl_hours != null ? ` · TTL ${sp.token_ttl_hours}h` : ''}`),
          !spaceOff && React.createElement('div', {
            className: 'ow-hub-row',
            style: { marginTop: 6, gap: 4, flexWrap: 'wrap', alignItems: 'center' },
          },
            React.createElement('span', { style: { fontSize: 10, color: '#7c8ea6' } }, '签发 TTL'),
            TTL_CHOICES.map((c) => React.createElement('button', {
              key: String(c.hours),
              type: 'button',
              className: `ow-msg-btn ${ttlHours === c.hours ? 'primary' : ''}`,
              style: { padding: '2px 8px', fontSize: 10 },
              onClick: () => setTtlHours(c.hours),
            }, c.label)),
          ),
          React.createElement('div', { className: 'ow-hub-row', style: { marginTop: 6, flexWrap: 'wrap' } },
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn primary',
              disabled: spaceOff,
              onClick: () => !spaceOff && issueSpaceToken(false, 'second-screen'),
            }, '签发只读令牌'),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              disabled: spaceOff,
              title: 'peer：… / request-local(→share-snapshot|space-token-status|notification-ack-all)；禁止 pair-*、签发、publish、idea-inject',
              onClick: () => {
                if (spaceOff) return
                if (typeof window !== 'undefined' && window.confirm
                  && !window.confirm('签发可回写（受限）令牌？对端可发短消息与全部已读，无法管 Pair/令牌/注入。')) {
                  return
                }
                issueSpaceToken(true, 'peer')
              },
            }, '签发可回写（受限）'),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              disabled: spaceOff,
              onClick: () => !spaceOff && issueSpaceToken(true, sp.role || spaceRole || 'second-screen'),
            }, '轮换'),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              disabled: spaceOff,
              onClick: () => !spaceOff && revokeSpaceTok(),
            }, '吊销'),
            spaceTok && !spaceOff && React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              onClick: () => navigator.clipboard && navigator.clipboard.writeText(spaceTok),
            }, '复制令牌'),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              disabled: spaceOff,
              onClick: () => !spaceOff && openSecondScreen(),
            }, '打开第二屏'),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              disabled: spaceOff,
              onClick: () => !spaceOff && copySecondScreenLink(),
            }, '复制链接'),
          ),
          spaceTok && !spaceOff && React.createElement('div', { className: 'ow-hub-link' }, spaceTok),
          !spaceOff && (sp.issuedAt || sp.expiresAt) && React.createElement('div', {
            style: { marginTop: 4, fontSize: 10, color: '#7c8ea6' },
          }, [
            sp.issuedAt ? `签发 ${sp.issuedAt}` : null,
            sp.expiresAt ? ` · 过期 ${sp.expiresAt}` : ' · 无过期',
            sp.expired ? ' · 已过期请轮换' : null,
          ].filter(Boolean).join('')),
        ),
        React.createElement('div', {
          className: 'ow-hub-sec',
          style: { marginBottom: 10, padding: '8px 10px', border: '1px solid rgba(245,214,122,.22)', borderRadius: 6 },
        },
          React.createElement('div', { className: 'ow-hub-title' }, '跨机 · 手机控工作区（Pair）'),
          React.createElement('div', { className: 'ow-hub-stat' },
            '由 dsh-remote-web-ui 负责 /m；OW 只代理状态与入口，不重写 Pair Host。'),
          React.createElement('div', { className: 'ow-hub-stat', style: { marginTop: 4, color: pair.available ? '#7c8ea6' : '#fbbf24' } },
            pair.available
              ? `${pair.paired ? '已配对' : '未配对'} · 设备 ${pair.deviceCount || 0} · 在线 ${pair.onlineCount || 0}`
              : (pairOfflineHint || 'remote-web-ui 未安装/未启用')),
          React.createElement('div', { className: 'ow-hub-row', style: { marginTop: 6, flexWrap: 'wrap' } },
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn primary',
              disabled: !pair.available,
              title: pairOfflineHint || undefined,
              onClick: () => pair.available ? issuePair() : onToast && onToast(pairOfflineHint),
            }, '生成配对码'),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              disabled: !pair.available,
              onClick: () => pair.available ? stopPair() : onToast && onToast(pairOfflineHint),
            }, '停止 Pair'),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              onClick: () => onAction({ type: 'remote', label: '远程面板' }),
            }, '打开远程'),
            pairUrl && React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              onClick: () => navigator.clipboard && navigator.clipboard.writeText(pairUrl),
            }, '复制链接'),
          ),
          pairUrl && React.createElement('div', { className: 'ow-hub-link' }, pairUrl),
        ),
        notif.available && React.createElement('div', { className: 'ow-hub-sec' },
          React.createElement('div', { className: 'ow-hub-title' }, `通知中心 · 未读 ${notif.unreadCount || 0}`),
          (notif.notifications || []).slice(0, 3).map((n) => React.createElement('div', { key: n.id, className: 'ow-hub-item' },
            React.createElement('div', { style: { color: '#e6f1ff' } }, n.title),
            React.createElement('div', { style: { fontSize: 10, color: '#7c8ea6' } }, n.body),
          )),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn', style: { marginTop: 6 },
            onClick: () => postOpenWorldAction({ action: 'notification-ack-all' }),
          }, '全部已读'),
        ),
        React.createElement('div', { className: 'ow-hub-sec' },
          React.createElement('div', { className: 'ow-hub-title' }, 'Hindsight 记忆'),
          React.createElement('div', {
            style: { fontSize: 9, color: '#64748b', marginBottom: 4 },
          }, 'daemon/cache · 非本地 RRM 归档（归档检索在 MemoryBrief）'),
          React.createElement('div', { className: 'ow-hub-row' },
            React.createElement('input', {
              className: 'ow-msg-select', style: { flex: 1 },
              value: memQ, placeholder: 'Hindsight 关键词…',
              title: 'action memory-search → /memory/search',
              onChange: (ev) => setMemQ(ev.target.value),
              onKeyDown: (ev) => { if (ev.key === 'Enter') searchMem() },
            }),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn', onClick: searchMem,
              title: 'Hindsight 检索 · 与「搜归档」分路',
            }, '搜 Hindsight'),
          ),
          memSource && React.createElement('div', {
            style: { fontSize: 9, color: '#94a3b8', marginTop: 4 },
          }, `来源 · ${memSource}`),
          memItems.slice(0, 4).map((m) => React.createElement('div', { key: m.id, className: 'ow-hub-mem' }, m.text.slice(0, 120))),
        ),
        React.createElement('div', { className: 'ow-hub-sec' },
          React.createElement('div', { className: 'ow-hub-title' }, `Archify 架构图 · ${archify.length}`),
          archify.slice(0, 4).map((d) => React.createElement('div', {
            key: d.id, className: 'ow-hub-item',
            onClick: () => onEmbedArchify(d.url, d.title),
          }, d.title || d.name)),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn', style: { marginTop: 6 },
            onClick: () => onAction({
              type: 'agent-prompt',
              prompt: '请用 archify 为 Open World ATI 指挥舱画一张系统架构图（拓扑+消息+社交+集成），保存 HTML 到 ~/.dsh/open-world/archify/',
            }),
          }, '生成新图'),
        ),
      )
    }

    function RewindTimelinePanel({ rewind, plugins, onAction, onToast, compact }) {
      const plug = (plugins || []).find((p) => p.id === 'rewind')
      const stats = rewind || {}
      const available = !!(stats.available || (plug && plug.online))
      const points = (stats.timeline && stats.timeline.points) || []
      if (!available) {
        const hint = (plug && plug.howToEnable)
          || '对话回退未启用 · 在 plugins.yml 将 web-ui-rewind: enabled 设为 true，运行 apply.cmd 后重启 Desktop'
        return React.createElement('div', { className: 'ow-hub' },
          React.createElement('div', {
            style: { fontSize: 12, color: '#fbbf24', lineHeight: 1.5 },
          }, hint),
          React.createElement('div', { className: 'ow-rewind-actions', style: { marginTop: 8 } },
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn primary',
              onClick: () => {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(hint)
                  onToast && onToast('启用说明已复制')
                } else {
                  onToast && onToast(hint)
                }
              },
            }, '复制说明'),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              onClick: () => onAction({ type: 'settings', label: 'Rewind', settingsHint: '插件' }),
            }, '打开设置'),
          ),
        )
      }
      if (compact) {
        return React.createElement('div', { className: 'ow-hub' },
          React.createElement('div', { className: 'ow-hub-stat' },
            `${stats.anchors || 0} 锚点 · ${stats.snapshots || 0} 快照 · ${stats.sessions || 0} 会话`),
          React.createElement('div', { style: { fontSize: 11, color: '#64748b', marginTop: 4 } },
            '摘要 · 完整时间轴只在壳内展开一处'),
          React.createElement('div', { className: 'ow-rewind-actions', style: { marginTop: 8 } },
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn primary',
              onClick: () => onAction({ type: 'enter-world', worldId: 'rewind', panel: 'rewind', label: '已进入回退世界' }),
            }, '展开回退'),
            React.createElement('button', {
              type: 'button', className: 'ow-msg-btn',
              onClick: () => onAction({ type: 'rewind-open', preferChat: true }),
            }, '聊天里 /rewind'),
          ),
        )
      }
      return React.createElement('div', { className: 'ow-hub' },
        React.createElement('div', { className: 'ow-hub-stat' },
          `${stats.anchors || 0} 锚点 · ${stats.snapshots || 0} 文件快照 · ${stats.sessions || 0} 会话`),
        React.createElement('div', { className: 'ow-rewind-actions' },
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn primary',
            onClick: () => onAction({ type: 'enter-world', worldId: 'rewind', panel: 'rewind', label: '已进入回退世界' }),
          }, '壳内时间轴'),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn',
            onClick: () => onAction({ type: 'rewind-open', preferChat: true }),
          }, '聊天里 /rewind'),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn',
            onClick: () => onAction({ type: 'settings', label: 'Rewind', settingsHint: '插件' }),
          }, '设置'),
        ),
        points.length === 0
          ? React.createElement('div', { style: { fontSize: 11, color: '#7c8ea6', marginTop: 8 } },
            '暂无快照 · 在对话里用写类工具后会自动记录锚点')
          : React.createElement('div', { className: 'ow-rewind-tl', style: { marginTop: 8 } },
            points.map((p) => React.createElement('div', {
              key: p.id,
              className: `ow-rewind-item ${p.active ? 'active' : ''}`,
            },
              React.createElement('div', { style: { color: '#e6f1ff' } }, p.label),
              React.createElement('div', { className: 'ow-rewind-meta' },
                `${p.fileCount} 文件 · ${new Date(p.ts).toLocaleString('zh-CN')}${p.active ? ' · 当前会话' : ''}`),
              React.createElement('div', { className: 'ow-rewind-actions' },
                p.anchorSeq != null && React.createElement('button', {
                  type: 'button', className: 'ow-msg-btn',
                  onClick: (ev) => {
                    ev.stopPropagation()
                    onAction({ type: 'rewind-exec', anchorSeq: p.anchorSeq, mode: 'chat' })
                    onToast && onToast(`回退对话 @${p.anchorSeq}`)
                  },
                }, '仅对话'),
                p.anchorSeq != null && React.createElement('button', {
                  type: 'button', className: 'ow-msg-btn primary',
                  onClick: (ev) => {
                    ev.stopPropagation()
                    onAction({ type: 'rewind-exec', anchorSeq: p.anchorSeq, mode: 'both' })
                    onToast && onToast(`回退对话+文件 @${p.anchorSeq}`)
                  },
                }, '对话+文件'),
              ),
            )),
          ),
      )
    }

    module.exports = {
      MessageHub,
      IntegrationsHub,
      RewindTimelinePanel,
    }
    return module.exports
  },
})


// Open World · views-space（ATI 场背景；星系/深空整页已移除）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/views-space',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useEffect, useRef } = React

    const WEBGL_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`

    function AtiFieldCanvas({ active, tick }) {
      const ref = useRef(null)
      useEffect(() => {
        if (!active) return undefined
        const canvas = ref.current
        if (!canvas) return undefined
        const gl = canvas.getContext('webgl2', { alpha: true, antialias: false })
        if (!gl) return undefined
        const vs = gl.createShader(gl.VERTEX_SHADER)
        const fs = gl.createShader(gl.FRAGMENT_SHADER)
        gl.shaderSource(vs, WEBGL_VS)
        gl.shaderSource(fs, `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
out vec4 fragColor;
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.7))) * 45758.5453); }
void main(){
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float dist = length(c);
  vec3 col = vec3(0.01, 0.015, 0.04);
  float ang = atan(c.y, c.x);
  float field = sin(ang * 5.0 + dist * 22.0 - uTime * 0.35) * 0.5 + 0.5;
  field *= exp(-dist * 1.8);
  col += vec3(0.35, 0.15, 0.65) * field * 0.35;
  col += vec3(0.1, 0.55, 0.5) * field * 0.2 * sin(uTime * 0.5 + dist * 8.0);
  float grid = abs(sin(uv.x * uRes.x * 0.04 + uTime * 0.1)) * abs(sin(uv.y * uRes.y * 0.04));
  col += vec3(0.05, 0.12, 0.2) * grid * 0.08 * exp(-dist * 2.0);
  fragColor = vec4(col, 1.0);
}`)
        gl.compileShader(vs)
        gl.compileShader(fs)
        const prog = gl.createProgram()
        gl.attachShader(prog, vs)
        gl.attachShader(prog, fs)
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined
        gl.useProgram(prog)
        const uTime = gl.getUniformLocation(prog, 'uTime')
        const uRes = gl.getUniformLocation(prog, 'uRes')
        let raf = 0
        const start = performance.now()
        const resize = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          canvas.width = Math.floor(canvas.clientWidth * dpr)
          canvas.height = Math.floor(canvas.clientHeight * dpr)
          gl.viewport(0, 0, canvas.width, canvas.height)
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(canvas)
        const draw = (now) => {
          raf = requestAnimationFrame(draw)
          gl.uniform1f(uTime, (now - start) / 1000)
          gl.uniform2f(uRes, canvas.width, canvas.height)
          gl.drawArrays(gl.TRIANGLES, 0, 3)
        }
        raf = requestAnimationFrame(draw)
        return () => { cancelAnimationFrame(raf); ro.disconnect(); gl.deleteProgram(prog) }
      }, [active])
      return React.createElement('canvas', { ref, className: 'ow-bg-canvas' })
    }

    module.exports = {
      WEBGL_VS,
      AtiFieldCanvas,
    }
    return module.exports
  },
})


// Open World · ati-view
window.__ModuleLoader__.load({
  id: 'dsh-open-world/ati-view',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React
    const C = require('dsh-open-world/constants')
    const { ATI_PRESETS, NODE_ZH, NODE_LAYOUT } = C
    const Shell = require('dsh-open-world/shell')
    const { sourceTag } = Shell
    const AtiLab = require('dsh-open-world/ati-lab')
    const { AtiStageRenderer } = AtiLab

    function Sparkline({ values, color, height = 24 }) {
      const w = 180
      const h = height
      const pts = values.length < 2 ? [0, values[0] || 0] : values
      const min = Math.min(...pts)
      const max = Math.max(...pts, min + 1)
      const d = pts.map((v, i) => {
        const x = (i / (pts.length - 1)) * w
        const y = h - ((v - min) / (max - min)) * (h - 4) - 2
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')
      return React.createElement('svg', { className: height > 28 ? 'ow-spark' : 'ow-load-wave', width: w, height: h, viewBox: `0 0 ${w} ${h}` },
        React.createElement('path', { d: `${d} L${w},${h} L0,${h} Z`, fill: color, opacity: 0.12 }),
        React.createElement('path', { d, fill: 'none', stroke: color, strokeWidth: 1.2, opacity: 0.9 }),
      )
    }

    function SectorRadar({ nodes }) {
      const vals = (nodes || []).filter((n) => n.id !== 'core').slice(0, 5).map((n) => n.metric)
      while (vals.length < 5) vals.push(50)
      const cx = 100; const cy = 60; const r = 48
      const pts = vals.map((v, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        const rr = (v / 100) * r
        return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`
      }).join(' ')
      const rings = [0.25, 0.5, 0.75, 1].map((f) => React.createElement('circle', {
        key: f, cx, cy, r: r * f, fill: 'none', stroke: 'rgba(94,234,212,.1)', strokeWidth: 1,
      }))
      const axes = vals.map((_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        return React.createElement('line', {
          key: i, x1: cx, y1: cy, x2: cx + Math.cos(a) * r, y2: cy + Math.sin(a) * r,
          stroke: 'rgba(94,234,212,.15)', strokeWidth: 1,
        })
      })
      return React.createElement('svg', { className: 'ow-radar', viewBox: '0 0 200 120' },
        rings, axes,
        React.createElement('polygon', { points: pts, fill: 'rgba(94,234,212,.15)', stroke: '#5eead4', strokeWidth: 1 }),
      )
    }

    function ArchifyEmbed({ url, title, onClose }) {
      if (!url) return null
      return React.createElement('div', { className: 'ow-archify-embed' },
        React.createElement('div', { className: 'ow-archify-head' },
          React.createElement('span', null, title || 'Archify 架构图'),
          React.createElement('button', { type: 'button', className: 'ow-msg-btn', onClick: onClose }, '关闭'),
        ),
        React.createElement('iframe', { className: 'ow-archify-frame', src: url, title: title || 'archify' }),
      )
    }

    function AtiCortex({ nodes, synapses, ati, selected, onSelect, tick, onActivate, preset, onPresetChange, pulseBoost, lab }) {
      const W = 920
      const H = 600
      const cx = 460
      const cy = 300
      const nodeMap = useMemo(() => Object.fromEntries((nodes || []).map((n) => [n.id, n])), [nodes])
      const pulseMul = pulseBoost && pulseBoost > Date.now() - 4000 ? 2.5 : 1
      const emphasis = preset || 'ati-unified'
      const presetDef = ATI_PRESETS.find((p) => p.id === emphasis) || ATI_PRESETS[0]
      const labFocus = ['ml-gradient', 'deep-attention', 'molecular-graph', 'periodic-lattice', 'ati-evolution'].includes(emphasis)
      const topologyFocus = ['manifold-torus', 'manifold-mobius', 'manifold-klein', 'poincare-disk'].includes(emphasis)
      const showCommonCore = !topologyFocus && emphasis !== 'ati-evolution'
      const organDim = labFocus || topologyFocus

      const organPos = useMemo(() => ({
        core: { x: cx, y: cy },
        'ai-engine': { x: cx - 60, y: cy - 80 },
        memory: { x: cx + 130, y: cy - 40 },
        'task-board': { x: cx + 90, y: cy + 70 },
        storage: { x: cx - 100, y: cy + 90 },
        network: { x: cx - 150, y: cy - 20 },
        'user-hub': { x: cx - 180, y: cy - 100 },
        analytics: { x: cx + 20, y: cy + 110 },
        security: { x: cx + 150, y: cy + 30 },
        runtime: { x: cx - 40, y: cy + 130 },
      }), [cx, cy])

      const edges = useMemo(() => (synapses || []).map((s) => {
        const a = organPos[s.from] || { x: cx, y: cy }
        const b = organPos[s.to] || { x: cx, y: cy }
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2 - 30
        const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
        const speed = (0.015 + s.weight * 0.025) * pulseMul
        const t = (tick * speed) % 1
        const u = 1 - t
        const pulse = { x: u * u * a.x + 2 * u * t * mx + t * t * b.x, y: u * u * a.y + 2 * u * t * my + t * t * b.y }
        const color = NODE_LAYOUT[s.from]?.color || '#a78bfa'
        return { ...s, d, pulse, color }
      }), [synapses, organPos, tick, pulseMul, cx, cy])

      const metrics = ati || {}
      const ml = (lab && lab.ml) || {}
      const dl = (lab && lab.dl) || {}
      const chem = (lab && lab.chemistry) || {}
      const evo = (lab && lab.evolution) || null
      const topo = (lab && lab.topology) || null
      const groupClass = presetDef.group === '拓扑'
        ? 'g-top'
        : (presetDef.group === 'ML' || presetDef.group === 'DL')
          ? 'g-ml'
          : presetDef.group === '化学'
            ? 'g-chem'
            : ''

      const hudLine2 = emphasis === 'ml-gradient'
        ? `loss = ${ml.loss ?? '—'} · acc = ${ml.accuracy ?? '—'}% · lr = ${ml.lr ?? '—'}`
        : emphasis === 'deep-attention'
          ? `heads = ${dl.heads ?? 8} · depth = ${dl.depth ?? '—'} · T = ${dl.temperature ?? '—'}`
          : emphasis === 'molecular-graph'
            ? `ΔG = ${chem.freeEnergy ?? '—'} kJ/mol · ΔS = ${chem.entropy ?? '—'} J/K`
            : emphasis === 'periodic-lattice'
              ? `轨道能 = ${chem.orbitalEnergy ?? '—'} eV · 反应速率 k = ${chem.reactionRate ?? '—'}`
              : emphasis === 'ati-evolution'
                ? `ATI readiness = ${evo ? evo.readiness : '—'} · ${evo ? evo.stage.label : '—'}`
                : topo
                  ? `${topo.activeLabel} · g = ${topo.genus} · χ = ${topo.eulerCharacteristic} · ${topo.orientable ? '可定向' : '不可定向'}`
                  : `β = [${(metrics.bettiNumbers || [1, 1, 0]).join(', ')}]  ·  genus = ${metrics.topologyGenus ?? 1}`

      return React.createElement('div', { className: 'ow-ati-wrap' },
        React.createElement('div', { className: 'ow-ati-title' },
          `A · T · I   ${presetDef.sub.split('·')[0].trim()}`,
          sourceTag(presetDef.group === 'ML' || presetDef.group === 'DL' || presetDef.group === '化学' || presetDef.group === '拓扑'
            ? 'metaphor'
            : 'derived'),
        ),
        React.createElement('div', { className: 'ow-ati-sub' }, `ARTIFICIAL TOPOLOGICAL INTELLIGENCE · ${presetDef.group || 'ATI'}`),
        React.createElement('div', { className: 'ow-ati-hud' },
          React.createElement('div', null,
            React.createElement('b', null, 'κ'), ` = ${metrics.manifoldCurvature ?? '—'}  ·  `,
            React.createElement('b', null, '‖∇L‖'), ` = ${metrics.gradientNorm ?? '—'}`,
            sourceTag(metrics.source || 'derived'),
          ),
          React.createElement('div', null, hudLine2),
          React.createElement('div', null, `heads = ${metrics.attentionHeads ?? 8} · bonds = ${metrics.molecularBonds ?? 0} · stage = ${metrics.atiStage ?? '—'}`),
        ),
        evo && React.createElement('div', { className: 'ow-ati-stage-tag' },
          React.createElement('div', null, 'ATI READINESS'),
          React.createElement('div', null, React.createElement('b', null, `${evo.readiness} / 100`)),
          React.createElement('div', null, `${evo.stage.zh} · ${evo.stage.sub}`),
        ),
        React.createElement('svg', { className: 'ow-ati-svg', viewBox: `0 0 ${W} ${H}` },
          React.createElement('defs', null,
            React.createElement('radialGradient', { id: 'owAtiCore' },
              React.createElement('stop', { offset: '0%', stopColor: '#fff', stopOpacity: 0.9 }),
              React.createElement('stop', { offset: '40%', stopColor: '#a78bfa', stopOpacity: 0.5 }),
              React.createElement('stop', { offset: '100%', stopColor: '#5eead4', stopOpacity: 0 }),
            ),
            React.createElement('filter', { id: 'owAtiGlow' },
              React.createElement('feGaussianBlur', { stdDeviation: 4, result: 'b' }),
              React.createElement('feMerge', null,
                React.createElement('feMergeNode', { in: 'b' }),
                React.createElement('feMergeNode', { in: 'SourceGraphic' }),
              ),
            ),
            React.createElement('marker', {
              id: 'owLabArrow', markerWidth: 8, markerHeight: 8,
              refX: 6, refY: 3, orient: 'auto', markerUnits: 'strokeWidth',
            },
              React.createElement('path', { d: 'M0,0 L6,3 L0,6 z', fill: '#5eead4' }),
            ),
          ),
          React.createElement(AtiStageRenderer, {
            preset: emphasis, tick, W, H, cx, cy, nodeMap, lab,
          }),
          Array.from({ length: 24 }).map((_, i) => React.createElement('rect', {
            key: `bar-${i}`,
            x: 180 + i * 28, y: H - 36,
            width: 8 + (i % 3) * 4,
            height: 4 + (metrics.bettiNumbers && metrics.bettiNumbers[i % 3] ? metrics.bettiNumbers[i % 3] * 6 : 8),
            className: 'ow-ati-bar',
            opacity: organDim ? 0.12 : 0.3 + (i % 5) * 0.1,
          })),
          edges.map((e) => React.createElement('g', { key: `${e.from}-${e.to}`, opacity: organDim ? 0.3 : 1 },
            React.createElement('path', {
              d: e.d, fill: 'none', stroke: e.color,
              strokeWidth: e.active ? 2 : 1,
              strokeOpacity: 0.2 + e.weight * 0.6,
            }),
            e.active && React.createElement('circle', {
              cx: e.pulse.x, cy: e.pulse.y, r: 4,
              fill: e.color, opacity: 0.85, className: 'ow-nn-pulse',
            }),
          )),
          showCommonCore && React.createElement('g', { className: 'ow-ati-singularity' },
            React.createElement('circle', { cx, cy, r: 55 + Math.sin(tick * 0.04) * 4, fill: 'url(#owAtiCore)', opacity: 0.35 }),
            React.createElement('circle', { cx, cy, r: 28, fill: 'none', stroke: '#fff', strokeWidth: 1.5, opacity: 0.6 }),
            React.createElement('circle', { cx, cy, r: 10, fill: '#fff', filter: 'url(#owAtiGlow)' }),
            React.createElement('text', {
              x: cx, y: cy - 42, textAnchor: 'middle', fill: '#e9d5ff',
              fontSize: 11, fontFamily: 'Consolas,monospace', letterSpacing: 4,
            }, 'ATI CORE'),
          ),
          React.createElement('g', { opacity: organDim ? 0.34 : 1 },
            Object.entries(organPos).map(([id, pos]) => {
              const node = nodeMap[id]
              if (!node || id === 'core') return null
              const layout = NODE_LAYOUT[id] || { color: node.color || '#5eead4', en: id }
              const sel = selected === id
              const offline = node.status === 'offline' || node.status === 'missing'
              const stroke = offline ? '#64748b' : layout.color
              const fill = offline ? '#33415566' : `${layout.color}44`
              return React.createElement('g', {
                key: id,
                className: `ow-nn-node${offline ? ' ow-nn-offline' : ''}`,
                opacity: offline ? 0.48 : 1,
                onClick: () => onSelect(id),
                onDoubleClick: (ev) => {
                  ev.stopPropagation()
                  if (!node.action) return
                  if (offline) {
                    // 灰态：只选中，由详情卡「如何启用」处理；禁止空壳进场
                    onSelect(id)
                    return
                  }
                  onActivate(node.action)
                },
              },
                React.createElement('circle', {
                  cx: pos.x, cy: pos.y, r: sel ? 14 : 11,
                  fill, stroke, strokeWidth: sel ? 2.5 : 1,
                  strokeDasharray: offline ? '3 3' : undefined,
                  filter: sel && !offline ? 'url(#owAtiGlow)' : undefined,
                }),
                React.createElement('text', {
                  x: pos.x, y: pos.y - 18, textAnchor: 'middle',
                  fill: offline ? '#94a3b8' : '#e6f1ff', fontSize: 9,
                }, NODE_ZH[id] || node.label),
                React.createElement('text', {
                  x: pos.x, y: pos.y + 24, textAnchor: 'middle', className: 'ow-ati-metric',
                  fill: offline ? '#64748b' : undefined,
                }, offline ? '未启用' : `${node.metric}%`),
              )
            }),
          ),
        ),
        React.createElement('div', { className: 'ow-ati-preset-bar' },
          React.createElement('button', {
            type: 'button',
            className: `ow-ati-preset ${(!preset || preset === 'ati-unified') ? 'on' : ''}`,
            onClick: () => onPresetChange('ati-unified'),
            title: '主视图 · 点节点干活',
          }, '统一场'),
          React.createElement('details', { className: 'ow-ati-lab-details' },
            React.createElement('summary', {
              className: 'ow-ati-preset',
              title: '隐喻实验室 · 可选壁纸式预设',
            }, '实验室'),
            React.createElement('div', { className: 'ow-ati-lab-presets' },
              ATI_PRESETS.filter((p) => p.id !== 'ati-unified').map((p) => React.createElement('button', {
                key: p.id, type: 'button',
                className: `ow-ati-preset ${groupClassForPreset(p)} ${preset === p.id ? 'on' : ''}`,
                onClick: () => onPresetChange(p.id),
                title: `${p.group} · ${p.sub}（隐喻）`,
              }, p.label)),
            ),
          ),
        ),
      )
    }

    function groupClassForPreset(p) {
      if (p.group === '拓扑') return 'g-top'
      if (p.group === 'ML' || p.group === 'DL') return 'g-ml'
      if (p.group === '化学') return 'g-chem'
      return ''
    }

    function ResourceDonut({ nodes }) {
      const items = (nodes || []).filter((n) => n.id !== 'core').slice(0, 5)
      const total = items.reduce((s, n) => s + n.metric, 0) || 1
      const radius = 48
      const circumference = 2 * Math.PI * radius
      let offset = 0
      return React.createElement('div', { className: 'ow-donut-wrap' },
        React.createElement('div', { className: 'ow-donut' },
          React.createElement('svg', { viewBox: '0 0 120 120' },
            items.map((item) => {
              const layout = NODE_LAYOUT[item.id] || { color: '#5eead4' }
              const dash = (item.metric / total) * circumference
              const el = React.createElement('circle', {
                key: item.id, cx: 60, cy: 60, r: radius, fill: 'none',
                stroke: layout.color, strokeWidth: 6,
                strokeDasharray: `${dash} ${circumference - dash}`,
                strokeDashoffset: -offset, strokeLinecap: 'butt',
              })
              offset += dash
              return el
            }),
          ),
          React.createElement('div', { className: 'ow-donut-center' },
            React.createElement('span', { className: 'ow-donut-total' }, total),
            React.createElement('span', { className: 'ow-donut-label' }, '总资源'),
          ),
        ),
        React.createElement('div', { className: 'ow-res-list' },
          items.map((item) => {
            const layout = NODE_LAYOUT[item.id] || { color: '#5eead4' }
            const pct = Math.round((item.metric / total) * 100)
            return React.createElement('div', { key: item.id, className: 'ow-res-item' },
              React.createElement('span', { className: 'ow-res-dot', style: { background: layout.color, boxShadow: `0 0 4px ${layout.color}` } }),
              React.createElement('span', { className: 'ow-res-name' }, NODE_ZH[item.id] || item.label),
              React.createElement('span', { className: 'ow-res-val' }, item.metric),
              React.createElement('span', { className: 'ow-res-pct' }, `(${pct}%)`),
            )
          }),
        ),
      )
    }

    module.exports = {
      Sparkline,
      SectorRadar,
      ArchifyEmbed,
      AtiCortex,
      groupClassForPreset,
      ResourceDonut,
    }
    return module.exports
  },
})


// Open World · chrome
window.__ModuleLoader__.load({
  id: 'dsh-open-world/chrome',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React
    const C = require('dsh-open-world/constants')
    const { APP_SURFACES, NODE_ZH, NODE_LAYOUT } = C
    const Shell = require('dsh-open-world/shell')
    const { EmbeddedAppSurface } = Shell

    function iconSvg(name, size = 20) {
      const paths = {
        plus: ['M3 3h18v18H3z', 'M12 8v8', 'M8 12h8'],
        diagnosis: ['M22 12h-4l-3 9L9 3l-3 9H2'],
        scan: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
        backup: ['M2 7h20v14H2z', 'M16 3l-4 4-4-4'],
        network: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20'],
        config: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
        monitor: ['M2 3h20v14H2z', 'M8 21h8', 'M12 17v4'],
        galaxy: ['M12 2a10 10 0 0 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20'],
        neural: ['M5 12a7 7 0 0 1 14 0', 'M12 5v14', 'M8 8l8 8', 'M16 8l-8 8'],
        topology: ['M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M19 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
        ati: ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
      }
      const d = paths[name]
      if (!d) return null
      return React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        d.map((seg, i) => React.createElement('path', { key: i, d: seg })),
      )
    }

    function Panel({ titleZh, titleEn, more, icon, children, last }) {
      return React.createElement('div', { className: 'ow-panel', style: last ? { marginBottom: 0 } : undefined },
        React.createElement('div', { className: 'ow-panel-head' },
          React.createElement('div', { className: 'ow-panel-title' },
            React.createElement('span', { className: 'ow-panel-title-zh' }, titleZh),
            React.createElement('span', { className: 'ow-panel-title-en' }, titleEn),
          ),
          more ? React.createElement('span', { className: 'ow-panel-more' }, more) : iconSvg(icon),
        ),
        React.createElement('div', { className: 'ow-panel-body' }, children),
      )
    }

    function exportSvgPng(svgEl, filename = 'nexora-topology.png') {
      if (!svgEl) return
      const clone = svgEl.cloneNode(true)
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      const svgData = new XMLSerializer().serializeToString(clone)
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = svgEl.viewBox.baseVal.width || 860
        canvas.height = svgEl.viewBox.baseVal.height || 560
        const ctx2d = canvas.getContext('2d')
        ctx2d.fillStyle = '#05070d'
        ctx2d.fillRect(0, 0, canvas.width, canvas.height)
        ctx2d.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        canvas.toBlob((png) => {
          if (!png) return
          const a = document.createElement('a')
          a.href = URL.createObjectURL(png)
          a.download = filename
          a.click()
          URL.revokeObjectURL(a.href)
        })
      }
      img.src = url
    }

    function useViewport() {
      const [vp, setVp] = useState({ x: 0, y: 0, scale: 1 })
      const panRef = useRef(null)
      const onWheel = useCallback((ev) => {
        ev.preventDefault()
        const delta = ev.deltaY > 0 ? 0.92 : 1.08
        setVp((v) => ({ ...v, scale: Math.max(0.35, Math.min(2.8, v.scale * delta)) }))
      }, [])
      const onBgPointerDown = useCallback((ev) => {
        if (ev.button !== 0) return
        panRef.current = { x: ev.clientX, y: ev.clientY, ox: vp.x, oy: vp.y }
      }, [vp.x, vp.y])
      const onBgPointerMove = useCallback((ev) => {
        if (!panRef.current) return
        const dx = ev.clientX - panRef.current.x
        const dy = ev.clientY - panRef.current.y
        setVp((v) => ({ ...v, x: panRef.current.ox + dx, y: panRef.current.oy + dy }))
      }, [])
      const onBgPointerUp = useCallback(() => { panRef.current = null }, [])
      const reset = useCallback(() => setVp({ x: 0, y: 0, scale: 1 }), [])
      return { vp, onWheel, onBgPointerDown, onBgPointerMove, onBgPointerUp, reset }
    }

    function ViewportWrap({ vp, onWheel, onBgPointerDown, onBgPointerMove, onBgPointerUp, children, showBg }) {
      return React.createElement('div', {
        className: 'ow-vp-wrap',
        onWheel,
        onPointerDown: (ev) => {
          if (ev.target.closest && ev.target.closest('.ow-nn-node')) return
          onBgPointerDown(ev)
        },
        onPointerMove: onBgPointerMove,
        onPointerUp: onBgPointerUp,
        onPointerLeave: onBgPointerUp,
      },
        showBg && React.createElement('div', { className: 'ow-vp-bg' },
          React.createElement(DeepSpaceCanvas, { active: true }),
        ),
        React.createElement('div', {
          className: 'ow-vp-inner',
          style: { transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})` },
        }, children),
      )
    }

    function CommandPalette({ open, query, setQuery, items, selIdx, onSelect, onClose }) {
      const inputRef = useRef(null)
      useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus()
      }, [open])
      if (!open) return null
      return React.createElement('div', {
        className: 'ow-cmd-overlay',
        onClick: (ev) => { if (ev.target.className === 'ow-cmd-overlay') onClose() },
      },
        React.createElement('div', { className: 'ow-cmd' },
          React.createElement('input', {
            ref: inputRef,
            className: 'ow-cmd-input',
            placeholder: '搜索器官 / 插件 / 任务 / 操作…',
            value: query,
            onChange: (ev) => setQuery(ev.target.value),
            onKeyDown: (ev) => {
              if (ev.key === 'Escape') onClose()
              if (ev.key === 'Enter' && items[selIdx]) onSelect(items[selIdx])
            },
          }),
          React.createElement('div', { className: 'ow-cmd-list' },
            items.length === 0
              ? React.createElement('div', { className: 'ow-cmd-item' }, '无匹配项')
              : items.map((it, i) => React.createElement('div', {
                key: it.id,
                className: `ow-cmd-item ${i === selIdx ? 'sel' : ''}`,
                onClick: () => onSelect(it),
              },
                React.createElement('span', null, it.label),
                React.createElement('span', null, it.kind),
              )),
          ),
        ),
      )
    }

    function EmbeddedTaskPanel({ tasks, onRun, onCreate, onClose }) {
      return React.createElement(EmbeddedAppSurface, {
        panel: 'task-board',
        tasks,
        onRunTask: onRun,
        onCreateTask: onCreate,
        onClose,
      })
    }

    function renderEmbedSurface(embed, props) {
      if (!embed) return null
      return React.createElement(EmbeddedAppSurface, {
        panel: embed,
        tasks: props.tasks,
        snapshot: props.snapshot,
        plugins: props.plugins,
        hub: props.hub,
        memory: props.memory,
        onClose: () => props.setEmbed(null),
        onAction: props.runBridge,
        onRunTask: (taskId) => props.runBridge({ type: 'task-run', taskId, inline: true }),
        onCreateTask: () => props.runBridge({ type: 'task-create', title: '开放世界 · 新任务', inline: true }),
      })
    }

    function enterActionLabel(action, node) {
      if (node && node.status === 'offline' && node.howToEnable) return '如何启用'
      if (!action) return '进入'
      if (action.type === 'close') return action.label || '返回会话'
      if (action.type === 'idea-panel') return '打开 IDEA'
      const title = (action.panel && APP_SURFACES[action.panel] && APP_SURFACES[action.panel].title)
        || String(action.label || '').replace(/^进入\s*/, '')
      return `进入 · ${title}`
    }

    function formatUsageMoney(balance) {
      if (!balance || balance.balance == null) return '—'
      const symbol = balance.currency === 'USD' ? '$' : '¥'
      return `${symbol}${Number(balance.balance).toFixed(2)}`
    }

    function NodeDetailCard({ node, synapses, events, usage, onAction, onClose, onOfflineHint }) {
      if (!node) return null
      const layout = NODE_LAYOUT[node.id] || { en: node.label, color: node.color || '#5eead4' }
      const edgeCount = synapses.filter((s) => s.from === node.id || s.to === node.id).length
      const related = events.filter((e) => (e.detail || '').includes(node.id) || (e.title || '').includes(NODE_ZH[node.id] || '')).slice(0, 3)
      const today = usage && usage.today
      const bal = usage && usage.balance
      const blocked = node.status === 'offline' && node.howToEnable
      return React.createElement('div', { className: 'ow-detail-card' },
        React.createElement('div', { className: 'ow-detail-title' }, NODE_ZH[node.id] || node.label),
        React.createElement('div', { className: 'ow-detail-sub' }, layout.en),
        React.createElement('div', { className: 'ow-detail-row' },
          React.createElement('span', null, '指标'), React.createElement('span', null, `${node.metric}%`)),
        React.createElement('div', { className: 'ow-detail-row' },
          React.createElement('span', null, '状态'), React.createElement('span', null, node.status)),
        React.createElement('div', { className: 'ow-detail-row' },
          React.createElement('span', null, '突触'), React.createElement('span', null, edgeCount)),
        React.createElement('div', { className: 'ow-detail-row' },
          React.createElement('span', null, '提示'), React.createElement('span', { style: { maxWidth: 120, textAlign: 'right' } }, node.hint || '—')),
        blocked && React.createElement('div', { className: 'ow-detail-row' },
          React.createElement('span', null, '启用'),
          React.createElement('span', { style: { maxWidth: 140, textAlign: 'right', color: '#fbbf24', fontSize: 10 } }, node.howToEnable)),
        node.id === 'ai-engine' && usage && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'ow-detail-row' },
            React.createElement('span', null, '余额'),
            React.createElement('span', null, formatUsageMoney(bal))),
          React.createElement('div', { className: 'ow-detail-row' },
            React.createElement('span', null, '今日消费'),
            React.createElement('span', null, today && today.cost != null
              ? formatUsageMoney({ balance: today.cost, currency: bal && bal.currency })
              : '—')),
          React.createElement('div', { className: 'ow-detail-row' },
            React.createElement('span', null, '今日 Token'),
            React.createElement('span', null, today && today.tokens != null
              ? Number(today.tokens).toLocaleString('zh-CN')
              : '—')),
          React.createElement('div', { className: 'ow-detail-row' },
            React.createElement('span', null, '今日请求'),
            React.createElement('span', null, today && today.requests != null
              ? Number(today.requests).toLocaleString('zh-CN')
              : '—')),
        ),
        related.length > 0 && React.createElement('div', { style: { marginTop: 8, fontSize: 10, color: '#7c8ea6' } },
          related.map((e) => React.createElement('div', { key: e.id }, e.title))),
        React.createElement('div', { className: 'ow-detail-actions' },
          node.action && React.createElement('button', {
            type: 'button',
            onClick: () => {
              if (blocked && onOfflineHint) onOfflineHint(node.howToEnable)
              else onAction(node.action)
            },
          }, blocked ? '如何启用' : enterActionLabel(node.action, node)),
          React.createElement('button', { type: 'button', onClick: onClose }, '收起'),
        ),
      )
    }

    module.exports = {
      iconSvg,
      Panel,
      exportSvgPng,
      useViewport,
      ViewportWrap,
      CommandPalette,
      EmbeddedTaskPanel,
      renderEmbedSurface,
      enterActionLabel,
      formatUsageMoney,
      NodeDetailCard,
    }
    return module.exports
  },
})


// Open World · app-layout（左栏 / 中区 / 右栏，从 client-main 抽出）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/app-layout',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const C = require('dsh-open-world/constants')
    const Shell = require('dsh-open-world/shell')
    const Idea = require('dsh-open-world/idea')
    const Hubs = require('dsh-open-world/hubs')
    const AtiView = require('dsh-open-world/ati-view')
    const Chrome = require('dsh-open-world/chrome')
    const Runtime = require('dsh-open-world/runtime')

    const { NODE_ZH, NODE_LAYOUT, EVENT_COLORS, QUICK_ACTIONS } = C
    const {
      BridgeHealthBar, ShellGuide, EnterWorldCta, ActionsEmptyState, EventsEmptyState, MemoryHub, StatusSummaryChips, LeftSidebarTabs,
      SocialPanel, IntegrationsPanel, pluginAction, socialChannelAction,
      tierBadge, FleetPanel, sourceTag,
    } = Shell
    const { IdeaLabWorkspace } = Idea
    const { MessageHub, IntegrationsHub, RewindTimelinePanel } = Hubs
    const { Sparkline, ArchifyEmbed, AtiCortex, ResourceDonut } = AtiView
    const {
      iconSvg, Panel, ViewportWrap, renderEmbedSurface, enterActionLabel, NodeDetailCard,
    } = Chrome
    const { taskProgress } = Runtime

    function LeftRail({
      leftTab, onLeftTab,
      snapshot, plugins, hist, health, healthCirc, loadRows, nodes,
      bridgeHealth, setBridgeHealth, checkBridgeCapabilities,
      runBridge, setEmbed, setToast,
      hub, handleEmbedArchify,
      events, social,
      mailbox, handleSendMessage, handleMarkRead, handleShareSnapshot,
      handleInjectAgent, handleSearchMemory,
    }) {
      return React.createElement('div', { className: 'ow-side ow-side-left' },
                    React.createElement(ShellGuide, null),
                    React.createElement(LeftSidebarTabs, { tab: leftTab, onTab: onLeftTab }),
                    leftTab === 'status' && React.createElement(React.Fragment, null,
                      React.createElement(Panel, { titleZh: '现在怎样', titleEn: 'STATUS', icon: 'diagnosis' },
                        React.createElement('div', { className: 'ow-health-wrap' },
                          React.createElement('div', { className: 'ow-health-ring' },
                            React.createElement('svg', { viewBox: '0 0 120 120' },
                              React.createElement('defs', null,
                                React.createElement('linearGradient', { id: 'owHealthGrad', x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
                                  React.createElement('stop', { offset: '0%', stopColor: '#bfe38e' }),
                                  React.createElement('stop', { offset: '100%', stopColor: '#5eead4' }),
                                ),
                              ),
                              React.createElement('circle', { cx: 60, cy: 60, r: 48, fill: 'none', stroke: 'rgba(94,234,212,.1)', strokeWidth: 3 }),
                              React.createElement('circle', {
                                cx: 60, cy: 60, r: 48, fill: 'none', stroke: 'url(#owHealthGrad)', strokeWidth: 3,
                                strokeLinecap: 'round', strokeDasharray: `${healthCirc} ${2 * Math.PI * 48}`,
                              }),
                            ),
                            React.createElement('div', { className: 'ow-health-center' },
                              React.createElement('span', { className: 'ow-health-val' }, health),
                              React.createElement('span', { className: 'ow-health-unit' }, '/ 100'),
                            ),
                          ),
                        ),
                        React.createElement('div', { className: 'ow-health-label' },
                          React.createElement('div', { className: 'ow-health-label-main' },
                            '整体健康度',
                            sourceTag((snapshot && snapshot.core && snapshot.core.healthScoreSource) || 'derived'),
                          ),
                          React.createElement('div', { className: 'ow-health-label-sub' }, 'HEALTH SCORE'),
                        ),
                        React.createElement(Sparkline, { values: hist.health, color: '#5eead4', height: 36 }),
                        React.createElement(StatusSummaryChips, { snapshot, plugins }),
                        React.createElement(EnterWorldCta, {
                          worlds: snapshot && snapshot.worlds,
                          worldPacks: snapshot && snapshot.worldPacks,
                          onEnter: (w) => runBridge({
                            type: 'enter-world',
                            worldId: (w && w.id) || 'tasks',
                            panel: (w && w.panel) || 'task-board',
                            label: (w && w.titleFull) ? `已进入${w.titleFull}` : '已进入任务世界',
                          }),
                          onOffline: (w) => setToast((w && w.howToEnable) || '任务扩展未在线'),
                        }),
                        React.createElement(BridgeHealthBar, {
                          health: bridgeHealth,
                          onRefresh: () => {
                            const results = checkBridgeCapabilities()
                            setBridgeHealth(results)
                          },
                        }),
                      ),
                      React.createElement(Panel, { titleZh: '进行中', titleEn: 'RUNNING', icon: 'network' },
                        React.createElement(FleetPanel, {
                          fleet: snapshot && snapshot.fleet,
                          onAction: runBridge,
                          compact: true,
                        }),
                        React.createElement('button', {
                          type: 'button',
                          className: 'ow-neural-btn',
                          style: { marginTop: 8 },
                          onClick: () => setEmbed('fleet'),
                        }, '展开列表'),
                      ),
                      React.createElement(Panel, { titleZh: '实时负载', titleEn: 'REAL-TIME LOAD', icon: 'diagnosis', last: true },
                        loadRows.map((row) => React.createElement('div', { key: row.key, className: 'ow-load-item' },
                          React.createElement('span', { className: 'ow-load-label' }, row.key),
                          React.createElement(Sparkline, { values: row.hist, color: row.color }),
                          React.createElement('span', { className: 'ow-load-val' }, row.val),
                        )),
                      ),
                    ),
                    leftTab === 'actions' && React.createElement(React.Fragment, null,
                      React.createElement(ActionsEmptyState, {
                        plugins,
                        onIdea: () => runBridge({ type: 'idea-panel' }),
                        onTasks: () => runBridge({ type: 'enter-world', worldId: 'tasks', panel: 'task-board', label: '已进入任务世界' }),
                        onRewind: () => runBridge({ type: 'enter-world', worldId: 'rewind', panel: 'rewind', label: '已进入回退世界' }),
                      }),
                      React.createElement(Panel, { titleZh: '扩展', titleEn: 'EXTENSIONS', icon: 'config' },
                        React.createElement(IntegrationsPanel, {
                          plugins,
                          onActivate: (p) => runBridge(pluginAction(p)),
                          onOffline: (p) => setToast(p.howToEnable || p.hint || `${p.title} 未在线`),
                        }),
                      ),
                      React.createElement(Panel, { titleZh: '更多', titleEn: 'MORE', icon: 'network' },
                        React.createElement(IntegrationsHub, {
                          hub,
                          space: snapshot && snapshot.space,
                          onAction: runBridge,
                          onEmbedArchify: handleEmbedArchify,
                          onToast: setToast,
                        }),
                      ),
                      React.createElement(Panel, { titleZh: '对话回退', titleEn: 'REWIND', icon: 'backup' },
                        React.createElement(RewindTimelinePanel, {
                          rewind: snapshot && snapshot.rewind,
                          plugins,
                          onAction: runBridge,
                          onToast: setToast,
                          compact: true,
                        }),
                      ),
                      React.createElement(Panel, { titleZh: '说话风格', titleEn: 'PERSONA', icon: 'config', last: true },
                        React.createElement('div', { className: 'ow-hub', style: { fontSize: 11, color: '#94a3b8', lineHeight: 1.55 } },
                          React.createElement('div', null, '加一段人格前缀，再发到官方聊天里试一句。'),
                          React.createElement('div', { style: { marginTop: 4, color: '#64748b' } },
                            '不会真的换掉 Agent；完整面板只在中间打开一次。'),
                          React.createElement('button', {
                            type: 'button',
                            className: 'ow-neural-btn',
                            style: { marginTop: 10 },
                            onClick: () => runBridge({ type: 'idea-panel' }),
                          }, '打开风格面板'),
                        ),
                      ),
                    ),
                    leftTab === 'events' && React.createElement(React.Fragment, null,
                      React.createElement(Panel, { titleZh: '记忆', titleEn: 'MEMORY', icon: 'backup' },
                        React.createElement(MemoryHub, {
                          memory: snapshot && snapshot.memory,
                          onToast: setToast,
                          onSearchMemory: handleSearchMemory,
                        }),
                      ),
                      React.createElement(Panel, { titleZh: '系统事件', titleEn: 'EVENTS', icon: 'diagnosis' },
                        React.createElement(EventsEmptyState, { events }),
                        React.createElement('div', { className: 'ow-event-list' },
                          events.slice(0, 10).map((ev, i) => React.createElement('div', { key: ev.id, className: 'ow-event-item' },
                            React.createElement('span', { className: `ow-event-dot ${EVENT_COLORS[i % EVENT_COLORS.length]}` }),
                            tierBadge(ev.tier),
                            React.createElement('span', { className: 'ow-event-text', title: ev.detail || ev.title }, ev.title),
                            React.createElement('span', { className: 'ow-event-time' },
                              new Date(ev.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                            ),
                          )),
                        ),
                      ),
                      React.createElement('details', { className: 'ow-adv-fold', style: { margin: '0 0 8px' } },
                        React.createElement('summary', {
                          style: { fontSize: 11, color: '#7c8ea6', cursor: 'pointer', padding: '6px 0' },
                        }, '高级 · 社交层'),
                        React.createElement(Panel, { titleZh: '社交层', titleEn: 'SOCIAL', icon: 'network' },
                          React.createElement(SocialPanel, {
                            social,
                            onChannel: (id) => runBridge(socialChannelAction(id)),
                            onSession: (p) => runBridge({ type: 'session-focus', sessionId: p.id, label: '切换会话' }),
                          }),
                        ),
                      ),
                      React.createElement(Panel, { titleZh: '消息总线', titleEn: 'MESSAGES', icon: 'network', last: true },
                        React.createElement(MessageHub, {
                          mailbox: mailbox || (snapshot && snapshot.mailbox),
                          hub,
                          onSend: handleSendMessage,
                          onRead: handleMarkRead,
                          onShare: handleShareSnapshot,
                          onInjectAgent: handleInjectAgent,
                          onSearchMemory: handleSearchMemory,
                        }),
                      ),
                    ),
                  )
    }

    function CenterStage({
      view, setView,
      idea, handleIdeaInject, handleIdeaCompare, runBridge,
      viewport, nodes, synapses, ati, selected, setSelected, tick,
      atiPreset, onAtiPresetChange, pulseBoost, lab,
      archifyEmbed, setArchifyEmbed,
      detailOpen, setDetailOpen, selectedNode, selectedAction, activateSelectedAction,
      events, usage, embed, setEmbed, tasks, snapshot, plugins, hub, setToast, taskState,
    }) {
      return React.createElement('div', { className: 'ow-center' },
                    view === 'idea' && React.createElement(IdeaLabWorkspace, {
                      idea,
                      compact: false,
                      onInject: handleIdeaInject,
                      onCompare: handleIdeaCompare,
                      onAction: runBridge,
                    }),
                    view === 'ati' && React.createElement(React.Fragment, null,
                      React.createElement(ViewportWrap, {
                        vp: viewport.vp,
                        onWheel: viewport.onWheel,
                        onBgPointerDown: viewport.onBgPointerDown,
                        onBgPointerMove: viewport.onBgPointerMove,
                        onBgPointerUp: viewport.onBgPointerUp,
                        showBg: false,
                      },
                        React.createElement(AtiCortex, {
                          nodes, synapses, ati, selected, onSelect: setSelected, tick,
                          onActivate: runBridge, preset: atiPreset, onPresetChange: onAtiPresetChange, pulseBoost, lab,
                        }),
                      ),
                      archifyEmbed && React.createElement(ArchifyEmbed, {
                        url: archifyEmbed.url,
                        title: archifyEmbed.title,
                        onClose: () => setArchifyEmbed(null),
                      }),
                      detailOpen && selectedNode && React.createElement(NodeDetailCard, {
                        node: selectedNode, synapses, events, usage, onAction: runBridge, onClose: () => setDetailOpen(false),
                        onOfflineHint: (msg) => setToast(msg),
                      }),
                      embed && renderEmbedSurface(embed, {
                        tasks, snapshot, plugins, hub, memory: snapshot && snapshot.memory, setEmbed, runBridge,
                      }),
                      selectedNode && React.createElement('div', { className: 'ow-orbit-hint' },
                        React.createElement('span', null, `ATI · ${NODE_ZH[selectedNode.id] || selectedNode.label} · ${selectedNode.metric}%`),
                        selectedAction && React.createElement('div', { className: 'ow-action-bar' },
                          React.createElement('button', { type: 'button', onClick: activateSelectedAction },
                            selectedNode.status === 'offline' && selectedNode.howToEnable
                              ? '如何启用'
                              : enterActionLabel(selectedAction, selectedNode)),
                          React.createElement('button', { type: 'button', className: 'sec', onClick: () => setView('monitor') }, 'JSON'),
                        ),
                      ),
                    ),
                    view === 'monitor' && React.createElement('div', { className: 'ow-monitor' },
                      React.createElement('pre', null, JSON.stringify({ snapshot, taskState }, null, 2)),
                    ),
                    view === 'topology' && React.createElement('div', { className: 'ow-topo' },
                      nodes.map((n) => React.createElement('div', {
                        key: n.id, className: 'ow-topo-card', onClick: () => setSelected(n.id),
                        onDoubleClick: () => {
                          if (n.status === 'offline' && n.howToEnable) setToast(n.howToEnable)
                          else if (n.action) runBridge(n.action)
                        },
                        style: { outline: selected === n.id ? '1px solid #5eead4' : 'none' },
                      },
                        React.createElement('strong', { style: { color: '#e6f1ff' } }, NODE_ZH[n.id] || n.label),
                        React.createElement('div', { style: { fontSize: 11, color: '#7c8ea6', marginTop: 4 } }, NODE_LAYOUT[n.id] && NODE_LAYOUT[n.id].en),
                        React.createElement('div', { style: { fontSize: 12, color: '#5eead4', marginTop: 6 } }, `${n.metric}% · ${n.status}`),
                      )),
                    ),
                  )
    }

    function RightRail({ nodes, tasks, runBridge }) {
      return React.createElement('div', { className: 'ow-side ow-side-right' },
                    React.createElement(Panel, { titleZh: '资源分布', titleEn: 'RESOURCE DISTRIBUTION', icon: 'galaxy' },
                      React.createElement(ResourceDonut, { nodes }),
                    ),
                    React.createElement(Panel, { titleZh: '任务队列', titleEn: 'TASK QUEUE', more: '更多 ›' },
                      React.createElement('div', { className: 'ow-task-list' },
                        tasks.length === 0
                          ? React.createElement('div', { style: { fontSize: 12, color: '#7c8ea6' } }, '暂无任务 · task-board 离线')
                          : tasks.slice(0, 5).map((t, i) => {
                            const pct = taskProgress(t)
                            const running = t.running || t.status === 'running'
                            return React.createElement('div', {
                              key: t.id, className: 'ow-task-item ow-clickable',
                              onClick: () => runBridge({ type: 'task-run', taskId: t.id }),
                              title: '点击运行任务',
                            },
                              React.createElement('div', { className: 'ow-task-head' },
                                tierBadge(t.tier),
                                React.createElement('span', { className: 'ow-task-name' }, t.title),
                                React.createElement('span', { className: `ow-task-status ${running ? 'running' : 'pending'}` },
                                  running ? '进行中' : '等待中'),
                                React.createElement('span', { className: 'ow-task-pct' }, `${pct}%`),
                              ),
                              React.createElement('div', { className: 'ow-task-bar' },
                                React.createElement('div', {
                                  className: `ow-task-fill ${running ? (i % 2 ? 'gold' : 'cyan') : 'dim'}`,
                                  style: { width: `${pct}%` },
                                }),
                              ),
                            )
                          }),
                      ),
                    ),
                    React.createElement(Panel, { titleZh: '快捷操作', titleEn: 'QUICK ACTIONS', icon: 'config', last: true },
                      React.createElement('div', { className: 'ow-actions' },
                        QUICK_ACTIONS.map((a) => React.createElement('button', {
                          key: a.label, type: 'button', className: 'ow-action-btn',
                          onClick: () => runBridge(a.action),
                        },
                          iconSvg(a.icon),
                          React.createElement('span', { className: 'ow-action-label' }, a.label),
                        )),
                      ),
                    ),
                  )
    }

    module.exports = { LeftRail, CenterStage, RightRail }
    return module.exports
  },
})


// Open World · portal（Trigger / BottomBar / PortalHost 工厂）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/portal',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useState, useEffect, useCallback, useRef } = React
    const C = require('dsh-open-world/constants')
    const Runtime = require('dsh-open-world/runtime')
    const Chrome = require('dsh-open-world/chrome')

    const {
      CLIENT_VER, WM_MODES, MESSAGES_URL, STREAM_URL,
    } = C
    const {
      readWmMode, readWmLastMode, persistWmMode,
      fetchWorldState, postWorldState, applyWorldLocalCaches,
    } = Runtime
    const { iconSvg } = Chrome

    function TriggerButton({ onOpen, unread }) {
      return React.createElement('div', { className: 'ow-trigger-wrap' },
        React.createElement('button', {
          type: 'button', className: 'ow-trigger', title: `开放世界 ${CLIENT_VER}`,
          'aria-label': `开放世界控制台 ${CLIENT_VER}`, onClick: onOpen,
        }, '✦'),
        unread > 0 && React.createElement('span', { className: 'ow-unread-badge' }, unread > 9 ? '9+' : unread),
      )
    }

    function BottomBar({
      logLine, deepSpace, setDeepSpace, view, setView, viewModes, load,
    }) {
      return React.createElement('div', { className: 'ow-bottom' },
        React.createElement('div', { className: 'ow-log-wrap' },
          React.createElement('div', { className: 'ow-log-head' },
            React.createElement('span', { className: 'ow-log-title' }, 'SYSTEM LOG'),
          ),
          React.createElement('div', { className: 'ow-log-line' },
            React.createElement('span', { className: 'ow-log-time' }, new Date().toLocaleTimeString('zh-CN')),
            React.createElement('span', null, logLine || 'System initializing…'),
            React.createElement('span', { className: 'ow-log-dot' }),
          ),
        ),
        React.createElement('div', { className: 'ow-view-switch' },
          React.createElement('div', { className: 'ow-deep-toggle' },
            React.createElement('span', { className: 'ow-deep-icon' }, '🌙'),
            React.createElement('div', { className: 'ow-deep-label' },
              React.createElement('span', { className: 'ow-deep-zh' }, '深空模式'),
              React.createElement('span', { className: 'ow-deep-en' }, 'DEEP SPACE MODE'),
            ),
            React.createElement('div', {
              className: `ow-deep-switch ${deepSpace ? 'on' : ''}`,
              onClick: () => setDeepSpace((v) => !v), role: 'switch',
            }),
          ),
          viewModes.map((mode) => React.createElement('button', {
            key: mode.id, type: 'button',
            className: `ow-view-btn ${view === mode.id ? 'on' : ''}`,
            onClick: () => setView(mode.id),
          },
            React.createElement('svg', { className: 'ow-view-hex', viewBox: '0 0 140 60' },
              React.createElement('polygon', { points: '15,0 125,0 140,30 125,60 15,60 0,30' }),
            ),
            React.createElement('div', { className: 'ow-view-content' },
              iconSvg(mode.icon),
              React.createElement('span', { className: 'ow-view-label' }, mode.label),
              React.createElement('span', { className: 'ow-view-sub' }, mode.sub),
            ),
          )),
        ),
        React.createElement('div', { className: 'ow-bottom-right' },
          React.createElement('div', { className: 'ow-metric', title: '进程堆内存（真实指标）' },
            React.createElement('div', { className: 'ow-metric-label' },
              React.createElement('span', { className: 'ow-metric-zh' }, '堆内存'),
              React.createElement('span', { className: 'ow-metric-en' }, 'HEAP'),
            ),
            React.createElement('div', { className: 'ow-metric-val' },
              Math.round((load && load.heapUsedMb) || 0),
              React.createElement('span', { className: 'u' }, 'MB'),
            ),
            React.createElement('div', { className: 'ow-metric-bar' },
              React.createElement('div', {
                className: 'ow-metric-fill',
                style: {
                  width: `${Math.min(95, ((load && load.heapUsedMb) || 0) / 4)}%`,
                  background: 'linear-gradient(to right,#5eead4,#bfe38e)',
                  boxShadow: '0 0 4px rgba(94,234,212,.4)',
                },
              }),
            ),
          ),
          React.createElement('div', { className: 'ow-metric', title: '进程常驻内存 RSS（真实指标）' },
            React.createElement('div', { className: 'ow-metric-label' },
              React.createElement('span', { className: 'ow-metric-zh' }, '常驻内存'),
              React.createElement('span', { className: 'ow-metric-en' }, 'RSS'),
            ),
            React.createElement('div', { className: 'ow-metric-val' },
              Math.round((load && load.rssMb) || 0),
              React.createElement('span', { className: 'u' }, 'MB'),
            ),
            React.createElement('div', { className: 'ow-metric-bar' },
              React.createElement('div', {
                className: 'ow-metric-fill',
                style: {
                  width: `${Math.min(95, ((load && load.rssMb) || 0) / 8)}%`,
                  background: 'linear-gradient(to right,#f5d67a,#f4a261)',
                  boxShadow: '0 0 4px rgba(245,214,122,.4)',
                },
              }),
            ),
          ),
        ),
      )
    }

    /** PortalHost 依赖 OpenWorldApp，用工厂避免环依赖 */
    function createPortalHost(OpenWorldApp) {
      return function PortalHost() {
        const [open, setOpen] = useState(false)
        const [unread, setUnread] = useState(0)
        const [wmMode, setWmMode] = useState(() => readWmMode())
        const portalRef = useRef(null)
        const wasOpen = useRef(false)

        const applyWmMode = useCallback((next) => {
          const mode = WM_MODES.includes(next) ? next : 'split'
          setWmMode(mode)
          persistWmMode(mode)
          postWorldState({ wmMode: mode, open: true })
        }, [])

        useEffect(() => {
          let cancelled = false
          ;(async () => {
            const world = await fetchWorldState()
            if (cancelled || !world) return
            applyWorldLocalCaches(world)
            const mode = world.shell && world.shell.wmMode
            if (world.shell && world.shell.open) {
              if (mode && mode !== 'minimized') persistWmMode(mode)
              setWmMode('minimized')
              setOpen(true)
            } else if (mode && WM_MODES.includes(mode) && mode !== 'minimized') {
              setWmMode(mode)
              persistWmMode(mode)
            } else if (mode === 'minimized') {
              setWmMode(readWmLastMode())
            }
          })()
          return () => { cancelled = true }
        }, [])

        useEffect(() => {
          const poll = async () => {
            try {
              const res = await fetch(MESSAGES_URL, { cache: 'no-store' })
              if (!res.ok) return
              const mb = await res.json()
              setUnread(mb.unread || 0)
            } catch { /* ignore */ }
          }
          poll()
          let es
          try {
            es = new EventSource(STREAM_URL)
            es.onmessage = (ev) => {
              try {
                const data = JSON.parse(ev.data)
                if (data.unread != null) setUnread(data.unread)
              } catch { /* ignore */ }
            }
          } catch { /* ignore */ }
          const iv = setInterval(poll, 10000)
          return () => { clearInterval(iv); if (es) es.close() }
        }, [])

        useEffect(() => {
          if (!open) {
            if (portalRef.current) {
              portalRef.current.root.unmount()
              portalRef.current.el.remove()
              portalRef.current = null
            }
            if (wasOpen.current) postWorldState({ open: false })
            wasOpen.current = false
            return undefined
          }
          wasOpen.current = true
          if (!portalRef.current) {
            const el = document.createElement('div')
            el.dataset.plugin = 'dsh-open-world'
            document.body.appendChild(el)
            const root = require('react-dom/client').createRoot(el)
            portalRef.current = { el, root }
          }
          portalRef.current.root.render(React.createElement(OpenWorldApp, {
            onClose: () => setOpen(false),
            wmMode,
            onWmMode: applyWmMode,
            unread,
          }))
          postWorldState({ open: true, wmMode })
          return undefined
        }, [open, wmMode, applyWmMode, unread])

        useEffect(() => () => {
          if (portalRef.current) {
            portalRef.current.root.unmount()
            portalRef.current.el.remove()
            portalRef.current = null
          }
        }, [])

        const onTrigger = useCallback(() => {
          if (!open) {
            if (wmMode === 'minimized') applyWmMode(readWmLastMode())
            setOpen(true)
            return
          }
          if (wmMode === 'minimized') applyWmMode(readWmLastMode())
          else applyWmMode('minimized')
        }, [open, wmMode, applyWmMode])

        return React.createElement(TriggerButton, { onOpen: onTrigger, unread })
      }
    }

    module.exports = {
      TriggerButton,
      BottomBar,
      createPortalHost,
    }
    return module.exports
  },
})


// Open World · hooks（世界存档 / 数据订阅 / 信箱操作，从 OpenWorldApp 抽出）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/hooks',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React
    const C = require('dsh-open-world/constants')
    const Runtime = require('dsh-open-world/runtime')

    const {
      SNAPSHOT_URL, TASK_BOARD_URL, POLL_MS,
      STREAM_URL, MEMORY_SEARCH_URL, DEEPSEEK_USAGE_URL,
    } = C
    const {
      fetchWorldState, postWorldState, applyWorldLocalCaches,
      postOpenWorldAction, fetchJson, fetchMessages, notifyPulse,
    } = Runtime

    /** snapshot / task / usage / mailbox + SSE + 时钟 */
    function useWorldFeed() {
      const [snapshot, setSnapshot] = useState(null)
      const [taskState, setTaskState] = useState(null)
      const [usage, setUsage] = useState(null)
      const [error, setError] = useState('')
      const [logLine, setLogLine] = useState('')
      const [hist, setHist] = useState({ cpu: [], ram: [], net: [], iops: [], health: [] })
      const [mailbox, setMailbox] = useState(null)
      const [unreadCount, setUnreadCount] = useState(0)
      const [tick, setTick] = useState(0)
      const [clock, setClock] = useState(() => new Date())
      const [pulseBoost, setPulseBoost] = useState(0)

      const pushHist = useCallback((key, value) => {
        setHist((prev) => {
          const arr = [...(prev[key] || []), value]
          if (arr.length > 30) arr.shift()
          return { ...prev, [key]: arr }
        })
      }, [])

      const refresh = useCallback(async () => {
        try {
          const data = await fetchJson(SNAPSHOT_URL)
          setSnapshot(data)
          setError('')
          const load = data.load || {}
          const health = (data.core && data.core.healthScore) || 0
          pushHist('cpu', load.heapUsedMb || 0)
          pushHist('ram', load.rssMb || 0)
          pushHist('net', (data.core && data.core.sessionCount) || 0)
          pushHist('iops', load.taskRunning || 0)
          pushHist('health', health)
          setLogLine(`[${new Date().toLocaleTimeString('zh-CN')}] snapshot ok · health ${health}`)
          try { setTaskState(await fetchJson(TASK_BOARD_URL)) } catch { setTaskState(null) }
          try { setUsage(await fetchJson(DEEPSEEK_USAGE_URL)) } catch { setUsage(null) }
          try {
            const mb = await fetchMessages()
            setMailbox(mb)
            setUnreadCount(mb.unread || 0)
          } catch { setMailbox(null) }
        } catch (err) {
          setError(String(err && err.message || err))
        }
      }, [pushHist])

      useEffect(() => {
        refresh()
        let es = null
        try {
          es = new EventSource(STREAM_URL)
          es.onmessage = (ev) => {
            try {
              const data = JSON.parse(ev.data)
              if (data.type === 'mailbox' || data.type === 'hello') {
                if (data.unread != null) setUnreadCount(data.unread)
                fetchMessages().then((mb) => {
                  setMailbox(mb)
                  if (mb && mb.unread != null) setUnreadCount(mb.unread)
                }).catch(() => {})
              }
              if (data.type === 'snapshot-delta' || data.type === 'mailbox') refresh()
            } catch { /* ignore */ }
          }
        } catch { /* SSE 不可用时降级为轮询 */ }

        const poll = setInterval(refresh, POLL_MS * 6)
        const anim = setInterval(() => setTick((t) => t + 1), 80)
        const clk = setInterval(() => setClock(new Date()), 1000)
        return () => {
          clearInterval(poll); clearInterval(anim); clearInterval(clk)
          if (es) es.close()
        }
      }, [refresh])

      useEffect(() => {
        let es
        try {
          es = new EventSource('/api/task-board/events')
          es.onmessage = () => {
            setPulseBoost(Date.now())
            notifyPulse(['task-board->runtime', 'task-board->storage', 'ai-engine->task-board'])
          }
        } catch { /* ignore */ }
        return () => { if (es) es.close() }
      }, [])

      return {
        snapshot, taskState, usage, error, logLine, hist,
        mailbox, setMailbox, unreadCount, setUnreadCount,
        tick, clock, pulseBoost, refresh,
      }
    }

    /** 冷启动恢复 + 防抖写回 world-state */
    function useWorldPersist({
      onWmMode,
      mode, floatPos, leftTab, view, selected, atiPreset, deepSpace, embed, detailOpen,
      snapshot,
      apply,
    }) {
      const hydratedRef = useRef(false)
      const saveTimer = useRef(null)
      const applyRef = useRef(apply)
      applyRef.current = apply
      const onWmModeRef = useRef(onWmMode)
      onWmModeRef.current = onWmMode

      useEffect(() => {
        let cancelled = false
        ;(async () => {
          const world = await fetchWorldState()
          if (cancelled || !world || hydratedRef.current) return
          hydratedRef.current = true
          applyWorldLocalCaches(world)
          const a = applyRef.current
          const ui = world.ui || {}
          const shell = world.shell || {}
          if (ui.leftTab) a.setLeftTab(ui.leftTab)
          if (ui.view) {
            const v = ui.view
            a.setView(v === 'manifold3d' || v === 'neural' || v === 'galaxy' ? 'ati' : v)
          }
          if (ui.selected) a.setSelected(ui.selected)
          if (ui.atiPreset) a.setAtiPreset(ui.atiPreset)
          if (ui.deepSpace != null) a.setDeepSpace(!!ui.deepSpace)
          if (ui.embed !== undefined) a.setEmbed(ui.embed)
          if (ui.detailOpen != null) a.setDetailOpen(!!ui.detailOpen)
          if (shell.floatPos) a.setFloatPos(shell.floatPos)
          const wm = onWmModeRef.current
          if (shell.wmMode && typeof wm === 'function') wm(shell.wmMode)
        })()
        return () => { cancelled = true }
      }, [])

      const queueWorldSave = useCallback((extra = {}) => {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
          postWorldState({
            wmMode: mode,
            floatPos: mode === 'float' ? floatPos : (floatPos || null),
            open: true,
            leftTab,
            view,
            selected,
            atiPreset,
            deepSpace,
            embed,
            detailOpen,
            ...extra,
          })
        }, 700)
      }, [mode, floatPos, leftTab, view, selected, atiPreset, deepSpace, embed, detailOpen])

      useEffect(() => {
        if (!hydratedRef.current) return undefined
        queueWorldSave()
        return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
      }, [queueWorldSave])

      const synapseKey = useMemo(() => {
        const list = (snapshot && snapshot.synapses) || []
        return list.map((s) => `${s.from}->${s.to}`).slice(0, 48).join('|')
      }, [snapshot])

      useEffect(() => {
        if (!hydratedRef.current || !synapseKey) return undefined
        const pairs = synapseKey.split('|').filter(Boolean).map((k) => k.split('->'))
        queueWorldSave({ synapses: pairs })
        return undefined
      }, [synapseKey, queueWorldSave])
    }

    /** 信箱 / IDEA / 记忆搜索 */
    function useMailboxHandlers({ setToast, setMailbox, setUnreadCount, runBridge, setMode }) {
      const handleSendMessage = useCallback(async (payload) => {
        const data = await postOpenWorldAction(payload)
        setToast('消息已发送')
        const mb = await fetchMessages()
        setMailbox(mb)
        setUnreadCount(mb.unread || 0)
        notifyPulse(['user-hub->session-active', 'session-active->ai-engine'])
        return data
      }, [setToast, setMailbox, setUnreadCount])

      const handleMarkRead = useCallback(async (ids) => {
        await postOpenWorldAction({ action: 'mark-read', ids })
        const mb = await fetchMessages()
        setMailbox(mb)
        setUnreadCount(mb.unread || 0)
      }, [setMailbox, setUnreadCount])

      const handleShareSnapshot = useCallback(async () => {
        const data = await postOpenWorldAction({
          action: 'share-snapshot',
          to: 'external',
          body: '开放世界拓扑快照',
        })
        setToast(data.outboxFile ? `已导出到 outbox` : '快照已分享')
        const mb = await fetchMessages()
        setMailbox(mb)
      }, [setToast, setMailbox])

      const handleInjectAgent = useCallback(async (text) => {
        await runBridge({ type: 'inject-message', body: text })
      }, [runBridge])

      const handleSearchMemory = useCallback(async (query) => {
        const q = encodeURIComponent(query || '')
        return fetchJson(`${MEMORY_SEARCH_URL}?q=${q}`)
      }, [])

      const handleIdeaInject = useCallback(async (presetId, body, treatAs) => {
        setToast('正在投递到官方聊天…')
        try {
          const data = await postOpenWorldAction({
            action: 'idea-inject',
            presetId,
            body,
            treatAs,
            logMailbox: true,
          })
          if (!data.wrapped) throw new Error('Host 未返回包装文本')
          await runBridge({ type: 'inject-message', body: data.wrapped })
          const title = (data.preset && data.preset.title) || presetId
          setMode('minimized')
          setToast(`已投递「${title}」· 看聊天窗回复（前缀包装，非真换 Agent）`)
          notifyPulse(['ai-engine->analytics', 'user-hub->ai-engine'])
          try {
            const mb = await fetchMessages()
            setMailbox(mb)
          } catch { /* 信箱失败不影响注入 */ }
        } catch (err) {
          setToast(String(err && err.message || err))
        }
      }, [runBridge, setMode, setToast, setMailbox])

      const handleIdeaCompare = useCallback(async (presetIds, body, treatAs) => {
        try {
          const data = await postOpenWorldAction({
            action: 'idea-compare',
            presetIds,
            body,
            treatAs,
          })
          const n = (data.variants || []).filter((v) => v.wrapped).length
          setToast(`IDEA 对比 · ${n} 种人格已写入信箱`)
          const mb = await fetchMessages()
          setMailbox(mb)
          setUnreadCount(mb.unread || 0)
        } catch (err) {
          setToast(String(err && err.message || err))
        }
      }, [setToast, setMailbox, setUnreadCount])

      return {
        handleSendMessage,
        handleMarkRead,
        handleShareSnapshot,
        handleInjectAgent,
        handleSearchMemory,
        handleIdeaInject,
        handleIdeaCompare,
      }
    }

    // 底栏只保留主路径；拓扑卡片仍可走 Ctrl+K「拓扑视图」
    const VIEW_MODES = [
      { id: 'ati', label: '主视图', sub: 'COMMAND', icon: 'ati' },
      { id: 'idea', label: 'IDEA', sub: 'PERSONA', icon: 'config' },
      { id: 'monitor', label: '调试 JSON', sub: 'DEBUG', icon: 'monitor' },
    ]

    function useToast() {
      const [toast, setToast] = useState('')
      useEffect(() => {
        if (!toast) return undefined
        if (String(toast).includes('正在注入') || String(toast).includes('正在投递') || String(toast).includes('生成中')) return undefined
        const t = setTimeout(() => setToast(''), 3200)
        return () => clearTimeout(t)
      }, [toast])
      return [toast, setToast]
    }

    /** 浮窗拖拽 + overlay 定位 */
    function useFloatShell(mode) {
      const overlayRef = useRef(null)
      const floatDrag = useRef(null)
      const [floatPos, setFloatPos] = useState(null)
      const [dragging, setDragging] = useState(false)

      useEffect(() => {
        if (mode !== 'float') {
          setFloatPos(null)
          setDragging(false)
        }
      }, [mode])

      useEffect(() => {
        if (!dragging) return undefined
        const onMove = (ev) => {
          const d = floatDrag.current
          if (!d) return
          setFloatPos({
            left: Math.max(8, Math.min(window.innerWidth - 120, d.startLeft + (ev.clientX - d.x))),
            top: Math.max(8, Math.min(window.innerHeight - 80, d.startTop + (ev.clientY - d.y))),
          })
        }
        const onUp = () => {
          floatDrag.current = null
          setDragging(false)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
      }, [dragging])

      const onFloatDragStart = useCallback((ev) => {
        if (mode !== 'float') return
        if (ev.target.closest('button,input,textarea,a,[role="tab"]')) return
        const el = overlayRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        floatDrag.current = { x: ev.clientX, y: ev.clientY, startLeft: rect.left, startTop: rect.top }
        setDragging(true)
        ev.preventDefault()
      }, [mode])

      const overlayStyle = (mode === 'float' && floatPos)
        ? { left: floatPos.left, top: floatPos.top, right: 'auto', bottom: 'auto' }
        : undefined

      return {
        overlayRef, floatPos, setFloatPos, dragging,
        onFloatDragStart, overlayStyle,
      }
    }

    /** Ctrl/Cmd+K 命令面板 + Esc 收窗 */
    function useCmdPalette({ mode, setMode, buildItems }) {
      const [cmdOpen, setCmdOpen] = useState(false)
      const [cmdQuery, setCmdQuery] = useState('')
      const [cmdIdx, setCmdIdx] = useState(0)

      useEffect(() => {
        const onKey = (ev) => {
          if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
            ev.preventDefault()
            setCmdOpen((v) => !v)
            setCmdQuery('')
            setCmdIdx(0)
          }
          if (ev.key === 'Escape' && !cmdOpen) {
            if (mode === 'fullscreen') setMode('split')
            else if (mode === 'float' || mode === 'split') setMode('minimized')
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [cmdOpen, mode, setMode])

      useEffect(() => { setCmdIdx(0) }, [cmdQuery])

      const cmdItems = useMemo(() => {
        const items = typeof buildItems === 'function' ? buildItems(() => setCmdOpen(false)) : []
        const q = cmdQuery.trim().toLowerCase()
        if (!q) return items.slice(0, 18)
        return items.filter((it) => it.label.toLowerCase().includes(q) || it.kind.includes(q)).slice(0, 14)
      }, [cmdQuery, buildItems])

      return {
        cmdOpen, setCmdOpen, cmdQuery, setCmdQuery, cmdIdx, setCmdIdx, cmdItems,
      }
    }

    function buildCommandItems({
      nodes, plugins, tasks, social, hub,
      runBridge, setToast, setSelected, setView, setAtiPreset,
      handleEmbedArchify, close,
    }) {
      const Shell = require('dsh-open-world/shell')
      const { pluginAction, socialChannelAction } = Shell
      const { ATI_PRESETS, NODE_ZH, QUICK_ACTIONS } = C
      const items = []
      nodes.forEach((n) => items.push({
        id: `node-${n.id}`, kind: '器官', label: NODE_ZH[n.id] || n.label,
        action: () => { setSelected(n.id); setView('ati'); close() },
      }))
      plugins.forEach((p) => items.push({
        id: `plug-${p.id}`, kind: '插件', label: p.title,
        action: () => {
          if (p.online) runBridge(pluginAction(p))
          else setToast(p.howToEnable || p.hint || `${p.title} 未在线`)
          close()
        },
      }))
      tasks.forEach((t) => items.push({
        id: `task-${t.id}`, kind: '任务', label: t.title,
        action: () => { runBridge({ type: 'task-run', taskId: t.id }); close() },
      }))
      QUICK_ACTIONS.forEach((a) => items.push({
        id: `qa-${a.label}`, kind: '操作', label: a.label,
        action: () => { runBridge(a.action); close() },
      }))
      social && social.feed && social.feed.forEach((item) => items.push({
        id: `feed-${item.id}`, kind: '动态', label: item.title,
        action: () => { close() },
      }))
      items.push({
        id: 'view-ati', kind: '视图', label: '切换到主视图',
        action: () => { setView('ati'); close() },
      })
      items.push({
        id: 'view-idea', kind: '视图', label: 'IDEA 人格试玩',
        action: () => { setView('idea'); close() },
      })
      items.push({
        id: 'view-topology', kind: '视图', label: '拓扑卡片（高级）',
        action: () => { setView('topology'); close() },
      })
      items.push({
        id: 'view-monitor', kind: '视图', label: '调试 JSON',
        action: () => { setView('monitor'); close() },
      })
      ATI_PRESETS.forEach((p) => {
        if (p.id === 'ati-unified') return
        items.push({
          id: `ati-preset-${p.id}`, kind: 'ATI 实验室', label: `切换 · ${p.label}（${p.group}）`,
          action: () => { setView('ati'); setAtiPreset(p.id); close() },
        })
      })
      hub && hub.archify && hub.archify.items && hub.archify.items.forEach((d) => {
        items.push({
          id: `archify-${d.id}`, kind: 'Archify', label: d.title || d.name,
          action: () => { handleEmbedArchify(d.url, d.title); close() },
        })
      })
      social && social.channels && social.channels.forEach((ch) => {
        if (!ch.installed) return
        items.push({
          id: `ch-${ch.id}`, kind: '社交', label: ch.title,
          action: () => { runBridge(socialChannelAction(ch.id)); close() },
        })
      })
      return items
    }

    function derivePanelModel(snapshot, taskState, selected, hist) {
      const { LOAD_COLORS } = C
      const ati = (snapshot && snapshot.ati) || null
      const lab = (snapshot && snapshot.lab) || null
      const social = (snapshot && snapshot.social) || null
      const hub = (snapshot && snapshot.hub) || null
      const idea = (snapshot && snapshot.idea) || null
      const synapses = (snapshot && snapshot.synapses) || []
      const nodes = (snapshot && snapshot.nodes) || []
      const plugins = (snapshot && snapshot.plugins) || []
      const selectedNode = nodes.find((n) => n.id === selected) || nodes[0]
      const selectedAction = selectedNode && selectedNode.action
      const tasks = (taskState && taskState.tasks) || (snapshot && snapshot.taskBoard && snapshot.taskBoard.tasks) || []
      const health = (snapshot && snapshot.core && snapshot.core.healthScore) || 0
      const load = (snapshot && snapshot.load) || {}
      const events = (snapshot && snapshot.events) || []
      const healthPct = Math.max(0, Math.min(100, health)) / 100
      const healthCirc = 2 * Math.PI * 48 * healthPct
      const loadRows = [
        { key: 'CPU', val: `${Math.min(99, Math.round((load.heapUsedMb || 0) / 1.2))}%`, hist: hist.cpu, color: LOAD_COLORS[0] },
        { key: 'RAM', val: `${load.heapUsedMb || 0}MB`, hist: hist.ram, color: LOAD_COLORS[1] },
        { key: 'NET', val: `${(snapshot && snapshot.core && snapshot.core.sessionCount) || 0}`, hist: hist.net, color: LOAD_COLORS[2] },
        { key: 'IOPS', val: `${load.taskRunning || 0}`, hist: hist.iops, color: LOAD_COLORS[3] },
      ]
      return {
        ati, lab, social, hub, idea, synapses, nodes, plugins,
        selectedNode, selectedAction, tasks, health, load, events,
        healthCirc, loadRows,
      }
    }

    module.exports = {
      useWorldFeed,
      useWorldPersist,
      useMailboxHandlers,
      useToast,
      useFloatShell,
      useCmdPalette,
      buildCommandItems,
      derivePanelModel,
      VIEW_MODES,
    }
    return module.exports
  },
})


// dsh-open-world · Client — NEXORA 高保真面板 + WebGL 深空背景
window.__ModuleLoader__.load({
  id: 'dsh-open-world',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const C = require('dsh-open-world/constants')
    const BridgeLib = require('dsh-open-world/bridge')
    const Shell = require('dsh-open-world/shell')
    const ViewsSpace = require('dsh-open-world/views-space')
    const Chrome = require('dsh-open-world/chrome')
    const Styles = require('dsh-open-world/styles')
    const Runtime = require('dsh-open-world/runtime')
    const AppLayout = require('dsh-open-world/app-layout')
    const Portal = require('dsh-open-world/portal')
    const Hooks = require('dsh-open-world/hooks')
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React
    const { CSS } = Styles
    const {
      readWmLastMode,
      postTaskAction, notifyPulse,
      fetchJson, fmtClock,
    } = Runtime
    const { LeftRail, CenterStage, RightRail } = AppLayout
    const { BottomBar, createPortalHost } = Portal
    const {
      useWorldFeed, useWorldPersist, useMailboxHandlers,
      useToast, useFloatShell, useCmdPalette,
      buildCommandItems, derivePanelModel, VIEW_MODES,
    } = Hooks

    const {
      SNAPSHOT_URL, POLL_MS, CLIENT_VER, CLIENT_BUILD,
      ATI_PRESET_KEY, LEFT_TAB_KEY,
    } = C
    const {
      SidebarSummaryView, WindowModeBar, ShellDock,
    } = Shell
    const { AtiFieldCanvas } = ViewsSpace
    const {
      iconSvg, useViewport, CommandPalette,
    } = Chrome

    let sessionsBridge = null

    const {
      bridgeExecute, readBridgeHealth, checkBridgeCapabilities,
    } = BridgeLib.createBridge({
      getSessionsBridge: () => sessionsBridge,
      postTaskAction,
      notifyPulse,
    })

    function OpenWorldApp({ onClose, wmMode, onWmMode, unread = 0 }) {
      const [view, setView] = useState('ati')
      const [deepSpace, setDeepSpace] = useState(true)
      const [selected, setSelected] = useState('core')
      const [toast, setToast] = useToast()
      const [embed, setEmbed] = useState(null)
      const [detailOpen, setDetailOpen] = useState(true)
      const [atiPreset, setAtiPreset] = useState(() => {
        try { return localStorage.getItem(ATI_PRESET_KEY) || 'ati-unified' } catch { return 'ati-unified' }
      })
      const [archifyEmbed, setArchifyEmbed] = useState(null)
      const viewport = useViewport()
      const mode = wmMode || 'split'

      const [leftTab, setLeftTab] = useState(() => {
        try { return localStorage.getItem(LEFT_TAB_KEY) || 'status' } catch { return 'status' }
      })
      const onLeftTab = useCallback((tab) => {
        setLeftTab(tab)
        try { localStorage.setItem(LEFT_TAB_KEY, tab) } catch { /* ignore */ }
      }, [])
      const [bridgeHealth, setBridgeHealth] = useState(() => readBridgeHealth())
      const pluginsRef = useRef([])

      const setMode = useCallback((next) => {
        if (typeof onWmMode === 'function') onWmMode(next)
      }, [onWmMode])

      const {
        overlayRef, floatPos, setFloatPos, dragging,
        onFloatDragStart, overlayStyle,
      } = useFloatShell(mode)

      const bridgeCtx = useMemo(() => ({
        onClose, setView, setToast, setEmbed,
        get plugins() { return pluginsRef.current },
      }), [onClose, setToast, setEmbed])

      const runBridge = useCallback(async (action) => {
        try {
          await bridgeExecute(action, bridgeCtx)
        } catch (err) {
          setToast(String(err && err.message || err))
        } finally {
          setBridgeHealth(readBridgeHealth() || checkBridgeCapabilities())
        }
      }, [bridgeCtx, setToast])

      const {
        snapshot, taskState, usage, error, logLine, hist,
        mailbox, setMailbox, unreadCount, setUnreadCount,
        tick, clock, pulseBoost,
      } = useWorldFeed()

      useWorldPersist({
        onWmMode,
        mode, floatPos, leftTab, view, selected, atiPreset, deepSpace, embed, detailOpen,
        snapshot,
        apply: {
          setLeftTab, setView, setSelected, setAtiPreset,
          setDeepSpace, setEmbed, setDetailOpen, setFloatPos,
        },
      })

      const {
        handleSendMessage, handleMarkRead, handleShareSnapshot,
        handleInjectAgent, handleSearchMemory,
        handleIdeaInject, handleIdeaCompare,
      } = useMailboxHandlers({
        setToast, setMailbox, setUnreadCount, runBridge, setMode,
      })

      useEffect(() => {
        if (!bridgeHealth) {
          requestAnimationFrame(() => {
            setBridgeHealth(checkBridgeCapabilities())
          })
        }
      }, []) // eslint-disable-line react-hooks/exhaustive-deps

      const handleEmbedArchify = useCallback((url, title) => {
        setArchifyEmbed({ url, title })
        setView('ati')
        setToast(`已嵌入：${title || '架构图'}`)
      }, [setToast])

      const panel = derivePanelModel(snapshot, taskState, selected, hist)
      const {
        ati, lab, social, hub, idea, synapses, nodes, plugins,
        selectedNode, selectedAction, tasks, health, load, events,
        healthCirc, loadRows,
      } = panel
      pluginsRef.current = plugins || []

      const activateSelectedAction = () => {
        if (selectedNode && selectedNode.status === 'offline' && selectedNode.howToEnable) {
          setToast(selectedNode.howToEnable)
          return
        }
        if (selectedAction) runBridge(selectedAction)
      }

      const buildItems = useCallback((close) => buildCommandItems({
        nodes, plugins, tasks, social, hub,
        runBridge, setToast, setSelected, setView, setAtiPreset,
        handleEmbedArchify, close,
      }), [nodes, plugins, tasks, social, hub, runBridge, setToast, handleEmbedArchify])

      const {
        cmdOpen, setCmdOpen, cmdQuery, setCmdQuery, cmdIdx, cmdItems,
      } = useCmdPalette({ mode, setMode, buildItems })

      const clkFmt = fmtClock(clock)
      const showAtiBg = deepSpace && view === 'ati'
      const hostBuild = snapshot && snapshot.framework && snapshot.framework.clientBuild
      const staleBuild = !!(hostBuild && CLIENT_BUILD && hostBuild !== CLIENT_BUILD)
      const verLabel = CLIENT_BUILD && CLIENT_BUILD !== 'dev'
        ? `OPEN-WORLD ${CLIENT_VER} · ${CLIENT_BUILD}`
        : `OPEN-WORLD ${CLIENT_VER}`

      const onAtiPresetChange = useCallback((id) => {
        setAtiPreset(id)
        try { localStorage.setItem(ATI_PRESET_KEY, id) } catch { /* ignore */ }
      }, [])

      if (mode === 'minimized') {
        return React.createElement('div', {
          className: 'ow-overlay ow-root is-minimized',
          'data-wm': 'minimized',
          'data-plugin': 'dsh-open-world',
        },
          React.createElement(ShellDock, {
            unread: unreadCount || unread,
            onRestore: () => setMode(readWmLastMode()),
            onClose,
          }),
        )
      }

      return React.createElement('div', {
        ref: overlayRef,
        className: `ow-overlay ow-root is-${mode}${dragging ? ' is-dragging' : ''}`,
        'data-wm': mode,
        style: overlayStyle,
      },
        showAtiBg
          ? React.createElement(AtiFieldCanvas, { active: true, tick })
          : React.createElement('div', { className: 'ow-starfield' }),
        deepSpace && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'ow-fx-vig' }),
          React.createElement('div', { className: 'ow-fx-scan' }),
          React.createElement('div', { className: 'ow-fx-sweep' }),
        ),
        React.createElement('div', {
          className: 'ow-ver',
          title: CLIENT_BUILD ? `build ${CLIENT_BUILD}` : undefined,
        }, verLabel),
        React.createElement(CommandPalette, {
          open: cmdOpen,
          query: cmdQuery,
          setQuery: setCmdQuery,
          items: cmdItems,
          selIdx: cmdIdx,
          onSelect: (it) => it.action && it.action(),
          onClose: () => setCmdOpen(false),
        }),
        toast && React.createElement('div', { className: 'ow-toast' }, toast),
        staleBuild && React.createElement('div', { className: 'ow-stale' },
          `壳产物过期：界面 ${CLIENT_BUILD} ≠ Host ${hostBuild}。请完全退出 DSH Desktop 后重开；改过 client/ 先 npm run build:client。`),
        React.createElement('div', { className: 'ow-shell' },
          React.createElement('div', {
            className: `ow-topbar${mode === 'float' ? ' is-float-drag' : ''}`,
            onMouseDown: onFloatDragStart,
          },
            React.createElement('div', { className: 'ow-topbar-left' },
              React.createElement('div', { className: 'ow-brand' },
                React.createElement('div', { className: 'ow-brand-logo' }),
                React.createElement('span', { className: 'ow-brand-name' }, '开放世界'),
                social && React.createElement('span', { className: 'ow-social-tag' },
                  (snapshot && snapshot.framework && snapshot.framework.motto) || 'Open World · 指挥舱'),
              ),
              ['monitor', 'plus', 'scan', 'network'].map((ic) => React.createElement('span', { key: ic, className: 'ow-icon-btn' }, iconSvg(ic))),
            ),
            React.createElement('div', { className: 'ow-topbar-center' },
              React.createElement('span', { className: 'ow-topbar-time' }, clkFmt.time),
              React.createElement('span', { className: 'ow-topbar-date' }, clkFmt.date),
            ),
            React.createElement('div', { className: 'ow-topbar-right' },
              React.createElement(WindowModeBar, { mode, onMode: setMode, onClose }),
            ),
          ),
          error && React.createElement('div', { className: 'ow-error' }, error),
          React.createElement('div', { className: 'ow-body' },
            React.createElement(LeftRail, {
              leftTab, onLeftTab,
              snapshot, plugins, hist, health, healthCirc, loadRows, nodes,
              bridgeHealth, setBridgeHealth, checkBridgeCapabilities,
              runBridge, setEmbed, setToast,
              hub, handleEmbedArchify,
              events, social,
              mailbox, handleSendMessage, handleMarkRead, handleShareSnapshot,
              handleInjectAgent, handleSearchMemory,
            }),
            React.createElement(CenterStage, {
              view, setView,
              idea, handleIdeaInject, handleIdeaCompare, runBridge,
              viewport, nodes, synapses, ati, selected, setSelected, tick,
              atiPreset, onAtiPresetChange, pulseBoost, lab,
              archifyEmbed, setArchifyEmbed,
              detailOpen, setDetailOpen, selectedNode, selectedAction, activateSelectedAction,
              events, usage, embed, setEmbed, tasks, snapshot, plugins, hub, setToast, taskState,
            }),
            React.createElement(RightRail, { nodes, tasks, runBridge }),
          ),
          React.createElement(BottomBar, {
            logLine, deepSpace, setDeepSpace, view, setView, viewModes: VIEW_MODES, load,
          }),
        ),
      )
    }

    const PortalHost = createPortalHost(OpenWorldApp)

    function OpenWorldSummaryTab() {
      const [snap, setSnap] = useState(null)
      useEffect(() => {
        let cancelled = false
        const pull = () => fetchJson(SNAPSHOT_URL).then((d) => {
          if (!cancelled) setSnap(d)
        }).catch(() => {})
        pull()
        const iv = setInterval(pull, POLL_MS * 6)
        return () => { cancelled = true; clearInterval(iv) }
      }, [])
      return React.createElement(SidebarSummaryView, { snapshot: snap })
    }

    // betterSidebar is optional: hard-inject blocks web-boot when the sidebar
    // plugin is missing or still pending (e.g. waiting on rc.8+ `modules`).
    // Nested ctx.inject activates the tab once the service appears.
    const inject = ['slots', 'sessions']

    function apply(ctx) {
      sessionsBridge = ctx.sessions
      ctx.effect(() => {
        const style = document.createElement('style')
        style.dataset.plugin = 'dsh-open-world'
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'dsh-open-world: styles')

      const register = (slotName, order) => ctx.slots.inject(slotName, () => ctx.slots.register(
        { name: slotName, id: 'open-world', order },
        () => React.createElement(PortalHost),
      ))
      register('sidebar.footer.action', 5)
      register('conversation.input.left', 2)

      ctx.inject(['betterSidebar'], (scope) => {
        if (typeof scope.betterSidebar.registerTab !== 'function') return
        scope.effect(() => scope.betterSidebar.registerTab({
          id: 'open-world-summary',
          title: '开放世界',
          single: true,
          component: () => React.createElement(OpenWorldSummaryTab),
        }), 'dsh-open-world: better-sidebar-tab')
      })
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})

