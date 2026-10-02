// dsh-self · Client — composed (npm run build:client)
// Organs: file-drop · smooth-stream · usage

// dsh-file-drop · Client half（DSH web __ModuleLoader__ 格式）
// 两个入口共用同一套处理逻辑（壳直取原始路径 → uri-list → 上传兜底）：
// 1. 回形针按钮（conversation.input.left）：点击弹文件选择器
// 2. 拖拽（window 捕获阶段拦截，先于 DSH 自带图片拖拽处理）：
//    - 桌面壳 preload 已解析路径 → 直接取
//    - DataTransfer 自带路径（uri-list）→ 直接取
//    - 普通文件 → POST /api/dsh-file-drop 上传到工作区
window.__ModuleLoader__.load({
  id: 'dsh-self/file-drop',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    const TEXT_EXT = new Set([
      'md', 'markdown', 'txt', 'text', 'json', 'csv', 'tsv', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
      'py', 'pyw', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log', 'xml', 'html', 'htm', 'css',
      'scss', 'sass', 'less', 'sh', 'bash', 'zsh', 'fish', 'sql', 'go', 'rs', 'java', 'kt', 'kts',
      'c', 'h', 'cpp', 'hpp', 'cc', 'hh', 'rb', 'php', 'lua', 'r', 'swift', 'vue', 'svelte', 'env',
      'properties', 'gitignore', 'dockerfile', 'makefile', 'gradle', 'lock',
    ])
    const TEXT_MIME = new Set([
      'application/json', 'application/xml', 'application/javascript', 'application/x-yaml',
      'application/sql', 'application/x-sh', 'application/x-httpd-php', 'application/ecmascript',
    ])
    const MAX_BYTES = 25 * 1024 * 1024
    const API_PATH = '/api/dsh-file-drop'

    // ---- 文件识别与读取 ----

    function looksText(file) {
      if (file.type && file.type.startsWith('text/')) return true
      if (file.type && TEXT_MIME.has(file.type)) return true
      const dot = file.name.lastIndexOf('.')
      if (dot < 0) return false
      return TEXT_EXT.has(file.name.slice(dot + 1).toLowerCase())
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
        reader.onload = () => {
          try {
            const bytes = new Uint8Array(reader.result)
            let bin = ''
            const CHUNK = 0x8000
            for (let i = 0; i < bytes.length; i += CHUNK) {
              bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
            }
            resolve(btoa(bin))
          } catch (e) { reject(e) }
        }
        reader.readAsArrayBuffer(file)
      })
    }

    // ---- 桌面壳 ----

    // 拖拽场景：preload 在捕获阶段已用 webUtils.getPathForFile 解析好路径
    function drainShellPaths() {
      try {
        if (typeof window === 'undefined' || !window.dshDesktop) return []
        if (typeof window.dshDesktop.drainDroppedPaths === 'function') {
          const p = window.dshDesktop.drainDroppedPaths()
          return Array.isArray(p) ? p : []
        }
      } catch { /* 忽略 */ }
      return []
    }

    // 按钮/兜底场景：直接映射单个 File（preload 暴露的备用 API）
    function shellPathOf(file) {
      try {
        if (typeof window === 'undefined' || !window.dshDesktop) return null
        if (typeof window.dshDesktop.getPathForFile === 'function') {
          const p = window.dshDesktop.getPathForFile(file)
          return (typeof p === 'string' && p.length > 0) ? p : null
        }
      } catch { /* 忽略 */ }
      return null
    }

    // 拖拽自带路径（Obsidian / 文件管理器拖拽常带 uri-list）
    function extractPaths(e) {
      const paths = []
      try {
        const uris = (e.dataTransfer.getData('text/uri-list') || '').split('\n')
        for (const line of uris) {
          const t = line.trim()
          if (!t || t.startsWith('#')) continue
          if (t.startsWith('file://')) {
            try {
              paths.push(decodeURIComponent(t.slice('file://'.length).replace(/^localhost/, '')))
            } catch { paths.push(t.slice(7)) }
          } else if (t.startsWith('/')) {
            paths.push(t)
          }
        }
      } catch { /* 某些浏览器/事件阶段读不了，忽略 */ }
      if (paths.length === 0) {
        try {
          const plain = (e.dataTransfer.getData('text/plain') || '').trim()
          if (plain && (plain.startsWith('/') || /^[A-Za-z]:[\\/]/.test(plain)) && !plain.includes('\n')) {
            paths.push(plain)
          }
        } catch { /* 忽略 */ }
      }
      return paths
    }

    // ---- 共享状态（按钮上传与拖拽共用一个状态条） ----

    const statusStore = {
      value: null,
      listeners: new Set(),
      timer: null,
      set(text) {
        this.value = text
        for (const l of [...this.listeners]) l()
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => {
          this.value = null
          for (const l of [...this.listeners]) l()
        }, 3500)
      },
      subscribe(fn) {
        this.listeners.add(fn)
        return () => this.listeners.delete(fn)
      },
    }

    function useStatus() {
      const [value, setValue] = React.useState(statusStore.value)
      React.useEffect(() => statusStore.subscribe(() => setValue(statusStore.value)), [])
      return value
    }

    function appendToDraft(inputActions, draft, paths) {
      if (!inputActions) return
      const lines = paths.map((p) => '📎 文件：`' + p + '`')
      const nl = draft === '' ? '' : '\n'
      inputActions.setDraft(draft + nl + lines.join('\n'))
    }

    // 共用处理：壳路径优先，其余走上传兜底
    async function processFiles(files, opts) {
      if (!files.length) return
      const { sessionId, inputActions, getDraft } = opts
      const direct = []
      const rest = []
      for (const f of files) {
        const p = shellPathOf(f)
        if (p) direct.push(p)
        else rest.push(f)
      }
      if (direct.length > 0) {
        appendToDraft(inputActions, getDraft(), direct)
        statusStore.set('✓ 已获取 ' + direct.length + ' 个原始路径（桌面壳）')
      }
      if (rest.length === 0) return

      statusStore.set('正在上传 ' + rest.length + ' 个文件…')
      const ok = []
      const errs = []
      for (const f of rest) {
        if (f.size > MAX_BYTES) { errs.push(f.name + '（超过 25MB 限制）'); continue }
        try {
          const payload = looksText(f)
            ? { kind: 'text', content: await f.text() }
            : { kind: 'binary', base64: await fileToBase64(f) }
          const response = await fetch(API_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionId,
              name: f.name,
              size: f.size,
              type: f.type || '',
              ...payload,
            }),
          })
          const data = await response.json().catch(() => ({}))
          if (response.ok && data.path) ok.push(data.path)
          else errs.push(f.name + '：' + (data.error || '保存失败'))
        } catch (err) {
          errs.push(f.name + '：' + String((err && err.message) || err))
        }
      }
      if (ok.length > 0) appendToDraft(inputActions, getDraft(), ok)
      const text = [
        ok.length > 0 ? '✓ ' + ok.length + ' 个文件已上传' : '',
        errs.length > 0 ? '✗ ' + errs.join('；') : '',
      ].filter(Boolean).join('　')
      statusStore.set(text || '没有文件被处理')
    }

    // ---- 组件 ----

    // 输入框工具行：回形针按钮（点开文件选择器）
    function PaperclipButton(props) {
      const pickRef = React.useRef(null)
      const optsRef = React.useRef({})
      optsRef.current = {
        sessionId: props.sessionId,
        inputActions: props.inputActions,
        getDraft: () => (props.input && props.input.draft) || '',
      }
      const onClick = () => { if (pickRef.current) pickRef.current.click() }
      const onChange = (e) => {
        const files = Array.from(e.target.files || [])
        e.target.value = ''
        if (files.length > 0) void processFiles(files, optsRef.current)
      }
      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'dsh-paperclip-wrap' },
          React.createElement('button', {
            type: 'button',
            className: 'dsh-paperclip',
            'aria-label': '上传文件',
            onClick: onClick,
          },
            React.createElement('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', 'aria-hidden': true },
              React.createElement('path', {
                d: 'M5.5498 9.75V5H6.9502V9.75C6.9502 10.3299 7.4201 10.7998 8 10.7998C8.5799 10.7998 9.0498 10.3299 9.0498 9.75V4.5C9.0498 2.9536 7.7964 1.7002 6.25 1.7002C4.7036 1.7002 3.4502 2.9536 3.4502 4.5V9.75C3.4502 12.2629 5.4871 14.2998 8 14.2998C10.5129 14.2998 12.5498 12.2629 12.5498 9.75V4H13.9502V9.75C13.9502 13.0361 11.2861 15.7002 8 15.7002C4.71391 15.7002 2.0498 13.0361 2.0498 9.75V4.5C2.04981 2.1804 3.9304 0.299806 6.25 0.299805C8.5696 0.299805 10.4502 2.1804 10.4502 4.5V9.75C10.4502 11.1031 9.3531 12.2002 8 12.2002C6.6469 12.2002 5.5498 11.1031 5.5498 9.75Z',
                fill: 'currentColor',
              })
            )
          ),
          React.createElement('div', { className: 'dsh-paperclip-tip' },
            '点击选择文件 · 也可把文件拖到窗口任意位置'
          )
        ),
        React.createElement('input', {
          ref: pickRef,
          type: 'file',
          multiple: true,
          style: { display: 'none' },
          onChange: onChange,
        })
      )
    }

    // 输入框上方 dock：拖拽监听 + 浮层 + 状态条
    function DropZone(props) {
      const [drag, setDrag] = React.useState(false)
      const statusText = useStatus()
      const depthRef = React.useRef(0)
      const busyRef = React.useRef(false)
      const optsRef = React.useRef({})
      optsRef.current = {
        sessionId: props.sessionId,
        inputActions: props.inputActions,
        getDraft: () => (props.input && props.input.draft) || '',
      }

      React.useEffect(() => {
        // 全部挂在 window 捕获阶段：事件流的第一个节点，先于 DSH 自带的
        // document 级拖拽图片处理（InputBar intakeImages / DropOverlay）。
        const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')
        const onDragEnter = (e) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          e.stopPropagation()
          depthRef.current += 1
          setDrag(true)
        }
        const onDragOver = (e) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          e.stopPropagation()
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
        }
        const onDragLeave = (e) => {
          e.stopPropagation()
          depthRef.current -= 1
          if (depthRef.current <= 0) { depthRef.current = 0; setDrag(false) }
        }
        const onDrop = (e) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          e.stopPropagation()
          depthRef.current = 0
          setDrag(false)
          void handleDrop(e)
        }
        window.addEventListener('dragenter', onDragEnter, true)
        window.addEventListener('dragover', onDragOver, true)
        window.addEventListener('dragleave', onDragLeave, true)
        window.addEventListener('drop', onDrop, true)
        return () => {
          window.removeEventListener('dragenter', onDragEnter, true)
          window.removeEventListener('dragover', onDragOver, true)
          window.removeEventListener('dragleave', onDragLeave, true)
          window.removeEventListener('drop', onDrop, true)
        }
      }, [])

      async function handleDrop(e) {
        if (busyRef.current) return
        const files = Array.from((e.dataTransfer && e.dataTransfer.files) || [])

        // 桌面壳（preload 捕获阶段已解析好磁盘原始路径）
        const shellPaths = drainShellPaths()
        if (shellPaths.length > 0) {
          appendToDraft(optsRef.current.inputActions, optsRef.current.getDraft(), shellPaths)
          statusStore.set('✓ 已获取 ' + shellPaths.length + ' 个原始路径（桌面壳）')
          return
        }

        // 拖拽自带路径 → 直接取地址，零上传
        const paths = extractPaths(e)
        if (paths.length > 0) {
          appendToDraft(optsRef.current.inputActions, optsRef.current.getDraft(), paths)
          statusStore.set('✓ 已获取 ' + paths.length + ' 个文件路径')
          return
        }

        // 普通文件 → 上传兜底
        if (files.length === 0) return
        busyRef.current = true
        try {
          await processFiles(files, optsRef.current)
        } finally {
          busyRef.current = false
        }
      }

      return React.createElement(React.Fragment, null,
        statusText ? React.createElement('div', { className: 'dsh-drop-status' }, statusText) : null,
        drag ? React.createElement('div', { className: 'dsh-drop-overlay' },
          React.createElement('div', { className: 'dsh-drop-overlay-inner' }, '松开鼠标，获取文件')
        ) : null
      )
    }

    const CSS = `
      .dsh-paperclip-wrap {
        position: relative;
        display: inline-flex;
      }
      .dsh-paperclip-wrap .dsh-paperclip-tip {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        z-index: 50;
        white-space: nowrap;
        font-size: 12px;
        line-height: 1.4;
        color: #dce1e8;
        background: rgba(20, 22, 28, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 6px 10px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
        opacity: 0;
        pointer-events: none;
      }
      /* 每次 hover 都重新播放：淡入 → 停留 → 自动淡出 */
      .dsh-paperclip-wrap:hover .dsh-paperclip-tip {
        animation: dshTipCycle 1.5s ease forwards;
      }
      @keyframes dshTipCycle {
        0% { opacity: 0; }
        10% { opacity: 1; }
        85% { opacity: 1; }
        100% { opacity: 0; }
      }
      .dsh-paperclip {
        display: grid; place-items: center; flex: none;
        width: 28px; height: 28px;
        border: none; border-radius: 999px;
        background: var(--dsw-specific-selector, rgba(128, 128, 128, 0.14));
        color: var(--dsw-alias-label-primary, inherit);
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .dsh-paperclip:hover:not(:disabled) {
        background: var(--dsw-alias-interactive-bg-hover-solid, rgba(128, 128, 128, 0.24));
      }
      .dsh-drop-status {
        position: fixed; bottom: 110px; left: 50%; transform: translateX(-50%);
        z-index: 9998; pointer-events: none;
        max-width: 70vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        font-size: 12px; line-height: 1.5; color: #dce1e8;
        background: rgba(20, 22, 28, 0.85); border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px; padding: 6px 14px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
        animation: dshDropStatusIn 0.18s ease-out;
      }
      @keyframes dshDropStatusIn {
        from { opacity: 0; transform: translateX(-50%) translateY(6px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      .dsh-drop-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(24, 118, 255, 0.08);
        border: 2px dashed rgba(24, 118, 255, 0.7);
        display: flex; align-items: center; justify-content: center;
        pointer-events: none;
      }
      .dsh-drop-overlay-inner {
        background: #1876ff; color: #fff; border-radius: 10px;
        padding: 14px 28px; font-size: 15px; font-weight: 600;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
      }
    `

    const inject = ['slots']

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style')
        style.dataset.plugin = 'dsh-file-drop'
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'dsh-file-drop: styles')

      ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
        { name: 'conversation.input.left', id: 'file-drop-pick', order: 0 },
        (props) => React.createElement(PaperclipButton, props)
      ))

      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
        { name: 'conversation.input.dock', id: 'file-drop', order: 30 },
        (props) => React.createElement(DropZone, props)
      ))
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})


window.__ModuleLoader__.load({
  id: 'dsh-self/smooth-stream',
  factory: (require) => {
    const React = require('react');
    const styles = {
      insert(css) {
        if (typeof document === 'undefined') return function () {};
        const prev = document.querySelector('style[data-plugin="dsh-plugin-smooth-stream"]');
        if (prev) {
          prev.textContent = css;
          return function () { prev.remove(); };
        }
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-plugin-smooth-stream';
        tag.textContent = css;
        document.head.appendChild(tag);
        return function () { tag.remove(); };
      }
    };
    return (function () {
// dsh-plugin-smooth-stream v1
// Smooth assistant output for DeepSeek Harness.

const SUMMARY_TICK_MS = 1000;
const BODY_POLL_MS = 200;
const THINK_MIN_CHARS = 1000;
const TEXT_MIN_CHARS = 500;
const FADE_MS = 450;
const SPEC_PRIMITIVES = '@deepseek-ai/dsh-client-ui-primitives';
const SPEC_ATTACHMENT = '@deepseek-ai/dsh-client-ui-attachment';

function firstLine(text) {
  const n = text.indexOf('\n');
  return n === -1 ? text : text.slice(0, n);
}
function latestLine(text) {
  const t = (text || '').trimEnd();
  const n = t.lastIndexOf('\n');
  return n === -1 ? t : t.slice(n + 1);
}
function realGlobal() {
  try { if (typeof window !== 'undefined' && window) return window; } catch (e) {}
  try { if (typeof globalThis !== 'undefined' && globalThis) return globalThis; } catch (e) {}
  try { return (0, eval)('globalThis'); } catch (e) {}
  return null;
}
// A renderable export is a plain function component OR a React wrapper object:
// memo() and forwardRef() produce objects carrying `$$typeof`, not functions.
// Testing only for `function` silently misses every memoized host component —
// which is what MarkdownText became, sending this plugin to its own fallback.
function isComponent(value) {
  if (typeof value === 'function') return true;
  return !!value && typeof value === 'object' && value.$$typeof !== undefined;
}
function pickNamed(mod, key) {
  if (!mod) return null;
  if (isComponent(mod[key])) return mod;
  if (mod.default && isComponent(mod.default[key])) return mod.default;
  return null;
}
function fromSystem(ms, spec, key) {
  if (!ms) return null;
  const tries = [];
  try { if (ms.seed && typeof ms.seed.get === 'function') tries.push(ms.seed.get(spec)); } catch (e) {}
  try { if (ms.statics && typeof ms.statics.get === 'function') tries.push(ms.statics.get(spec)); } catch (e) {}
  try {
    if (ms.loadCache && typeof ms.loadCache.get === 'function') {
      const rec = ms.loadCache.get(spec);
      if (rec) tries.push(rec.exports || rec);
    }
  } catch (e) {}
  for (let i = 0; i < tries.length; i++) {
    const hit = pickNamed(tries[i], key);
    if (hit) return hit;
  }
  return null;
}
function resolveModule(spec, key) {
  const g = realGlobal();
  return fromSystem(g && g.__DSH_MODULES__, spec, key);
}
function lineTarget(text, shown, flush) {
  if (typeof text !== 'string') return 0;
  if (flush) return text.length;
  const nl = text.lastIndexOf('\n');
  const target = nl >= 0 ? nl + 1 : 0;
  return target > shown ? target : shown;
}
function isFenceLine(line) {
  return /^\s*```/.test(line);
}
function isTableLine(line) {
  return /^\s*\|/.test(line);
}
function lineAt(text, index) {
  const from = text.lastIndexOf('\n', index - 1) + 1;
  const to = text.indexOf('\n', index);
  return text.slice(from, to === -1 ? text.length : to);
}
function walkLines(text, fn) {
  let start = 0;
  while (start <= text.length) {
    const nl = text.indexOf('\n', start);
    const end = nl === -1 ? text.length : nl;
    fn(start, end, text.slice(start, end));
    if (nl === -1) break;
    start = nl + 1;
  }
}
function extendToSafeMarkdown(text, pos, flush) {
  if (pos >= text.length) return text.length;
  let fenceFrom = -1;
  let tableFrom = -1;
  let inFence = false;
  let inTable = false;
  walkLines(text, function (start, end, line) {
    if (isFenceLine(line)) {
      if (!inFence) {
        inFence = true;
        fenceFrom = start;
      } else {
        inFence = false;
        fenceFrom = -1;
      }
      inTable = false;
      tableFrom = -1;
      return;
    }
    if (!inFence && isTableLine(line)) {
      if (!inTable) {
        inTable = true;
        tableFrom = start;
      }
    } else if (inTable && line.trim() === '') {
      inTable = false;
      tableFrom = -1;
    } else if (inTable && !isTableLine(line)) {
      inTable = false;
      tableFrom = -1;
    }
  });
  if (inFence) return flush ? text.length : (fenceFrom > 0 ? fenceFrom : pos);
  if (inTable) {
    if (flush) return text.length;
    return tableFrom > 0 ? tableFrom : pos;
  }
  return pos;
}
function paragraphTarget(text, shown, flush, minChars) {
  if (typeof text !== 'string') return 0;
  if (flush) return text.length;
  const need = shown + minChars;
  if (text.length < need) return shown;
  let pos = -1;
  const para = text.indexOf('\n\n', need);
  if (para !== -1) pos = para + 2;
  else {
    const nl = text.indexOf('\n', need);
    if (nl !== -1) pos = nl + 1;
  }
  if (pos === -1) return shown;
  pos = extendToSafeMarkdown(text, pos, false);
  return pos > shown ? pos : shown;
}
function laterBlockStarted(blocks, index) {
  for (let i = index + 1; i < blocks.length; i++) {
    if (blocks[i]) return true;
  }
  return false;
}
function ensureRevealSlots(s, n) {
  while (s.shown.length < n) {
    s.shown.push(0);
    s.prev.push(0);
    s.sum.push(0);
    s.batch.push(0);
    s.sumBatch.push(0);
  }
}
function restartFade(node) {
  if (!node || !node.classList) return;
  node.classList.remove('dss-fresh');
  void node.offsetWidth;
  node.classList.add('dss-fresh');
}
function findScrollport(from) {
  if (from && from.closest) {
    const hit = from.closest('[data-conversation-scroll]');
    if (hit) return hit;
  }
  const g = realGlobal();
  const doc = g && g.document;
  return doc ? doc.querySelector('[data-conversation-scroll]') : null;
}
function classFromCss(css, suffix) {
  if (!css) return '';
  const m = css.match(new RegExp('\\.([A-Za-z0-9_-]+_' + suffix + ')\\b'));
  return m ? m[1] : '';
}
function thinkClasses() {
  const fallback = {
    root: 'dss-nr-root',
    row: 'dss-nr-row',
    leading: 'dss-nr-leading',
    chevron: 'dss-nr-chevron',
    title: 'dss-nr-title',
    separator: 'dss-nr-separator',
    summary: 'dss-nr-summary',
    thinkBody: 'dss-nr-body',
    hidden: 'dss-nr-hidden'
  };
  const g = realGlobal();
  const doc = g && g.document;
  if (!doc) return fallback;
  const tag = doc.querySelector('style[data-plugin-css*="ReasoningRow.module.css"]');
  const a11y = doc.querySelector('style[data-plugin-css*="accessibility.module.css"]');
  const css = tag && tag.textContent;
  const hidden = classFromCss(a11y && a11y.textContent, 'visuallyHidden') || fallback.hidden;
  return {
    root: classFromCss(css, 'root') || fallback.root,
    row: classFromCss(css, 'row') || fallback.row,
    leading: classFromCss(css, 'leading') || fallback.leading,
    chevron: classFromCss(css, 'chevron') || fallback.chevron,
    title: classFromCss(css, 'title') || fallback.title,
    separator: classFromCss(css, 'separator') || fallback.separator,
    summary: classFromCss(css, 'summary') || fallback.summary,
    thinkBody: classFromCss(css, 'thinkBody') || fallback.thinkBody,
    hidden: hidden
  };
}

const CSS = [
  '.dss-root{color:var(--dsw-alias-label-primary);flex-direction:column;font-size:16px;line-height:28px;display:flex}',
  '.dss-body{flex-direction:column;gap:16px;display:flex}',
  '.dss-stopped{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);border-radius:6px;align-self:flex-start;padding:0 6px;font-size:11px;line-height:18px}',
  '.dss-dr-root{display:flex;flex-direction:column;width:100%;min-width:0}',
  '.dss-dr-row{position:relative;overflow:hidden;display:flex;align-items:center;height:24px;min-width:0}',
  '.dss-dr-row[data-expandable]{cursor:pointer}',
  '.dss-dr-leading{position:relative;flex:none;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;margin-right:6px;padding:0;border:none;background:none;color:var(--dsw-alias-label-tertiary)}',
  '.dss-dr-iconIdle{display:inline-flex;opacity:1;transition:opacity 100ms ease}',
  '.dss-dr-chevronHover{position:absolute;inset:0;margin:auto;opacity:0;transition:opacity 100ms ease;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}',
  '.dss-dr-row:hover .dss-dr-iconIdle{opacity:0}',
  '.dss-dr-row:hover .dss-dr-chevronHover{opacity:1}',
  '.dss-dr-title{flex:none;font-size:14px;line-height:24px;font-weight:400;color:var(--dsw-alias-label-secondary)}',
  '.dss-nr-chevron{color:var(--dsw-alias-label-secondary);display:inline-flex}',
  '.dss-nr-root{display:flex;flex-direction:column}',
  '.dss-nr-row{position:relative;overflow:hidden}',
  '.dss-nr-root[data-state=running] .dss-nr-row:after{content:"";position:absolute;inset-block:0;left:0;width:300px;background:linear-gradient(90deg,transparent 0%,color-mix(in srgb,var(--dsw-alias-bg-base) 60%,transparent) 55%,transparent 100%);animation:2.6s ease-out infinite dss-nr-sweep;pointer-events:none}',
  '@keyframes dss-nr-sweep{0%{left:-300px}90%,to{left:100%}}',
  '.dss-nr-separator{flex:none;width:2px;height:2px;margin:0 8px;border-radius:1px;background:var(--dsw-alias-label-caption)}',
  '.dss-nr-summary{min-width:0;overflow:hidden;flex:1 1 auto;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:24px;text-overflow:ellipsis;white-space:nowrap}',
  '.dss-nr-summary[data-follow-end]{text-overflow:clip}',
  '.dss-nr-body{padding:4px 0 4px 22px;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:24px;white-space:pre-wrap;word-break:break-word}',
  '.dss-nr-hidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}',
  '.dss-sum-fade{display:inline;animation:dss-fade ' + FADE_MS + 'ms ease-out both}',
  '.dss-line{display:block}',
  '.dss-plain{white-space:pre-wrap;overflow-wrap:anywhere}',
  '.dss-codeblock{background:var(--dsw-alias-markdown-code-block);border-radius:8px;padding:10px 12px;overflow:auto}',
  '.dss-code{font-family:var(--dsw-font-markdown-code,monospace);background:var(--dsw-alias-interactive-bg-hover);border-radius:4px;padding:0 4px}',
  '.dss-strong{font-weight:600}',
  '.dss-em{font-style:italic}',
  '.dss-image{max-width:100%;border-radius:8px}',
  '.dss-mdwrap table{border-collapse:collapse;width:100%;margin:8px 0 16px}',
  '.dss-mdwrap th,.dss-mdwrap td{border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.12));padding:10px 16px 10px 0;text-align:left;vertical-align:top}',
  '.dss-mdwrap th{font-weight:600}',
  '@keyframes dss-fade{from{opacity:0;filter:blur(5px);transform:translateY(6px)}to{opacity:1;filter:none;transform:none}}',
  '.dss-fresh{animation:dss-fade ' + FADE_MS + 'ms ease-out both}',
  // While a reply streams, the native bottom-follow's instant scrollTop writes
  // become eased glides. The class lives only during streaming so opening a
  // long conversation, paging prepends and saved-position restores stay instant.
  '[data-conversation-scroll].dss-smooth-follow{scroll-behavior:smooth}',
  '@media (prefers-reduced-motion:reduce){.dss-fresh,.dss-sum-fade{animation:none;filter:none;transform:none}.dss-nr-root[data-state=running] .dss-nr-row:after{animation:none}.dss-smooth-follow{scroll-behavior:auto}}'
].join('');

function inlineMarkdown(text) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) out.push(React.createElement('strong', { className: 'dss-strong', key: out.length }, m[2]));
    else if (m[3] !== undefined) out.push(React.createElement('em', { className: 'dss-em', key: out.length }, m[3]));
    else out.push(React.createElement('code', { className: 'dss-code', key: out.length }, m[4]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function FallbackMarkdown(props) {
  const text = props.text || '';
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i += 1; continue; }
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(lines[i]);
        i += 1;
      }
      const body = rows.filter(function (row) { return !/^\s*\|?\s*:?-{3,}/.test(row); });
      out.push(React.createElement('table', { key: out.length },
        React.createElement('tbody', null, body.map(function (row, ri) {
          const cells = row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
          return React.createElement('tr', { key: ri }, cells.map(function (cell, ci) {
            return React.createElement(ri === 0 ? 'th' : 'td', { key: ci }, inlineMarkdown(cell.trim()));
          }));
        }))
      ));
      continue;
    }
    if (/^\s*```/.test(line)) {
      const buf = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      i += 1;
      out.push(React.createElement('pre', { className: 'dss-codeblock', key: out.length }, React.createElement('code', null, buf.join('\n'))));
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      out.push(React.createElement('h' + Math.min(h[1].length, 6), { key: out.length }, inlineMarkdown(h[2])));
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i += 1; }
      out.push(React.createElement('blockquote', { key: out.length }, inlineMarkdown(buf.join(' '))));
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i += 1; }
      out.push(React.createElement('ul', { key: out.length }, items.map(function (it, k) {
        return React.createElement('li', { key: k }, inlineMarkdown(it));
      })));
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i += 1; }
      out.push(React.createElement('ol', { key: out.length }, items.map(function (it, k) {
        return React.createElement('li', { key: k }, inlineMarkdown(it));
      })));
      continue;
    }
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*(```|#{1,6}\s|>\s?|[-*+]\s+|\d+[.)]\s+)/.test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    out.push(React.createElement('p', { key: out.length }, inlineMarkdown(buf.join(' '))));
  }
  return React.createElement('div', null, out);
}

function SvgIcon(size, viewBox, paths) {
  return React.createElement('svg', {
    width: size,
    height: size,
    viewBox: viewBox,
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true
  }, paths.map(function (p, i) {
    return React.createElement('path', {
      key: i,
      d: p.d,
      fill: 'currentColor',
      fillRule: p.fillRule,
      clipRule: p.clipRule
    });
  }));
}
function IconThink14() {
  return SvgIcon(14, '0 0 14 14', [
    { d: 'M7.06431 5.93342C7.68763 5.93342 8.19307 6.43904 8.19322 7.06233C8.19322 7.68573 7.68772 8.19123 7.06431 8.19123C6.44099 8.19113 5.9354 7.68567 5.9354 7.06233C5.93555 6.43911 6.44108 5.93353 7.06431 5.93342Z' },
    {
      fillRule: 'evenodd',
      clipRule: 'evenodd',
      d: 'M8.6815 0.963693C10.1169 0.447019 11.6266 0.374829 12.5633 1.31135C13.5 2.24805 13.4277 3.75776 12.911 5.19319C12.7126 5.74431 12.4386 6.31796 12.0965 6.89729C12.4969 7.54638 12.8141 8.19018 13.036 8.80647C13.5527 10.2419 13.6251 11.7516 12.6883 12.6883C11.7516 13.625 10.242 13.5527 8.8065 13.036C8.19022 12.8141 7.54641 12.4969 6.89732 12.0965C6.31797 12.4386 5.74435 12.7125 5.19322 12.911C3.75777 13.4276 2.2481 13.5 1.31138 12.5633C0.374859 11.6266 0.447049 10.1168 0.963724 8.68147C1.17185 8.10338 1.46321 7.50063 1.82896 6.8924C1.52182 6.35711 1.27235 5.82825 1.08872 5.31819C0.572068 3.88278 0.499714 2.37306 1.43638 1.43635C2.37308 0.499655 3.8828 0.572044 5.31822 1.08869C5.82828 1.27232 6.35715 1.5218 6.89243 1.82893C7.50066 1.46318 8.10341 1.17181 8.6815 0.963693ZM11.3573 8.01154C10.9083 8.62253 10.3901 9.22873 9.80943 9.8094C9.22877 10.3901 8.62255 10.9083 8.01158 11.3572C8.4257 11.5841 8.8287 11.7688 9.21275 11.9071C10.5456 12.3868 11.4246 12.2547 11.8397 11.8397C12.2548 11.4246 12.3869 10.5456 11.9071 9.21272C11.7688 8.82866 11.5841 8.42568 11.3573 8.01154ZM2.56529 8.02912C2.37344 8.39322 2.21495 8.74796 2.09263 9.08772C1.61291 10.4204 1.74512 11.2995 2.16001 11.7147C2.57505 12.1297 3.45415 12.2618 4.78697 11.7821C5.11057 11.6656 5.44786 11.5164 5.7938 11.3367C5.249 10.9223 4.70922 10.4533 4.19029 9.9344C3.57578 9.31987 3.03169 8.67633 2.56529 8.02912ZM6.90708 3.2469C6.24065 3.70479 5.5646 4.26321 4.91392 4.91389C4.26325 5.56456 3.70482 6.24063 3.24693 6.90705C3.72674 7.63325 4.32777 8.37459 5.03892 9.08576C5.64943 9.69627 6.28183 10.2265 6.90806 10.6678C7.59368 10.2025 8.2908 9.63076 8.96079 8.96076C9.6308 8.29075 10.2025 7.59366 10.6678 6.90803C10.2265 6.2818 9.69631 5.6494 9.08579 5.03889C8.37462 4.32773 7.63328 3.72672 6.90708 3.2469ZM11.7147 2.15998C11.2996 1.74509 10.4204 1.61288 9.08775 2.0926C8.74835 2.21479 8.39382 2.37271 8.03013 2.56428C8.67728 3.03065 9.31995 3.5758 9.93443 4.19026C10.4534 4.7092 10.9223 5.24896 11.3368 5.79377C11.5164 5.44785 11.6656 5.11052 11.7821 4.78694C12.2618 3.45416 12.1297 2.57502 11.7147 2.15998ZM4.91197 2.2176C3.57922 1.73788 2.70004 1.86995 2.28501 2.28498C1.87001 2.70003 1.73791 3.5792 2.21763 4.91194C2.31709 5.18822 2.44112 5.47427 2.58677 5.7674C3.01931 5.1887 3.51474 4.6158 4.06529 4.06526C4.61584 3.5147 5.18872 3.01928 5.76743 2.58674C5.47431 2.4411 5.18824 2.31706 4.91197 2.2176Z'
    }
  ]);
}
function IconChevron14(className) {
  return React.createElement('span', { className: className },
    SvgIcon(14, '0 0 14 14', [{
      d: 'M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z'
    }])
  );
}

return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots');
    if (slots === undefined) return;
    ctx.effect(function () { return styles.insert(CSS); });

    const nr = thinkClasses();
    let prims = resolveModule(SPEC_PRIMITIVES, 'MarkdownText');
    let attach = resolveModule(SPEC_ATTACHMENT, 'ImageGallery');
    try {
      const svc = ctx.get('modules');
      if (!prims) prims = fromSystem(svc, SPEC_PRIMITIVES, 'MarkdownText');
      if (!attach) attach = fromSystem(svc, SPEC_ATTACHMENT, 'ImageGallery');
    } catch (e) {}

    function MarkdownView(props) {
      const wrapRef = React.useRef(null);
      const seenRef = React.useRef(0);
      React.useEffect(function () {
        const host = wrapRef.current;
        if (!host) return;
        const root = host.firstElementChild;
        const n = root ? root.children.length : 0;
        if (!props.animate || props.fromEmpty) {
          seenRef.current = n;
          return;
        }
        if (n > seenRef.current) {
          for (let i = seenRef.current; i < n; i++) restartFade(root.children[i]);
          seenRef.current = n;
          return;
        }
        if (n > 0) restartFade(root.children[n - 1]);
        else restartFade(host);
      }, [props.text, props.animate, props.fromEmpty, props.batchId]);

      const node = (prims && isComponent(prims.MarkdownText))
        ? React.createElement(prims.MarkdownText, {
          text: props.text,
          streaming: false,
          codeLabels: props.codeLabels,
          fileMentions: props.fileMentions
        })
        : React.createElement(FallbackMarkdown, { text: props.text });
      const cls = props.animate && props.fromEmpty ? 'dss-mdwrap dss-fresh' : 'dss-mdwrap';
      return React.createElement('div', { ref: wrapRef, className: cls, 'data-dss-prose': '1' }, node);
    }

    function ReasoningView(props) {
      const [expanded, setExpanded] = React.useState(false);
      const summaryRef = React.useRef(null);
      const summarySrc = props.summaryText !== undefined ? props.summaryText : props.text;
      const summary = props.running ? latestLine(summarySrc) : firstLine(summarySrc);
      React.useEffect(function () {
        const el = summaryRef.current;
        if (!el) return;
        el.scrollLeft = props.running ? el.scrollWidth - el.clientWidth : 0;
      }, [props.running, summary]);

      const stable = props.bodyStable || '';
      const fresh = props.bodyFresh || '';
      const body = React.createElement('div', { className: 'dss-nr-body' },
        stable ? React.createElement('div', { className: 'dss-line', style: { whiteSpace: 'pre-wrap' } }, stable) : null,
        fresh ? React.createElement('div', {
          key: 'f' + (props.batchId || 0),
          className: 'dss-line dss-fresh',
          style: { whiteSpace: 'pre-wrap' }
        }, fresh) : null
      );
      const summaryNode = React.createElement(React.Fragment, null,
        React.createElement('span', { className: 'dss-nr-separator', 'aria-hidden': true }),
        React.createElement('span', {
          ref: summaryRef,
          className: 'dss-nr-summary',
          'data-follow-end': props.running || undefined
        },
          React.createElement('span', {
            key: String(props.summaryBatch || props.batchId) + ':' + summary,
            className: 'dss-sum-fade'
          }, summary)
        )
      );
      const toggle = function () { setExpanded(function (v) { return !v; }); };
      const chevron = IconChevron14('dss-nr-chevron');
      const leading = expanded
        ? chevron
        : React.createElement(React.Fragment, null,
          React.createElement('span', { className: 'dss-dr-iconIdle' }, IconThink14()),
          IconChevron14('dss-dr-chevronHover')
        );

      return React.createElement('div', {
        className: 'dss-dr-root dss-nr-root',
        'data-variant': 'think',
        'data-state': props.running ? 'running' : 'ok',
        'data-open': expanded || undefined
      },
        props.running ? React.createElement('span', { className: 'dss-nr-hidden' }, 'Running') : null,
        React.createElement('div', {
          className: 'dss-dr-row dss-nr-row',
          'data-disclosure-row': true,
          'data-expandable': true,
          role: 'button',
          tabIndex: 0,
          'aria-expanded': expanded,
          onClick: toggle,
          onKeyDown: function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
          }
        },
          React.createElement('span', { className: 'dss-dr-leading' }, leading),
          React.createElement('span', { className: 'dss-dr-title' }, 'Think'),
          expanded ? null : summaryNode
        ),
        expanded ? body : null
      );
    }

    function ImageNode(props) {
      const [src, setSrc] = React.useState(null);
      React.useEffect(function () {
        let alive = true;
        if (typeof props.loadImage === 'function' && props.attachment) {
          Promise.resolve(props.loadImage(props.attachment)).then(function (url) {
            if (alive && typeof url === 'string') setSrc(url);
          }).catch(function () {});
        }
        return function () { alive = false; };
      }, [props.attachment, props.loadImage]);
      if (src === null) return null;
      return React.createElement('img', { className: 'dss-image', src: src, alt: '' });
    }

    function OtherView(props) {
      if (prims && isComponent(prims.JsonBlock)) {
        return React.createElement(prims.JsonBlock, { label: 'Data', payload: props.payload });
      }
      return React.createElement('div', { className: 'dss-plain' }, '[data]');
    }

    function SmoothAssistantNode(props) {
      const node = props.node;
      const data = (node && node.data) || {};
      const blocks = Array.isArray(data.blocks) ? data.blocks : [];
      const status = data.status === 'running' ? 'running' : (data.status === 'interrupted' ? 'interrupted' : 'settled');
      const streaming = status === 'running';
      const t = typeof props.t === 'function' ? props.t : function (k) { return k; };

      const labelsRef = React.useRef(null);
      if (labelsRef.current === null) {
        labelsRef.current = { copyLabel: t('copy') || 'Copy', copiedLabel: t('copied') || 'Copied' };
      }
      const codeLabels = labelsRef.current;

      const loc = node && node.location;
      const turn = loc && (loc.kind === 'turn' || loc.kind === 'step') ? loc.turn : undefined;
      const tail = typeof props.useTurnData === 'function' ? props.useTurnData('turn-tail') : undefined;
      const mentions = React.useMemo(function () {
        if (typeof props.fileMentions !== 'function') return undefined;
        if (!turn || turn.status !== 'closed' || data.finalNode === undefined) return undefined;
        if (!tail || !tail.closing || !tail.closing.finalNode || tail.closing.finalNode.seq !== data.finalNode.seq) return undefined;
        return props.fileMentions({ turn: turn, seq: data.finalNode.seq, openFile: props.openFile });
      }, [data.finalNode, props.fileMentions, props.openFile, tail, turn]);

      const stateRef = React.useRef({ shown: [], prev: [], sum: [], batch: [], sumBatch: [] });
      const blocksRef = React.useRef(blocks);
      const streamingRef = React.useRef(streaming);
      blocksRef.current = blocks;
      streamingRef.current = streaming;
      const rootRef = React.useRef(null);
      const seenStreamRef = React.useRef(false);
      const [, force] = React.useReducer(function (x) { return x + 1; }, 0);
      if (streaming) seenStreamRef.current = true;
      const liveReveal = seenStreamRef.current;
      const s0 = stateRef.current;
      ensureRevealSlots(s0, blocks.length);
      if (!streaming) {
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          if (!b || (b.kind !== 'text' && b.kind !== 'reasoning') || typeof b.text !== 'string') continue;
          if (!liveReveal) {
            s0.shown[i] = b.text.length;
            s0.prev[i] = b.text.length;
            if (b.kind === 'reasoning') s0.sum[i] = b.text.length;
            continue;
          }
          if (s0.shown[i] < b.text.length) {
            s0.prev[i] = s0.shown[i];
            s0.shown[i] = b.text.length;
            s0.batch[i] += 1;
          }
          if (b.kind === 'reasoning' && s0.sum[i] < b.text.length) {
            s0.sum[i] = b.text.length;
            s0.sumBatch[i] += 1;
          }
        }
      }

      React.useEffect(function () {
        const port = findScrollport(rootRef.current);
        if (!port) return undefined;
        if (streaming) port.classList.add('dss-smooth-follow');
        else port.classList.remove('dss-smooth-follow');
        return function () { port.classList.remove('dss-smooth-follow'); };
      }, [streaming]);

      React.useEffect(function () {
        function grow(kind) {
          const list = blocksRef.current;
          const live = streamingRef.current;
          const s = stateRef.current;
          ensureRevealSlots(s, list.length);
          let dirty = false;
          for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b || (b.kind !== 'text' && b.kind !== 'reasoning') || typeof b.text !== 'string') continue;
            const flush = !live || laterBlockStarted(list, i);
            if (kind === 'body' || b.kind === 'text') {
              const min = b.kind === 'reasoning' ? THINK_MIN_CHARS : TEXT_MIN_CHARS;
              const target = paragraphTarget(b.text, s.shown[i], flush, min);
              if (target > s.shown[i]) {
                s.prev[i] = s.shown[i];
                s.shown[i] = target;
                s.batch[i] += 1;
                dirty = true;
              }
            }
            if ((kind === 'sum' || flush) && b.kind === 'reasoning') {
              const target = lineTarget(b.text, s.sum[i], flush);
              if (target > s.sum[i]) {
                s.sum[i] = target;
                s.sumBatch[i] += 1;
                dirty = true;
              }
            }
          }
          if (dirty) force();
        }
        grow('body');
        grow('sum');
        if (!streaming) return undefined;
        const stopBody = ctx.interval(function () { grow('body'); }, BODY_POLL_MS);
        const stopSum = ctx.interval(function () { grow('sum'); }, SUMMARY_TICK_MS);
        return function () {
          if (typeof stopBody === 'function') stopBody();
          if (typeof stopSum === 'function') stopSum();
        };
      }, [streaming, blocks.length]);

      const rendered = [];
      const lastIdx = blocks.length - 1;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (!b) continue;
        if (b.kind === 'tool-call') continue;
        if (b.kind === 'text' && typeof b.text === 'string') {
          const shown = Math.min(stateRef.current.shown[i] || 0, b.text.length);
          const prevShown = Math.min(stateRef.current.prev[i] || 0, shown);
          const batchId = stateRef.current.batch[i] || 0;
          if (shown === 0) continue;
          rendered.push(React.createElement(MarkdownView, {
            key: 't' + i,
            text: b.text.slice(0, shown),
            animate: liveReveal,
            fromEmpty: prevShown === 0,
            batchId: batchId,
            codeLabels: codeLabels,
            fileMentions: mentions
          }));
        } else if (b.kind === 'reasoning' && typeof b.text === 'string') {
          const bodyShown = Math.min(stateRef.current.shown[i] || 0, b.text.length);
          const sumShown = Math.min(stateRef.current.sum[i] || 0, b.text.length);
          const batchId = stateRef.current.batch[i] || 0;
          const summaryBatch = stateRef.current.sumBatch[i] || 0;
          if (bodyShown === 0 && sumShown === 0) continue;
          const prevShown = Math.min(stateRef.current.prev[i] || 0, bodyShown);
          rendered.push(React.createElement(ReasoningView, {
            key: 'r' + i,
            summaryText: b.text.slice(0, sumShown),
            bodyStable: b.text.slice(0, prevShown),
            bodyFresh: bodyShown > prevShown ? b.text.slice(prevShown, bodyShown) : '',
            batchId: batchId,
            summaryBatch: summaryBatch,
            running: streaming && i === lastIdx
          }));
        } else if (b.kind === 'image') {
          if (attach && isComponent(attach.ImageGallery)) {
            const group = [b];
            while (i + 1 < blocks.length && blocks[i + 1] && blocks[i + 1].kind === 'image') {
              i += 1;
              group.push(blocks[i]);
            }
            rendered.push(React.createElement(attach.ImageGallery, {
              key: 'img' + i,
              images: group,
              load: props.loadImage || function () { return Promise.reject(new Error('no image loader')); },
              align: 'start'
            }));
          } else {
            rendered.push(React.createElement(ImageNode, {
              key: 'img' + i,
              attachment: b.attachment,
              loadImage: props.loadImage
            }));
          }
        } else if (b.kind === 'other') {
          rendered.push(React.createElement(OtherView, { key: 'o' + i, payload: b.block }));
        }
      }

      return React.createElement('div', { className: 'dss-root', ref: rootRef },
        React.createElement('div', { className: 'dss-body' },
          rendered,
          status === 'interrupted' ? React.createElement('span', { className: 'dss-stopped' }, t('message.stopped') || 'Stopped') : null
        )
      );
    }

    slots.inject('conversation.chat.node', function () {
      return slots.register(
        { name: 'conversation.chat.node', key: 'assistant-step', priority: -1 },
        SmoothAssistantNode
      );
    });
  }
};

    })();
  }
});


window.__ModuleLoader__.load({
	id: "dsh-self/usage",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region src/client/VentusSettingsCard.ts
		/**
		* DeepSeek API 用量 settings card registered into the Ventus plugin series.
		* Collapsed by default; the user clicks the chevron to expand.
		* @module dsh-deepseek-usage/client/VentusSettingsCard
		*/
		/** Minimal inline styles matching the Ventus settings card chrome. */
		const cardStyle = {
			listStyle: "none",
			padding: "14px 16px",
			border: "1px solid var(--dsw-alias-line-normal)",
			borderRadius: "12px",
			background: "var(--dsw-alias-bg-module-platform)",
			color: "var(--dsw-alias-label-primary)",
			fontFamily: "inherit"
		};
		const headStyle = {
			display: "flex",
			alignItems: "center",
			gap: "8px",
			cursor: "pointer"
		};
		const titleStyle = {
			flex: "1",
			fontSize: "14px",
			fontWeight: "700"
		};
		const bodyStyle = {
			marginTop: "10px",
			display: "flex",
			flexDirection: "column",
			gap: "8px",
			fontSize: "13px"
		};
		const buttonStyle = {
			alignSelf: "flex-start",
			padding: "6px 12px",
			borderRadius: "8px",
			border: "1px solid var(--dsw-alias-line-normal)",
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			cursor: "pointer"
		};
		/** Settings card for the DeepSeek usage monitor. */
		function DeepSeekUsageSettingsCard() {
			const [collapsed, setCollapsed] = (0, react.useState)(true);
			const [loginMessage, setLoginMessage] = (0, react.useState)("");
			const startLogin = async () => {
				setLoginMessage("正在打开登录窗口…");
				try {
					const result = await (await fetch("/api/deepseek-usage/login/start", { method: "POST" })).json();
					setLoginMessage(result.message ?? "请在打开的浏览器中登录");
				} catch {
					setLoginMessage("无法启动登录窗口");
				}
			};
			return (0, react.createElement)("li", { style: cardStyle }, (0, react.createElement)("div", {
				style: headStyle,
				role: "button",
				tabIndex: 0,
				onClick: () => setCollapsed((current) => !current),
				onKeyDown: (event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						setCollapsed((current) => !current);
					}
				}
			}, (0, react.createElement)("span", { style: titleStyle }, "DeepSeek API 用量"), (0, react.createElement)("span", { style: { fontSize: "12px" } }, collapsed ? "▸" : "▾")), collapsed ? null : (0, react.createElement)("div", { style: bodyStyle }, (0, react.createElement)("span", null, "登录状态：请点击下方按钮登录 DeepSeek 开放平台"), (0, react.createElement)("button", {
				style: buttonStyle,
				onClick: () => void startLogin()
			}, "打开登录窗口"), loginMessage ? (0, react.createElement)("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, loginMessage) : null));
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services: slots lets the plugin claim a shell overlay seat. */
		const inject = ["slots"];
		/** Plugin namespace for styles and DOM queries. */
		const NS = "dsu";
		/** Poll interval for state refreshes in milliseconds. */
		const POLL_MS = 6e4;
		const CSS = `
[data-${NS}] { --dsu-bg:var(--dsw-alias-bg-base, #0b0e14); --dsu-panel:var(--dsw-alias-bg-module-platform, #12161f); --dsu-panel-2:var(--dsw-alias-bg-module-hover, #171c27); --dsu-border:var(--dsw-alias-line-normal, rgba(255,255,255,.08)); --dsu-text:var(--dsw-alias-label-primary, #e7ecf3); --dsu-muted:var(--dsw-alias-label-secondary, #8b95a7); --dsu-brand:var(--dsw-alias-state-business-primary, #4d6bfe); --dsu-green:#34d399; --dsu-gold:#ffd166; --dsu-red:#f87171; --dsu-link:#8ea2ff; --dsu-radius:14px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; color:var(--dsu-text); }
body:not([data-ds-dark-theme]) [data-${NS}] { --dsu-bg:#eef0f4; --dsu-panel:#ffffff; --dsu-panel-2:#f4f5f7; --dsu-border:rgba(15,17,21,.08); --dsu-text:#1a1d21; --dsu-muted:#5b6472; --dsu-green:#059669; --dsu-gold:#8a6100; --dsu-red:#dc2626; --dsu-link:#2563eb; }
[data-${NS}]{ position:fixed; inset:0; z-index:2147483000; pointer-events:none; }
[data-${NS}] *{ box-sizing:border-box; }
.${NS}-ball{ position:absolute; top:calc(50% - 20px); right:0; display:flex; align-items:center; gap:6px; background:var(--dsu-panel-2); border:1px solid color-mix(in srgb, var(--dsu-brand) 45%, transparent); border-radius:999px 0 0 999px; padding:6px 10px 6px 8px; box-shadow:0 8px 20px rgba(0,0,0,.35),0 0 0 1px color-mix(in srgb, var(--dsu-brand) 12%, transparent); cursor:grab; transition:box-shadow .15s ease; user-select:none; pointer-events:auto; touch-action:none; }
.${NS}-ball:hover{ box-shadow:0 10px 24px rgba(77,107,254,.20),0 0 0 1px rgba(77,107,254,.25); }
.${NS}-icon{ width:24px; height:24px; border-radius:50%; background:linear-gradient(135deg,#4d6bfe,#7c5cfc); display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:800; }
.${NS}-icon.peak{ background:linear-gradient(135deg,#ef4444,#b91c1c); }
.${NS}-icon.valley{ background:linear-gradient(135deg,#10b981,#047857); }
.${NS}-copy{ display:flex; flex-direction:column; gap:0; min-width:56px; }
.${NS}-copy .k{ font-size:9px; color:var(--dsu-muted); line-height:1; }
.${NS}-copy .v{ font-size:12px; font-weight:650; line-height:1.2; font-variant-numeric:tabular-nums; }
.${NS}-ball-line{ display:flex; align-items:baseline; justify-content:space-between; gap:4px; }
.${NS}-ball-r0{ display:inline-block; margin-top:1px; padding:1px 6px; border-radius:999px; background:color-mix(in srgb, var(--dsu-gold) 14%, transparent); border:1px solid color-mix(in srgb, var(--dsu-gold) 40%, transparent); color:var(--dsu-gold); font-size:10px; font-weight:700; white-space:nowrap; }
.${NS}-chevron{ color:var(--dsu-muted); font-size:10px; margin-left:0; }
.${NS}-dot{ position:absolute; top:5px; right:5px; width:6px; height:6px; border-radius:50%; background:var(--dsu-green); box-shadow:0 0 0 3px rgba(52,211,153,.12); }
/* Mini mode: hide text, keep only a compact colored dot */
.${NS}-ball.${NS}-mini { padding:6px; gap:0; }
.${NS}-ball.${NS}-mini .${NS}-copy,
.${NS}-ball.${NS}-mini .${NS}-chevron { display:none; }
.${NS}-ball.${NS}-mini .${NS}-icon { width:20px; height:20px; font-size:0; border-radius:50%; }
.${NS}-ball.${NS}-mini .${NS}-dot { top:3px; right:3px; width:5px; height:5px; }
.${NS}-toggle{ background:transparent; border:0; padding:2px 4px; color:var(--dsu-muted); font-size:12px; cursor:pointer; border-radius:4px; line-height:1; opacity:0.5; transition:opacity .15s, background .15s; flex:none; }
.${NS}-toggle:hover{ opacity:1; background:rgba(128,128,128,.12); }
.${NS}-panel{ position:absolute; right:0; top:0; bottom:0; width:460px; max-width:94vw; background:var(--dsu-panel); border-left:1px solid var(--dsu-border); box-shadow:-20px 0 60px rgba(0,0,0,.4); display:flex; flex-direction:column; z-index:2147483001; transform:translateX(105%); transition:transform .18s ease; pointer-events:auto; }
.${NS}-panel.open{ transform:translateX(0); }
.${NS}-header{ display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid var(--dsu-border); background:var(--dsu-panel-2); }
.${NS}-header .title{ flex:1; font-size:14px; font-weight:650; }
.${NS}-btn{ width:28px; height:28px; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--dsu-muted); display:flex; align-items:center; justify-content:center; font-size:14px; cursor:pointer; }
.${NS}-btn:hover{ background:rgba(255,255,255,.06); color:var(--dsu-text); }
.${NS}-body{ flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:14px; }
.${NS}-section-title{ font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:var(--dsu-muted); margin-bottom:8px; }
.${NS}-balance{ background:linear-gradient(135deg,rgba(77,107,254,.18),rgba(124,92,252,.08)); border:1px solid rgba(77,107,254,.28); border-radius:var(--dsu-radius); padding:14px 16px; }
.${NS}-balance-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; font-size:12px; color:var(--dsu-muted); }
.${NS}-balance-main{ display:flex; align-items:center; flex-wrap:nowrap; gap:8px; margin-bottom:10px; }
.${NS}-model-label{ margin-left:auto; font-size:12px; color:var(--dsu-muted); white-space:nowrap; flex:none; }
.${NS}-balance-main select{ flex:none; height:30px; padding:0 8px; border-radius:8px; border:1px solid var(--dsu-border); background:var(--dsu-panel-2); color:var(--dsu-text); font:inherit; font-size:12px; }
.${NS}-r0-row{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
.${NS}-amount{ font-size:30px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.${NS}-amount-sub{ color:var(--dsu-muted); font-size:13px; }
.${NS}-r0{ padding:4px 10px; border-radius:999px; background:color-mix(in srgb, var(--dsu-gold) 12%, transparent); border:1px solid color-mix(in srgb, var(--dsu-gold) 35%, transparent); color:var(--dsu-gold); font-size:12px; font-weight:650; white-space:nowrap; }
.${NS}-pv-badge{ padding:3px 10px; border-radius:999px; font-size:12px; font-weight:500; white-space:nowrap; }
.${NS}-pv-badge b{ font-weight:900; font-size:1.15em; }
.${NS}-pv-badge.peak{ background:color-mix(in srgb, #ef4444 16%, transparent); border:1px solid color-mix(in srgb, #ef4444 45%, transparent); color:#dc2626; }
.${NS}-pv-badge.valley{ background:color-mix(in srgb, #10b981 16%, transparent); border:1px solid color-mix(in srgb, #10b981 45%, transparent); color:#047857; }
.${NS}-balance-detail{ display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
.${NS}-balance-detail .item{ background:rgba(0,0,0,.18); border:1px solid rgba(255,255,255,.05); border-radius:10px; padding:8px 10px; }
.${NS}-balance-detail .k{ font-size:12px; color:var(--dsu-muted); margin-bottom:2px; }
.${NS}-balance-detail .v{ font-size:13px; font-weight:600; font-variant-numeric:tabular-nums; }
.${NS}-summary{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.${NS}-summary-card{ background:var(--dsu-panel-2); border:1px solid var(--dsu-border); border-radius:12px; padding:12px; }
.${NS}-summary-card .k{ font-size:12px; color:var(--dsu-muted); margin-bottom:6px; }
.${NS}-summary-card .v{ font-size:20px; font-weight:650; font-variant-numeric:tabular-nums; }
.${NS}-summary-card .sub{ font-size:12px; color:var(--dsu-muted); margin-top:2px; }
.${NS}-table{ border:1px solid var(--dsu-border); border-radius:var(--dsu-radius); overflow:hidden; }
.${NS}-row{ display:grid; grid-template-columns:1.8fr .7fr 1fr .8fr; gap:8px; align-items:center; padding:10px 12px; border-bottom:1px solid var(--dsu-border); background:var(--dsu-panel-2); }
.${NS}-row:last-child{ border-bottom:0; }
.${NS}-row.head{ background:rgba(255,255,255,.03); font-size:12px; color:var(--dsu-muted); text-transform:uppercase; letter-spacing:.04em; }
.${NS}-row.head span:nth-child(n+2){ text-align:right; }
.${NS}-row .model{ font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.${NS}-row .num{ font-size:12px; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.${NS}-row .cost{ font-size:12px; text-align:right; color:var(--dsu-gold); font-variant-numeric:tabular-nums; white-space:nowrap; }
.${NS}-legend{ font-size:12px; color:var(--dsu-muted); line-height:1.5; }
.${NS}-error{ color:var(--dsu-red); font-size:12px; margin-top:8px; }
.${NS}-footer{ padding:12px 16px; border-top:1px solid var(--dsu-border); background:var(--dsu-panel-2); display:flex; align-items:center; justify-content:space-between; color:var(--dsu-muted); font-size:12px; }
.${NS}-footer .refresh{ color:var(--dsu-link); cursor:pointer; }
.${NS}-tooltip{ position:fixed; z-index:2147483999; display:none; max-width:380px; padding:10px 14px; border-radius:10px; background:var(--dsw-alias-bg-popover, var(--dsu-panel-2)); border:1px solid var(--dsu-border); color:var(--dsu-text); font-size:14px; line-height:1.6; white-space:normal; pointer-events:none; box-shadow:0 10px 28px rgba(0,0,0,.35); backdrop-filter:blur(8px); }
.${NS}-tooltip.visible{ display:block; }
body:not([data-ds-dark-theme]) [data-${NS}] .${NS}-panel{ box-shadow:-12px 0 32px rgba(15,17,21,.10); }
body:not([data-ds-dark-theme]) [data-${NS}] .${NS}-ball{ box-shadow:0 8px 24px rgba(15,17,21,.12),0 0 0 1px rgba(77,107,254,.18); }
body:not([data-ds-dark-theme]) [data-${NS}] .${NS}-balance-detail .item{ background:rgba(15,17,21,.04); border-color:rgba(15,17,21,.08); }
body:not([data-ds-dark-theme]) [data-${NS}] .${NS}-row.head{ background:rgba(15,17,21,.04); }
body:not([data-ds-dark-theme]) [data-${NS}] .${NS}-btn:hover{ background:rgba(15,17,21,.06); }
@media (prefers-reduced-motion:reduce){ .${NS}-panel{ transition:none; } }
`;
		/** Convert a number to a compact K/M label. */
		function compact(value) {
			if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
			if (value >= 1e6) return `${(value / 1e6).toFixed(value >= 1e7 ? 1 : 2)}M`;
			if (value >= 1e3) return `${Math.round(value / 1e3)}K`;
			return String(value);
		}
		/** Format money with the snapshot currency. */
		function money(value, currency) {
			return currency === "USD" ? `$${value.toFixed(2)}` : `¥${value.toFixed(2)}`;
		}
		/** Short display name for tracked models. */
		function shortModelName(model) {
			if (model.includes("pro")) return "Pro";
			if (model.includes("flash")) return "Flash";
			return model;
		}
		/** Format a number as mantissa × 10^exponent with three significant digits. */
		function toScientific(value) {
			if (value === 0 || !Number.isFinite(value)) return String(value);
			const exponent = Math.floor(Math.log10(Math.abs(value)));
			const mantissa = value / 10 ** exponent;
			const superscripts = {
				"0": "⁰",
				"1": "¹",
				"2": "²",
				"3": "³",
				"4": "⁴",
				"5": "⁵",
				"6": "⁶",
				"7": "⁷",
				"8": "⁸",
				"9": "⁹",
				"-": "⁻"
			};
			const expText = String(exponent).split("").map((char) => superscripts[char] ?? char).join("");
			return `${mantissa.toFixed(2)}×10${expText}`;
		}
		/** Return whether the current Beijing time is peak or valley. */
		function peakValley() {
			const now = /* @__PURE__ */ new Date();
			const parts = new Intl.DateTimeFormat("en-GB", {
				timeZone: "Asia/Shanghai",
				hour: "2-digit",
				hour12: false
			}).formatToParts(now);
			const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
			return hour >= 9 && hour < 12 || hour >= 14 && hour < 18 ? {
				text: "峰",
				cls: "peak"
			} : {
				text: "谷",
				cls: "valley"
			};
		}
		/** Mount the floating widget. */
		function apply(ctx) {
			let styleEl = null;
			if (document.querySelector(`style[data-${NS}-css]`) === null) {
				styleEl = document.createElement("style");
				styleEl.dataset[`${NS}Css`] = "";
				styleEl.textContent = CSS;
				document.head.appendChild(styleEl);
			}
			const host = document.createElement("div");
			host.dataset[NS] = "";
			host.innerHTML = `
    <div class="${NS}-ball" role="button" tabindex="0" aria-label="DeepSeek API 用量">
      <span class="${NS}-dot"></span>
      <div class="${NS}-icon" data-field="ball-icon">峰</div>
      <div class="${NS}-copy">
        <span class="${NS}-ball-line"><span class="k">余额</span><span class="v">--</span></span>
        <span class="${NS}-ball-r0" data-field="ball-r0">--</span>
      </div>
      <span class="${NS}-chevron">‹</span>
      <button type="button" class="${NS}-toggle" data-action="toggle-mini" title="切换极简模式" aria-label="切换极简/完整模式">⤡</button>
    </div>
    <aside class="${NS}-panel" aria-hidden="true">
      <div class="${NS}-header">
        <span class="title">DeepSeek API 用量</span>
        <button class="${NS}-btn" data-action="refresh" title="刷新">↻</button>
        <button class="${NS}-btn" data-action="close" title="收起">✕</button>
      </div>
      <div class="${NS}-body">
        <section>
          <div class="${NS}-section-title">账户</div>
          <div class="${NS}-balance">
            <div class="${NS}-balance-top">
              <span>DeepSeek 开放平台</span>
              <span class="${NS}-pv-badge" data-field="pv-badge">--</span>
              <span data-field="source">--</span>
            </div>
            <div class="${NS}-balance-main">
              <span class="${NS}-amount">--</span><span class="${NS}-amount-sub"></span>
              <span class="${NS}-model-label">模型涨价率：</span>
              <select id="dsu-model-select" data-field="model-select">
                <option value="deepseek-v4-flash">DeepSeek Flash</option>
                <option value="deepseek-v4-pro">DeepSeek Pro</option>
              </select>
            </div>
            <div class="${NS}-r0-row">
              <span class="${NS}-r0" data-field="r0-total" title="8月17日起累计涨价倍率">累计R0 --</span>
              <span class="${NS}-r0" data-field="r0-today" title="今日涨价倍率">今日R0 --</span>
            </div>
            <div class="${NS}-balance-detail">
              <div class="item"><div class="k">赠金余额</div><div class="v" data-field="bonus">--</div></div>
              <div class="item"><div class="k">累计消费</div><div class="v" data-field="total-cost">--</div></div>
            </div>
          </div>
        </section>
        <section>
          <div class="${NS}-section-title">今日</div>
          <div class="${NS}-summary">
            <div class="${NS}-summary-card">
              <div class="k">今日消费</div>
              <div class="v" data-field="cost">--</div>
              <div class="sub">平台实际扣费</div>
            </div>
            <div class="${NS}-summary-card">
              <div class="k">API 请求次数</div>
              <div class="v" data-field="requests">--</div>
              <div class="sub">平台统计</div>
            </div>
            <div class="${NS}-summary-card">
              <div class="k">Tokens</div>
              <div class="v" data-field="tokens">--</div>
              <div class="sub">平台统计</div>
            </div>
            <div class="${NS}-summary-card">
              <div class="k">模型数</div>
              <div class="v" data-field="model-count">--</div>
              <div class="sub">今日有调用</div>
            </div>
          </div>
        </section>
        <section>
          <div class="${NS}-section-title">分模型今日</div>
          <div class="${NS}-table" data-field="table">
            <div class="${NS}-row head"><span>模型</span><span>请求</span><span>Tokens</span><span>消费</span></div>
          </div>
          <div class="${NS}-legend">数据来源：DeepSeek 开放平台，与用量页同源。</div>
        </section>
      </div>
      <div class="${NS}-footer">
        <span data-field="footer">等待数据</span>
        <span class="refresh" data-action="login">登录</span>
        <span class="refresh" data-action="logout">退出登录</span>
        <span class="refresh" data-action="refresh">刷新</span>
      </div>
    </aside>
    <div class="${NS}-tooltip" data-field="tooltip" role="tooltip"></div>
  `;
			document.body.appendChild(host);
			const ball = host.querySelector(`.${NS}-ball`);
			const panel = host.querySelector(`.${NS}-panel`);
			const ballValue = host.querySelector(`.${NS}-copy .v`);
			const stateFields = {
				source: host.querySelector("[data-field=\"source\"]"),
				amount: host.querySelector(`.${NS}-amount`),
				amountSub: host.querySelector(`.${NS}-amount-sub`),
				ballR0: host.querySelector("[data-field=\"ball-r0\"]"),
				ballIcon: host.querySelector("[data-field=\"ball-icon\"]"),
				pvBadge: host.querySelector("[data-field=\"pv-badge\"]"),
				modelSelect: host.querySelector("[data-field=\"model-select\"]"),
				r0Total: host.querySelector("[data-field=\"r0-total\"]"),
				r0Today: host.querySelector("[data-field=\"r0-today\"]"),
				bonus: host.querySelector("[data-field=\"bonus\"]"),
				totalCost: host.querySelector("[data-field=\"total-cost\"]"),
				cost: host.querySelector("[data-field=\"cost\"]"),
				requests: host.querySelector("[data-field=\"requests\"]"),
				tokens: host.querySelector("[data-field=\"tokens\"]"),
				modelCount: host.querySelector("[data-field=\"model-count\"]"),
				table: host.querySelector("[data-field=\"table\"]"),
				footer: host.querySelector("[data-field=\"footer\"]"),
				tooltip: host.querySelector("[data-field=\"tooltip\"]")
			};
			let open = false;
			let currency = "CNY";
			let selectedModel = "deepseek-v4-flash";
			let lastState = null;
			let lastBalanceLow = null;
			/** Mini mode toggle: persist "dsu-mini" in localStorage, default off. */
			const MINI_KEY = "dsu-mini";
			function readMiniMode() {
				try {
					return localStorage.getItem(MINI_KEY) === "1";
				} catch {
					return false;
				}
			}
			function writeMiniMode(on) {
				try {
					localStorage.setItem(MINI_KEY, on ? "1" : "0");
				} catch {}
			}
			if (readMiniMode()) ball.classList.add("dsu-mini");
			/** Whale-musume integration: notify the mascot when balance is low.
			*  The mascot listens for `dsh-whale-balance-low` event and
			*  `localStorage.dsh.balance.low`. Threshold is ¥5 CNY or $5 USD. */
			const WHALE_BALANCE_THRESHOLD_CNY = 5;
			const WHALE_BALANCE_THRESHOLD_USD = 5;
			function notifyWhaleBalance(state) {
				if (!state.balance) return;
				const threshold = state.balance.currency === "USD" ? WHALE_BALANCE_THRESHOLD_USD : WHALE_BALANCE_THRESHOLD_CNY;
				const isLow = state.balance.balance < threshold;
				if (isLow === lastBalanceLow) return;
				lastBalanceLow = isLow;
				try {
					if (isLow) {
						localStorage.setItem("dsh.balance.low", "1");
						window.dispatchEvent(new CustomEvent("dsh-whale-balance-low"));
					} else localStorage.removeItem("dsh.balance.low");
				} catch {}
			}
			const toggle = (next) => {
				open = next ?? !open;
				panel.classList.toggle("open", open);
				panel.setAttribute("aria-hidden", String(!open));
				if (open) load();
			};
			const updatePeakValleyIcon = () => {
				const pv = peakValley();
				stateFields.ballIcon.textContent = pv.text;
				stateFields.ballIcon.classList.toggle("peak", pv.cls === "peak");
				stateFields.ballIcon.classList.toggle("valley", pv.cls === "valley");
				stateFields.pvBadge.innerHTML = pv.text === "峰" ? "LW<b>峰</b>时刻" : "LW<b>谷</b>时刻";
				stateFields.pvBadge.classList.toggle("peak", pv.cls === "peak");
				stateFields.pvBadge.classList.toggle("valley", pv.cls === "valley");
			};
			const load = async () => {
				updatePeakValleyIcon();
				try {
					const response = await fetch("/api/deepseek-usage/state", { headers: { accept: "application/json" } });
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					render(await response.json());
					stateFields.footer.textContent = "数据已更新";
				} catch {
					stateFields.footer.textContent = "加载失败，3 秒后重试";
					setTimeout(() => {
						load();
					}, 3e3);
				}
			};
			const refresh = async () => {
				try {
					const response = await fetch("/api/deepseek-usage/refresh", { method: "POST" });
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					render(await response.json());
				} catch {
					stateFields.footer.textContent = "刷新失败";
				}
			};
			let loginPollTimer;
			const startLogin = async () => {
				try {
					const result = await (await fetch("/api/deepseek-usage/login/start", { method: "POST" })).json();
					stateFields.footer.textContent = result.message ?? "正在打开登录窗口…";
					if (!result.ok) return;
					clearInterval(loginPollTimer);
					loginPollTimer = setInterval(async () => {
						try {
							const status = await (await fetch("/api/deepseek-usage/login/status")).json();
							if (status.loggedIn) {
								clearInterval(loginPollTimer);
								stateFields.footer.textContent = "登录成功，正在获取数据…";
								await refresh();
							} else stateFields.footer.textContent = status.message ?? "等待登录完成…";
						} catch {
							stateFields.footer.textContent = "登录状态检查失败";
						}
					}, 2e3);
				} catch {
					stateFields.footer.textContent = "无法启动登录窗口";
				}
			};
			const logout = async () => {
				try {
					const result = await (await fetch("/api/deepseek-usage/logout", { method: "POST" })).json();
					stateFields.footer.textContent = result.ok ? "已退出登录" : result.message ?? "退出失败";
					if (result.ok) await load();
				} catch {
					stateFields.footer.textContent = "退出失败";
				}
			};
			const showTooltip = (target, text) => {
				stateFields.tooltip.textContent = text;
				const rect = target.getBoundingClientRect();
				const left = Math.max(8, Math.min(rect.left, window.innerWidth - 380));
				const below = rect.bottom + 10;
				const above = rect.top - 48;
				const top = below + 60 < window.innerHeight ? below : Math.max(8, above);
				stateFields.tooltip.style.left = `${left}px`;
				stateFields.tooltip.style.top = `${top}px`;
				stateFields.tooltip.classList.add("visible");
			};
			const hideTooltip = () => {
				stateFields.tooltip.classList.remove("visible");
			};
			const bindTooltip = (el) => {
				el.addEventListener("mouseenter", () => {
					const tip = el.dataset.tip;
					if (tip) showTooltip(el, tip);
				});
				el.addEventListener("mouseleave", hideTooltip);
				el.addEventListener("focus", () => {
					const tip = el.dataset.tip;
					if (tip) showTooltip(el, tip);
				});
				el.addEventListener("blur", hideTooltip);
			};
			const render = (state) => {
				if (state.error) {
					ballValue.textContent = "--";
					stateFields.source.textContent = "异常";
					stateFields.footer.textContent = state.error;
					lastBalanceLow = null;
					try {
						localStorage.removeItem("dsh.balance.low");
					} catch {}
					return;
				}
				const balance = state.balance;
				if (balance) {
					currency = balance.currency || "CNY";
					const symbol = currency === "USD" ? "$" : "¥";
					ballValue.textContent = `${symbol}${balance.balance.toFixed(2)}`;
					stateFields.source.textContent = "平台已连接";
					stateFields.amount.textContent = `${symbol}${balance.balance.toFixed(2)}`;
					stateFields.amountSub.textContent = currency;
					stateFields.bonus.textContent = `${symbol}${balance.bonus_balance.toFixed(2)}`;
					stateFields.totalCost.textContent = `${symbol}${balance.total_cost.toFixed(2)}`;
					const threshold = balance.currency === "USD" ? WHALE_BALANCE_THRESHOLD_USD : WHALE_BALANCE_THRESHOLD_CNY;
					if (balance.balance < threshold) stateFields.ballR0.title = `鲸鱼娘说：余额不足 ${symbol}${threshold.toFixed(2)} 啦，快去充值！🐋`;
					else stateFields.ballR0.title = "";
				} else {
					ballValue.textContent = "--";
					stateFields.source.textContent = "无数据";
					stateFields.amount.textContent = "--";
					stateFields.amountSub.textContent = "";
					stateFields.bonus.textContent = "--";
					stateFields.totalCost.textContent = "--";
				}
				const ratio = state.price_ratio;
				const modelData = ratio?.models.find((model) => model.model === selectedModel);
				const topModel = state.today?.models.slice().sort((a, b) => b.tokens - a.tokens)[0]?.model;
				const topModelData = ratio?.models.find((model) => model.model === topModel);
				if (modelData) {
					stateFields.r0Total.textContent = !modelData.used_total ? "累计未使用" : modelData.r0_total !== null ? `累计R0 ×${modelData.r0_total.toFixed(2)}` : "累计R0 --";
					stateFields.r0Total.dataset.tip = modelData.has_history ? `8月17日起累计 A2/A1 = ${modelData.a2_total !== null ? toScientific(modelData.a2_total) : "--"} / ${toScientific(modelData.a1)}` : `无涨价前历史，使用默认 A1 = ${toScientific(modelData.a1)}`;
					stateFields.r0Today.textContent = !modelData.used_today ? "今日未使用" : modelData.r0_today !== null ? `今日R0 ×${modelData.r0_today.toFixed(2)}` : "今日R0 --";
					stateFields.r0Today.dataset.tip = modelData.has_history ? `今日 A2/A1 = ${modelData.a2_today !== null ? toScientific(modelData.a2_today) : "--"} / ${toScientific(modelData.a1)}` : `无涨价前历史，使用默认 A1 = ${toScientific(modelData.a1)}`;
				} else {
					stateFields.r0Total.textContent = "累计R0 --";
					stateFields.r0Today.textContent = "今日R0 --";
				}
				stateFields.ballR0.textContent = topModelData && topModelData.used_today && topModelData.r0_today !== null ? `${shortModelName(topModel ?? selectedModel)} ×${topModelData.r0_today.toFixed(2)}` : "--";
				stateFields.ballR0.dataset.tip = topModelData && topModelData.r0_today !== null ? `${shortModelName(topModel ?? selectedModel)} 今日 A2/A1 = ${toScientific(topModelData.a2_today ?? 0)} / ${toScientific(topModelData.a1)}` : "";
				const today = state.today;
				if (today) {
					stateFields.cost.textContent = money(today.cost, currency);
					stateFields.requests.textContent = today.requests.toLocaleString("zh-CN");
					stateFields.tokens.textContent = today.tokens.toLocaleString("zh-CN");
					stateFields.modelCount.textContent = String(today.models.length);
					const rows = today.models.map((model) => `
        <div class="${NS}-row">
          <span class="model" title="${escapeHtml(model.model)}">${escapeHtml(model.model)}</span>
          <span class="num">${model.requests.toLocaleString("zh-CN")}</span>
          <span class="num">${compact(model.tokens)}</span>
          <span class="cost">${money(model.cost, currency)}</span>
        </div>
      `).join("");
					stateFields.table.innerHTML = `<div class="${NS}-row head"><span>模型</span><span>请求</span><span>Tokens</span><span>消费</span></div>${rows || `<div class="${NS}-row"><span class="model">暂无数据</span><span class="num">--</span><span class="num">--</span><span class="cost">--</span></div>`}`;
				} else {
					stateFields.cost.textContent = "--";
					stateFields.requests.textContent = "--";
					stateFields.tokens.textContent = "--";
					stateFields.modelCount.textContent = "--";
					stateFields.table.innerHTML = `<div class="${NS}-row head"><span>模型</span><span>请求</span><span>Tokens</span><span>消费</span></div><div class="${NS}-row"><span class="model">暂无数据</span><span class="num">--</span><span class="num">--</span><span class="cost">--</span></div>`;
				}
				stateFields.footer.textContent = `更新于 ${new Date(state.fetched_at).toLocaleTimeString("zh-CN", { hour12: false })}`;
				lastState = state;
				notifyWhaleBalance(state);
			};
			const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				"\"": "&quot;",
				"'": "&#39;"
			})[char] ?? char);
			let dragMoved = false;
			let dragPointerY = 0;
			let dragStartTop = 0;
			const onBallPointerDown = (event) => {
				dragMoved = false;
				dragPointerY = event.clientY;
				dragStartTop = ball.getBoundingClientRect().top;
				ball.setPointerCapture(event.pointerId);
			};
			const onBallPointerMove = (event) => {
				if (!ball.hasPointerCapture(event.pointerId)) return;
				const delta = event.clientY - dragPointerY;
				if (Math.abs(delta) > 4) dragMoved = true;
				const maxTop = Math.max(0, window.innerHeight - ball.offsetHeight);
				ball.style.top = `${Math.max(0, Math.min(maxTop, dragStartTop + delta))}px`;
			};
			const onBallPointerUp = (event) => {
				if (!ball.hasPointerCapture(event.pointerId)) return;
				ball.releasePointerCapture(event.pointerId);
				if (!dragMoved) return;
				if (event.clientX < window.innerWidth / 2) {
					ball.style.right = "auto";
					ball.style.left = "0";
					ball.style.borderRadius = "0 999px 999px 0";
				} else {
					ball.style.left = "auto";
					ball.style.right = "0";
					ball.style.borderRadius = "999px 0 0 999px";
				}
			};
			ball.addEventListener("click", () => {
				if (!dragMoved) toggle();
			});
			ball.addEventListener("pointerdown", onBallPointerDown);
			ball.addEventListener("pointermove", onBallPointerMove);
			ball.addEventListener("pointerup", onBallPointerUp);
			ball.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					toggle();
				}
			});
			host.querySelector("[data-action=\"login\"]")?.addEventListener("click", () => void startLogin());
			host.querySelector("[data-action=\"logout\"]")?.addEventListener("click", () => void logout());
			host.querySelectorAll("[data-action=\"refresh\"]").forEach((el) => el.addEventListener("click", () => void refresh()));
			stateFields.modelSelect.addEventListener("change", () => {
				selectedModel = stateFields.modelSelect.value;
				if (lastState) render(lastState);
			});
			bindTooltip(stateFields.r0Total);
			bindTooltip(stateFields.r0Today);
			bindTooltip(stateFields.ballR0);
			host.querySelector("[data-action=\"close\"]")?.addEventListener("click", (e) => {
				e.stopPropagation();
				toggle(false);
			});
			host.querySelector("[data-action=\"toggle-mini\"]")?.addEventListener("click", (e) => {
				e.stopPropagation();
				const next = !ball.classList.contains("dsu-mini");
				ball.classList.toggle("dsu-mini", next);
				writeMiniMode(next);
			});
			const onKeydown = (event) => {
				if (event.key === "Escape" && open) toggle(false);
			};
			document.addEventListener("keydown", onKeydown);
			const onDocumentClick = (event) => {
				if (!open) return;
				const target = event.target;
				if (!panel.contains(target) && !ball.contains(target)) toggle(false);
			};
			document.addEventListener("click", onDocumentClick);
			const disposeOverlay = ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-deepseek-usage",
				order: 100
			}, () => null));
			const disposeVentusCard = ctx.slots.inject("ventus.plugin.item", () => ctx.slots.register({
				name: "ventus.plugin.item",
				id: "dsh-deepseek-usage",
				order: 20
			}, DeepSeekUsageSettingsCard));
			load();
			const timer = setInterval(() => {
				load();
			}, POLL_MS);
			ctx.effect(() => () => {
				clearInterval(timer);
				clearInterval(loginPollTimer);
				disposeOverlay();
				disposeVentusCard();
				document.removeEventListener("keydown", onKeydown);
				document.removeEventListener("click", onDocumentClick);
				host.remove();
				styleEl?.remove();
			}, "dsh-deepseek-usage: ui");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map

window.__ModuleLoader__.load({
  id: 'dsh-self',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')

    const inject = ['slots']
    const NS = 'dsh-self'
    const HOST_SEND_MARK = '__dshSelfHostSendHooked'

    const SLOT_REMAP = {
      'sidebar.footer.action': 'ventus.plugin.item',
      'sidebar.footer': 'ventus.plugin.item',
      'web-ui.plugin.item': 'settings.plugin.item',
    }

    /** First-level settings.section ids that belong as cards under official 插件. */
    const DEMOTE_SECTION = {
      'super-injector-plugins': { title: '注入器', wrap: 'dom' },
      'web-ui-plugins': { skip: true },
      'community-plugins': { title: '社区插件索引', wrap: 'react' },
    }

    /** Observe entry-fusion: hide separate settings cards; keep shell.overlay / composer dock. */
    const ABSORB_SETTINGS_IDS = {
      'live-stats': true,
      'dsh-deepseek-usage': true,
    }
    const ABSORB_SLOT_NAMES = {
      'settings.plugin.item': true,
      'web-ui.plugin.item': true,
      'ventus.plugin.item': true,
    }

    const cardStyle = {
      listStyle: 'none',
      border: '1px solid var(--dsw-alias-border-l2, #cbd5e0)',
      background: 'var(--dsw-alias-bg-layer-3, #edf2f7)',
      borderRadius: 12,
      padding: 0,
      overflow: 'hidden',
    }
    const headStyle = {
      appearance: 'none',
      width: '100%',
      textAlign: 'left',
      border: 0,
      background: 'transparent',
      padding: '14px 16px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      font: 'inherit',
      color: 'inherit',
    }
    const bodyStyle = {
      borderTop: '1px solid var(--dsw-alias-border-l2, #cbd5e0)',
      margin: '0 16px',
      padding: '12px 0 16px',
      fontSize: 13,
    }
    const btnStyle = {
      marginRight: 8,
      marginTop: 8,
      padding: '6px 12px',
      borderRadius: 8,
      border: '1px solid var(--dsw-alias-border-l2, #cbd5e0)',
      background: 'var(--dsw-alias-brand-primary, #3182ce)',
      color: '#fff',
      cursor: 'pointer',
    }

    function hostRouteHint(text) {
      const t = String(text || '')
      if (/路由（必读）/.test(t)) return ''
      const lines = []
      if (/预演.*git|git\.status|git status/i.test(t)) {
        lines.push('路由（必读）：必须调用原生 tool dsh_host_preview({"tool":"git.status"})；禁止 bash git status（bash cwd 不是 dsp 白名单）。')
      }
      if (/读取|读.*dsh-self|organs\.yml/i.test(t)) {
        lines.push('路由（必读）：必须调用原生 tool dsh_host_run({"tool":"fs.read","path":"dsh-self/organs.yml"})；禁止 bash / str_replace_editor / read。')
      }
      if (/列出.*宿主|宿主工具|dsh_host_catalog/i.test(t)) {
        lines.push('路由（必读）：必须调用原生 tool dsh_host_catalog({})；禁止 bash。调用后直接返回工具结果，不要寒暄。')
      }
      if (lines.length === 0 && /(宿主|dsh_host|\bdsp\b|白名单)/i.test(t)) {
        lines.push('路由（必读）：dsp 任务用原生 tool dsh_host_catalog / dsh_host_preview / dsh_host_run，不是 bash 命令。')
      }
      return lines.join('\n')
    }

    function installHostSendHook(conversation) {
      if (!conversation || typeof conversation !== 'object') return
      if (conversation[HOST_SEND_MARK]) return
      if (typeof conversation.sendSession === 'function') {
        const original = conversation.sendSession
        conversation.sendSession = function (session, text, imageIds, mode) {
          const hint = hostRouteHint(text)
          const next = hint ? (String(text || '').trim() + '\n' + hint) : text
          return original.call(this, session, next, imageIds, mode)
        }
      }
      if (typeof conversation.send === 'function') {
        const originalSend = conversation.send
        conversation.send = function (text) {
          const hint = hostRouteHint(text)
          const next = hint ? (String(text || '').trim() + '\n' + hint) : text
          return originalSend.call(this, next)
        }
      }
      conversation[HOST_SEND_MARK] = true
    }

    function isDump(el) {
      if (!el || el.nodeType !== 1) return false
      if (el.hasAttribute('data-dsh-self')) return false
      if (el.hasAttribute('data-dsu') || (el.querySelector && el.querySelector('[data-dsu]'))) return false
      const tag = el.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'META' || tag === 'IFRAME') return false
      if (el.getAttribute('role') === 'dialog') return false
      if (el.hasAttribute('data-plugin')) return true
      const cls = String(el.className || '')
      if (/notification|exporter|workspace-analyzer|plugin-panel/i.test(cls)) return true
      const pos = (el.style && el.style.position) || ''
      if (pos === 'fixed') {
        const left = parseFloat(el.style.left || '')
        const width = el.offsetWidth || parseFloat(el.style.width || '0')
        if (Number.isFinite(left) && left < 90 && width > 160) return true
      }
      return false
    }

    function ensureBin() {
      let bin = document.getElementById(NS + '-bin')
      if (bin) return bin
      bin = document.createElement('div')
      bin.id = NS + '-bin'
      bin.setAttribute('data-dsh-self', 'bin')
      bin.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147482000;max-width:360px;max-height:40vh;overflow:auto;pointer-events:auto;display:none;background:var(--dsw-alias-bg-layer-2,#111);border:1px solid var(--dsw-alias-border-l2,#333);border-radius:12px;padding:8px;'
      document.documentElement.appendChild(bin)
      return bin
    }

    function relocate(el) {
      const bin = ensureBin()
      bin.style.display = 'block'
      el.setAttribute('data-dsh-self', 'relocated')
      bin.appendChild(el)
    }

    function installBodyGuard() {
      if (window.__dshSelfBodyGuard) return () => {}
      window.__dshSelfBodyGuard = true
      const proto = Element.prototype
      const origAppend = proto.appendChild
      const origAppendMany = proto.append
      proto.appendChild = function (child) {
        if (this === document.body && isDump(child)) {
          relocate(child)
          return child
        }
        return origAppend.call(this, child)
      }
      proto.append = function (...nodes) {
        if (this === document.body) {
          for (const n of nodes) {
            if (isDump(n)) relocate(n)
            else origAppend.call(this, n)
          }
          return this
        }
        return origAppendMany.apply(this, nodes)
      }
      return () => {
        proto.appendChild = origAppend
        proto.append = origAppendMany
        window.__dshSelfBodyGuard = false
      }
    }

    function makeDemotedCard(id, title, inner, kind) {
      return function DemotedCard(props) {
        const [open, setOpen] = React.useState(false)
        const ref = React.useRef(null)
        React.useEffect(() => {
          if (kind !== 'dom' || !open || !ref.current) return
          ref.current.innerHTML = ''
          try {
            const factory = inner
            const inst = typeof factory === 'function' ? factory() : factory
            const node = inst && typeof inst.render === 'function' ? inst.render() : inst
            if (node && node.nodeType === 1) ref.current.appendChild(node)
          } catch (e) { /* ignore mount errors */ }
          return () => {
            if (ref.current) ref.current.innerHTML = ''
          }
        }, [open])
        return React.createElement(
          'li',
          { style: cardStyle, 'data-plugin': id, 'data-dsh-self': 'demoted-section' },
          React.createElement(
            'button',
            { type: 'button', style: headStyle, onClick: () => setOpen((v) => !v) },
            React.createElement('span', { style: { fontSize: 15, fontWeight: 600 } }, title),
            React.createElement('span', { style: { fontSize: 13, opacity: 0.75 } }, '已收编进官方「插件」，不再占侧栏'),
          ),
          open
            ? (kind === 'react'
              ? React.createElement('div', { style: bodyStyle },
                typeof inner === 'function' ? React.createElement(inner, props) : null)
              : React.createElement('div', { style: bodyStyle, ref: ref }))
            : null,
        )
      }
    }

    function installSlotRemap(ctx) {
      if (!ctx.slots || ctx.slots.__dshSelfPatched) return () => {}
      ctx.slots.__dshSelfPatched = true
      const seen = new Set()
      const rawInject = ctx.slots.inject.bind(ctx.slots)
      const rawRegister = ctx.slots.register.bind(ctx.slots)
      let absorbSettings = true
      ctx.slots.__dshSelfSetAbsorb = (on) => { absorbSettings = !!on }

      ctx.slots.register = function (opts, comp) {
        if (opts && opts.name === 'settings.section' && DEMOTE_SECTION[opts.id]) {
          const spec = DEMOTE_SECTION[opts.id]
          if (spec.skip) return function noop() {}
          const inner = comp || opts.component
          const Card = makeDemotedCard(opts.id, spec.title, inner, spec.wrap)
          return rawRegister({
            name: 'settings.plugin.item',
            key: opts.id,
            id: opts.id,
            order: opts.order || 80,
          }, Card)
        }
        const slotName = opts && opts.name
        const slotId = opts && opts.id
        if (absorbSettings && ABSORB_SLOT_NAMES[slotName] && ABSORB_SETTINGS_IDS[slotId] && slotId !== 'dsh-self') {
          return function noop() {}
        }
        const mapped = SLOT_REMAP[slotName] || slotName
        if (absorbSettings && ABSORB_SLOT_NAMES[mapped] && ABSORB_SETTINGS_IDS[slotId] && slotId !== 'dsh-self') {
          return function noop() {}
        }
        const nextOpts = mapped !== slotName ? Object.assign({}, opts, { name: mapped }) : opts
        if (nextOpts.name === 'settings.plugin.item' && !nextOpts.key && nextOpts.id) {
          Object.assign(nextOpts, { key: nextOpts.id })
        }
        // Dedupe ONLY id-keyed settings/plugin cards. Keyed seats like
        // conversation.chat.node use `key` (user/assistant-step/…) and often
        // have no `id`; a global seen of "name:undefined" silently drops every
        // renderer after the first → 整页「未知 surface 事件」。
        const dedupeId = nextOpts.id
        const shouldDedupe = dedupeId != null && dedupeId !== '' && (
          ABSORB_SLOT_NAMES[nextOpts.name]
          || nextOpts.name === 'settings.plugin.item'
          || nextOpts.name === 'ventus.plugin.item'
        )
        if (shouldDedupe) {
          const dedupeKey = String(nextOpts.name) + ':' + String(dedupeId)
          if (seen.has(dedupeKey)) return function noop() {}
          seen.add(dedupeKey)
          const dispose = rawRegister(nextOpts, comp)
          return function () {
            seen.delete(dedupeKey)
            if (typeof dispose === 'function') dispose()
          }
        }
        return rawRegister(mapped !== slotName ? nextOpts : opts, comp)
      }

      ctx.slots.inject = function (slotName, factory) {
        const mapped = SLOT_REMAP[slotName] || slotName
        return rawInject(mapped, factory)
      }

      return () => {
        ctx.slots.inject = rawInject
        ctx.slots.register = rawRegister
        ctx.slots.__dshSelfPatched = false
        delete ctx.slots.__dshSelfSetAbsorb
      }
    }

    function atomOn(organs, organId, atomId) {
      const og = (organs || []).find((o) => o.id === organId)
      const a = og && (og.atoms || []).find((x) => x.id === atomId)
      return !a || a.enabled !== false
    }

    function mountOrganModule(require, moduleId, ctx) {
      let mod
      try { mod = require(moduleId) } catch { return null }
      if (!mod || typeof mod.apply !== 'function') return null
      if (Array.isArray(mod.inject) && mod.inject.length && typeof ctx.inject === 'function') {
        try {
          ctx.inject(mod.inject, (sub) => mod.apply(sub))
          return () => {}
        } catch (e) {
          console.warn('[dsh-self] organ inject failed', moduleId, e)
          return null
        }
      }
      try {
        mod.apply(ctx)
        return () => {}
      } catch (e) {
        console.warn('[dsh-self] organ apply failed', moduleId, e)
        return null
      }
    }

    function mountOrganAtoms(require, ctx, groups) {
      const organDisposers = []
      if (atomOn(groups, 'chat', 'file-drop')) {
        const d = mountOrganModule(require, 'dsh-self/file-drop', ctx)
        if (d) organDisposers.push(d)
      }
      if (atomOn(groups, 'chat', 'smooth-stream')) {
        const d = mountOrganModule(require, 'dsh-self/smooth-stream', ctx)
        if (d) organDisposers.push(d)
      }
      if (atomOn(groups, 'observe', 'usage-balance') || atomOn(groups, 'observe', 'usage-today')) {
        const d = mountOrganModule(require, 'dsh-self/usage', ctx)
        if (d) organDisposers.push(d)
      }
      if (organDisposers.length) {
        ctx.effect(
          () => () => { for (const d of organDisposers) { try { d() } catch {} } },
          'dsh-self: fused-organs',
        )
      }
    }

    function applyWhaleMascotPref(enabled) {
      try {
        localStorage.setItem('whale-moe:pet', enabled ? '1' : '0')
      } catch {}
      window.dispatchEvent(new CustomEvent('whale-moe-prefs-change', { detail: { key: 'pet', value: enabled } }))
      if (!enabled) {
        try {
          document.querySelectorAll('[data-dsh-whale-pet-root], [data-dsh-whale-pet-particle], [data-dsh-whale-pet-fx], [data-dsh-whale-pet-context], [data-dsh-whale-pet-panel]').forEach((n) => n.remove())
        } catch {}
      }
    }

    function peel(x) {
      let v = x
      let i = 0
      while (i < 4 && v && typeof v === 'object' && v.report && typeof v.report === 'object') {
        v = v.report
        i += 1
      }
      return v || {}
    }

    function SelfCard() {
      const [open, setOpen] = React.useState(true)
      const [busy, setBusy] = React.useState(false)
      const [organs, setOrgans] = React.useState(null)
      const [inspect, setInspect] = React.useState(null)
      const [doctor, setDoctor] = React.useState(null)
      const [vision, setVision] = React.useState(null)
      const [hostTools, setHostTools] = React.useState(null)
      const [err, setErr] = React.useState('')
      const [msg, setMsg] = React.useState('')
      const ACTION_HIDE = {
        'doctor-check': 1, 'doctor-fix': 1, 'baseline': 1, 'toggle-apply': 1,
        'inspect': 1, 'wrap': 1, 'health-process': 1, 'health-hot': 1, 'health-forbidden': 1,
        'settings-absorb': 1, 'wizard-vision': 1,
        'host-catalog': 1, 'host-dry-run': 1, 'host-audit': 1, 'host-budget': 1, 'host-chat': 1,
        'fs-read': 1, 'fs-write': 1, 'shell-param': 1, 'git-status': 1, 'git-commit': 1, 'dsh-restart': 1,
      }

      const load = async () => {
        setBusy(true)
        setErr('')
        try {
          const [o, i, d, v, h] = await Promise.all([
            fetch('/api/dsh-self/organs').then((r) => r.json()),
            fetch('/api/dsh-self/inspect').then((r) => r.json()),
            fetch('/api/dsh-doctor/check').then((r) => r.json()).catch(() => null),
            fetch('/api/dsh-self/wizard/vision').then((r) => r.json()).catch(() => null),
            fetch('/api/dsh-host/tools').then((r) => r.json()).catch(() => null),
          ])
          setOrgans(peel(o))
          setInspect(peel(i))
          setDoctor(peel(d))
          setVision(peel(v))
          setHostTools(peel(h))
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy(false)
        }
      }

      React.useEffect(() => { void load() }, [])

      const catalog = organs || {}
      const groupsRaw = catalog.organs || []
      const groupOrder = { ops: 0, observe: 1, vision: 2, execute: 3, chat: 4, code: 5, remote: 6, experience: 7 }
      const groups = groupsRaw.slice().sort((a, b) => (groupOrder[a.id] ?? 50) - (groupOrder[b.id] ?? 50))
      const report = inspect || {}
      const needs = report.needs_adopt || []
      const dups = report.duplicates || []
      const drep = doctor || {}
      const dIssues = drep.issues || []
      const dOk = drep.ok !== false && dIssues.filter((x) => x.severity === 'critical' || x.severity === 'high').length === 0

      const runDoctor = async (path, method) => {
        setBusy(true)
        setErr('')
        setMsg('')
        try {
          const res = await fetch(path, { method: method || 'GET' })
          const body = peel(json)
          setDoctor(body)
          setMsg(body && body.ok === false ? '发现问题' : '已执行')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy(false)
        }
      }

      const runWizard = async (dryRun) => {
        setBusy(true)
        setErr('')
        setMsg('')
        try {
          const res = await fetch('/api/dsh-self/wizard/vision', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ dry_run: !!dryRun }),
          })
          const json = await res.json()
          const body = peel(json)
          setVision(body)
          setMsg(body.note || (dryRun ? '已预演，未改文件' : '已绑定'))
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy(false)
        }
      }

      const runHost = async (tool, extra) => {
        setBusy(true)
        setErr('')
        setMsg('')
        try {
          const res = await fetch('/api/dsh-host/run', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(Object.assign({ tool: tool }, extra || {})),
          })
          const json = await res.json()
          const body = peel(json)
          const inner = body.result || body
          const failed = body.ok === false || inner.ok === false
          const detail = inner.note || inner.error || body.note || body.error
          if (failed) {
            setErr((body.tool ? body.tool + '：' : '') + (detail || '拒绝'))
          } else if (body.dry_run) {
            const impact = Array.isArray(body.impact) ? body.impact.map((x) => x.path + ' → ' + x.to).join('；') : ''
            setMsg('预演 ' + (body.tool || tool) + (impact ? '：' + impact : ' 完成'))
          } else {
            const out = inner.stdout ? String(inner.stdout).slice(0, 240) : ''
            setMsg(detail || ('完成 ' + (body.tool || tool) + (out ? '\n' + out : '')))
          }
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy(false)
        }
      }

      const startUsageLogin = async () => {
        setBusy(true)
        setErr('')
        setMsg('')
        try {
          const res = await fetch('/api/deepseek-usage/login/start', { method: 'POST' })
          const json = await res.json()
          setMsg(json.message || '请在打开的窗口中登录 DeepSeek 用量')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy(false)
        }
      }

      const setAtom = async (organId, atom, enabled) => {
        setBusy(true)
        setErr('')
        setMsg('')
        try {
          const res = await fetch('/api/dsh-self/atom', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ organ: organId, atom: atom.id, enabled }),
          })
          const json = await res.json()
          const body = peel(json)
          await load()
          if (organId === 'experience' && atom.id === 'whale-mascot' && (json.ok && !(body && body.ok === false))) {
            applyWhaleMascotPref(!!enabled)
          }
          if (!json.ok || (body && body.ok === false)) {
            setErr((body && (body.error || body.note)) || json.error || '拒绝')
          } else {
            setMsg(body.note || '已更新')
          }
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy(false)
        }
      }

      const badge = (a) => {
        if (a.forbidden) return '禁止'
        if (a.pending) return '待融合'
        if (a.fused) return '已融合'
        if (a.health === 'ok') return '健康'
        if (a.health === 'fail') return '异常'
        return '供应商'
      }

      const organBlurb = (g) => {
        if (g.id === 'observe') {
          return '统一入口：余额球 + 对话栏吞吐。设置卡已收编；现场表面仍保留。'
        }
        if (g.id === 'execute') {
          return '对话可调 dsh_host_*；设置卡仍可预演。宿主只跑白名单。'
        }
        if (g.id === 'ops') return null
        return g.fused ? '已进自身' : '供应商开关（本轮整包）'
      }

      return React.createElement(
        'li',
        { style: cardStyle, 'data-plugin': 'dsh-self', 'data-dsh-self': 'card' },
        React.createElement(
          'button',
          { type: 'button', style: headStyle, onClick: () => setOpen((v) => !v) },
          React.createElement('span', { style: { fontSize: 15, fontWeight: 600 } }, '自身器官'),
          React.createElement(
            'span',
            { style: { fontSize: 13, opacity: 0.75 } },
            '运维 / 观测 / 智谱向导 / 执行宿主。迭代 ' + (catalog.iteration || 8) + '。',
          ),
        ),
        open
          ? React.createElement(
              'div',
              { style: bodyStyle },
              React.createElement('div', { style: { fontWeight: 600 } }, '运维（已并入，不再单独占卡）'),
              React.createElement('div', { style: { marginTop: 4, fontSize: 12, opacity: 0.8 } },
                busy ? '处理中…' : ((dOk ? '状态：正常' : '状态：有问题') + (drep.hot_count != null ? ' · hot=' + drep.hot_count : ''))),
              dIssues.length
                ? React.createElement('ul', { style: { margin: '6px 0', paddingLeft: 18 } },
                  ...dIssues.map((i) => React.createElement('li', { key: i.id }, '[' + i.severity + '] ' + i.message)))
                : null,
              React.createElement('div', null,
                React.createElement('button', { type: 'button', style: btnStyle, disabled: busy, onClick: () => { void runDoctor('/api/dsh-doctor/check') } }, '重新检查'),
                React.createElement('button', { type: 'button', style: btnStyle, disabled: busy, onClick: () => { void runDoctor('/api/dsh-doctor/fix', 'POST') } }, '一键修复'),
                React.createElement('button', { type: 'button', style: btnStyle, disabled: busy, onClick: () => { void runDoctor('/api/dsh-doctor/baseline-save', 'POST') } }, '保存基线'),
              ),
              React.createElement('div', { style: { fontWeight: 600, marginTop: 14 } }, '智谱看图向导'),
              React.createElement('div', { style: { marginTop: 4, fontSize: 12, opacity: 0.8 } },
                (function () {
                  const v = peel(vision)
                  const bound = v.bound || {}
                  if (!vision) return '向导状态未加载（点刷新或重启 Desktop）'
                  const bits = []
                  if (bound.model) bits.push('model=' + bound.model)
                  if (bound.apiKeyEnv) bits.push('env=' + bound.apiKeyEnv)
                  bits.push(v.has_credential ? '密钥：已配置' : '密钥：未配置')
                  bits.push(v.plugin_enabled === false ? '插件未开' : '插件已开')
                  if (Array.isArray(v.missing) && v.missing.length) bits.push('缺 ' + v.missing.join(','))
                  return bits.join(' · ')
                })()),
              React.createElement('div', { style: { marginTop: 4, fontSize: 12, opacity: 0.75 } },
                '只绑 baseURL / 模型 / 环境变量名，不回显 Key。'),
              React.createElement('div', null,
                React.createElement('button', { type: 'button', style: btnStyle, disabled: busy, onClick: () => { void runWizard(true) } }, '预演绑定'),
                React.createElement('button', { type: 'button', style: btnStyle, disabled: busy, onClick: () => { void runWizard(false) } }, '一键绑定智谱'),
              ),
              React.createElement('div', { style: { fontWeight: 600, marginTop: 14 } }, '执行宿主（Phase 2）'),
              React.createElement('div', { style: { marginTop: 4, fontSize: 12, opacity: 0.75 } },
                '白名单参数化工具；先预演再执行。禁止自由 shell。目录 '
                  + ((peel(hostTools).tools || []).length)
                  + ' 项。对话工具：dsh_host_catalog / dsh_host_preview / dsh_host_run。Git 仓库根必须在 dsp 白名单内。'),
              React.createElement('div', null,
                React.createElement('button', { type: 'button', style: btnStyle, disabled: busy, onClick: () => { void runHost('doctor.check', { dry_run: true }) } }, '预演诊断'),
                React.createElement('button', { type: 'button', style: btnStyle, disabled: busy, onClick: () => { void runHost('doctor.fix', { dry_run: true }) } }, '预演修复'),
                React.createElement('button', { type: 'button', style: btnStyle, disabled: busy, onClick: () => { void runHost('git.status', { dry_run: true }) } }, '预演 git.status'),
                React.createElement('button', { type: 'button', style: btnStyle, disabled: busy, onClick: () => { void runHost('git.status') } }, 'Git 状态'),
              ),
              ...groups.map((g) => {
                const blurb = organBlurb(g)
                const atoms = (g.atoms || []).filter((a) => !ACTION_HIDE[a.id])
                if (g.id === 'ops' && atoms.length === 0) return null
                return React.createElement(
                  'div',
                  { key: g.id, style: { marginTop: 14 } },
                  React.createElement('div', { style: { fontWeight: 600 } },
                    g.title + (g.id === 'observe' ? ' · 入口已融合' : (g.fused ? ' · 已进自身' : ' · 供应商开关'))),
                  blurb
                    ? React.createElement('div', { style: { marginTop: 4, fontSize: 12, opacity: 0.75 } }, blurb)
                    : null,
                  g.id === 'observe'
                    ? React.createElement('div', { style: { marginTop: 8 } },
                      React.createElement('button', {
                        type: 'button',
                        style: btnStyle,
                        disabled: busy,
                        onClick: () => { void startUsageLogin() },
                      }, '用量登录 / 刷新授权'))
                    : null,
                  ...atoms.map((a) =>
                    React.createElement(
                      'label',
                      {
                        key: a.id,
                        style: {
                          display: 'flex',
                          gap: 8,
                          marginTop: 6,
                          opacity: a.forbidden || a.pending || a.locked ? 0.45 : 1,
                          cursor: a.forbidden || a.pending || a.locked || busy ? 'not-allowed' : 'pointer',
                          alignItems: 'flex-start',
                        },
                      },
                      React.createElement('input', {
                        type: 'checkbox',
                        checked: !!a.enabled,
                        disabled: !!a.forbidden || !!a.pending || !!a.locked || busy,
                        onChange: (ev) => { void setAtom(g.id, a, ev.target.checked) },
                      }),
                      React.createElement(
                        'span',
                        null,
                        a.title,
                        React.createElement('span', { style: { marginLeft: 6, fontSize: 11, opacity: 0.75 } }, badge(a)),
                        a.detail
                          ? React.createElement('span', { style: { marginLeft: 6, fontSize: 11, opacity: 0.7 } }, a.detail)
                          : null,
                      ),
                    ),
                  ),
                )
              }),
              dups.length
                ? React.createElement('div', { style: { color: '#c53030', marginTop: 8 } }, '重复能力：' + dups.map((d) => d.capability).join('、'))
                : null,
              needs.length
                ? React.createElement('div', { style: { marginTop: 8, fontSize: 12, opacity: 0.75 } }, '收编扫描：' + needs.length + ' 项（运行时闸仍生效）')
                : null,
              err ? React.createElement('div', { style: { color: '#c53030', marginTop: 8 } }, err) : null,
              msg ? React.createElement('div', { style: { marginTop: 8 } }, msg) : null,
              React.createElement(
                'button',
                { type: 'button', style: btnStyle, disabled: busy, onClick: () => { void load() } },
                '刷新',
              ),
            )
          : null,
      )
    }

    function apply(ctx) {
      let undoGuard = installBodyGuard()
      let undoSlots = installSlotRemap(ctx)
      try { installHostSendHook(ctx.conversation) } catch {}
      if (typeof ctx.inject === 'function') {
        try { ctx.inject(['conversation'], (c) => { try { installHostSendHook(c.conversation) } catch {} }) } catch {}
      }
      fetch('/api/dsh-self/organs').then((r) => r.json()).then((data) => {
        const groups = (data && data.report && data.report.organs)
          || (data && data.organs)
          || []
        if (!atomOn(groups, 'ops', 'body-bin')) {
          undoGuard()
          undoGuard = function () {}
        }
        if (!atomOn(groups, 'ops', 'slot-remap')) {
          undoSlots()
          undoSlots = function () {}
        }
        if (ctx.slots && ctx.slots.__dshSelfSetAbsorb) {
          ctx.slots.__dshSelfSetAbsorb(atomOn(groups, 'observe', 'settings-absorb'))
        }
        // Enforce organ default: whale mascot off unless explicitly enabled.
        applyWhaleMascotPref(atomOn(groups, 'experience', 'whale-mascot'))
        mountOrganAtoms(require, ctx, groups)
      }).catch(() => {})
      const disposers = []
      for (const slot of ['ventus.plugin.item', 'web-ui.plugin.item', 'settings.plugin.item']) {
        try {
          disposers.push(ctx.slots.inject(slot, () =>
            ctx.slots.register({
              name: slot,
              ...(slot === 'ventus.plugin.item' ? {} : { key: 'dsh-self' }),
              id: 'dsh-self',
              order: 1,
            }, SelfCard),
          ))
        } catch {}
      }
      ctx.effect(
        () => () => {
          undoGuard()
          undoSlots()
          for (const d of disposers) d()
          const bin = document.getElementById(NS + '-bin')
          if (bin) bin.remove()
        },
        'dsh-self: ui',
      )
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})

