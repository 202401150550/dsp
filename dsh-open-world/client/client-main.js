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

    /** Align OW chrome with 550C phosphor scheme (settings → 通用). */
    function readBootScheme() {
      try {
        const raw = window.localStorage.getItem('dsh-550c-boot:scheme')
        return ['amber', 'green', 'cyan', 'white'].includes(raw) ? raw : 'amber'
      } catch {
        return 'amber'
      }
    }

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
      const [arriving, setArriving] = useState(false)
      const pluginsRef = useRef([])
      const arriveTimerRef = useRef(null)

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
        // 进世界门：先播 550C 开场（若已装），播完再进世界。冷启不播。
        // 可选门——未装 / 关闭档 / 播放失败都不挡进世界。
        if (action && action.type === 'enter-world') {
          const gate = window.__dsh550c
          if (gate && typeof gate.play === 'function') {
            try { await gate.play() } catch (err) { /* optional gate */ }
          }
          if (arriveTimerRef.current) window.clearTimeout(arriveTimerRef.current)
          setArriving(true)
          arriveTimerRef.current = window.setTimeout(() => setArriving(false), 1100)
        }
        try {
          await bridgeExecute(action, bridgeCtx)
        } catch (err) {
          setToast(String(err && err.message || err))
        } finally {
          setBridgeHealth(readBridgeHealth() || checkBridgeCapabilities())
        }
      }, [bridgeCtx, setToast])

      useEffect(() => () => {
        if (arriveTimerRef.current) window.clearTimeout(arriveTimerRef.current)
      }, [])

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
          'data-ow-scheme': readBootScheme(),
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
        className: `ow-overlay ow-root is-${mode}${dragging ? ' is-dragging' : ''}${arriving ? ' is-arriving' : ''}`,
        'data-wm': mode,
        'data-ow-scheme': readBootScheme(),
        style: overlayStyle,
      },
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
            ),
            React.createElement('div', { className: 'ow-topbar-right' },
              React.createElement('span', { className: 'ow-topbar-clock' }, clkFmt.time),
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
              handleSendMessage, handleSearchMemory,
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
