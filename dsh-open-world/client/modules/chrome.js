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
      if (action.type === 'idea-panel') return '进入 · IDEA Lab'
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
