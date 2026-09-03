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
