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
          } else {
            // P3：无历史视图时按 default_view 进门（小白=园 / 主人默认=厅）
            try {
              const snapDv = await fetchJson(SNAPSHOT_URL)
              const dv = snapDv && snapDv.config && snapDv.config.default_view
              const gardenOff = !!(snapDv && snapDv.config && snapDv.config.worlds && snapDv.config.worlds.garden === false)
              if ((dv === 'garden' && !gardenOff) || dv === 'idea' || dv === 'monitor') a.setView(dv)
            } catch { /* 取不到 default_view 就走默认主视图 */ }
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
      { id: 'garden', label: '园', sub: 'GARDEN', icon: 'config' },
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
      runBridge, setToast, setSelected, setView,
      handleEmbedArchify, close,
    }) {
      const Shell = require('dsh-open-world/shell')
      const { pluginAction, socialChannelAction } = Shell
      const { NODE_ZH, QUICK_ACTIONS } = C
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
