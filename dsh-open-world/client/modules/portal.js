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
          viewModes.map((mode) => React.createElement('button', {
            key: mode.id, type: 'button',
            className: `ow-view-btn ${view === mode.id ? 'on' : ''}`,
            onClick: () => setView(mode.id),
          },
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
                  background: 'linear-gradient(to right,#E7B24B,#30D158)',
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
                  background: 'var(--ow-accent)',
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
