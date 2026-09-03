/**
 * Reciprocal Resolution Memory — Open World 壳层（中/小行李）
 * 距离越远，事件表征越粗；字节预算内优先保留近史精确态。
 * 大行李（神经 RRA）见 ./rra-neural.stub.mjs — 此处不假装已实现。
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync, statSync, writeFileSync, unlinkSync, openSync, readSync, closeSync } from 'node:fs'
import { join, dirname } from 'node:path'

export function defaultRrmConfig() {
  return {
    enabled: true,
    tau_ms: 60_000,
    alpha: 1,
    exact_window: 8,
    compressed_max: 24,
    landmark_max: 12,
    byte_budget: 48_000,
    archive_path: 'open-world/rrm-archive.jsonl',
    snapshot_exact: 12,
    snapshot_compressed: 8,
    snapshot_landmarks: 6,
    // 信箱通道（中行李扩展）
    mailbox_exact_window: 6,
    mailbox_compressed_max: 20,
    mailbox_landmark_max: 10,
    mailbox_byte_budget: 64_000,
    mailbox_archive_path: 'open-world/rrm-mailbox-archive.jsonl',
    // 任务通道（ledger 摘要投影；不改写官方 ledger 文件）
    task_exact_window: 6,
    task_compressed_max: 16,
    task_landmark_max: 8,
    task_byte_budget: 32_000,
    task_archive_path: 'open-world/rrm-task-archive.jsonl',
  }
}

export function mergeRrmConfig(partial) {
  return { ...defaultRrmConfig(), ...(partial || {}) }
}

const RRM_SESSION_REL = 'open-world/rrm-session.json'

export function rrmSessionPath(home) {
  return join(home, RRM_SESSION_REL)
}

/** 会话覆盖：只允许改衰减三参，不写 yml；Host 进程间靠文件共享 */
export function loadRrmSessionOverride(home) {
  const file = rrmSessionPath(home)
  if (!existsSync(file)) return null
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    if (!raw || typeof raw !== 'object') return null
    const out = {}
    if (Number.isFinite(Number(raw.alpha))) out.alpha = Number(raw.alpha)
    if (Number.isFinite(Number(raw.tau_ms))) out.tau_ms = Number(raw.tau_ms)
    if (Number.isFinite(Number(raw.byte_budget))) out.byte_budget = Number(raw.byte_budget)
    if (!Object.keys(out).length) return null
    return {
      ...out,
      appliedAt: raw.appliedAt || null,
      label: typeof raw.label === 'string' ? raw.label : 'session',
    }
  } catch {
    return null
  }
}

export function clampRrmSessionParams(input = {}) {
  const out = {}
  if (input.alpha != null) {
    const a = Number(input.alpha)
    if (!Number.isFinite(a)) return { ok: false, error: 'invalid-alpha' }
    out.alpha = Math.min(3, Math.max(0.1, a))
  }
  if (input.tau_ms != null) {
    const t = Number(input.tau_ms)
    if (!Number.isFinite(t)) return { ok: false, error: 'invalid-tau_ms' }
    out.tau_ms = Math.min(3_600_000, Math.max(1_000, Math.round(t)))
  }
  if (input.byte_budget != null) {
    const b = Number(input.byte_budget)
    if (!Number.isFinite(b)) return { ok: false, error: 'invalid-byte_budget' }
    out.byte_budget = Math.min(500_000, Math.max(2_000, Math.round(b)))
  }
  if (!Object.keys(out).length) return { ok: false, error: 'empty-params' }
  return { ok: true, params: out }
}

export function saveRrmSessionOverride(home, patch, meta = {}) {
  const file = rrmSessionPath(home)
  if (patch == null) {
    try {
      if (existsSync(file)) unlinkSync(file)
    } catch { /* ignore */ }
    return { ok: true, cleared: true, path: file }
  }
  const clamped = clampRrmSessionParams(patch)
  if (!clamped.ok) return clamped
  mkdirSync(dirname(file), { recursive: true })
  const payload = {
    ...clamped.params,
    label: typeof meta.label === 'string' ? meta.label : 'session',
    appliedAt: new Date().toISOString(),
    note: '会话覆盖 · 不写 open-world.yml · 可一键清除',
  }
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return { ok: true, cleared: false, session: payload, path: file }
}

/** yaml 基线 + 可选会话覆盖 → 生效 rrm */
export function resolveRrmConfig(home, yamlPartial) {
  const base = mergeRrmConfig(yamlPartial)
  const session = loadRrmSessionOverride(home)
  if (!session) {
    return { rrm: base, session: null, source: 'yml' }
  }
  const { appliedAt, label, ...params } = session
  return {
    rrm: mergeRrmConfig({ ...base, ...params }),
    session: { appliedAt, label, ...params },
    source: 'session',
  }
}

/** 固定四组参数，供 snapshot /memory/compare 共用，避免漂移 */
export function defaultCompareVariants(cfgInput) {
  const rrm = mergeRrmConfig(cfgInput)
  return [
    { label: 'current', alpha: rrm.alpha, tau_ms: rrm.tau_ms, byte_budget: rrm.byte_budget },
    { label: 'reciprocal', alpha: 1, tau_ms: rrm.tau_ms, byte_budget: rrm.byte_budget },
    { label: 'slow-decay', alpha: 0.5, tau_ms: rrm.tau_ms * 2, byte_budget: rrm.byte_budget },
    {
      label: 'tight-budget',
      alpha: 1.5,
      tau_ms: rrm.tau_ms,
      byte_budget: Math.max(4000, Math.floor(rrm.byte_budget * 0.25)),
    },
  ]
}

export function eventBytes(ev) {
  try {
    return Buffer.byteLength(JSON.stringify(ev), 'utf8')
  } catch {
    return 0
  }
}

export function distanceOf(ev, now = Date.now()) {
  return Math.max(0, now - (Number(ev?.ts) || now))
}

/** density ∈ (0,1] ；alpha=1 为互易型衰减 */
export function resolutionDensity(distanceMs, cfg) {
  const tau = Math.max(1, Number(cfg.tau_ms) || 60_000)
  const alpha = Math.max(0.1, Number(cfg.alpha) || 1)
  return (1 + distanceMs / tau) ** -alpha
}

export function assignTier(ev, indexFromNewest, cfg, now = Date.now()) {
  if (indexFromNewest < (cfg.exact_window || 8)) return 'exact'
  const dens = resolutionDensity(distanceOf(ev, now), cfg)
  if (dens >= 0.45) return 'compressed'
  if (dens >= 0.15) return 'landmark'
  return 'archive'
}

export function compressEvent(ev) {
  const before = eventBytes(ev)
  return {
    id: ev.id,
    kind: ev.kind,
    title: String(ev.title || '').slice(0, 48),
    detail: '',
    ts: ev.ts,
    tier: 'compressed',
    bytesBefore: before,
  }
}

export function landmarkEvent(ev) {
  return {
    id: ev.id,
    kind: ev.kind,
    title: String(ev.title || '').slice(0, 24),
    ts: ev.ts,
    tier: 'landmark',
  }
}

export function archiveRecord(ev) {
  return {
    id: ev.id,
    kind: ev.kind,
    title: String(ev.title || '').slice(0, 32),
    ts: ev.ts,
    tier: 'archive',
    archivedAt: Date.now(),
  }
}

/**
 * 将原始事件投影为分层记忆。
 */
export function projectLiveMemory(rawEvents, cfgInput, now = Date.now()) {
  const cfg = mergeRrmConfig(cfgInput)
  const list = Array.isArray(rawEvents) ? rawEvents : []
  const exact = []
  const compressed = []
  const landmarks = []
  const toArchive = []

  list.forEach((ev, i) => {
    const tier = assignTier(ev, i, cfg, now)
    if (tier === 'exact') {
      exact.push({ ...ev, tier: 'exact' })
    } else if (tier === 'compressed') {
      if (compressed.length < cfg.compressed_max) compressed.push(compressEvent(ev))
      else toArchive.push(archiveRecord(ev))
    } else if (tier === 'landmark') {
      if (landmarks.length < cfg.landmark_max) landmarks.push(landmarkEvent(ev))
      else toArchive.push(archiveRecord(ev))
    } else {
      toArchive.push(archiveRecord(ev))
    }
  })

  let liveEvents = [...exact, ...compressed, ...landmarks]
  let liveBytes = liveEvents.reduce((n, e) => n + eventBytes(e), 0)
  const naiveBytes = list.reduce((n, e) => n + eventBytes(e), 0)

  if (cfg.byte_budget > 0 && liveBytes > cfg.byte_budget) {
    const keepExact = liveEvents.filter((e) => e.tier === 'exact')
    let rest = liveEvents.filter((e) => e.tier !== 'exact')
    while (rest.length && liveBytes > cfg.byte_budget) {
      const dropped = rest.pop()
      toArchive.push(archiveRecord(dropped))
      liveBytes -= eventBytes(dropped)
    }
    liveEvents = [...keepExact, ...rest]
  }

  const liveCompressed = liveEvents.filter((e) => e.tier === 'compressed')
  const liveLandmarks = liveEvents.filter((e) => e.tier === 'landmark')
  const liveExact = liveEvents.filter((e) => e.tier === 'exact')

  const falsify = {
    naiveEventCount: list.length,
    naiveBytes,
    rrmLiveCount: liveEvents.length,
    rrmLiveBytes: liveBytes,
    archivedThisPass: toArchive.length,
    bytesSaved: Math.max(0, naiveBytes - liveBytes),
    ratio: naiveBytes > 0 ? Number((liveBytes / naiveBytes).toFixed(3)) : 1,
    baseline: 'byte-matched-keep-all-exact',
    note: '壳层证伪：同等事件集下 RRM 投影字节 vs 全量精确；非神经 RRA 质量声明',
  }

  const meta = {
    protocol: 'ow-rrm/0.1',
    enabled: cfg.enabled !== false,
    tau_ms: cfg.tau_ms,
    alpha: cfg.alpha,
    exact: liveExact.length,
    compressed: liveCompressed.length,
    landmarks: liveLandmarks.length,
    archiveQueued: toArchive.length,
    liveBytes,
    byteBudget: cfg.byte_budget,
    budgetUtilization: cfg.byte_budget > 0
      ? Number((liveBytes / cfg.byte_budget).toFixed(3))
      : null,
  }

  return {
    exact: liveExact,
    compressed: liveCompressed,
    landmarks: liveLandmarks,
    toArchive,
    liveEvents,
    meta,
    falsify,
  }
}

export function archiveFilePath(home, cfg) {
  const rel = (cfg && cfg.archive_path) || 'open-world/rrm-archive.jsonl'
  return join(home, rel)
}

export function appendArchive(home, records, cfg) {
  if (!records || records.length === 0) return { appended: 0, path: null }
  const file = archiveFilePath(home, cfg)
  mkdirSync(dirname(file), { recursive: true })
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n'
  appendFileSync(file, lines, 'utf8')
  return { appended: records.length, path: file }
}

export function readArchiveStats(home, cfg) {
  const file = archiveFilePath(home, cfg)
  if (!existsSync(file)) {
    return { path: file, exists: false, lines: 0, bytes: 0 }
  }
  const st = statSync(file)
  let lines = 0
  try {
    const text = readFileSync(file, 'utf8')
    lines = text.split('\n').filter(Boolean).length
  } catch {
    lines = 0
  }
  return { path: file, exists: true, lines, bytes: st.size }
}

export function slimMemoryForSnapshot(projection, cfgInput, activeMeta = null) {
  const cfg = mergeRrmConfig(cfgInput)
  const archive = projection.archiveStats || null
  const source = (activeMeta && activeMeta.source) || 'yml'
  const session = activeMeta && activeMeta.session ? {
    label: activeMeta.session.label || 'session',
    appliedAt: activeMeta.session.appliedAt || null,
    alpha: activeMeta.session.alpha,
    tau_ms: activeMeta.session.tau_ms,
    byte_budget: activeMeta.session.byte_budget,
  } : null
  return {
    protocol: 'ow-rrm/0.1',
    layer: 'shell',
    neural: false,
    active: {
      tau_ms: cfg.tau_ms,
      alpha: cfg.alpha,
      byte_budget: cfg.byte_budget,
      exact_window: cfg.exact_window,
      source,
      session,
    },
    meta: projection.meta,
    falsify: projection.falsify,
    archive,
    exact: projection.exact.slice(0, cfg.snapshot_exact),
    compressed: projection.compressed.slice(0, cfg.snapshot_compressed),
    landmarks: projection.landmarks.slice(0, cfg.snapshot_landmarks),
    hint: formatMemoryHint(projection.meta),
  }
}

export function formatMemoryHint(meta) {
  if (!meta) return '记忆 · —'
  const pct = meta.budgetUtilization != null
    ? `${Math.round(meta.budgetUtilization * 100)}%`
    : '—'
  return `记忆 · 精确${meta.exact}/压缩${meta.compressed}/地标${meta.landmarks} · 预算${pct}`
}

export function formatArchiveHint(sum) {
  if (!sum) return '归档 · —'
  if (!sum.totalLines) return '归档 · 空'
  const kb = sum.totalBytes >= 1024
    ? `${(sum.totalBytes / 1024).toFixed(1)}KB`
    : `${sum.totalBytes}B`
  return `归档 · ${sum.totalLines}行 · ${kb}`
}

/** 三通道归档磁盘汇总（只读统计，不读全文） */
export function summarizeArchives(parts = {}) {
  const pick = (stats) => {
    if (!stats) return { exists: false, lines: 0, bytes: 0, path: null }
    return {
      exists: !!stats.exists,
      lines: Number(stats.lines) || 0,
      bytes: Number(stats.bytes) || 0,
      path: stats.path || null,
    }
  }
  const events = pick(parts.events)
  const mailbox = pick(parts.mailbox)
  const tasks = pick(parts.tasks)
  const totalLines = events.lines + mailbox.lines + tasks.lines
  const totalBytes = events.bytes + mailbox.bytes + tasks.bytes
  const summary = { events, mailbox, tasks, totalLines, totalBytes }
  summary.hint = formatArchiveHint(summary)
  return summary
}

export function slimArchiveItem(raw, channel = 'events') {
  if (!raw || typeof raw !== 'object') return null
  const title = raw.title || raw.body || raw.id || '—'
  return {
    channel,
    id: raw.id != null ? String(raw.id) : null,
    title: String(title).slice(0, 48),
    tier: raw.tier || 'archive',
    ts: raw.ts || raw.updatedAt || null,
    kind: raw.kind || raw.status || null,
  }
}

/**
 * 只读归档尾预览。大文件只读末尾 64KB，避免整文件进内存。
 */
export function readArchiveTail(home, cfg, limit = 6) {
  const file = archiveFilePath(home, cfg)
  const maxItems = Math.max(1, Math.min(24, Number(limit) || 6))
  if (!existsSync(file)) {
    return { items: [], truncated: false, path: file, scanned: 0 }
  }
  let text = ''
  let fileBytes = 0
  let usedTailChunk = false
  try {
    const st = statSync(file)
    fileBytes = st.size
    const TAIL_BYTES = 64 * 1024
    if (st.size > 256 * 1024) {
      usedTailChunk = true
      const fd = openSync(file, 'r')
      try {
        const size = Math.min(st.size, TAIL_BYTES)
        const buf = Buffer.alloc(size)
        const start = Math.max(0, st.size - size)
        readSync(fd, buf, 0, size, start)
        text = buf.toString('utf8')
        if (start > 0) {
          const nl = text.indexOf('\n')
          if (nl >= 0) text = text.slice(nl + 1)
        }
      } finally {
        closeSync(fd)
      }
    } else {
      text = readFileSync(file, 'utf8')
    }
  } catch {
    return { items: [], truncated: false, path: file, scanned: 0, error: true }
  }
  const lines = text.split('\n').filter(Boolean)
  const slice = lines.slice(-maxItems)
  const items = []
  const channel = (cfg && cfg.channel) || 'events'
  for (const line of slice) {
    try {
      const item = slimArchiveItem(JSON.parse(line), channel)
      if (item) items.push(item)
    } catch { /* skip bad line */ }
  }
  return {
    items,
    truncated: usedTailChunk || lines.length > slice.length,
    path: file,
    scanned: lines.length,
    fileBytes,
  }
}

/** 在 summarizeArchives 结果上挂 recent 尾预览 */
export function attachArchiveTails(home, rrmInput, summary, limit = 5) {
  const rrm = mergeRrmConfig(rrmInput)
  const n = Math.max(1, Math.min(12, Number(limit) || 5))
  const eventsTail = readArchiveTail(home, { ...rrm, channel: 'events' }, n)
  const mailboxTail = readArchiveTail(home, { ...mailboxChannelConfig(rrm), channel: 'mailbox' }, n)
  const tasksTail = readArchiveTail(home, { ...taskChannelConfig(rrm), channel: 'tasks' }, n)
  return {
    ...(summary || summarizeArchives()),
    recent: {
      events: eventsTail.items,
      mailbox: mailboxTail.items,
      tasks: tasksTail.items,
      limit: n,
      note: '只读尾预览 · 非全量回放 · 大文件仅扫末尾',
    },
  }
}

/**
 * 本地归档末尾扫描检索（非全库索引、非 Hindsight）。
 * 大文件只读末尾 maxBytes，按行倒序匹配。
 */
export function searchArchiveFile(home, cfg, query, opts = {}) {
  const q = String(query || '').trim().toLowerCase()
  const limit = Math.max(1, Math.min(24, Number(opts.limit) || 8))
  const maxBytes = Math.max(16 * 1024, Math.min(1024 * 1024, Number(opts.maxBytes) || 256 * 1024))
  const channel = (cfg && cfg.channel) || 'events'
  const file = archiveFilePath(home, cfg)
  if (!q) {
    return {
      channel, hits: [], query: '', scanned: 0, truncated: false,
      path: file, exists: existsSync(file), note: '空查询',
    }
  }
  if (!existsSync(file)) {
    return {
      channel, hits: [], query: q, scanned: 0, truncated: false,
      path: file, exists: false,
    }
  }
  let text = ''
  let truncated = false
  let fileBytes = 0
  try {
    const st = statSync(file)
    fileBytes = st.size
    if (st.size > maxBytes) {
      truncated = true
      const fd = openSync(file, 'r')
      try {
        const size = Math.min(st.size, maxBytes)
        const buf = Buffer.alloc(size)
        const start = Math.max(0, st.size - size)
        readSync(fd, buf, 0, size, start)
        text = buf.toString('utf8')
        if (start > 0) {
          const nl = text.indexOf('\n')
          if (nl >= 0) text = text.slice(nl + 1)
        }
      } finally {
        closeSync(fd)
      }
    } else {
      text = readFileSync(file, 'utf8')
    }
  } catch {
    return {
      channel, hits: [], query: q, scanned: 0, truncated: false,
      path: file, exists: true, error: true, fileBytes,
    }
  }
  const lines = text.split('\n').filter(Boolean)
  const hits = []
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    try {
      const raw = JSON.parse(line)
      const item = slimArchiveItem(raw, channel)
      if (!item) continue
      const hay = `${item.title || ''} ${item.id || ''} ${line}`.toLowerCase()
      if (!hay.includes(q)) continue
      hits.push(item)
      if (hits.length >= limit) break
    } catch { /* skip */ }
  }
  return {
    channel,
    hits,
    query: q,
    scanned: lines.length,
    truncated,
    path: file,
    exists: true,
    fileBytes,
  }
}

/** 三通道本地归档检索 */
export function searchLocalArchives(home, rrmInput, query, opts = {}) {
  const rrm = mergeRrmConfig(rrmInput)
  const per = Math.max(1, Math.min(12, Number(opts.perChannel) || 5))
  const maxBytes = opts.maxBytes
  const q = String(query || '').trim()
  return {
    query: q,
    note: '本地 RRM 归档末尾扫描 · 非 Hindsight · 非全库索引',
    channels: {
      events: searchArchiveFile(home, { ...rrm, channel: 'events' }, q, { limit: per, maxBytes }),
      mailbox: searchArchiveFile(home, { ...mailboxChannelConfig(rrm), channel: 'mailbox' }, q, { limit: per, maxBytes }),
      tasks: searchArchiveFile(home, { ...taskChannelConfig(rrm), channel: 'tasks' }, q, { limit: per, maxBytes }),
    },
  }
}

/**
 * 就地维护 events 数组：投影 → 归档 → 用 live 替换。
 */
export function reconcileEvents(eventsRef, home, cfgInput, now = Date.now()) {
  const cfg = mergeRrmConfig(cfgInput)
  if (cfg.enabled === false) {
    return {
      exact: eventsRef.slice(0, cfg.exact_window).map((e) => ({ ...e, tier: 'exact' })),
      compressed: [],
      landmarks: [],
      toArchive: [],
      liveEvents: eventsRef.slice(),
      meta: {
        protocol: 'ow-rrm/0.1',
        enabled: false,
        exact: Math.min(eventsRef.length, cfg.exact_window),
        compressed: 0,
        landmarks: 0,
        archiveQueued: 0,
        liveBytes: 0,
        byteBudget: cfg.byte_budget,
        budgetUtilization: null,
      },
      falsify: null,
      archiveStats: readArchiveStats(home, cfg),
      skipped: true,
    }
  }
  const projection = projectLiveMemory(eventsRef, cfg, now)
  if (projection.toArchive.length) {
    appendArchive(home, projection.toArchive, cfg)
  }
  eventsRef.length = 0
  for (const ev of projection.liveEvents) eventsRef.push(ev)
  projection.archiveStats = readArchiveStats(home, cfg)
  return projection
}

/** 信箱通道配置：复用同一套投影算法，独立预算与归档文件 */
export function mailboxChannelConfig(cfgInput) {
  const cfg = mergeRrmConfig(cfgInput)
  return {
    ...cfg,
    exact_window: cfg.mailbox_exact_window,
    compressed_max: cfg.mailbox_compressed_max,
    landmark_max: cfg.mailbox_landmark_max,
    byte_budget: cfg.mailbox_byte_budget,
    archive_path: cfg.mailbox_archive_path,
  }
}

export function compressMailboxMessage(msg) {
  return {
    id: msg.id,
    ts: msg.ts,
    direction: msg.direction,
    to: msg.to,
    toLabel: msg.toLabel,
    kind: msg.kind,
    read: msg.read,
    body: String(msg.body || '').slice(0, 64),
    tier: 'compressed',
  }
}

export function landmarkMailboxMessage(msg) {
  return {
    id: msg.id,
    ts: msg.ts,
    direction: msg.direction,
    to: msg.to,
    kind: msg.kind,
    read: true,
    body: String(msg.body || '').slice(0, 24),
    tier: 'landmark',
  }
}

/**
 * 信箱 RRM：未读永远 exact；已读按距离降分辨率。
 */
export function projectMailboxMemory(messages, cfgInput, now = Date.now()) {
  const channel = mailboxChannelConfig(cfgInput)
  const list = Array.isArray(messages) ? [...messages] : []
  list.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))

  const unread = list.filter((m) => !m.read).map((m) => ({ ...m, tier: 'exact' }))
  const read = list.filter((m) => m.read)

  const exact = [...unread]
  const compressed = []
  const landmarks = []
  const toArchive = []

  read.forEach((msg, i) => {
    // index 从「紧接未读之后」起算，使近期已读仍可能 exact
    const tier = assignTier(msg, unread.length + i, channel, now)
    if (tier === 'exact') {
      exact.push({ ...msg, tier: 'exact' })
    } else if (tier === 'compressed') {
      if (compressed.length < channel.compressed_max) compressed.push(compressMailboxMessage(msg))
      else toArchive.push({ ...archiveRecord({ id: msg.id, kind: 'mailbox', title: msg.body, ts: msg.ts }), channel: 'mailbox' })
    } else if (tier === 'landmark') {
      if (landmarks.length < channel.landmark_max) landmarks.push(landmarkMailboxMessage(msg))
      else toArchive.push({ ...archiveRecord({ id: msg.id, kind: 'mailbox', title: msg.body, ts: msg.ts }), channel: 'mailbox' })
    } else {
      toArchive.push({ ...archiveRecord({ id: msg.id, kind: 'mailbox', title: msg.body, ts: msg.ts }), channel: 'mailbox' })
    }
  })

  let live = [...exact, ...compressed, ...landmarks]
  let liveBytes = live.reduce((n, m) => n + eventBytes(m), 0)
  const naiveBytes = list.reduce((n, m) => n + eventBytes(m), 0)

  if (channel.byte_budget > 0 && liveBytes > channel.byte_budget) {
    const keepExact = live.filter((m) => m.tier === 'exact')
    let rest = live.filter((m) => m.tier !== 'exact')
    while (rest.length && liveBytes > channel.byte_budget) {
      const dropped = rest.pop()
      toArchive.push({ ...archiveRecord({ id: dropped.id, kind: 'mailbox', title: dropped.body, ts: dropped.ts }), channel: 'mailbox' })
      liveBytes -= eventBytes(dropped)
    }
    live = [...keepExact, ...rest]
  }

  const liveExact = live.filter((m) => m.tier === 'exact')
  const liveCompressed = live.filter((m) => m.tier === 'compressed')
  const liveLandmarks = live.filter((m) => m.tier === 'landmark')

  return {
    messages: live,
    exact: liveExact,
    compressed: liveCompressed,
    landmarks: liveLandmarks,
    toArchive,
    meta: {
      protocol: 'ow-rrm/0.1',
      channel: 'mailbox',
      enabled: channel.enabled !== false,
      exact: liveExact.length,
      compressed: liveCompressed.length,
      landmarks: liveLandmarks.length,
      unreadPinned: unread.length,
      archiveQueued: toArchive.length,
      liveBytes,
      byteBudget: channel.byte_budget,
      budgetUtilization: channel.byte_budget > 0
        ? Number((liveBytes / channel.byte_budget).toFixed(3))
        : null,
    },
    falsify: {
      naiveEventCount: list.length,
      naiveBytes,
      rrmLiveCount: live.length,
      rrmLiveBytes: liveBytes,
      archivedThisPass: toArchive.length,
      bytesSaved: Math.max(0, naiveBytes - liveBytes),
      ratio: naiveBytes > 0 ? Number((liveBytes / naiveBytes).toFixed(3)) : 1,
      baseline: 'byte-matched-mailbox-full',
    },
  }
}

export function reconcileMailbox(home, messages, cfgInput, now = Date.now()) {
  const cfg = mergeRrmConfig(cfgInput)
  if (cfg.enabled === false) {
    return {
      messages: messages.slice(),
      meta: { enabled: false, channel: 'mailbox' },
      falsify: null,
      skipped: true,
    }
  }
  const projection = projectMailboxMemory(messages, cfg, now)
  const channel = mailboxChannelConfig(cfg)
  if (projection.toArchive.length) {
    appendArchive(home, projection.toArchive, channel)
  }
  return {
    ...projection,
    archiveStats: readArchiveStats(home, channel),
  }
}

export function tierLabel(tier) {
  if (tier === 'exact') return '精确'
  if (tier === 'compressed') return '压缩'
  if (tier === 'landmark') return '地标'
  if (tier === 'archive') return '归档'
  return tier || '—'
}

export function taskChannelConfig(cfgInput) {
  const cfg = mergeRrmConfig(cfgInput)
  return {
    ...cfg,
    exact_window: cfg.task_exact_window,
    compressed_max: cfg.task_compressed_max,
    landmark_max: cfg.task_landmark_max,
    byte_budget: cfg.task_byte_budget,
    archive_path: cfg.task_archive_path,
  }
}

export function compressTask(task) {
  return {
    id: task.id,
    title: String(task.title || '').slice(0, 40),
    status: task.status,
    running: !!task.running,
    updatedAt: task.updatedAt,
    tier: 'compressed',
  }
}

export function landmarkTask(task) {
  return {
    id: task.id,
    title: String(task.title || '').slice(0, 20),
    status: task.status,
    updatedAt: task.updatedAt,
    tier: 'landmark',
  }
}

function isHotTask(task) {
  return task.running
    || task.status === 'running'
    || task.status === 'queued'
    || task.status === 'pending'
}

/**
 * 任务摘要 RRM：热任务钉住 exact；其余按 updatedAt 降分辨率。
 * 不删除官方 ledger，仅投影 + 可选归档摘要行。
 */
export function projectTaskMemory(tasks, cfgInput, now = Date.now()) {
  const channel = taskChannelConfig(cfgInput)
  const list = Array.isArray(tasks) ? [...tasks] : []
  list.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))

  const hot = list.filter(isHotTask).map((t) => ({
    ...t,
    ts: t.updatedAt || now,
    tier: 'exact',
  }))
  const cold = list.filter((t) => !isHotTask(t)).map((t) => ({
    ...t,
    ts: t.updatedAt || now,
  }))

  const exact = [...hot]
  const compressed = []
  const landmarks = []
  const toArchive = []

  cold.forEach((task, i) => {
    const tier = assignTier(task, hot.length + i, channel, now)
    if (tier === 'exact') {
      exact.push({ ...task, tier: 'exact' })
    } else if (tier === 'compressed') {
      if (compressed.length < channel.compressed_max) compressed.push(compressTask(task))
      else toArchive.push({ ...archiveRecord({ id: task.id, kind: 'task', title: task.title, ts: task.ts }), channel: 'task', status: task.status })
    } else if (tier === 'landmark') {
      if (landmarks.length < channel.landmark_max) landmarks.push(landmarkTask(task))
      else toArchive.push({ ...archiveRecord({ id: task.id, kind: 'task', title: task.title, ts: task.ts }), channel: 'task', status: task.status })
    } else {
      toArchive.push({ ...archiveRecord({ id: task.id, kind: 'task', title: task.title, ts: task.ts }), channel: 'task', status: task.status })
    }
  })

  let live = [...exact, ...compressed, ...landmarks]
  let liveBytes = live.reduce((n, t) => n + eventBytes(t), 0)
  const naiveBytes = list.reduce((n, t) => n + eventBytes(t), 0)

  if (channel.byte_budget > 0 && liveBytes > channel.byte_budget) {
    const keepExact = live.filter((t) => t.tier === 'exact')
    let rest = live.filter((t) => t.tier !== 'exact')
    while (rest.length && liveBytes > channel.byte_budget) {
      const dropped = rest.pop()
      toArchive.push({ ...archiveRecord({ id: dropped.id, kind: 'task', title: dropped.title, ts: dropped.updatedAt || dropped.ts }), channel: 'task' })
      liveBytes -= eventBytes(dropped)
    }
    live = [...keepExact, ...rest]
  }

  const liveExact = live.filter((t) => t.tier === 'exact')
  const liveCompressed = live.filter((t) => t.tier === 'compressed')
  const liveLandmarks = live.filter((t) => t.tier === 'landmark')

  return {
    tasks: live,
    exact: liveExact,
    compressed: liveCompressed,
    landmarks: liveLandmarks,
    toArchive,
    meta: {
      protocol: 'ow-rrm/0.1',
      channel: 'task',
      enabled: channel.enabled !== false,
      exact: liveExact.length,
      compressed: liveCompressed.length,
      landmarks: liveLandmarks.length,
      hotPinned: hot.length,
      archiveQueued: toArchive.length,
      liveBytes,
      byteBudget: channel.byte_budget,
      budgetUtilization: channel.byte_budget > 0
        ? Number((liveBytes / channel.byte_budget).toFixed(3))
        : null,
    },
    falsify: {
      naiveEventCount: list.length,
      naiveBytes,
      rrmLiveCount: live.length,
      rrmLiveBytes: liveBytes,
      archivedThisPass: toArchive.length,
      bytesSaved: Math.max(0, naiveBytes - liveBytes),
      ratio: naiveBytes > 0 ? Number((liveBytes / naiveBytes).toFixed(3)) : 1,
      baseline: 'byte-matched-task-full',
    },
  }
}

export function reconcileTasks(home, tasks, cfgInput, now = Date.now()) {
  const cfg = mergeRrmConfig(cfgInput)
  if (cfg.enabled === false) {
    return {
      tasks: tasks.slice(),
      meta: { enabled: false, channel: 'task' },
      falsify: null,
      skipped: true,
    }
  }
  const projection = projectTaskMemory(tasks, cfg, now)
  const channel = taskChannelConfig(cfg)
  if (projection.toArchive.length) {
    appendArchive(home, projection.toArchive, channel)
  }
  return {
    ...projection,
    archiveStats: readArchiveStats(home, channel),
  }
}

/**
 * 参数证伪对照：同一事件集下比较多组 (tau, alpha, budget) 的字节比。
 * @returns {{ winner, rows, note }}
 */
export function compareRrmParams(rawEvents, variants, now = Date.now()) {
  const rows = (variants || []).map((v) => {
    const cfg = mergeRrmConfig(v)
    const proj = projectLiveMemory(rawEvents, cfg, now)
    return {
      label: v.label || `α=${cfg.alpha},τ=${cfg.tau_ms},B=${cfg.byte_budget}`,
      alpha: cfg.alpha,
      tau_ms: cfg.tau_ms,
      byte_budget: cfg.byte_budget,
      liveCount: proj.meta.exact + proj.meta.compressed + proj.meta.landmarks,
      liveBytes: proj.falsify.rrmLiveBytes,
      naiveBytes: proj.falsify.naiveBytes,
      ratio: proj.falsify.ratio,
      bytesSaved: proj.falsify.bytesSaved,
      exact: proj.meta.exact,
    }
  })
  const ranked = [...rows].sort((a, b) => a.ratio - b.ratio || a.liveBytes - b.liveBytes)
  return {
    winner: ranked[0] || null,
    rows,
    note: '壳层字节证伪对照；不代表神经任务质量',
  }
}

function compareWithProjector(projectFn, items, variants, now) {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return null
  const rows = (variants || []).map((v) => {
    const cfg = mergeRrmConfig(v)
    const proj = projectFn(list, cfg, now)
    const falsify = proj.falsify || {}
    const meta = proj.meta || {}
    return {
      label: v.label || `α=${cfg.alpha},τ=${cfg.tau_ms}`,
      alpha: cfg.alpha,
      tau_ms: cfg.tau_ms,
      byte_budget: cfg.byte_budget,
      liveCount: (meta.exact || 0) + (meta.compressed || 0) + (meta.landmarks || 0),
      liveBytes: falsify.rrmLiveBytes ?? 0,
      naiveBytes: falsify.naiveBytes ?? 0,
      ratio: falsify.ratio ?? 1,
      bytesSaved: falsify.bytesSaved ?? 0,
      exact: meta.exact || 0,
    }
  })
  const ranked = [...rows].sort((a, b) => a.ratio - b.ratio || a.liveBytes - b.liveBytes)
  return {
    winner: ranked[0] || null,
    rows,
  }
}

/**
 * 三通道证伪：事件为主（winner/rows 兼容旧 UI），旁附信箱/任务。
 * 试用胜出仍以事件通道 winner 为准（全局 α/τ/B）。
 */
export function compareRrmAllChannels({ events, mailbox, tasks }, variants, now = Date.now()) {
  const vars = variants || defaultCompareVariants()
  const eventsCmp = compareRrmParams(events || [], vars, now)
  const mailboxCmp = compareWithProjector(projectMailboxMemory, mailbox, vars, now)
  const tasksCmp = compareWithProjector(projectTaskMemory, tasks, vars, now)
  return {
    ...eventsCmp,
    channels: {
      events: { winner: eventsCmp.winner, rows: eventsCmp.rows },
      mailbox: mailboxCmp,
      tasks: tasksCmp,
    },
    note: '三通道壳层字节证伪；胜出/试用按事件通道；旁注信箱·任务 · 非神经质量',
  }
}
