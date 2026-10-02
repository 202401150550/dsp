// Open World · 壳层 UI（三栏 / 集成 / 社交）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/shell',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const { RewindTimelinePanel } = require('dsh-open-world/hubs')
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
          border: '1px solid rgba(231,178,75,.28)',
          borderRadius: 8,
          background: 'rgba(231,178,75,.06)',
        },
      },
        React.createElement('div', {
          style: { fontSize: 11, color: '#A3A3A8', marginBottom: 8, lineHeight: 1.45 },
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
          React.createElement('div', { style: { fontSize: 11, color: '#64748b', marginBottom: 6 } },
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
          source && React.createElement('div', { style: { fontSize: 11, color: '#64748b', marginTop: 4 } }, `来源 · ${source}`),
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
          style: { fontSize: 11, color: '#A3A3A8', marginLeft: 4, fontFamily: 'var(--ow-mono)' },
          title: surfaceTitle,
        }, `${apiN}通 · ${degN}弱 · ${badN}无`),
        lastText && React.createElement('span', {
          className: 'ow-bridge-last',
          style: {
            fontSize: 11, marginLeft: 6, fontFamily: 'var(--ow-mono)',
            color: last.ok ? '#E7B24B' : '#ff9090',
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
          fontSize: 11, padding: '2px 7px', marginLeft: 6, borderRadius: 999,
          verticalAlign: 'middle', fontFamily: 'var(--ow-mono)',
          background: source === 'metaphor' ? 'rgba(255,159,10,.15)' : 'rgba(231,178,75,.12)',
          color: source === 'metaphor' ? '#FF9F0A' : '#E7B24B',
          border: `1px solid ${source === 'metaphor' ? 'rgba(255,159,10,.25)' : 'rgba(231,178,75,.2)'}`,
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
        return React.createElement('div', { style: { fontSize: 12, color: '#A3A3A8' } }, 'RRM 记忆未就绪')
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

      return React.createElement('div', { className: 'ow-memory-brief', style: { fontSize: 11, color: '#A3A3A8', lineHeight: 1.55 } },
        React.createElement('div', { style: { color: '#E7B24B', marginBottom: 6 } }, view.hint || '事件记忆'),
        React.createElement('div', {
          style: { fontSize: 11, color: '#64748b', marginBottom: 6 },
        }, '本地 RRM 壳层 · ≠ Hindsight（信箱/集成枢纽走「搜 Hindsight」）'),
        React.createElement('div', null, `精确 ${m.exact} · 压缩 ${m.compressed} · 地标 ${m.landmarks}`),
        f.bytesSaved != null && React.createElement('div', null, `证伪节省 ${f.bytesSaved}B · 比 ${f.ratio}`),
        (act.tau_ms != null || act.byte_budget != null) && React.createElement('div', {
          style: { marginTop: 8, fontFamily: 'var(--ow-mono)', fontSize: 11, color: sessionOn ? '#fbbf24' : '#A3A3A8' },
        },
          `生效 · α=${act.alpha ?? '—'} · τ=${act.tau_ms ?? '—'}ms · B=${act.byte_budget ?? '—'}`,
          React.createElement('div', { style: { marginTop: 2 } },
            sessionOn
              ? `来源 · 会话覆盖${act.session && act.session.label ? `（${act.session.label}）` : ''} · 未写 yml`
              : '来源 · open-world.yml',
          ),
        ),
        mb && mb.meta && React.createElement('div', { style: { marginTop: 8, color: '#A3A3A8' } },
          mb.hint || '信箱',
          ` · 未读钉住 ${mb.meta.unreadPinned || 0}`,
        ),
        view.tasks && view.tasks.meta && React.createElement('div', { style: { marginTop: 6, color: '#A3A3A8' } },
          view.tasks.hint || '任务',
          ` · 热钉住 ${view.tasks.hotPinned || view.tasks.meta.hotPinned || 0}`,
        ),
        archives && React.createElement('div', { style: { marginTop: 8, color: '#A3A3A8' } },
          React.createElement('div', { style: { color: '#E7B24B', marginBottom: 2 } }, archives.hint || '归档'),
          archLine('事件', archives.events),
          archLine('信箱', archives.mailbox),
          archLine('任务', archives.tasks),
          archives.recent && React.createElement('div', { style: { marginTop: 6 } },
            React.createElement('div', { style: { color: '#E7B24B', marginBottom: 2 } }, '最近归档（尾预览）'),
            ['events', 'mailbox', 'tasks'].map((ch) => {
              const zh = ch === 'events' ? '事件' : ch === 'mailbox' ? '信箱' : '任务'
              const list = (archives.recent[ch] || []).slice(-3)
              if (!list.length) {
                return React.createElement('div', { key: ch, style: { fontSize: 11, opacity: 0.7 } }, `${zh} · —`)
              }
              return React.createElement('div', { key: ch, style: { marginBottom: 4 } },
                React.createElement('div', { style: { fontSize: 11, color: '#64748b' } }, zh),
                list.map((it, i) => React.createElement('div', {
                  key: `${ch}-${it.id || i}`,
                  style: { fontFamily: 'var(--ow-mono)', fontSize: 9 },
                }, `· ${it.title}`)),
              )
            }),
            archives.recent.note && React.createElement('div', {
              style: { marginTop: 2, fontSize: 11, color: '#64748b' },
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
                flex: '1 1 120px', minWidth: 100, fontSize: 11, padding: '2px 6px',
                background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', color: '#F2F2F4', borderRadius: 9,
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
            style: { marginTop: 6, fontSize: 11, color: '#A3A3A8' },
          },
            React.createElement('div', { style: { color: '#E7B24B', marginBottom: 2 } },
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
            style: { color: '#E7B24B', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
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
              fontFamily: 'var(--ow-mono)', fontSize: 11,
              opacity: cmp.winner && cmp.winner.label === row.label ? 1 : 0.75,
              color: cmp.winner && cmp.winner.label === row.label ? '#E7B24B' : undefined,
            },
          }, `${row.label}: α=${row.alpha} τ=${row.tau_ms} · ${row.liveBytes}B / ${row.naiveBytes}B = ${row.ratio}`)),
          cmp && cmp.channels && React.createElement('div', {
            style: { marginTop: 8, fontSize: 11, color: '#A3A3A8' },
          },
            React.createElement('div', { style: { color: '#E7B24B', marginBottom: 2 } }, '三通道旁注'),
            cmp.channels.mailbox && cmp.channels.mailbox.winner && React.createElement('div', null,
              `信箱胜出 · ${cmp.channels.mailbox.winner.label} · 比 ${cmp.channels.mailbox.winner.ratio}`,
            ),
            cmp.channels.tasks && cmp.channels.tasks.winner && React.createElement('div', null,
              `任务胜出 · ${cmp.channels.tasks.winner.label} · 比 ${cmp.channels.tasks.winner.ratio}`,
            ),
            !cmp.channels.mailbox && !cmp.channels.tasks && React.createElement('div', {
              style: { fontSize: 11, color: '#64748b' },
            }, '信箱/任务暂无样本可对照'),
          ),
          cmp && cmp.note && React.createElement('div', {
            style: { marginTop: 4, fontSize: 11, color: '#64748b' },
          }, cmp.note),
          !cmp && React.createElement('div', { style: { fontSize: 10 } }, '尚无对照 · 点刷新或等下一帧 snapshot'),
        ),
        view.neuralStub && React.createElement('div', { style: { marginTop: 8, fontSize: 11, color: '#64748b' } },
          `神经 RRA：未实现（${view.neuralStub.stage || 'L0'} · ${view.neuralStub.protocol || 'stub'}）`,
          view.neuralStub.adapter && React.createElement('div', {
            style: { marginTop: 2, fontSize: 11, color: '#475569' },
          },
            view.neuralStub.adapter.probe
              ? `适配器 · 已探测${view.neuralStub.adapter.proto && view.neuralStub.adapter.proto.version ? ` rra-proto@${view.neuralStub.adapter.proto.version}` : ''}${view.neuralStub.adapter.error ? ` · ${view.neuralStub.adapter.error}` : ''} · 神经仍关`
              : '适配器 · 未探测（rra.probe=false）· 神经仍关',
          ),
          view.neuralStub.nextCut && React.createElement('div', {
            style: { marginTop: 2, fontSize: 11, color: '#475569' },
          }, `下一刀 · ${view.neuralStub.nextCut}`),
        ),
      )
    }

    function tierBadge(tier) {
      const label = tier === 'exact' ? '精确' : tier === 'compressed' ? '压缩' : tier === 'landmark' ? '地标' : ''
      if (!label) return null
      const color = tier === 'exact' ? '#E7B24B' : tier === 'compressed' ? '#fbbf24' : '#64D2FF'
      return React.createElement('span', {
        className: 'ow-tier-badge',
        style: {
          fontSize: 11, padding: '2px 8px', borderRadius: 999, marginRight: 6,
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
        return React.createElement('div', { style: { fontSize: 12, color: '#A3A3A8' } }, '社交层加载中…')
      }
      const presence = social.presence || []
      const channels = social.channels || []
      const feed = social.feed || []
      return React.createElement('div', { className: 'ow-social-list' },
        React.createElement('div', { className: 'ow-social-tag' }, social.tagline),
        presence.length > 0 && React.createElement('div', { style: { marginTop: 8 } },
          React.createElement('div', { style: { fontSize: 11, color: '#4a5a70', marginBottom: 6, letterSpacing: 0 } }, `在线会话 · ${social.presenceCount}`),
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
          React.createElement('div', { style: { fontSize: 11, color: '#4a5a70', marginBottom: 6, letterSpacing: 0 } }, `社交频道 · ${social.channelCount}`),
          channels.map((ch) => React.createElement('div', {
            key: ch.id,
            className: `ow-social-channel ${ch.installed ? '' : 'off'}`,
            onClick: () => ch.installed && onChannel(ch.id),
          },
            React.createElement('span', null, ch.title),
            React.createElement('span', { style: { fontSize: 11, color: ch.online ? '#E7B24B' : '#A3A3A8' } },
              ch.online ? '在线' : (ch.installed ? '就绪' : '未装')),
          )),
        ),
        feed.length > 0 && React.createElement('div', { style: { marginTop: 10 } },
          React.createElement('div', { style: { fontSize: 11, color: '#4a5a70', marginBottom: 6, letterSpacing: 0 } }, '动态流'),
          feed.slice(0, 5).map((item) => React.createElement('div', { key: item.id, className: 'ow-social-feed-item' },
            React.createElement('span', { className: 'ow-social-kind' }, item.kind),
            React.createElement('span', null,
              React.createElement('div', { style: { color: '#F2F2F4' } }, item.title),
              item.detail && React.createElement('div', { style: { color: '#A3A3A8', fontSize: 10 } }, item.detail),
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
          ? React.createElement('div', { style: { fontSize: 12, color: '#A3A3A8' } }, '扫描插件目录…')
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
      return React.createElement('div', { className: 'ow-sidebar-summary', style: { padding: 12, fontSize: 12, color: '#A3A3A8' } },
        React.createElement('div', { style: { color: '#F2F2F4', fontSize: 13, fontWeight: 590, marginBottom: 8, letterSpacing: 0 } }, '开放世界摘要'),
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
            ? React.createElement('div', { style: { fontSize: 12, color: '#A3A3A8' } }, '暂无进程')
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
      chat: { title: '聊天坞 · 内嵌', en: 'CHAT' },
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
            ? React.createElement('div', { style: { color: '#A3A3A8', fontSize: 12 } },
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
        body = React.createElement(RewindTimelinePanel, { rewind, plugins: plug, onAction, compact: false })
      } else if (panel === 'market') {
        body = React.createElement(React.Fragment, null,
          React.createElement('div', { style: { fontSize: 12, color: '#A3A3A8', marginBottom: 8 } },
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
          React.createElement('div', { style: { fontSize: 11, color: '#A3A3A8', marginBottom: 8 } },
            '双通路：上方本地 RRM（刷新记忆 / 搜归档）；Hindsight 长期记忆在集成枢纽或事件页信箱「搜 Hindsight」。'),
          React.createElement(MemoryBrief, { memory: memory || (snapshot && snapshot.memory) }),
          React.createElement('div', { style: { marginTop: 12, fontSize: 12, color: '#A3A3A8' } },
            integ.hindsightDaemon ? 'Hindsight daemon 在线' : (integ.hindsight ? 'Hindsight 已装' : 'Hindsight 未启用')),
          React.createElement('div', { style: { marginTop: 12, display: 'flex', gap: 8 } },
            officialBtn('到设置找 Hindsight', { type: 'settings', label: 'Hindsight', settingsHint: '插件' }),
          ),
        )
      } else if (panel === 'chat') {
        const ChatLib = require('dsh-open-world/chat')
        const ChatDock = ChatLib && ChatLib.ChatDock
        body = ChatDock
          ? React.createElement(ChatDock, {
            compact: false,
            mailbox: snapshot && snapshot.mailbox,
            hub,
            onAction,
            setToast: (msg) => onAction && onAction({ type: 'toast', label: msg }),
            onInject: (text) => onAction && onAction({
              type: 'inject-message', body: text, label: '已注入当前会话',
            }),
          })
          : React.createElement('div', { style: { fontSize: 12, color: '#8b95a7' } },
            '聊天模块未加载：先运行 npm run build:client')
      } else if (panel === 'ssh') {
        body = React.createElement(React.Fragment, null,
          React.createElement('div', { style: { fontSize: 12, color: '#F2F2F4', lineHeight: 1.6 } },
            'SSH 会话仍由官方面板承载。这里保留壳内入口，避免把指挥舱关掉才找按钮。'),
          React.createElement('div', { style: { marginTop: 10, fontSize: 12, color: '#A3A3A8' } },
            `网络节点 · sessions ${sessions.count != null ? sessions.count : (core.sessionCount || 0)}`),
          React.createElement('div', { style: { marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            officialBtn('打开官方 SSH', { type: 'panel', label: 'SSH', panel: 'ssh', selector: '[data-dsh-ssh-entry]' }),
            officialBtn('移动端远程', { type: 'remote', label: '远程' }),
          ),
        )
      } else if (panel === 'remote') {
        const space = (snapshot && snapshot.space) || {}
        body = React.createElement(React.Fragment, null,
          React.createElement('div', { style: { fontSize: 12, color: '#F2F2F4', lineHeight: 1.6 } },
            '移动端 / Pair 远程由 Host 驱动提供。LAN 第二屏：/api/open-world/space/view（SSE 同步）。'),
          hub && hub.pair && React.createElement('div', { style: { marginTop: 8, fontSize: 12, color: '#A3A3A8' } },
            hub.pair.available
              ? `Pair · ${hub.pair.paired ? '已配对' : '未配对'} · 在线 ${hub.pair.onlineCount || 0}`
              : 'Pair 不可用'),
          React.createElement('div', { style: { marginTop: 8, fontSize: 12, color: '#E7B24B' } },
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
          React.createElement('div', { style: { marginTop: 12, fontSize: 12, color: '#A3A3A8' } },
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
          React.createElement('div', { style: { fontSize: 15, color: '#E7B24B', marginBottom: 8 } },
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
          React.createElement('div', { style: { marginTop: 12, fontSize: 12, color: '#A3A3A8' } },
            'better-sidebar 的开放世界 Tab 也可看摘要。'),
        )
      }

      return React.createElement('div', { className: 'ow-embed', 'data-ow-surface': panel || '' },
        React.createElement('div', { className: 'ow-embed-head' },
          React.createElement('div', null,
            React.createElement('strong', null, meta.title),
            React.createElement('span', { style: { marginLeft: 8, fontSize: 10.5, color: '#6B6B72', letterSpacing: '.1em' } }, meta.en),
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
