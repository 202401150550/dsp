// Open World · ati-view
// v107 戏服退役（用户定调「假的全删，真图做干净」）：隐喻舞台 AtiStageRenderer / 假 HUD（κ/∇L/heads/loss/ΔG）/
// 24 装饰条 / 实验室预设与壁纸系统全部移除；仅保留真实拓扑——器官节点（点选=详情卡，双击=直达面板）+
// 突触脉冲连线 + 真实健康均值 HUD。ati-lab.js 不再被本模块引用（文件暂留，工厂不执行）。
window.__ModuleLoader__.load({
  id: 'dsh-open-world/ati-view',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React
    const C = require('dsh-open-world/constants')
    const { NODE_ZH, NODE_LAYOUT } = C
    const Shell = require('dsh-open-world/shell')
    const { sourceTag } = Shell

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
        key: f, cx, cy, r: r * f, fill: 'none', stroke: 'rgba(255,255,255,.06)', strokeWidth: 1,
      }))
      const axes = vals.map((_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        return React.createElement('line', {
          key: i, x1: cx, y1: cy, x2: cx + Math.cos(a) * r, y2: cy + Math.sin(a) * r,
          stroke: 'rgba(255,255,255,.1)', strokeWidth: 1,
        })
      })
      return React.createElement('svg', { className: 'ow-radar', viewBox: '0 0 200 120' },
        rings, axes,
        React.createElement('polygon', { points: pts, fill: 'rgba(255,255,255,.1)', stroke: '#E7B24B', strokeWidth: 1 }),
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

    function AtiCortex({ nodes, synapses, selected, onSelect, tick, onActivate, pulseBoost }) {
      const W = 920
      const H = 600
      const cx = 460
      const cy = 300
      const nodeMap = useMemo(() => Object.fromEntries((nodes || []).map((n) => [n.id, n])), [nodes])
      const pulseMul = pulseBoost && pulseBoost > Date.now() - 4000 ? 2.5 : 1

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
        const color = NODE_LAYOUT[s.from]?.color || '#64D2FF'
        return { ...s, d, pulse, color }
      }), [synapses, organPos, tick, pulseMul, cx, cy])
      const org = (nodes || []).filter((n) => n.id !== 'core')
      const online = org.filter((n) => n.status !== 'offline' && n.status !== 'missing')
      const avg = online.length ? Math.round(online.reduce((s, n) => s + (n.metric || 0), 0) / online.length) : 0

      return React.createElement('div', { className: 'ow-ati-wrap' },
        React.createElement('div', { className: 'ow-ati-title' },
          'A · T · I   系统拓扑',
          sourceTag('derived'),
        ),
        React.createElement('div', { className: 'ow-ati-sub' }, 'SYSTEM TOPOLOGY · 实时健康 · 点节点看详情，双击直达'),
        React.createElement('div', { className: 'ow-ati-hud' },
          React.createElement('div', null,
            `节点 ${org.length} · 在线 ${online.length} · 健康均值 ${avg}%`,
            sourceTag('derived'),
          ),
        ),
        React.createElement('svg', { className: 'ow-ati-svg', viewBox: `0 0 ${W} ${H}` },
          React.createElement('defs', null,
            React.createElement('radialGradient', { id: 'owAtiCore' },
              React.createElement('stop', { offset: '0%', stopColor: '#FFFFFF', stopOpacity: 0.5 }),
              React.createElement('stop', { offset: '55%', stopColor: '#E7B24B', stopOpacity: 0.12 }),
              React.createElement('stop', { offset: '100%', stopColor: '#E7B24B', stopOpacity: 0 }),
            ),
            React.createElement('filter', { id: 'owAtiGlow' },
              React.createElement('feGaussianBlur', { stdDeviation: 3, result: 'b' }),
              React.createElement('feComponentTransfer', { in: 'b', result: 'soft' },
                React.createElement('feFuncA', { type: 'linear', slope: 0.28 }),
              ),
              React.createElement('feMerge', null,
                React.createElement('feMergeNode', { in: 'soft' }),
                React.createElement('feMergeNode', { in: 'SourceGraphic' }),
              ),
            ),
          ),
                    edges.map((e) => React.createElement('g', { key: `${e.from}-${e.to}`, opacity: 1 },
            React.createElement('path', {
              d: e.d, fill: 'none', stroke: e.color,
              strokeWidth: e.active ? 1.4 : 1,
              strokeOpacity: 0.12 + e.weight * 0.34,
            }),
            e.active && React.createElement('circle', {
              cx: e.pulse.x, cy: e.pulse.y, r: 2.5,
              fill: e.color, opacity: 0.5, className: 'ow-nn-pulse',
            }),
          )),
                    React.createElement('g', { className: 'ow-ati-singularity' },
            React.createElement('circle', { cx, cy, r: 64, fill: 'url(#owAtiCore)', opacity: 0.5 }),
            React.createElement('circle', { cx, cy, r: 30, fill: 'none', stroke: 'rgba(255,255,255,.16)', strokeWidth: 1 }),
            React.createElement('circle', { cx, cy, r: 6, fill: '#FFFFFF', opacity: 0.92 }),
            React.createElement('text', {
              x: cx, y: cy - 44, textAnchor: 'middle', fill: '#A3A3A8',
              fontSize: 11, fontFamily: 'inherit', letterSpacing: 0, fontWeight: 500,
            }, 'ATI CORE'),
          ),
                    React.createElement('g', null,
            Object.entries(organPos).map(([id, pos]) => {
              const node = nodeMap[id]
              if (!node || id === 'core') return null
              const layout = NODE_LAYOUT[id] || { color: node.color || '#E7B24B', en: id }
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
                  cx: pos.x, cy: pos.y, r: sel ? 12 : 10,
                  fill, stroke, strokeWidth: sel ? 1.6 : 1,
                  strokeOpacity: offline ? 0.5 : 0.85,
                }),
                sel && !offline && React.createElement('circle', {
                  cx: pos.x, cy: pos.y, r: 17, fill: 'none',
                  stroke: layout.color, strokeWidth: 1, strokeOpacity: 0.35,
                }),
                React.createElement('text', {
                  x: pos.x, y: pos.y - 19, textAnchor: 'middle',
                  fill: offline ? '#6B6B72' : '#F2F2F4', fontSize: 12, fontWeight: 510,
                }, NODE_ZH[id] || node.label),
                React.createElement('text', {
                  x: pos.x, y: pos.y + 24, textAnchor: 'middle', className: 'ow-ati-metric',
                  fill: offline ? '#64748b' : undefined,
                }, offline ? '未启用' : `${node.metric}%`),
              )
            }),
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
              const layout = NODE_LAYOUT[item.id] || { color: '#E7B24B' }
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
            const layout = NODE_LAYOUT[item.id] || { color: '#E7B24B' }
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
