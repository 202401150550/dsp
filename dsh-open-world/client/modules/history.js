// Read-only Session history and artifact reopening inside the existing ChatDock.
window.__ModuleLoader__.load({
  id: 'dsh-open-world/history',
  factory: (require) => {
    const React = require('react')
    const { useState, useEffect, useRef } = React
    const h = React.createElement
    const { Conversation, NewConversation, bookmark } = require('dsh-open-world/conversation')
    const MAX_BYTES = 8 * 1024 * 1024
    // Same authenticated read-only endpoints used by the native document preview.
    // Optional legacy DI does not expose remote.workspaceFiles on every Desktop.
    let workspaceFiles = {
      stat: (sessionId, path, signal) => rpcRead('workspaceFiles/stat', { workspaceFileScopeId: sessionId, path }, signal),
      readBytes: (sessionId, path, options, signal) => rpcRead('workspaceFiles/readBytes', { workspaceFileScopeId: sessionId, path, options }, signal),
    }
    function configureWorkspaceFiles(service) {
      workspaceFiles = service
      return () => { if (workspaceFiles === service) workspaceFiles = null }
    }
    function validPath(path) {
      return typeof path === 'string' && path.trim().length > 0 && path.length <= 4096
        && !/[\u0000-\u001f]/.test(path) && !/^(https?|data|javascript|file):/i.test(path)
    }
    function mutationPath(data) {
      let a
      try { a = typeof data.arguments === 'string' ? JSON.parse(data.arguments) : data.arguments } catch { return null }
      if (!a || typeof a !== 'object') return null
      let path = null
      if (data.name === 'write' && typeof a.content === 'string') path = a.file_path
      if (data.name === 'edit' && typeof a.old_string === 'string' && a.old_string.length && typeof a.new_string === 'string' && a.old_string !== a.new_string) path = a.file_path
      if (data.name === 'str_replace_editor') {
        const allowed = (a.command === 'create' && typeof a.file_text === 'string')
          || (a.command === 'str_replace' && typeof a.old_str === 'string' && a.old_str.length > 0 && (a.new_str === undefined || typeof a.new_str === 'string'))
          || (a.command === 'insert' && Number.isInteger(a.insert_line) && a.insert_line >= 0 && typeof a.new_str === 'string')
        if (allowed) path = a.path
      }
      return validPath(path) ? path : null
    }
    function eventsOf(records) {
      return records.map(r => r.event).filter(e => e && Number.isFinite(e.seq)).sort((a, b) => a.seq - b.seq)
    }
    function collectArtifacts(records) {
      const calls = new Map(), files = new Map()
      function add(path, e, source, label) {
        if (!validPath(path)) return
        files.set(path, { path, name: typeof label === 'string' && label.trim() ? label : path.split(/[\\/]/).pop(), seq: e.seq, turn: e.data?.turn, source })
      }
      for (const e of eventsOf(records)) {
        const d = e.data || {}, key = `${d.turn}:${d.callId}`
        if (e.type === 'tool/call') calls.set(key, mutationPath(d))
        if (e.type === 'tool/result' && d.message && d.message.isError !== true && e.surfaceOp === 'append') {
          const path = calls.get(`${d.turn}:${d.message.source?.callId}`)
          if (path) add(path, e, '成功写入')
        }
        if (e.type === 'deliverables/presented' && Array.isArray(d.files)) {
          for (const f of d.files) if (f && typeof f === 'object') add(f.path, e, '明确交付', f.title)
        }
      }
      return [...files.values()].sort((a, b) => b.seq - a.seq)
    }
    function messageRows(records) {
      return eventsOf(records).filter(e => (e.type === 'user/message' && (!e.data?.source?.kind || e.data.source.kind === 'user')) || e.type === 'assistant/message').map(e => {
        const m = e.data?.message || e.data
        const text = typeof m?.content === 'string' ? m.content : Array.isArray(m?.content) ? m.content.filter(b => b.type === 'text').map(b => b.text).join('\n') : ''
        return { seq: e.seq, role: e.type === 'user/message' ? '我' : '助手', text }
      }).filter(m => m.text)
    }
    async function rpcRead(method, args, signal) {
      if (!['session/list', 'session/page', 'workspaceFiles/stat', 'workspaceFiles/readBytes', 'workspaceFiles/list'].includes(method)) throw new Error('历史浏览仅允许读取')
      const rpcId = crypto.randomUUID()
      const response = await fetch('/api/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } }), signal })
      if (!response.ok) throw new Error(`读取失败（${response.status}）`)
      let envelope, parts
      if ((response.headers.get('content-type') || '').startsWith('multipart/form-data')) {
        const reader = response.body.getReader(), chunks = []; let length = 0
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break
          length += chunk.value.byteLength
          if (length > MAX_BYTES + 65536) { await reader.cancel(); throw new Error('文件超过预览大小限制') }
          chunks.push(chunk.value)
        }
        parts = await new Response(new Blob(chunks), { headers: response.headers }).formData()
        if (typeof parts.get('metadata') !== 'string') throw new Error('文件响应缺少元数据')
        envelope = JSON.parse(parts.get('metadata'))
      } else envelope = await response.json()
      if (envelope.rpcId !== rpcId || !envelope.result?.ok) throw new Error(envelope.result?.error?.message || '会话服务未返回有效结果，请重试')
      if (parts) {
        const attachment = envelope.attachments?.find(a => a.codec === 'bytes' && a.path?.length === 1 && a.path[0] === 'data')
        const data = attachment && parts.get(attachment.part)
        if (!data || typeof data.arrayBuffer !== 'function' || data.size > MAX_BYTES) throw new Error('文件响应内容无效')
        envelope.result.value.data = new Uint8Array(await data.arrayBuffer())
      }
      return envelope.result.value
    }
    async function readArtifact(sessionId, file, signal) {
      if (!workspaceFiles) throw new Error('文件服务尚未就绪，请稍后重试')
      if (!validPath(file.path)) throw new Error('文件路径无效')
      const name = file.path.split(/[\\/]/).pop()
      if (/^(\.env(?:\..*)?|id_(rsa|ed25519)|credentials)$/i.test(name) || /\.(pem|key|p12|pfx)$/i.test(name)) throw new Error('敏感凭据文件不在历史预览中读取')
      const stat = await workspaceFiles.stat(sessionId, file.path, signal)
      if (!Number.isFinite(stat.bytes) || stat.bytes < 0) throw new Error('无法确定文件大小，未自动读取')
      if (stat.bytes > MAX_BYTES) throw new Error('文件超过 8 MB，请在原工作区打开')
      const result = await workspaceFiles.readBytes(sessionId, file.path, {}, signal)
      signal?.throwIfAborted()
      if (!result.data || result.data.byteLength > MAX_BYTES || result.eof !== true) throw new Error('文件未完整读取，未提供不完整预览')
      return result
    }
    const css = `.ow-history{display:flex;flex:1;min-height:0;min-width:0;gap:12px;padding:10px;color:var(--tx)}.ow-history button{font:inherit;color:inherit;cursor:pointer}.ow-history button:disabled{cursor:default;opacity:.5}.ow-history-nav{width:210px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;min-height:0}.ow-history-sessions{overflow:auto;min-height:0}.ow-history-session{display:block;width:100%;text-align:left;background:none;border:1px solid transparent;border-radius:8px;padding:10px;margin-bottom:4px;overflow-wrap:anywhere}.ow-history-session[aria-pressed=true]{background:var(--accSoft);border-color:var(--acc)}.ow-history-main{flex:1;min-width:0;min-height:0;overflow:auto}.ow-history-file{display:block;width:100%;text-align:left;border:1px solid var(--hair2);border-radius:9px;background:var(--panel);padding:10px;margin:8px 0;overflow-wrap:anywhere}.ow-history small{display:block;color:var(--tx2);font-size:11px;overflow-wrap:anywhere}.ow-history [data-history-text]{flex:1;min-height:0;overflow:auto}.ow-history pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace}.ow-history iframe{display:block;width:100%;flex:1;min-height:160px;height:auto;border:0;background:white}.ow-history img{display:block;max-width:100%;max-height:450px}.ow-history-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.ow-history [role=alert]{color:var(--red);overflow-wrap:anywhere}@media(max-width:700px){.ow-history{flex-direction:column}.ow-history-nav{width:auto;max-height:160px;flex-shrink:0}.ow-history-main{min-height:120px}}`
    function FilePreview({ session, file, onBack, backLabel = '返回会话' }) {
      const [state, setState] = useState({ loading: true }), [retry, setRetry] = useState(0)
      useEffect(() => {
        const controller = new AbortController(); let cancelled = false, objectUrl
        setState({ loading: true })
        ;(async () => {
          try {
            const result = await readArtifact(session.sessionId, file, controller.signal)
            if (cancelled) return
            const path = file.path, ext = path.split('.').pop().toLowerCase()
            const text = /^(txt|md|json|csv|log|html?|js|ts|css|py|yaml|yml|xml|svg)$/.test(ext)
            const image = /^(png|jpe?g|gif|webp)$/.test(ext)
            const mime = image ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/octet-stream'
            objectUrl = URL.createObjectURL(new Blob([result.data], { type: mime }))
            setState({ url: objectUrl, bytes: result.data.byteLength, text: text ? new TextDecoder().decode(result.data) : undefined, html: /^html?$/.test(ext), image, unsupported: !text && !image })
          } catch (e) { if (!cancelled) setState({ error: /not-found|no entry|不存在/i.test(e.message) ? '文件已移动或不存在；历史记录仍保留。' : e.message }) }
        })()
        return () => { cancelled = true; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
      }, [session.sessionId, file.path, retry])
      return h('section', { 'aria-label': '历史文件预览', 'data-history-path': file.path, style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } },
        h('div', { className: 'ow-history-toolbar' }, h('button', { type: 'button', className: 'btn', onClick: onBack }, backLabel), h('strong', null, file.name),
          state.url && h('a', { href: state.url, download: file.path.split(/[\\/]/).pop(), className: 'chip' }, '下载文件')),
        h('small', null, file.path), h('small', null, '读取当前文件，不是该轮的历史快照。'),
        state.loading && h('p', { role: 'status' }, '正在读取文件…'),
        state.error && h('div', null, h('p', { role: 'alert' }, state.error), h('button', { type: 'button', className: 'btn', onClick: () => setRetry(v => v + 1) }, '重试')),
        state.html && h(React.Fragment, null, h('p', null, '静态预览：不运行脚本，不加载外部资源。'), h('iframe', { title: file.name, sandbox: '', srcDoc: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">${state.text}` })),
        state.text !== undefined && !state.html && h('pre', { 'data-history-text': true }, state.text),
        state.image && h('img', { src: state.url, alt: file.name }),
        state.unsupported && h('p', null, '此格式暂不支持内嵌预览，请下载后用对应应用打开。'))
    }
    function childPath(parent, name) {
      if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/:\u0000-\u001f]/.test(name)) throw new Error('目录项名称无效')
      return parent === '.' ? name : `${parent}/${name}`
    }
    function WorkspaceBrowser({ session, onBack }) {
      const [folder, setFolder] = useState('.'), [state, setState] = useState({ loading: true }), [query, setQuery] = useState(''), [file, setFile] = useState(null), [retry, setRetry] = useState(0)
      useEffect(() => {
        const controller = new AbortController(); setState({ loading: true })
        rpcRead('workspaceFiles/list', { workspaceFileScopeId: session.sessionId, path: folder }, controller.signal).then(result => {
          if (!Array.isArray(result.entries)) throw new Error('目录服务响应无效，请重试')
          if (!controller.signal.aborted) setState({ entries: result.entries, truncated: result.truncated })
        }).catch(e => { if (!controller.signal.aborted) setState({ error: e.message }) })
        return () => controller.abort()
      }, [session.sessionId, folder, retry])
      if (file) return h(FilePreview, { session, file, onBack: () => setFile(null), backLabel: '返回文件列表' })
      const entries = (state.entries || []).filter(e => String(e.name).toLowerCase().includes(query.toLowerCase()))
      return h('section', { 'aria-label': '会话工作区文件' },
        h('div', { className: 'ow-history-toolbar' },
          h('button', { type: 'button', className: 'btn', onClick: onBack }, '返回历史记录'),
          folder !== '.' && h('button', { type: 'button', className: 'btn', onClick: () => { setFolder(folder.includes('/') ? folder.slice(0, folder.lastIndexOf('/')) : '.'); setQuery('') } }, '上一级'),
          h('button', { type: 'button', className: 'btn', disabled: state.loading, onClick: () => setRetry(v => v + 1) }, '刷新目录')),
        h('strong', null, '工作区文件'), h('small', null, `${session.cwd || ''} / ${folder}`),
        h('p', null, '当前工作区中的文件，未必由此会话生成；仅浏览，不修改。'),
        h('input', { className: 'inp', type: 'search', value: query, 'aria-label': '筛选当前目录', placeholder: '筛选当前目录…', onChange: e => setQuery(e.target.value) }),
        state.loading && h('p', { role: 'status' }, '正在读取目录…'), state.error && h('p', { role: 'alert' }, state.error),
        state.truncated && h('p', { role: 'status' }, '目录项超过服务上限，当前列表不完整。'),
        entries.map(e => h('button', { key: e.name, type: 'button', className: 'ow-history-file', disabled: !['file', 'directory'].includes(e.type), 'data-workspace-entry': e.name, 'data-entry-kind': e.type, title: e.type === 'symlink' ? '符号链接暂不在此打开' : undefined,
          onClick: () => { try { const path = childPath(folder, e.name); if (e.type === 'directory') { setFolder(path); setQuery('') } else setFile({ path, name: e.name }) } catch (error) { setState({ error: error.message }) } },
        }, e.type === 'directory' ? `${e.name} /` : e.name)),
        !state.loading && !state.error && !entries.length && h('p', null, '当前目录没有匹配项。'))
    }
    function HistoryBrowser() {
      const [sessions, setSessions] = useState([]), [query, setQuery] = useState(''), [selected, setSelected] = useState(null)
      const [workspace, setWorkspace] = useState(false), [conversation, setConversation] = useState(false), [creating, setCreating] = useState(false), [warning, setWarning] = useState('')
      const [records, setRecords] = useState([]), [hasMore, setHasMore] = useState(false), [file, setFile] = useState(null)
      const [loading, setLoading] = useState(false), [listLoading, setListLoading] = useState(true), [error, setError] = useState(''), [listError, setListError] = useState(''), [refresh, setRefresh] = useState(0)
      const active = useRef(null), current = useRef(null)
      useEffect(() => {
        const controller = new AbortController(); setListLoading(true); setListError('')
        rpcRead('session/list', { _request: {} }, controller.signal).then(value => {
          if (!controller.signal.aborted) {
            const items = (value.items || []).filter(s => !s.blank || s.sessionId.startsWith('ow-chat-')).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
            setSessions(items)
            if (!current.current) { const saved = bookmark(), restored = items.find(s => s.sessionId === saved?.id); if (restored) { if (saved.mode === 'conversation') openConversation(restored); else loadPage(restored) } }
          }
        }).catch(e => { if (!controller.signal.aborted) setListError(e.message) }).finally(() => { if (!controller.signal.aborted) setListLoading(false) })
        return () => controller.abort()
      }, [refresh])
      useEffect(() => () => active.current?.abort(), [])
      async function loadPage(session, older = false) {
        active.current?.abort(); const controller = new AbortController(); active.current = controller; current.current = session.sessionId
        setLoading(true); setError(''); setFile(null); setWorkspace(false); setConversation(false); setCreating(false); setSelected(session); bookmark({ id: session.sessionId, mode: 'history' })
        if (!older) { setRecords([]); setHasMore(false) }
        const seqs = eventsOf(records).map(e => e.seq)
        let throughSeq = older ? Math.min(...seqs) - 1 : session.projections?.asOfSeq
        try {
          if (!older) {
            const inventory = await rpcRead('session/list', { _request: {} }, controller.signal)
            const latest = inventory.items?.find(s => s.sessionId === session.sessionId)
            if (!latest) throw new Error('此会话已不可用，请刷新列表核对')
            if (controller.signal.aborted || current.current !== session.sessionId) return
            throughSeq = latest.projections?.asOfSeq; setSelected(latest)
          }
          if (!Number.isFinite(throughSeq) || throughSeq < 0) { setHasMore(false); return }
          const page = await rpcRead('session/page', { request: { address: { kind: 'session', sessionId: session.sessionId }, throughSeq, maxMessages: 30 } }, controller.signal)
          if (controller.signal.aborted || current.current !== session.sessionId) return
          const incoming = (page.records || []).filter(r => Number.isFinite(r.event?.seq))
          setRecords(previous => [...new Map([...(older ? previous : []), ...incoming].map(r => [r.event.seq, r])).values()])
          setHasMore(page.hasMore === true && incoming.some(r => r.event.seq < throughSeq))
        } catch (e) { if (!controller.signal.aborted) setError(e.message) }
        finally { if (!controller.signal.aborted) setLoading(false) }
      }
      function openConversation(session, notice = '') {
        active.current?.abort(); current.current = session.sessionId; setSelected(session); setCreating(false); setFile(null); setWorkspace(false); setWarning(notice); setConversation(true); bookmark({ id: session.sessionId, mode: 'conversation' })
      }
      const title = session => session.projections?.values?.title || '未命名会话'
      const filtered = sessions.filter(s => `${title(s)} ${s.cwd || ''} ${s.sessionId}`.toLowerCase().includes(query.toLowerCase()))
      const files = collectArtifacts(records), messages = messageRows(records)
      return h('div', { className: 'ow-history', 'data-history-browser': true }, h('style', null, css),
        h('nav', { className: 'ow-history-nav', 'aria-label': '历史会话列表' },
          h('input', { className: 'inp', type: 'search', 'aria-label': '搜索历史会话', placeholder: '搜索会话或工作区…', value: query, onChange: e => setQuery(e.target.value) }),
          h('button', { type: 'button', className: 'btn', onClick: () => setRefresh(v => v + 1), disabled: listLoading }, listLoading ? '正在读取…' : '刷新列表'),
          h('button', { type: 'button', className: 'btn', onClick: () => { active.current?.abort(); setCreating(true); setConversation(false) } }, '新建问答'),
          listError && h('p', { role: 'alert' }, listError),
          h('div', { className: 'ow-history-sessions' }, filtered.map(s => h('button', { key: s.sessionId, type: 'button', className: 'ow-history-session', 'data-history-session': s.sessionId, 'aria-pressed': selected?.sessionId === s.sessionId, onClick: () => loadPage(s) }, title(s), h('small', null, s.cwd || '未指定工作区')))),
          !listLoading && !listError && !filtered.length && h('p', null, '没有匹配的历史会话。')),
        h('main', { className: 'ow-history-main' }, creating ? h(NewConversation, { onCreated: (s, notice) => { openConversation(s, notice); setRefresh(v => v + 1) }, onBack: () => setCreating(false) }) : conversation && selected ? h(Conversation, { key: selected.sessionId, session: selected, toMessages: messageRows, warning, onBack: s => loadPage(s) }) : !selected ? h('p', null, '选择一个历史会话，查看文件与对话。') : file ? h(FilePreview, { session: selected, file, onBack: () => setFile(null) }) : workspace ? h(WorkspaceBrowser, { key: selected.sessionId, session: selected, onBack: () => setWorkspace(false) }) : h(React.Fragment, null,
          h('div', { className: 'ow-history-toolbar' }, h('strong', null, title(selected)), h('button', { type: 'button', className: 'btn', disabled: loading, onClick: () => loadPage(selected) }, '刷新会话')),
          h('small', null, selected.cwd || ''),
          h('button', { type: 'button', className: 'btn', onClick: () => openConversation(selected) }, '继续此会话'),
          selected.cwd && h('button', { type: 'button', className: 'btn', onClick: () => setWorkspace(true) }, '查看工作区文件'),
          loading && h('p', { role: 'status' }, '正在读取历史记录…'), error && h('p', { role: 'alert' }, error),
          files.map(f => h('button', { key: f.path, type: 'button', className: 'ow-history-file', 'data-history-file': f.path, onClick: () => setFile(f) }, f.name, h('small', null, `${f.source} · ${f.path}`))),
          !loading && !error && !files.length && h('p', null, '这页记录没有已登记的文件。' + (hasMore ? '可加载更早记录。' : '未登记的文件不会从对话文字中猜测。')),
          hasMore && h('button', { type: 'button', className: 'btn', disabled: loading, onClick: () => loadPage(selected, true) }, '加载更早记录'),
          messages.length > 0 && h('details', null, h('summary', null, `会话文字（只读，${messages.length} 条）`), messages.map(m => h('article', { key: m.seq }, h('strong', null, m.role), h('pre', null, m.text)))))))
    }
    return { configureWorkspaceFiles, childPath, validPath, mutationPath, collectArtifacts, messageRows, rpcRead, readArtifact, HistoryBrowser }
  },
})
