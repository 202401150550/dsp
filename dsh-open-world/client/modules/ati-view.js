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
              return React.createElement('g', {
                key: id, className: 'ow-nn-node',
                onClick: () => onSelect(id),
                onDoubleClick: (ev) => { ev.stopPropagation(); node.action && onActivate(node.action) },
              },
                React.createElement('circle', {
                  cx: pos.x, cy: pos.y, r: sel ? 14 : 11,
                  fill: `${layout.color}44`, stroke: layout.color, strokeWidth: sel ? 2.5 : 1,
                  filter: sel ? 'url(#owAtiGlow)' : undefined,
                }),
                React.createElement('text', {
                  x: pos.x, y: pos.y - 18, textAnchor: 'middle', fill: '#e6f1ff', fontSize: 9,
                }, NODE_ZH[id] || node.label),
                React.createElement('text', {
                  x: pos.x, y: pos.y + 24, textAnchor: 'middle', className: 'ow-ati-metric',
                }, `${node.metric}%`),
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
