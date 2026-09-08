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
