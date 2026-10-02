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
