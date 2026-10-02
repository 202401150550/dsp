// Open World · 聊天坞（壳内 · 已合并「消息总线」）
// 定位：日常对话 + 投递台合一 —— 说一句话、拖一份文件、选一个去处，就在同一个面板里完成。
//   · 主视图 = 会话（像聊天）；左栏底部固定一条「信箱 · 投递记录」，点开就是原来的消息总线记录。
//   · 投递目标不再是下拉框，而是输入框上的一排小按钮：本机 / 广播 / 全部会话 / 跨机 / 官方聊天 / 剪贴板 / 导出。
//   · 消息与附件仍全部落本地文件（open-world/chat/ 与 open-world/mailbox.json），可备份、可审计。
// 视觉：DSH 指挥舱皮肤（constants.OW_SKIN_DSH，取自 styles.js 的 --ow-* 令牌），与 550C 的琥珀 CRT 区分开。
window.__ModuleLoader__.load({
  id: 'dsh-open-world/chat',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const C = require('dsh-open-world/constants')
    const { HistoryBrowser } = require('dsh-open-world/history')
    const { useState, useEffect, useRef, useCallback } = React

    const SKIN = C.OW_SKIN_ACTIVE || ''
    const MAX_HINT = '附件上限 8 MB · .env / *.pem / id_rsa 等敏感名会被拒绝'
    const ROLE_ZH = { user: '我', agent: '助手', system: '系统' }
    const ROLE_CLS = { user: 'me', agent: 'ag', system: 'sys' }
    /* v25/v46：提示驻留与轮询间隔常量化 */
    const TOAST_MS = 2800
    const POLL_MS = 4000

    // 投递目标：一排小按钮，点一下就换去处
    const TARGETS = [
      { id: 'local', zh: '记录', en: 'LOCAL', hint: '保存到本地记录；不会自动生成助手回复' },
      { id: 'broadcast', zh: '广播', en: 'CAST', hint: '投给全体广播' },
      { id: 'sessions', zh: '全会话', en: 'SESS', hint: '投给全部会话' },
      { id: 'remote', zh: '跨机', en: 'REMOTE', hint: '本地 outbox，等另一台机器取', needPair: true },
      { id: 'clipboard', zh: '剪贴板', en: 'CLIP', hint: '打包成分享包复制走', info: true },
      { id: 'external', zh: '导出', en: 'EXPORT', hint: '导出成外发文件', info: true },
    ]
    const TARGET_ZH = TARGETS.reduce((a, t) => { a[t.id] = t.zh; return a }, {})

    function fmtTime(ts) {
      const d = new Date(ts || Date.now())
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    function fmtSize(n) {
      if (!n && n !== 0) return ''
      if (n < 1024) return `${n} B`
      if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
      return `${(n / 1048576).toFixed(1)} MB`
    }
    function dayLabel(ts) {
      const d = new Date(ts || Date.now())
      const now = new Date()
      const same = (a, b) => a.toDateString() === b.toDateString()
      if (same(d, now)) return '今天 · TODAY'
      if (same(d, new Date(now.getTime() - 86400000))) return '昨天 · YESTERDAY'
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    async function api(url, options) {
      const res = await fetch(url, Object.assign({ headers: { accept: 'application/json' } }, options || {}))
      if (!res.ok) {
        let detail = ''
        try { detail = (await res.json()).error || '' } catch { /* ignore */ }
        throw new Error(`${res.status}${detail ? ` ${detail}` : ''}`)
      }
      return res.json()
    }
    const post = (url, body) => api(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })

    function safeContentUrl(value) {
      if (typeof value !== 'string' || !value || /[\u0000-\u0020]/.test(value)) return null
      if (/^https?:\/\//i.test(value)) {
        try { const u = new URL(value); return u.username || u.password ? null : value } catch { return null }
      }
      return /^\/api\/open-world\/chat\/file\?[^#]+$/.test(value) ? value : null
    }

    function renderMessageText(text) {
      const value = String(text || ''), out = []
      const re = /\[([^\]\n]+)\]\((https?:\/\/[^\s<>"']+)\)|(https?:\/\/[^\s<>"'，。！？）]+)/g
      let last = 0
      for (const m of value.matchAll(re)) {
        if (m.index > last) out.push(value.slice(last, m.index))
        const raw = m[2] || m[3], url = m[2] ? raw : raw.replace(/[).,;!\]]+$/, '')
        const safe = safeContentUrl(url)
        out.push(safe ? React.createElement('a', { key: m.index, href: safe, target: '_blank', rel: 'noopener noreferrer', style: { color: 'inherit', textDecoration: 'underline', overflowWrap: 'anywhere' } }, m[1] || url) : m[0])
        if (!m[2] && raw.length > url.length) out.push(raw.slice(url.length))
        last = m.index + m[0].length
      }
      if (last < value.length) out.push(value.slice(last))
      return out
    }

    function AttachmentPreview({ attachment, onClose }) {
      const [state, setState] = useState({ loading: true })
      useEffect(() => {
        const controller = new AbortController()
        const url = safeContentUrl(attachment.url)
        if (!url || !url.startsWith('/api/open-world/chat/file?')) { setState({ error: '此附件不支持内嵌预览，请下载后打开。' }); return }
        ;(async () => {
          try {
            const response = await fetch(url, { signal: controller.signal })
            if (!response.ok) throw new Error(response.status === 404 ? '附件已不存在，或地址无效。' : `读取失败（${response.status}）`)
            const name = attachment.name || ''
            if (/\.(txt|md|json|csv|log|html?)$/i.test(name)) setState({ text: await response.text(), html: /\.html?$/i.test(name) })
            else if (/\.(png|jpe?g|gif|webp)$/i.test(name)) setState({ image: url })
            else setState({ downloadOnly: true })
          } catch (e) { if (!controller.signal.aborted) setState({ error: e.message }) }
        })()
        return () => controller.abort()
      }, [attachment])
      const url = safeContentUrl(attachment.url)
      const download = url && url.startsWith('/api/open-world/chat/file?') ? url + '&download=1' : url
      return React.createElement('section', { 'aria-label': '附件预览', style: { padding: 12, border: '1px solid var(--am1)', marginBottom: 10 } },
        React.createElement('strong', null, attachment.name || '附件'),
        React.createElement('button', { type: 'button', className: 'btn', onClick: onClose, style: { marginLeft: 12 } }, '关闭预览'),
        download && React.createElement('a', { href: download, download: attachment.name, className: 'chip', style: { marginLeft: 8 } }, '下载文件'),
        state.loading && React.createElement('p', null, '正在读取…'),
        state.error && React.createElement('p', { role: 'alert' }, state.error),
        state.downloadOnly && React.createElement('p', null, '此格式请下载后用对应应用打开。'),
        state.image && React.createElement('img', { src: state.image, alt: attachment.name, style: { display: 'block', maxWidth: '100%', maxHeight: 400 } }),
        state.html ? React.createElement('iframe', { title: attachment.name, sandbox: '', srcDoc: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">${state.text}`, style: { width: '100%', height: 360, border: 0, background: 'white' } })
          : state.text !== undefined && React.createElement('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 360, overflow: 'auto' } }, state.text))
    }

    function ChatDock({ compact, mailbox: mailboxProp, hub, onInject, onAction, setToast }) {
      const [threads, setThreads] = useState([])
      const [threadId, setThreadId] = useState(null)
      const [messages, setMessages] = useState([])
      const [draft, setDraft] = useState('')
      const [pending, setPending] = useState([])
      const [uploaded, setUploaded] = useState([])
      const [view, setView] = useState('chat')
      const [preview, setPreview] = useState(null)
      const [target, setTarget] = useState('local')
      const [moreTargets, setMoreTargets] = useState(false)
      const [attachTopo, setAttachTopo] = useState(false)
      const [attachMem, setAttachMem] = useState(false)
      const [memOpen, setMemOpen] = useState(false)
      const [memQuery, setMemQuery] = useState('')
      const [memHits, setMemHits] = useState([])
      const [memSource, setMemSource] = useState(null)
      const [mbox, setMbox] = useState(mailboxProp || null)
      const [filter, setFilter] = useState('all')
      const [mq, setMq] = useState('')
      const [sending, setSending] = useState(false)
      const [flash, setFlash] = useState(null)
      const [state, setState] = useState({ online: false, error: null, hint: MAX_HINT })
      const [q, setQ] = useState('')
      const fileRef = useRef(null)
      const listRef = useRef(null)
      const mboxRef = useRef(null)
      const viewRef = useRef(view)
      viewRef.current = view

      const say = useCallback((text) => {
        setState((s) => ({ ...s, hint: text }))
        if (setToast) setToast(text)
      }, [setToast])
      const flashSay = useCallback((text) => {
        setFlash(text)
        setTimeout(() => setFlash(null), TOAST_MS)
      }, [])

      const load = useCallback(async (silent) => {
        if (viewRef.current === 'history') return
        try {
          const t = await api(C.CHAT_THREADS_URL)
          const list = t.threads || []
          setThreads(list)
          const active = threadId || (list[0] && list[0].id) || 'main'
          if (!threadId) setThreadId(active)
          const m = await api(`${C.CHAT_MESSAGES_URL}?thread=${encodeURIComponent(active)}&limit=300`)
          setMessages(m.messages || [])
          setState((s) => ({ ...s, online: true, error: null }))
          if (C.MESSAGES_URL) {
            api(C.MESSAGES_URL).then((mb) => setMbox(mb)).catch(() => {})
          }
          if (viewRef.current === 'chat') post(C.CHAT_READ_URL, { threadId: active }).catch(() => {})
        } catch (err) {
          if (!silent) setState((s) => ({ ...s, online: false, error: String(err.message || err) }))
        }
      }, [threadId])

      useEffect(() => { if (view === 'history') return; load(false); const iv = setInterval(() => load(true), POLL_MS); return () => clearInterval(iv) }, [load, view])
      useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages.length, threadId, view])
      useEffect(() => { if (preview && listRef.current) listRef.current.scrollTop = 0 }, [preview])
      useEffect(() => { const el = mboxRef.current; if (el) el.scrollTop = el.scrollHeight }, [view])

      const upload = useCallback(async (files) => {
        for (const f of Array.from(files || [])) {
          try {
            const res = await fetch(`${C.CHAT_UPLOAD_URL}?thread=${encodeURIComponent(threadId || 'main')}&name=${encodeURIComponent(f.name)}`, {
              method: 'POST', headers: { 'content-type': f.type || 'application/octet-stream' }, body: f,
            })
            const data = await res.json()
            if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
            setUploaded((u) => [...u, data.attachment])
            setPending((p) => [...p, { name: f.name, size: f.size }])
            say(`已加入 ${f.name}，点「发送」一起发出`)
          } catch (err) { say(`上传失败 ${f.name}：${err.message || err}`) }
        }
      }, [threadId, say])

      const searchMem = useCallback(async () => {
        const q2 = memQuery.trim()
        if (!q2 || !C.MEMORY_SEARCH_URL) return
        try {
          const data = await api(`${C.MEMORY_SEARCH_URL}?q=${encodeURIComponent(q2)}`)
          setMemHits((data && data.items) || [])
          setMemSource((data && data.source) || (data && data.daemon ? 'daemon' : 'offline'))
          setAttachMem(true)
        } catch (err) { say(`检索失败：${err.message || err}`) }
      }, [memQuery, say])

      const deliver = useCallback(async (text, atts) => {
        if (target === 'local') return null
        if (target === 'agent') {
          throw new Error('请在原生问答中明确选择会话；不会投递到桌面当前会话')
        }
        const attachments = []
        if (attachMem && memHits.length) {
          attachments.push({ type: 'memory', items: memHits.slice(0, 5), source: memSource || 'hindsight' })
        }
        const data = await post(C.OW_ACTION_URL, {
          action: 'send-message', to: target, body: text,
          attachSnapshot: attachTopo,
          attachments,
          attachMemory: attachMem && memHits.length ? memHits.slice(0, 5) : undefined,
        })
        if (target === 'clipboard' && data && data.share && navigator.clipboard) {
          try { await navigator.clipboard.writeText(JSON.stringify(data.share, null, 2)) } catch { /* 剪贴板不可用不影响投递 */ }
        }
        return TARGET_ZH[target] || target
      }, [target, attachTopo, attachMem, memHits, memSource, onInject])

      const send = useCallback(async () => {
        const text = draft.trim()
        const atts = uploaded
        if ((!text && atts.length === 0) || sending) return
        setSending(true)
        const localId = `local-${Date.now()}`
        setMessages((m) => [...m, {
          id: localId, role: 'user', text, attachments: atts, status: 'sending', ts: Date.now(),
        }])
        setDraft(''); setUploaded([]); setPending([])
        try {
          await post(C.CHAT_POST_URL, { threadId: threadId || 'main', text, attachments: atts, role: 'user' })
          const where = await deliver(text, atts)
          if (where) flashSay(`✓ 已投递 · ${where}`)
          await load(true)
        } catch (err) {
          setMessages((m) => m.map((x) => (x.id === localId ? { ...x, status: 'failed' } : x)))
          say(`发送失败：${err.message || err}`)
        } finally { setSending(false) }
      }, [draft, uploaded, sending, threadId, deliver, load, say, flashSay])

      const markRead = useCallback(async (ids) => {
        if (!ids || ids.length === 0) return
        try {
          await post(C.OW_ACTION_URL, { action: 'mark-read', ids })
          const mb = await api(C.MESSAGES_URL)
          setMbox(mb)
        } catch (err) { say(`标记已读失败：${err.message || err}`) }
      }, [say])

      const shareSnapshot = useCallback(async () => {
        try {
          const data = await post(C.OW_ACTION_URL, { action: 'share-snapshot', to: 'external', body: '开放世界拓扑快照' })
          flashSay(data && data.outboxFile ? '✓ 已导出到 outbox' : '✓ 快照已分享')
          api(C.MESSAGES_URL).then((mb) => setMbox(mb)).catch(() => {})
        } catch (err) { say(`分享失败：${err.message || err}`) }
      }, [say, flashSay])

      const openChatView = useCallback(() => {
        if (C.CHAT_VIEW_URL) window.open(C.CHAT_VIEW_URL, '_blank', 'noopener')
      }, [])
      /* v106 成文：一键把草稿（或会话末段）投递给助手，用 office 插件生成 Word 文档（Tianshu 甄别 #6 · 走生态原生件） */
      const makeDoc = useCallback(async () => {
        if (sending) return
        const EOL = String.fromCharCode(10)
        const src = draft.trim() || messages
          .filter((m) => m.text && (m.role === 'user' || m.role === 'agent'))
          .slice(-20)
          .map((m) => `${ROLE_ZH[m.role] || m.role}：${m.text}`)
          .join(EOL)
        if (!src) { say('没有可成文的内容：先写点草稿，或等会话有来有往'); return }
        const body = `【成文请求】请把以下内容整理成一份 Word 文档（.docx，含标题/分节/要点），生成后回信告知文件路径。${EOL}----${EOL}${src.slice(0, 6000)}`
        const localId = `local-${Date.now()}`
        setMessages((m) => [...m, { id: localId, role: 'user', text: body, status: 'sending', ts: Date.now() }])
        setSending(true)
        try {
          await post(C.CHAT_POST_URL, { threadId: threadId || 'main', text: body, attachments: [], role: 'user' })
          await post(C.OW_ACTION_URL, { action: 'send-message', to: 'sessions', body })
          flashSay('✓ 成文请求已投递 · 助手生成文档后会回信到信箱')
          setDraft('')
          await load(true)
        } catch (err) {
          setMessages((m) => m.map((x) => (x.id === localId ? { ...x, status: 'failed' } : x)))
          say(`成文请求失败：${err.message || err}`)
        } finally { setSending(false) }
      }, [sending, draft, messages, threadId, say, flashSay, load])

      // ── 数据切面 ───────────────────────────────────────────────────
      const messages2 = mbox && mbox.messages ? mbox.messages : []
      const unread = (mbox && mbox.unread) || 0
      const remoteReady = !!(hub && hub.pair && (hub.pair.paired || hub.remoteMessaging?.paired))
      const filteredThreads = q
        ? threads.filter((t) => `${t.title || ''} ${t.lastMessage || ''}`.toLowerCase().includes(q.toLowerCase()))
        : threads
      const mboxFiltered = messages2
        .filter((m) => (filter === 'unread' ? m.direction === 'in' && !m.read
          : filter === 'out' ? m.direction !== 'in' : true))
        .filter((m) => !mq.trim() || String(m.body || '').toLowerCase().includes(mq.trim().toLowerCase()))

      const groups = []
      for (const m of messages) {
        const day = dayLabel(m.ts)
        const last = groups[groups.length - 1]
        if (!last || last.day !== day) groups.push({ day, items: [m] })
        else last.items.push(m)
      }

      const messageCard = (m) => {
        const atts = (m.attachments || []).map((a) => {
          const url = safeContentUrl(a.url), key = a.id || a.name
          if (!url) return React.createElement('span', { key, className: 'chip', title: '附件地址缺失或无效' }, (a.name || '附件') + '（不可用）')
          if (url.startsWith('/api/open-world/chat/file?')) return React.createElement('button', { key, type: 'button', className: 'chip', title: '在此处预览附件', onClick: () => setPreview(a) }, a.name, ' · ', fmtSize(a.bytes))
          return React.createElement('a', { key, href: url, target: '_blank', rel: 'noopener noreferrer', className: 'chip', title: '在浏览器打开附件' }, a.name)
        })
        return React.createElement('div', { key: m.id, className: `card ${ROLE_CLS[m.role] || 'ag'}` },
          React.createElement('div', { className: 'meta' },
            React.createElement('span', { className: m.role === 'user' ? 'warn' : (m.role === 'agent' ? 'info' : 'dim') },
              ROLE_ZH[m.role] || m.role),
            React.createElement('span', null, fmtTime(m.ts)),
            m.status === 'sending' ? React.createElement('span', { className: 'dim' }, '发送中…') : null,
            m.status === 'failed' ? React.createElement('span', { className: 'bad' }, '发送失败') : null),
          m.text ? React.createElement('div', { className: 'ln' }, renderMessageText(m.text)) : null,
          atts.length > 0 && React.createElement('div', { style: { paddingTop: 5 } }, atts))
      }

      const mboxCard = (m) => {
        const isIn = m.direction === 'in'
        const unseen = isIn && !m.read
        const atts = []
        for (const a of ((m.payload && m.payload.attachments) || [])) {
          if (a.type === 'memory') atts.push(`Hindsight · ${(a.items || []).length} 条`)
          else if (a.type === 'snapshot') atts.push('拓扑快照')
          else atts.push(a.type || '附件')
        }
        if (m.payload && m.payload.snapshot && !atts.some((t) => t.indexOf('拓扑') >= 0)) atts.push('拓扑快照')
        if (m.kind === 'notification') atts.push('通知中心')
        return React.createElement('div', {
          key: m.id, className: `card ${isIn ? 'ag' : 'me'}`,
          style: { cursor: unseen ? 'pointer' : 'default', opacity: unseen ? 1 : 0.86 },
          title: unseen ? '点击标记为已读' : undefined,
          onClick: () => { if (unseen) markRead([m.id]) },
        },
          React.createElement('div', { className: 'meta' },
            React.createElement('span', { className: isIn ? 'info' : 'warn' }, isIn ? '收' : '发'),
            React.createElement('span', null, m.toLabel || TARGET_ZH[m.to] || m.to || '本地'),
            React.createElement('span', null, fmtTime(m.ts)),
            unseen ? React.createElement('span', { className: 'badge' }, '未读') : null),
          React.createElement('div', { className: 'ln' }, renderMessageText(m.body || '（空消息）')),
          atts.length > 0 && React.createElement('div', { style: { paddingTop: 5 } },
            atts.map((t, i) => React.createElement('span', {
              key: `${m.id}-a-${i}`, className: 'chip att', style: { marginRight: 5 },
            }, t))))
      }

      const threadRow = (t) => React.createElement('div', {
        key: t.id, className: `row${view === 'chat' && t.id === threadId ? ' on' : ''}`,
        'data-thread-id': t.id, role: 'button', tabIndex: 0,
        onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click() } },
        onClick: () => {
          if (t.id !== threadId) { setMessages([]); setPreview(null) }
          setThreadId(t.id); setView('chat'); setPending([]); setUploaded([])
        },
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          React.createElement('span', { className: view === 'chat' && t.id === threadId ? 'warn' : '' }, t.title || t.id),
          t.unread ? React.createElement('span', { className: 'badge', style: { marginLeft: 'auto' } }, t.unread) : null),
        React.createElement('div', { className: 'dim ell', style: { fontSize: 10.5 } }, t.lastMessage || '（还没有消息）'))

      // ── 组装 ───────────────────────────────────────────────────────
      const rail = React.createElement('div', {
        style: {
          width: compact ? 182 : 220, flexShrink: 0, borderRight: '1px solid var(--am1)',
          padding: '0 8px 8px 0', display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(4,3,2,.35)',
        },
      },
        React.createElement('div', { className: 'sect' }, '会话 · THREADS'),
        React.createElement('input', {
          className: 'inp', type: 'search', value: q, placeholder: '搜索会话…',
          onChange: (e) => setQ(e.target.value),
        }),
        React.createElement('div', { className: 'body', style: { maxHeight: 330 } },
          filteredThreads.map(threadRow),
          filteredThreads.length === 0 && React.createElement('div', { className: 'muted', style: { fontSize: 10.5, padding: '6px 8px' } }, '还没有会话')),
        React.createElement('div', { className: 'divider' }),
        React.createElement('div', {
          className: `row${view === 'inbox' ? ' on' : ''}`,
          title: '原来的「消息总线」记录都在这里',
          onClick: () => setView('inbox'),
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            React.createElement('span', { className: view === 'inbox' ? 'warn' : '' }, '信箱 · 投递记录'),
            unread > 0 ? React.createElement('span', { className: 'badge', style: { marginLeft: 'auto' } }, unread)
              : React.createElement('span', { className: 'dim', style: { marginLeft: 'auto', fontSize: 10 } }, messages2.length)),
          React.createElement('div', { className: 'dim ell', style: { fontSize: 10.5 } }, 'open-world/mailbox.json')),
        React.createElement('div', { className: 'foot', style: { borderTop: 'none', padding: '6px 8px 0' } },
          React.createElement('span', null, C.CHAT_VIEW_URL ? '独立页 ↗' : ''),
          C.CHAT_VIEW_URL ? null : null),
        C.CHAT_VIEW_URL && React.createElement('span', {
          className: 'chip', style: { margin: '0 8px' }, title: '在新标签打开独立聊天页（含离线演示）',
          onClick: openChatView,
        }, '打开独立页'))

      const targetRow = React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', paddingTop: 6 } },
        React.createElement('span', { className: 'en', style: { color: 'var(--tx3)' } }, '投递到'),
        React.createElement('button', { type: 'button', className: 'chip', onClick: () => setView('history'), title: '明确选择会话，在世界内接收回复；当前记录草稿不会自动发送' }, '原生问答'),
        TARGETS.filter((t) => (!t.needPair || remoteReady) && (moreTargets || t.id === 'local')).map((t) => React.createElement('span', {
          key: t.id, className: `chip${target === t.id ? ' on' : ''}${t.info ? ' info' : ''}`,
          title: t.hint || '', onClick: () => setTarget(t.id),
        }, t.zh)),
        React.createElement('button', { type: 'button', className: 'chip', onClick: () => setMoreTargets(v => !v) }, moreTargets ? '收起投递方式' : '更多投递方式'),
        target !== 'local' && React.createElement('span', { className: 'muted', style: { fontFamily: 'var(--mono)', fontSize: 9 } },
          `→ ${TARGET_ZH[target]}`))

      const attachRow = React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', paddingTop: 5 } },
        React.createElement('span', { className: 'en', style: { color: 'var(--tx3)' } }, '随行'),
        React.createElement('span', {
          className: `chip att${attachTopo ? ' on' : ''}`, title: '把当前 ATI 拓扑/快照一并附上',
          onClick: () => setAttachTopo((v) => !v),
        }, '拓扑'),
        React.createElement('span', {
          className: `chip att${attachMem ? ' on' : ''}`, title: '把检索到的记忆一并附上',
          onClick: () => setAttachMem((v) => !v),
        }, 'Hindsight'),
        React.createElement('span', {
          className: `chip${memOpen ? ' on' : ''}`, title: '检索记忆库',
          onClick: () => setMemOpen((v) => !v),
        }, memOpen ? '收起检索' : '检索记忆…'),
        React.createElement('span', {
          className: `chip att${sending ? ' on' : ''}`, title: '成文：把草稿（或当前会话末段）投给助手，用 office 插件整理成 Word 文档，回信到信箱',
          onClick: makeDoc,
        }, '成文'),
        memHits.length > 0 && React.createElement('span', { className: 'dim', style: { fontSize: 10 } }, `命中 ${memHits.length} 条`))

      const composer = React.createElement('div', { style: { padding: '8px 10px 0' } },
        pending.length > 0 && React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 5, paddingBottom: 5 } },
          pending.map((f, i) => React.createElement('span', { key: `${f.name}-${i}`, className: 'chip' },
            `${f.name}`, React.createElement('span', { className: 'muted' }, fmtSize(f.size))))),
        React.createElement('textarea', {
          className: 'inp', value: draft, rows: 3,
          placeholder: '说点什么… Enter 发送 · Shift+Enter 换行 · 可直接拖入或粘贴文件',
          onChange: (e) => setDraft(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } },
          onDragOver: (e) => e.preventDefault(),
          onDrop: (e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files) upload(e.dataTransfer.files) },
          onPaste: (e) => { const f = e.clipboardData && e.clipboardData.files; if (f && f.length) upload(f) },
        }),
        targetRow,
        attachRow,
        memOpen && React.createElement('div', { style: { paddingTop: 6 } },
          React.createElement('div', { style: { display: 'flex', gap: 6 } },
            React.createElement('input', {
              className: 'inp', value: memQuery, placeholder: '在 Hindsight 里搜一段记忆…',
              onChange: (e) => setMemQuery(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') searchMem() },
            }),
            React.createElement('button', { type: 'button', className: 'btn', onClick: searchMem }, '搜')),
          React.createElement('div', { className: 'muted', style: { fontSize: 9.5, paddingTop: 3 } },
            memSource ? `来源 · Hindsight · ${memSource}` : '来源 · Hindsight（daemon/cache/offline）'),
          memHits.slice(0, 4).map((m, i) => React.createElement('div', {
            key: m.id || i, className: 'dim', style: { fontSize: 10.5, paddingLeft: '1.4em', textIndent: '-1.4em' },
          }, `· ${String(m.text || '').slice(0, 110)}`))),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' } },
          React.createElement('button', {
            type: 'button', className: 'btn', title: '选择文件（也可以拖进来或直接粘贴）',
            onClick: () => fileRef.current && fileRef.current.click(),
          }, '📎 附件'),
          React.createElement('input', {
            ref: fileRef, type: 'file', multiple: true, style: { display: 'none' },
            onChange: (e) => { upload(e.target.files); e.target.value = '' },
          }),
          React.createElement('button', {
            type: 'button', className: 'btn primary', style: { marginLeft: 'auto' },
            onClick: send, disabled: sending || (!draft.trim() && uploaded.length === 0),
          }, sending ? '发送中…' : (target === 'local' ? '保存记录' : `发送 → ${TARGET_ZH[target]}`)),
          React.createElement('span', { className: 'muted', style: { fontFamily: 'var(--mono)', fontSize: 9, flexBasis: '100%' } },
            flash ? React.createElement('span', { className: 'ok' }, flash) : state.hint)))

      const inboxView = React.createElement('div', {
        style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '0 10px 8px' },
      },
        React.createElement('div', { className: 'sect' }, `投递记录 · ${mboxFiltered.length} 条${unread ? ` · 未读 ${unread}` : ''}`),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' } },
          React.createElement('span', {
            className: `chip${filter === 'all' ? ' on' : ''}`, onClick: () => setFilter('all'),
          }, `全部 ${messages2.length}`),
          React.createElement('span', {
            className: `chip${filter === 'unread' ? ' on' : ''}`, onClick: () => setFilter('unread'),
          }, `未读 ${unread}`),
          React.createElement('span', {
            className: `chip${filter === 'out' ? ' on' : ''}`, onClick: () => setFilter('out'),
          }, '我发的'),
          React.createElement('input', {
            className: 'inp', type: 'search', value: mq, placeholder: '搜索投递记录…',
            style: { flex: 1, minWidth: 90 }, onChange: (e) => setMq(e.target.value),
          }),
          unread > 0 && React.createElement('button', {
            type: 'button', className: 'btn',
            onClick: () => markRead(messages2.filter((m) => m.direction === 'in' && !m.read).map((m) => m.id)),
          }, '全部已读'),
          React.createElement('button', { type: 'button', className: 'btn', onClick: shareSnapshot }, '分享快照')),
        React.createElement('div', { ref: mboxRef, className: 'body', style: { paddingTop: 4 } },
          mboxFiltered.length === 0 && React.createElement('div', {
            className: 'muted', style: { fontSize: 11, padding: '22px 0', textAlign: 'center' },
          }, '还没有投递记录 —— 回会话里选个投递目标发一句试试'),
          mboxFiltered.slice(0, 80).map(mboxCard)),
        React.createElement('div', { className: 'foot', style: { borderTop: 'none', padding: '6px 0 0' } },
          React.createElement('span', null, '收 / 发 记录落 open-world/mailbox.json'),
          React.createElement('span', { style: { marginLeft: 'auto' } }, remoteReady ? '跨机就绪' : '本机')))

      const chatView = React.createElement('div', {
        style: { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 10px 0' },
      },
        React.createElement('div', { className: 'sect' }, `消息 · ${messages.length} 条`),
        React.createElement('div', { ref: listRef, className: 'body', style: { flex: 1, minHeight: 60, overflowY: 'auto' } },
          preview && React.createElement(AttachmentPreview, { attachment: preview, onClose: () => setPreview(null) }),
          groups.map((g) => React.createElement('div', { key: g.day },
            React.createElement('div', { className: 'sect', style: { paddingTop: 4 } }, g.day),
            g.items.map(messageCard))),
          messages.length === 0 && React.createElement('div', {
            className: 'muted', style: { fontSize: 11, padding: '26px 0', textAlign: 'center' },
          }, '这里保存消息与附件；转到桌面会话后，助手回复在该会话中显示。')),
        !preview && composer)

      return React.createElement('div', { className: 'owd', style: { height: '100%', minHeight: 0 } },
        React.createElement('style', { dangerouslySetInnerHTML: { __html: SKIN } }),
        React.createElement('div', { className: 'panel', style: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
          React.createElement('div', { className: 'head' },
            React.createElement('span', { className: state.online ? 'sig' : 'sig red' }),
            React.createElement('span', { className: 'zh' }, '消息与附件'),
            React.createElement('button', { type: 'button', className: 'btn', 'data-history-toggle': true, onClick: () => setView(view === 'history' ? 'chat' : 'history') }, view === 'history' ? '本地记录' : '历史会话'),
            view !== 'history' && React.createElement('span', { className: 'tag' },
              `${threads.length} 个会话 · 信箱 ${messages2.length} 条${unread ? ` · 未读 ${unread}` : ''}`,
              state.error ? ` · ${state.error}` : '')),
          React.createElement('div', { className: 'ruler' }),
          view === 'history' ? React.createElement(HistoryBrowser) : React.createElement('div', { style: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' } },
            rail, view === 'inbox' ? inboxView : chatView)))
    }

    exports.safeContentUrl = safeContentUrl
    exports.renderMessageText = renderMessageText
    exports.ChatDock = ChatDock
    exports.TARGETS = TARGETS
    return module.exports
  },
})
