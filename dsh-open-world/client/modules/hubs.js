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

    // ── 信箱（原「消息总线」的阅读面）────────────────────────────────────
    // 投递动作已并入聊天坞的对话框（一排目标小按钮）；这里保留侧栏用的阅读面：
    //   快速扫记录、点未读、全部已读、分享快照，需要继续操作就跳聊天坞。
    const MBOX_TO_LABEL = {
      broadcast: '全体广播', sessions: '全部会话', remote: '跨机外发',
      agent: '官方聊天', clipboard: '复制分享包', external: '导出外发文件',
    }

    function mboxAgo(ts) {
      const d = new Date(ts || Date.now())
      const sec = (Date.now() - (ts || 0)) / 1000
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      if (sec < 60) return '刚刚'
      if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`
      if (new Date().toDateString() === d.toDateString()) return hhmm
      return `${d.getMonth() + 1}/${d.getDate()} ${hhmm}`
    }

    function MessageHub({ mailbox, hub, onRead, onShare, onOpenChat }) {
      const [filter, setFilter] = useState('all')
      const [q, setQ] = useState('')
      const [expanded, setExpanded] = useState(false)
      const messages = (mailbox && mailbox.messages) || []
      const unread = (mailbox && mailbox.unread) || 0
      const remoteReady = hub && hub.pair && (hub.pair.paired || hub.remoteMessaging?.paired)

      const filtered = messages
        .filter((m) => (filter === 'unread' ? m.direction === 'in' && !m.read
          : filter === 'out' ? m.direction !== 'in' : true))
        .filter((m) => !q.trim() || String(m.body || '').toLowerCase().includes(q.trim().toLowerCase()))
      const shown = filtered.slice(0, expanded ? 60 : 6)

      const attsOf = (m) => {
        const out = []
        const payloadAtts = (m.payload && m.payload.attachments) || []
        for (const a of payloadAtts) {
          if (a.type === 'memory') out.push(`Hindsight · ${(a.items || []).length} 条`)
          else if (a.type === 'snapshot') out.push('拓扑快照')
          else out.push(a.type || '附件')
        }
        if (m.payload && m.payload.snapshot && !payloadAtts.some((a) => a.type === 'snapshot')) out.push('拓扑快照')
        if (m.kind === 'notification') out.push('通知中心')
        return out
      }

      const entry = (m) => {
        const isIn = m.direction === 'in'
        const unseen = isIn && !m.read
        const atts = attsOf(m)
        return React.createElement('div', {
          key: m.id, className: `card ${isIn ? 'ag' : 'me'}`,
          style: { cursor: unseen ? 'pointer' : 'default', opacity: unseen ? 1 : 0.86 },
          title: unseen ? '点击标记为已读' : undefined,
          onClick: () => { if (unseen && onRead) onRead([m.id]) },
        },
          React.createElement('div', { className: 'meta' },
            React.createElement('span', { className: isIn ? 'info' : 'warn' }, isIn ? '收' : '发'),
            React.createElement('span', null, m.toLabel || MBOX_TO_LABEL[m.to] || m.to || '本地'),
            React.createElement('span', null, mboxAgo(m.ts)),
            unseen ? React.createElement('span', { className: 'badge' }, '未读') : null),
          React.createElement('div', { className: 'ln' }, m.body || '（空消息）'),
          atts.length > 0 && React.createElement('div', { style: { paddingTop: 5 } },
            atts.map((t, i) => React.createElement('span', {
              key: `${m.id}-a-${i}`, className: 'chip att', style: { marginRight: 5 },
            }, t))))
      }

      return React.createElement('div', { className: 'owd' },
        React.createElement('style', { dangerouslySetInnerHTML: { __html: C.OW_SKIN_ACTIVE || '' } }),
        React.createElement('div', { className: 'panel', style: { padding: '8px 9px 9px' } },
          React.createElement('div', { className: 'head', style: { margin: '-8px -9px 6px', borderBottom: '1px solid var(--am1)' } },
            React.createElement('span', { className: remoteReady ? 'sig' : 'sig red' }),
            React.createElement('span', { className: 'zh' }, '信箱'),
            React.createElement('span', { className: 'en' }, 'MAILBOX'),
            React.createElement('span', { className: 'tag' }, `${messages.length} 条${unread ? ` · 未读 ${unread}` : ''}`)),

          onOpenChat && React.createElement('button', {
            type: 'button', className: 'btn primary', style: { width: '100%', marginBottom: 7 },
            title: '投递与对话都在聊天坞里完成',
            onClick: onOpenChat,
          }, '在聊天坞继续 →'),

          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', paddingBottom: 5 } },
            React.createElement('span', {
              className: `chip${filter === 'all' ? ' on' : ''}`, onClick: () => setFilter('all'),
            }, `全部 ${messages.length}`),
            React.createElement('span', {
              className: `chip${filter === 'unread' ? ' on' : ''}`, onClick: () => setFilter('unread'),
            }, `未读 ${unread}`),
            React.createElement('span', {
              className: `chip${filter === 'out' ? ' on' : ''}`, onClick: () => setFilter('out'),
            }, '我发的'),
            React.createElement('input', {
              className: 'inp', type: 'search', value: q, placeholder: '搜索…',
              style: { flex: 1, minWidth: 70 }, onChange: (ev) => setQ(ev.target.value),
            })),

          shown.length === 0 && React.createElement('div', {
            className: 'muted', style: { fontSize: 10.5, padding: '10px 0', textAlign: 'center' },
          }, '这里还没有记录'),
          shown.map(entry),
          filtered.length > shown.length && React.createElement('button', {
            type: 'button', className: 'btn', style: { width: '100%', marginTop: 4 },
            onClick: () => setExpanded(true),
          }, `展开更多（还有 ${filtered.length - shown.length} 条）`),

          React.createElement('div', { className: 'divider' }),
          React.createElement('div', { style: { display: 'flex', gap: 6 } },
            unread > 0 && onRead && React.createElement('button', {
              type: 'button', className: 'btn', style: { flex: 1 },
              onClick: () => onRead(messages.filter((m) => m.direction === 'in' && !m.read).map((m) => m.id)),
            }, '全部已读'),
            onShare && React.createElement('button', {
              type: 'button', className: 'btn', style: { flex: 1 }, onClick: () => onShare(),
            }, '分享快照')),
          React.createElement('div', { className: 'foot', style: { borderTop: 'none', padding: '6px 0 0' } },
            React.createElement('span', null, remoteReady ? '跨机就绪' : '本机'),
            React.createElement('span', { style: { marginLeft: 'auto' } }, 'mailbox.json'))))
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
        return React.createElement('div', { style: { fontSize: 12, color: '#A3A3A8' } }, '集成层加载中…')
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
          style: { marginBottom: 10, padding: '8px 10px', border: '1px solid rgba(231,178,75,.2)', borderRadius: 6 },
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
            React.createElement('span', { style: { fontSize: 10, color: '#A3A3A8' } }, '签发 TTL'),
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
            style: { marginTop: 4, fontSize: 10, color: '#A3A3A8' },
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
          React.createElement('div', { className: 'ow-hub-stat', style: { marginTop: 4, color: pair.available ? '#A3A3A8' : '#fbbf24' } },
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
            React.createElement('div', { style: { color: '#F2F2F4' } }, n.title),
            React.createElement('div', { style: { fontSize: 10, color: '#A3A3A8' } }, n.body),
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
            style: { fontSize: 9, color: '#A3A3A8', marginTop: 4 },
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
      const blocked = '回退暂不可执行：会话绑定与旧插件兼容性尚未验证；历史时间轴仍可查看。'
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
          React.createElement('p', { role: 'status', 'data-rewind-readonly': true }, blocked),
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
              disabled: true, title: blocked,
            }, '执行回退（暂不可用）'),
          ),
        )
      }
      return React.createElement('div', { className: 'ow-hub' },
        React.createElement('p', { role: 'status', 'data-rewind-readonly': true }, blocked),
        React.createElement('div', { className: 'ow-hub-stat' },
          `${stats.anchors || 0} 锚点 · ${stats.snapshots || 0} 文件快照 · ${stats.sessions || 0} 会话`),
        React.createElement('div', { className: 'ow-rewind-actions' },
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn',
            disabled: true, title: blocked,
          }, '执行回退（暂不可用）'),
          React.createElement('button', {
            type: 'button', className: 'ow-msg-btn',
            onClick: () => onAction({ type: 'settings', label: 'Rewind', settingsHint: '插件' }),
          }, '设置'),
        ),
        points.length === 0
          ? React.createElement('div', { style: { fontSize: 11, color: '#A3A3A8', marginTop: 8 } },
            '暂无快照 · 在对话里用写类工具后会自动记录锚点')
          : React.createElement('div', { className: 'ow-rewind-tl', style: { marginTop: 8 } },
            points.map((p) => React.createElement('div', {
              key: p.id,
              className: `ow-rewind-item ${p.active ? 'active' : ''}`,
            },
              React.createElement('div', { style: { color: '#F2F2F4' } }, p.label),
              React.createElement('div', { className: 'ow-rewind-meta' },
                `${p.fileCount} 文件 · ${new Date(p.ts).toLocaleString('zh-CN')}${p.active ? ' · 当前会话' : ''}`),
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
