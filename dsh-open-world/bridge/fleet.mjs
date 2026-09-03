/**
 * Open World · 统一 Agent 进程/舰队视图（阶段 B4）
 * 聚合：session + task-board + ventus-progress（只读，不新造运行时）
 */

function shortId(id) {
  const s = String(id || '')
  return s.length > 10 ? `${s.slice(0, 8)}…` : s
}

function cwdLabel(cwd) {
  if (!cwd) return null
  const parts = String(cwd).replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : cwd
}

function statusRank(status) {
  if (status === 'running' || status === 'active' || status === 'busy') return 0
  if (status === 'queued' || status === 'pending') return 1
  if (status === 'done' || status === 'succeeded' || status === 'finished') return 3
  return 2
}

/** @returns {{ available:boolean, ventusAvailable:boolean, counts:object, processes:array }} */
export function buildFleetView({ sessions = {}, taskBoard = {}, ventus = {} } = {}) {
  const processes = []
  const sessionItems = Array.isArray(sessions.items) ? sessions.items : []
  for (const s of sessionItems) {
    const active = s.id && sessions.activeId && s.id === sessions.activeId
    processes.push({
      id: `session:${s.id}`,
      kind: 'session',
      title: cwdLabel(s.cwd) || shortId(s.id),
      detail: s.cwd || s.id,
      status: active ? 'active' : 'idle',
      sessionId: s.id,
      updatedAt: s.createdAt || 0,
    })
  }

  const tasks = Array.isArray(taskBoard.tasks) && taskBoard.tasks.length
    ? taskBoard.tasks
    : (Array.isArray(taskBoard.allTasks) ? taskBoard.allTasks : [])
  for (const t of tasks.slice(0, 16)) {
    const running = !!(t.running || t.status === 'running')
    processes.push({
      id: `task:${t.id}`,
      kind: 'task',
      title: t.title || '(untitled)',
      detail: t.status || (running ? 'running' : 'pending'),
      status: running ? 'running' : (t.status || 'pending'),
      taskId: t.id,
      updatedAt: t.updatedAt || 0,
    })
  }

  const entries = Array.isArray(ventus.entries) ? ventus.entries : []
  for (const e of entries.slice(0, 16)) {
    const pct = Number(e.percent)
    processes.push({
      id: `subagent:${e.subagentId || e.taskId || processes.length}`,
      kind: 'subagent',
      title: e.taskName || shortId(e.subagentId) || '子代理',
      detail: e.currentText || (Number.isFinite(pct) ? `${pct}%` : ''),
      status: e.finished ? 'done' : 'running',
      percent: Number.isFinite(pct) ? pct : null,
      stages: Array.isArray(e.stages) ? e.stages.slice(0, 8) : [],
      subagentId: e.subagentId,
      taskId: e.taskId,
      updatedAt: e.updatedAt || 0,
    })
  }

  processes.sort((a, b) => {
    const d = statusRank(a.status) - statusRank(b.status)
    if (d !== 0) return d
    return (b.updatedAt || 0) - (a.updatedAt || 0)
  })

  const running = processes.filter((p) => p.status === 'running' || p.status === 'active' || p.status === 'busy').length
  return {
    available: true,
    ventusAvailable: !!ventus.available,
    taskBoardAvailable: !!taskBoard.available,
    counts: {
      sessions: sessionItems.length,
      tasks: tasks.length,
      subagents: entries.length,
      running,
      total: processes.length,
    },
    processes: processes.slice(0, 40),
  }
}

export function emptyFleetView() {
  return buildFleetView({})
}
