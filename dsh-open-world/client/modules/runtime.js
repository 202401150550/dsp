// Open World · runtime（WM / world-state / fetch 助手，从 client-main 抽出）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/runtime',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const C = require('dsh-open-world/constants')
    const {
      WM_MODE_KEY, WM_LAST_MODE_KEY, WM_MODES,
      LEFT_TAB_KEY, ATI_PRESET_KEY,
      WORLD_STATE_URL, ACTION_URL, PULSE_URL, OW_ACTION_URL, MESSAGES_URL,
    } = C

    function readWmMode() {
      try {
        const m = localStorage.getItem(WM_MODE_KEY)
        if (m && WM_MODES.includes(m) && m !== 'minimized') return m
      } catch { /* ignore */ }
      return 'split'
    }

    function readWmLastMode() {
      try {
        const m = localStorage.getItem(WM_LAST_MODE_KEY)
        if (m && WM_MODES.includes(m) && m !== 'minimized') return m
      } catch { /* ignore */ }
      return 'split'
    }

    function persistWmMode(mode) {
      try {
        localStorage.setItem(WM_MODE_KEY, mode)
        if (mode !== 'minimized') localStorage.setItem(WM_LAST_MODE_KEY, mode)
      } catch { /* ignore */ }
    }

    async function fetchWorldState() {
      try {
        const res = await fetch(WORLD_STATE_URL, { cache: 'no-store', credentials: 'include' })
        if (!res.ok) return null
        const data = await res.json()
        return data && data.world ? data.world : null
      } catch {
        return null
      }
    }

    async function postWorldState(patch) {
      try {
        const res = await fetch(WORLD_STATE_URL, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) return null
        const data = await res.json()
        return data && data.world ? data.world : null
      } catch {
        return null
      }
    }

    function applyWorldLocalCaches(world) {
      if (!world) return
      const mode = world.shell && world.shell.wmMode
      if (mode) persistWmMode(mode)
      const left = world.ui && world.ui.leftTab
      if (left) {
        try { localStorage.setItem(LEFT_TAB_KEY, left) } catch { /* ignore */ }
      }
      const ati = world.ui && world.ui.atiPreset
      if (ati) {
        try { localStorage.setItem(ATI_PRESET_KEY, ati) } catch { /* ignore */ }
      }
    }

    async function postTaskAction(action) {
      const res = await fetch(ACTION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
        credentials: 'same-origin',
        body: JSON.stringify({ requestId: `ow-${Date.now()}`, action }),
      })
      if (!res.ok) throw new Error(`task-board ${res.status}`)
      return res.json()
    }

    function delay(ms) {
      return new Promise((r) => setTimeout(r, ms))
    }

    function notifyPulse(edges) {
      if (!edges || edges.length === 0) return
      fetch(PULSE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ edges }),
      }).catch(() => {})
    }

    async function postOpenWorldAction(action) {
      let res
      try {
        res = await fetch(OW_ACTION_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(action),
        })
      } catch (err) {
        const tip = err && err.message === 'Failed to fetch'
          ? `网络中断：打不开 ${OW_ACTION_URL}（请确认仍在 DSH Desktop 窗口，地址栏端口未变，然后 Ctrl+Shift+R）`
          : String(err && err.message || err)
        throw new Error(tip)
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || `action ${res.status}`)
      return data
    }

    async function fetchJson(url) {
      let res
      try {
        res = await fetch(url, { cache: 'no-store' })
      } catch (err) {
        if (err && err.message === 'Failed to fetch') {
          throw new Error(`网络中断：${url}（请用 DSH Desktop，勿用外部浏览器裸开；Ctrl+Shift+R）`)
        }
        throw err
      }
      if (!res.ok) throw new Error(`${url} ${res.status}`)
      return res.json()
    }

    async function fetchMessages() {
      return fetchJson(MESSAGES_URL)
    }

    function fmtClock(d) {
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      const ss = String(d.getSeconds()).padStart(2, '0')
      const y = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return { time: `${hh}:${mm}:${ss}`, date: `${y} / ${mo} / ${day} · UTC+8` }
    }

    function taskProgress(t) {
      if (t.running || t.status === 'running') return 72
      if (t.status === 'done' || t.status === 'succeeded') return 100
      if (t.status === 'queued' || t.status === 'pending') return 28
      return 45
    }

    module.exports = {
      readWmMode,
      readWmLastMode,
      persistWmMode,
      fetchWorldState,
      postWorldState,
      applyWorldLocalCaches,
      postTaskAction,
      delay,
      notifyPulse,
      postOpenWorldAction,
      fetchJson,
      fetchMessages,
      fmtClock,
      taskProgress,
    }
    return module.exports
  },
})
