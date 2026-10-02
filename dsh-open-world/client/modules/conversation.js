// Explicit native Session conversation. No model selection, task activation or second transcript store.
window.__ModuleLoader__.load({
  id: 'dsh-open-world/conversation',
  factory: (require) => {
    const React = require('react'), { useState, useEffect, useRef } = React, h = React.createElement
    const OUTBOX = 'ow-native-outbox:', BOOKMARK = 'ow-native-selection'
    const methods = ['session/list', 'session/page', 'session/create', 'session/rename', 'session/prompt', 'session/cancel']
    function bookmark(value) { try { if (value) sessionStorage.setItem(BOOKMARK, JSON.stringify(value)); else return JSON.parse(sessionStorage.getItem(BOOKMARK) || 'null') } catch { return null } }
    function pendingFor(id) { try { const p = JSON.parse(sessionStorage.getItem(OUTBOX + id) || 'null'); return p?.request?.sessionId === id && typeof p.request.requestId === 'string' && Array.isArray(p.request.content) ? p : null } catch { return null } }
    function savePending(id, value) { if (value) sessionStorage.setItem(OUTBOX + id, JSON.stringify(value)); else sessionStorage.removeItem(OUTBOX + id) }
    async function rpcSession(method, args, signal) {
      if (!methods.includes(method)) throw new Error('不支持的会话操作')
      if (method !== 'session/list' && (typeof (args.request?.sessionId || args.request?.address?.sessionId) !== 'string' || !(args.request?.sessionId || args.request?.address?.sessionId).trim())) throw new Error('必须明确指定会话')
      const controller = new AbortController(), abort = () => controller.abort(), timer = setTimeout(abort, 15000)
      if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', abort, { once: true })
      try {
        const rpcId = crypto.randomUUID()
        const r = await fetch('/api/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } }), signal: controller.signal })
        if (!r.ok) throw new Error(`会话接口失败（${r.status}）`)
        const j = await r.json()
        if (j.rpcId !== rpcId || !j.result || typeof j.result.ok !== 'boolean') throw new Error('会话响应无效')
        if (!j.result.ok) { const e = new Error(j.result.error?.message || '会话操作被拒绝'); e.definite = true; throw e }
        return j.result.value
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    }
    function hasReceipt(records, pending) {
      return !!pending && records.some(r => { const e = r.event; return e?.type === 'user/message' && e.data?.source?.rpcId === pending.request.requestId || e?.type === 'agent/inbox/spliced' && e.data?.inserted?.some(m => m.source?.rpcId === pending.request.requestId) })
    }
    function turnState(records, summary, pending) {
      const events = records.map(r => r.event).filter(Boolean).sort((a, b) => a.seq - b.seq)
      const user = pending && events.find(e => e.type === 'user/message' && e.data?.source?.rpcId === pending.request.requestId)
      const start = user && events.filter(e => e.type === 'turn/start' && e.seq < user.seq).at(-1)
      const end = user && start && events.find(e => e.type === 'turn/end' && e.seq > user.seq && e.data?.turn === start.data?.turn)
      const earlyError = pending && !user && events.filter(e => e.type === 'turn/end' && e.seq > pending.baseSeq && e.data?.reason?.kind === 'error').at(-1)
      if (earlyError && !summary?.running) return { phase: 'error', done: false, label: '会话运行失败，发送状态仍需核对', error: earlyError.data.reason.error?.message || '原生会话返回错误' }
      if (pending && !end) return { phase: user && summary?.running ? 'running' : 'waiting', done: false, label: user && summary?.running ? '正在回答…' : '已提交，等待原生会话处理…' }
      const last = end || events.filter(e => e.type === 'turn/end').at(-1)
      if (!pending && summary?.running) return { phase: 'running', done: false, label: '此会话正在运行…' }
      if (!last) return { phase: 'idle', done: false, label: '可以提问' }
      const kind = last.data?.reason?.kind
      if (kind === 'error') return { phase: 'error', done: !!end, label: '本轮失败', error: last.data.reason.error?.message || '原生会话返回错误' }
      if (kind !== 'completed') return { phase: 'stopped', done: !!end, label: '本轮已结束（' + (kind || '原因未提供') + '）' }
      const begin = events.filter(e => e.type === 'turn/start' && e.seq < last.seq && e.data?.turn === last.data?.turn).at(-1)
      const reply = begin && events.some(e => e.type === 'assistant/message' && e.seq > begin.seq && e.seq < last.seq)
      return { phase: 'complete', done: !!end, label: reply ? '回复已完成' : '本轮结束，未返回助手消息' }
    }
    function NewConversation({ onCreated, onBack }) {
      const [cwd, setCwd] = useState(''), [name, setName] = useState('世界问答'), [busy, setBusy] = useState(false), [error, setError] = useState('')
      const id = useRef('ow-chat-' + crypto.randomUUID()), lock = useRef(false), life = useRef(null), identity = useRef(null)
      useEffect(() => { life.current = new AbortController(); return () => life.current.abort() }, [])
      async function create(e) {
        e.preventDefault(); if (lock.current || !cwd.trim()) return
        if (!/^(?:[A-Za-z]:[\\/]|\/)/.test(cwd.trim()) || /[\u0000-\u001f]/.test(cwd)) { setError('请填写已有工作区的绝对路径'); return }
        lock.current = true; setBusy(true); setError('')
        // Keep identical identity after an ambiguous creation response.
        const request = identity.current || (identity.current = { sessionId: id.current, cwd: cwd.trim() })
        try {
          const created = await rpcSession('session/create', { request }, life.current.signal)
          if (created?.sessionId !== id.current) throw new Error('新会话返回的身份不匹配')
          let warning = ''
          if (name.trim()) try { await rpcSession('session/rename', { request: { sessionId: id.current, title: name.trim() } }, life.current.signal) } catch { warning = '会话已创建，但名称未保存。' }
          if (!life.current.signal.aborted) onCreated({ sessionId: id.current, cwd: request.cwd, projections: { values: { title: name.trim() || '世界问答' } } }, warning)
        } catch (e) { if (!life.current.signal.aborted) { if (e.definite) identity.current = null; setError(e.message + '；重试将沿用同一会话 ID。') } }
        finally { lock.current = false; if (!life.current.signal.aborted) setBusy(false) }
      }
      return h('form', { className: 'ow-native-new', onSubmit: create, 'data-native-new': true }, h('style', null, css), h('h3', null, '新建问答'),
        h('p', null, '使用原生会话与现有模型。发送后，助手可能按你的要求使用该工作区工具。'),
        h('label', null, '工作区绝对路径', h('input', { className: 'inp', value: cwd, disabled: busy || !!identity.current, required: true, 'aria-label': '问答工作区', placeholder: 'D:/项目目录', onChange: e => setCwd(e.target.value) })),
        h('label', null, '会话名称', h('input', { className: 'inp', value: name, maxLength: 80, disabled: busy, 'aria-label': '问答名称', onChange: e => setName(e.target.value) })),
        error && h('p', { role: 'alert' }, error), h('button', { className: 'btn', type: 'submit', disabled: busy || !cwd.trim() }, busy ? '正在创建…' : '创建会话'), h('button', { className: 'btn', type: 'button', onClick: onBack }, '返回'))
    }
    function Conversation({ session, onBack, toMessages, warning = '' }) {
      const id = session.sessionId, initial = pendingFor(id)
      const [draft, setDraft] = useState(initial?.request.content[0]?.text || ''), [pending, setPending] = useState(initial)
      const [snapshot, setSnapshot] = useState({ summary: session, records: [], ready: false }), [readError, setReadError] = useState('')
      const [operationError, setOperationError] = useState(warning), [uncertain, setUncertain] = useState(!!initial), [sending, setSending] = useState(false), [stopping, setStopping] = useState(false)
      const [refresh, setRefresh] = useState(0), [unlock, setUnlock] = useState(false), life = useRef(null), pendingRef = useRef(initial), lock = useRef(false), stopLock = useRef(false), tail = useRef(null), stick = useRef(true)
      useEffect(() => { const controller = new AbortController(); life.current = controller; return () => controller.abort() }, [])
      useEffect(() => {
        const controller = new AbortController(); let timer
        async function poll() {
          try {
            const list = await rpcSession('session/list', { _request: {} }, controller.signal)
            if (!Array.isArray(list?.items)) throw new Error('会话列表响应无效')
            const summary = list.items.find(s => s.sessionId === id)
            if (!summary) throw new Error('此会话已不可用，请返回列表核对')
            let records = []
            if (Number.isFinite(summary.projections?.asOfSeq)) {
              let throughSeq = summary.projections.asOfSeq
              // Follow the owned pending request across bounded pages; never mark an unrelated turn complete.
              for (let n = 0; n < 20; n++) {
                const page = await rpcSession('session/page', { request: { address: { kind: 'session', sessionId: id }, throughSeq, maxMessages: 30 } }, controller.signal)
                if (!Array.isArray(page?.records)) throw new Error('会话记录响应无效')
                records.push(...page.records)
                const p = pendingRef.current
                if (!p || !page.hasMore || records.some(r => r.event?.type === 'turn/start' && r.event.seq <= p.baseSeq + 1) || turnState(records, summary, p).done) break
                const min = Math.min(...page.records.map(r => r.event?.seq).filter(Number.isFinite))
                if (!Number.isFinite(min) || min <= p.baseSeq || min >= throughSeq) break
                throughSeq = min - 1
              }
            }
            if (controller.signal.aborted) return
            const status = turnState(records, summary, pendingRef.current)
            if (hasReceipt(records, pendingRef.current)) { setUncertain(false); setOperationError('') }
            if (status.error && !status.done && pendingRef.current && !summary.running) setUncertain(true)
            if (status.done && pendingRef.current) { savePending(id, null); pendingRef.current = null; setPending(null); setDraft(''); setUncertain(false); setOperationError('') }
            setSnapshot({ summary, records, ready: true }); setReadError('')
          } catch (e) { if (!controller.signal.aborted) setReadError('读取回复失败：' + e.message) }
          finally { if (!controller.signal.aborted) timer = setTimeout(poll, 1500) }
        }
        poll(); return () => { controller.abort(); clearTimeout(timer) }
      }, [id, refresh])
      const status = turnState(snapshot.records, snapshot.summary, pending), rows = toMessages(snapshot.records)
      useEffect(() => { if (stick.current) tail.current?.scrollIntoView({ block: 'nearest' }) }, [rows.at(-1)?.seq, rows.at(-1)?.text])
      async function send() {
        if (lock.current || pendingRef.current || !draft.trim() || !snapshot.ready || snapshot.summary.running || readError) return
        lock.current = true; setSending(true); setOperationError('')
        const p = { baseSeq: snapshot.summary.projections?.asOfSeq || 0, sentAt: Date.now(), request: { requestId: 'ow-prompt-' + crypto.randomUUID(), sessionId: id, mode: 'queue', content: [{ type: 'text', text: draft.trim() }], clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } }
        try {
          if (!p) return
          // Save only the in-flight outbox. Never blindly re-post an ambiguous native prompt.
          try { savePending(id, p) } catch { setOperationError('无法保存待确认请求，本次未发送；请检查浏览器存储。'); return }
          pendingRef.current = p; setPending(p); setUncertain(false)
          const accepted = await rpcSession('session/prompt', { request: p.request }, life.current.signal)
          if (accepted?.accepted !== true) throw new Error('未收到明确接收确认')
          if (!life.current.signal.aborted) { setDraft(''); setRefresh(v => v + 1) }
        } catch (e) {
          if (!life.current.signal.aborted) {
            if (e.definite) { savePending(id, null); pendingRef.current = null; setPending(null); setUncertain(false) }
            else { if (!pendingRef.current) return; setUncertain(true) }
            setOperationError(e.definite ? '发送被拒绝：' + e.message : '发送状态未确认：' + e.message + '。请核对发送状态；不会自动重发。')
          }
        } finally { lock.current = false; if (!life.current.signal.aborted) setSending(false) }
      }
      async function stop() {
        if (stopLock.current || !snapshot.summary.running) return
        stopLock.current = true; setStopping(true); setOperationError('')
        try { const r = await rpcSession('session/cancel', { request: { sessionId: id } }, life.current.signal); if (r?.accepted !== true) throw new Error('停止请求未确认'); if (!life.current.signal.aborted) { setOperationError('已请求停止当前回复；排队中的问题不会被删除。'); setRefresh(v => v + 1) } }
        catch (e) { if (!life.current.signal.aborted) setOperationError('停止状态未确认：' + e.message) }
        finally { stopLock.current = false; if (!life.current.signal.aborted) setStopping(false) }
      }
      return h('section', { className: 'ow-native-conversation', 'data-native-conversation': id }, h('style', null, css),
        h('header', null, h('strong', null, snapshot.summary.projections?.values?.title || '世界问答'), h('button', { type: 'button', className: 'btn', onClick: () => onBack(snapshot.summary) }, '历史与文件')),
        h('small', { className: 'ow-native-identity', title: `${id} · ${session.cwd || ''}` }, `${id} · ${session.cwd || ''}`),
        h('div', { className: 'ow-native-status', role: 'status', 'data-native-phase': status.phase }, sending ? '正在提交…' : uncertain && pending ? '发送状态待核对' : status.label),
        (readError || operationError || status.error) && h('div', { role: 'alert' }, readError || operationError || status.error),
        h('div', { className: 'ow-native-messages', 'aria-label': '原生会话对话', onScroll: e => { const x = e.currentTarget; stick.current = x.scrollHeight - x.scrollTop - x.clientHeight < 90 } },
          !snapshot.ready ? h('p', null, '正在读取会话…') : !rows.length ? h('p', null, '还没有对话。发送第一条问题。') : rows.map(m => h('article', { key: m.seq, 'data-native-message': m.role === '我' ? 'user' : 'assistant' }, h('strong', null, m.role), h('pre', null, m.text))),
          h('span', { ref: tail })),
        h('div', { className: 'ow-native-actions' }, h('button', { type: 'button', className: 'btn', onClick: () => setRefresh(v => v + 1) }, '刷新回复'),
          uncertain && pending && h('button', { type: 'button', className: 'btn', disabled: sending, onClick: () => setRefresh(v => v + 1) }, '核对发送状态'),
          uncertain && pending && !snapshot.summary.running && h('button', { type: 'button', className: 'btn', disabled: sending || !!readError, onClick: () => setUnlock(v => !v) }, '解除发送锁定'),
          snapshot.summary.running && h('button', { type: 'button', className: 'btn', disabled: stopping, onClick: stop }, stopping ? '正在请求停止…' : '停止当前回复')),
        unlock && uncertain && pending && h('div', { role: 'alert' }, '解除锁定不会撤回服务端请求；再次发送可能重复。', h('button', { type: 'button', className: 'btn', disabled: sending || !!readError || !!snapshot.summary.running, onClick: () => { savePending(id, null); pendingRef.current = null; setPending(null); setUncertain(false); setUnlock(false); setOperationError('已解除锁定，未重新发送。请先核对历史记录。') } }, '确认解除，不重发')),
        h('form', { onSubmit: e => { e.preventDefault(); send() } }, h('textarea', { className: 'inp', 'aria-label': '发送给此原生会话', placeholder: '向上方明确选定的会话提问…', rows: 3, value: draft, disabled: !!pending || sending, onChange: e => setDraft(e.target.value), onKeyDown: e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.nativeEvent?.isComposing) { e.preventDefault(); send() } } }),
          h('button', { className: 'btn', type: 'submit', disabled: !draft.trim() || !!pending || sending || !snapshot.ready || !!readError || !!snapshot.summary.running }, '发送问题')),
        h('small', null, '原生会话保留上下文；较早记录见“历史与文件”。离开此页不会停止回复。'))
    }
    const css = `.ow-history-main:has(.ow-native-conversation){display:flex;flex-direction:column;overflow:hidden}.ow-native-conversation{display:flex;flex-direction:column;flex:1;min-height:0;gap:8px;overflow:hidden}.ow-native-conversation header,.ow-native-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ow-native-conversation header strong{flex:1}.ow-native-identity{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}.ow-native-messages{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}.ow-native-messages article{margin:8px 0;padding:10px;background:#ffffff08;border:1px solid #ffffff18;border-radius:8px}.ow-native-messages article[data-native-message=user]{background:#629bff12}.ow-native-messages pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:6px 0}.ow-native-conversation form{flex-shrink:0;display:flex;align-items:flex-end;gap:8px}.ow-native-conversation textarea{flex:1;min-width:0;resize:vertical;max-height:150px}.ow-native-new label{display:flex;flex-direction:column;gap:8px;margin:12px 0}.ow-native-status{font-size:12px;color:#aacbff}`
    return { rpcSession, hasReceipt, turnState, bookmark, pendingFor, savePending, Conversation, NewConversation }
  },
})
