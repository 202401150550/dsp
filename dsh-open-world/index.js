// dsh-open-world · Host half
// GET /api/open-world/snapshot — 动态聚合 session / task-board / rewind / 系统指标
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { connect } from 'node:net'
import { fileURLToPath } from 'node:url'
import { mergePluginResults, scanManifestEntry, howToEnableHint } from './bridge/manifest.mjs'
import {
  SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_SCHEMA_NOTES,
  classifyAction,
  actionLayersSummary,
  HOST_ACTION_IDS,
  BRIDGE_ACTION_TYPES,
} from './bridge/action-layers.mjs'
import {
  mergeRrmConfig,
  reconcileEvents,
  slimMemoryForSnapshot,
  readArchiveStats,
  defaultRrmConfig,
  projectLiveMemory,
  formatMemoryHint,
  reconcileMailbox,
  projectMailboxMemory,
  reconcileTasks,
  projectTaskMemory,
  compareRrmParams,
  defaultCompareVariants,
  tierLabel,
  resolveRrmConfig,
  saveRrmSessionOverride,
  loadRrmSessionOverride,
  compareRrmAllChannels,
  summarizeArchives,
  attachArchiveTails,
  mailboxChannelConfig,
  taskChannelConfig,
  searchLocalArchives,
} from './bridge/rrm-memory.mjs'
import {
  describeNeuralRra,
  assertShellDoesNotClaimNeural,
  defaultRraConfig,
  mergeRraConfig,
  attachNeuralStubToMemory,
  attachNeuralStubToMemoryAsync,
  buildNeuralStub,
  probeRraProtoSync,
  probeRraProtoDeep,
  tryApplyRraSketch,
} from './bridge/rra-adapter.mjs'
import {
  loadWorldState,
  saveWorldState,
  worldStateForSnapshot,
  defaultWorldState,
  normalizeWorldState,
  worldStatePath,
} from './bridge/world-state.mjs'
import { buildFleetView, emptyFleetView } from './bridge/fleet.mjs'
import {
  authorizeSpaceRequest,
  ensureSpaceToken,
  rotateSpaceToken,
  loadSpaceToken,
  spaceStatus,
  sealJson,
  signMailboxEntry,
  mergeSpaceConfig,
  defaultSpaceConfig,
  SPACE_PROTOCOL,
  buildSecondScreenPayload,
  revokeSpaceToken,
} from './bridge/space-auth.mjs'

export const name = 'dsh-open-world'
export const inject = ['webServer', 'sessions']

const API_PREFIX = '/api/open-world'
const MAX_EVENTS = 48
const MAX_MAILBOX = 200
const PLUGIN_DIR = fileURLToPath(new URL('.', import.meta.url))
const events = []
const mlLossHistory = []

const TOPOLOGY_CATALOG = [
  { id: 'sphere', label: 'SPHERE', zh: '球面', genus: 0, orientable: true, betti: [1, 0, 1], euler: 2, dimension: 2 },
  { id: 'torus', label: 'TORUS', zh: '环面', genus: 1, orientable: true, betti: [1, 2, 1], euler: 0, dimension: 2 },
  { id: 'mobius', label: 'MÖBIUS', zh: '莫比乌斯带', genus: 1, orientable: false, betti: [1, 1, 0], euler: 0, dimension: 2 },
  { id: 'klein', label: 'KLEIN BOTTLE', zh: '克莱因瓶', genus: 2, orientable: false, betti: [1, 1, 0], euler: 0, dimension: 2 },
  { id: 'projective', label: 'RP²', zh: '射影平面', genus: 1, orientable: false, betti: [1, 0, 0], euler: 1, dimension: 2 },
  { id: 'poincare', label: 'POINCARÉ', zh: '庞加莱圆盘', genus: 0, orientable: true, betti: [1, 0, 1], euler: 1, dimension: 2 },
]

const ATI_STAGES = [
  { id: 'seed', threshold: 0, label: 'TOPOLOGY SEED', zh: '拓扑胚', sub: '流形与不变量' },
  { id: 'ml', threshold: 20, label: 'MACHINE LEARNING', zh: '机器学习', sub: '梯度下降 · 损失流形' },
  { id: 'dl', threshold: 40, label: 'DEEP LEARNING', zh: '深度学习', sub: '注意力 · Transformer' },
  { id: 'chem', threshold: 65, label: 'CHEMICAL COMPUTING', zh: '化学计算', sub: '分子图 · 反应场' },
  { id: 'ati', threshold: 85, label: 'ATI EMERGENCE', zh: 'ATI 涌现', sub: '人工拓扑智能' },
]

const CHEM_ELEMENTS = [
  { symbol: 'H', z: 1, name: '氢 · 会话入口', node: 'user-hub', category: 'nonmetal', shells: [1] },
  { symbol: 'C', z: 6, name: '碳 · AI 引擎', node: 'ai-engine', category: 'carbon', shells: [2, 4] },
  { symbol: 'N', z: 7, name: '氮 · 任务队列', node: 'task-board', category: 'nonmetal', shells: [2, 5] },
  { symbol: 'O', z: 8, name: '氧 · 存储中心', node: 'storage', category: 'nonmetal', shells: [2, 6] },
  { symbol: 'P', z: 15, name: '磷 · 运行时', node: 'runtime', category: 'nonmetal', shells: [2, 8, 5] },
  { symbol: 'S', z: 16, name: '硫 · 安全防护', node: 'security', category: 'nonmetal', shells: [2, 8, 6] },
  { symbol: 'Fe', z: 26, name: '铁 · 网络服务', node: 'network', category: 'metal', shells: [2, 8, 14, 2] },
  { symbol: 'Mg', z: 12, name: '镁 · 长期记忆', node: 'memory', category: 'metal', shells: [2, 8, 2] },
]

const PLUGIN_CATALOG = [
  { id: 'task-board', title: '任务看板', titleEn: 'TASK BOARD', dep: '@linxin666/dsh-client-ui-task-board', probe: 'taskBoard', featureId: 'web-ui-task-board' },
  { id: 'rewind', title: '对话回退', titleEn: 'REWIND', dep: 'dsh-rewind-plugin', probe: 'rewind', featureId: 'web-ui-rewind' },
  { id: 'git-graph', title: 'Git 图谱', titleEn: 'GIT GRAPH', dep: '@linxin666/dsh-client-ui-git-graph', probe: 'gitGraph', featureId: 'web-ui-git-graph' },
  { id: 'live-stats', title: '实时状态', titleEn: 'LIVE STATS', dep: '@linxin666/dsh-live-stats', probe: 'liveStats', featureId: 'web-ui-live-stats' },
  { id: 'ssh', title: 'SSH 远程', titleEn: 'SSH', dep: '@linxin666/dsh-ssh', probe: 'ssh', featureId: 'web-ui-ssh' },
  { id: 'market', title: '插件市场', titleEn: 'MARKET', dep: 'dshmarket', probe: 'market', featureId: 'dsh-market' },
  { id: 'remote-web-ui', title: '移动端远程', titleEn: 'REMOTE UI', dep: '@linxin666/dsh-remote-web-ui', probe: 'remoteWebUi', featureId: 'web-ui-remote-web-ui' },
  { id: 'community-plugins', title: '社区索引', titleEn: 'COMMUNITY', dep: '@linxin666/dsh-client-ui-community-plugins', probe: 'communityPlugins', featureId: 'web-ui-community-plugins' },
  { id: 'workspace-analyzer', title: '工作区分析', titleEn: 'WORKSPACE', dep: '@linxin666/dsh-client-ui-workspace-analyzer', probe: 'workspaceAnalyzer', featureId: 'web-ui-workspace-analyzer' },
  { id: 'aionui', title: 'AionUI 面板', titleEn: 'AIONUI', dep: '@linxin666/dsh-client-ui-aionui-panel', probe: 'aionui', featureId: 'web-ui-aionui-panel' },
  { id: 'hindsight', title: 'Hindsight 记忆', titleEn: 'HINDSIGHT', dep: '@vectorize-io/hindsight-coding-agents', probe: 'hindsight', featureId: 'hindsight' },
  { id: 'open-world', title: '开放世界', titleEn: 'OPEN WORLD', dep: 'dsh-open-world', probe: 'openWorld', featureId: 'dsh-open-world' },
  { id: 'deepseek-usage', title: 'DeepSeek 用量', titleEn: 'USAGE', dep: 'dsh-deepseek-usage', probe: 'deepseekUsage', featureId: null },
  { id: 'ventus-progress', title: '子代理进度', titleEn: 'PROGRESS', dep: 'dsh-ventus-progress', probe: 'ventusProgress', featureId: 'ventus-progress' },
  { id: 'better-sidebar', title: '右侧工作台', titleEn: 'SIDEBAR', dep: 'dsh-better-sidebar', probe: 'betterSidebar', featureId: 'better-sidebar' },
  { id: 'ventus-search', title: 'Ventus 搜索', titleEn: 'SEARCH', dep: 'dsh-ventus-search', probe: 'ventusSearch', featureId: 'ventus-search' },
]

const NODE_ZH = {
  core: '核心系统',
  'ai-engine': 'AI 引擎',
  'task-board': '任务队列',
  storage: '存储中心',
  network: '网络服务',
  security: '安全防护',
  analytics: '数据分析',
  'user-hub': '用户中心',
  runtime: '运行时',
  memory: '长期记忆',
}

const NODE_ACTIONS = {
  core: { type: 'close', label: '返回会话', pluginId: null },
  'ai-engine': { type: 'idea-panel', label: '进入 IDEA Lab', pluginId: null },
  'task-board': { type: 'embed', label: '进入任务看板', pluginId: 'task-board', panel: 'task-board' },
  storage: { type: 'embed', label: '进入回退时间轴', pluginId: 'rewind', panel: 'rewind' },
  network: { type: 'embed', label: '进入 SSH', pluginId: 'ssh', panel: 'ssh' },
  security: { type: 'embed', label: '进入设置表面', pluginId: null, panel: 'market' },
  analytics: { type: 'embed', label: '进入工作区分析', pluginId: 'workspace-analyzer', panel: 'analytics' },
  'user-hub': { type: 'embed', label: '进入插件中心', pluginId: 'market', panel: 'market' },
  runtime: { type: 'embed', label: '进入进程舰队', pluginId: 'live-stats', panel: 'fleet' },
  memory: { type: 'embed', label: '进入长期记忆', pluginId: 'hindsight', panel: 'memory' },
}

const DEFAULT_SYNAPSE_DEFS = [
  ['user-hub', 'ai-engine'],
  ['network', 'ai-engine'],
  ['ai-engine', 'analytics'],
  ['ai-engine', 'task-board'],
  ['analytics', 'security'],
  ['task-board', 'runtime'],
  ['task-board', 'storage'],
  ['runtime', 'core'],
  ['security', 'core'],
  ['storage', 'core'],
  ['memory', 'ai-engine'],
]

const PLUGIN_TO_CORE = {
  'task-board': 'task-board',
  rewind: 'storage',
  ssh: 'network',
  'live-stats': 'runtime',
  'workspace-analyzer': 'analytics',
  market: 'user-hub',
  'remote-web-ui': 'network',
  'community-plugins': 'user-hub',
  hindsight: 'memory',
  'git-graph': 'analytics',
  aionui: 'user-hub',
  'open-world': 'core',
}

const PLUGIN_COLORS = ['#a78bfa', '#38bdf8', '#f472b6', '#34d399', '#fb923c', '#c084fc', '#2dd4bf']

function dshHome() {
  const env = process.env.DSH_HOME && process.env.DSH_HOME.trim()
  return env || join(homedir(), '.dsh')
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function isLoopback(req) {
  const addr = req.socket && req.socket.remoteAddress
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

function pushEvent(kind, title, detail) {
  events.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind,
    title,
    detail: detail || '',
    ts: Date.now(),
  })
  // 小行李：用 RRM 替代硬截断 MAX_EVENTS（仍保留上限防失控）
  try {
    const home = dshHome()
    const cfg = loadOpenWorldConfig(home)
    reconcileEvents(events, home, cfg.rrm)
  } catch {
    if (events.length > MAX_EVENTS) events.length = MAX_EVENTS
  }
  if (events.length > MAX_EVENTS * 2) events.length = MAX_EVENTS * 2
}

function readJson(path) {
  try {
    if (!existsSync(path)) return undefined
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

function readText(path) {
  try {
    if (!existsSync(path)) return ''
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

function parseOpenWorldConfig(text) {
  const cfg = {
    default_view: 'ati',
    merge_synapses: true,
    dynamic_plugins: true,
    synapses: [],
    messaging: {
      enabled: true,
      max_messages: MAX_MAILBOX,
      allow_broadcast: true,
      allow_agent_inject: true,
      outbox_dir: 'open-world/outbox',
    },
    integrations: {
      pair: true,
      notifications: true,
      hindsight_port: 9077,
      archify_dirs: ['open-world/archify', '.dsh-drops'],
    },
    idea: {
      enabled: true,
    },
    rrm: defaultRrmConfig(),
    rra: defaultRraConfig(),
    space: defaultSpaceConfig(),
  }
  if (!text) return cfg
  let section = null
  let subKey = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    // 顶级 section 头
    if (line === 'synapses:') { section = 'synapses'; subKey = null; continue }
    if (line === 'messaging:') { section = 'messaging'; subKey = null; continue }
    if (line === 'integrations:') { section = 'integrations'; subKey = null; continue }
    if (line === 'idea:') { section = 'idea'; subKey = null; continue }
    if (line === 'rrm:') { section = 'rrm'; subKey = null; continue }
    if (line === 'rra:') { section = 'rra'; subKey = null; continue }
    if (line === 'space:') { section = 'space'; subKey = null; continue }

    // 列表项（如 archify_dirs 下的 - xxx）
    const listItem = line.match(/^-\s+(.+)$/)
    if (listItem && section === 'integrations' && subKey) {
      if (!Array.isArray(cfg.integrations[subKey])) cfg.integrations[subKey] = []
      cfg.integrations[subKey].push(listItem[1].trim())
      continue
    }
    if (listItem && section === 'synapses') {
      const pair = listItem[1].match(/^\[([^,\]]+),\s*([^\]]+)\]/)
      if (pair) {
        cfg.synapses.push([pair[1].trim(), pair[2].trim()])
      }
      continue
    }

    // key-value 行
    const kv = line.match(/^([\w-]+):\s*(.*)$/)
    if (kv) {
      const k = kv[1]
      const v = kv[2].trim()
      const parseVal = (val) => {
        if (val === 'true') return true
        if (val === 'false') return false
        if (/^\d+(\.\d+)?$/.test(val)) return Number(val)
        return val
      }
      if (section === 'messaging') {
        cfg.messaging[k] = parseVal(v)
      } else if (section === 'integrations') {
        if (v === '') {
          subKey = k
          cfg.integrations[k] = []
        } else {
          cfg.integrations[k] = parseVal(v)
          subKey = null
        }
      } else if (section === 'idea') {
        cfg.idea[k] = parseVal(v)
      } else if (section === 'rrm') {
        cfg.rrm[k] = parseVal(v)
      } else if (section === 'rra') {
        cfg.rra[k] = parseVal(v)
      } else if (section === 'space') {
        cfg.space[k] = parseVal(v)
      } else {
        cfg[k] = parseVal(v)
      }
      continue
    }
  }
  cfg.rrm = mergeRrmConfig(cfg.rrm)
  cfg.rra = mergeRraConfig(cfg.rra)
  cfg.space = mergeSpaceConfig(cfg.space)
  return cfg
}

function loadOpenWorldConfig(home) {
  const userPath = join(home, 'open-world.yml')
  const bundled = join(PLUGIN_DIR, 'open-world.yml')
  const text = existsSync(userPath) ? readText(userPath) : readText(bundled)
  return parseOpenWorldConfig(text)
}

function portOpen(port, host = '127.0.0.1', ms = 280) {
  return new Promise((resolve) => {
    const sock = connect({ port, host })
    const timer = setTimeout(() => { sock.destroy(); resolve(false) }, ms)
    sock.on('connect', () => { clearTimeout(timer); sock.destroy(); resolve(true) })
    sock.on('error', () => { clearTimeout(timer); resolve(false) })
  })
}

async function proxyLocal(hostHeader, method, path, body) {
  if (!hostHeader) return { ok: false, status: 0, data: null }
  try {
    const opts = { method, headers: { accept: 'application/json' } }
    if (body !== undefined) {
      opts.headers['content-type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
    const res = await fetch(`http://${hostHeader}${path}`, opts)
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    return { ok: false, status: 0, data: { error: String(err && err.message || err) } }
  }
}

function normalizeMemoryItems(data) {
  const list = data && (data.items || data.results || data.memories)
    ? (data.items || data.results || data.memories)
    : (Array.isArray(data) ? data : [])
  return list.map((m) => ({
    id: m.id || `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    text: String(m.text || m.snippet || m.body || m.name || '').slice(0, 480),
    name: m.name || null,
    score: m.score,
    date: m.date || m.updated_at || m.timestamp || null,
  })).filter((m) => m.text)
}

function hindsightCachePaths(home) {
  return [
    join(home, 'open-world', 'hindsight-cache.json'),
    join(home, 'logs', 'hindsight-memories-raw.json'),
    join(home, '..', 'Desktop', 'dsp', 'dsh-desktop-toggle', 'logs', 'hindsight-memories-raw.json'),
  ]
}

async function fetchHindsightSearch(home, query = '') {
  const q = String(query || '').trim()
  const daemon = await portOpen(9077)
  if (daemon) {
    const paths = [
      `/v1/memories/search?query=${encodeURIComponent(q || 'open world')}&limit=10`,
      `/v1/search?query=${encodeURIComponent(q || 'open world')}&limit=10`,
      `/memories?limit=10${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ]
    for (const p of paths) {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 2200)
        const res = await fetch(`http://127.0.0.1:9077${p}`, { signal: ctrl.signal })
        clearTimeout(timer)
        if (!res.ok) continue
        const data = await res.json()
        const items = normalizeMemoryItems(data)
        if (items.length > 0) {
          return { daemon: true, query: q, items, source: 'daemon' }
        }
      } catch { /* try next */ }
    }
  }
  for (const path of hindsightCachePaths(home)) {
    const data = readJson(path)
    if (!data) continue
    let items = normalizeMemoryItems(data)
    if (q) {
      const needle = q.toLowerCase()
      items = items.filter((m) => m.text.toLowerCase().includes(needle) || (m.name || '').toLowerCase().includes(needle))
    }
    if (items.length > 0) {
      return { daemon: false, query: q, items: items.slice(0, 10), source: 'cache' }
    }
  }
  return { daemon, query: q, items: [], source: daemon ? 'daemon' : 'offline' }
}

function scanArchifyDiagrams(home) {
  const items = []
  const dirs = [
    { dir: join(home, 'open-world', 'archify'), kind: 'user' },
    { dir: join(home, '.dsh-drops'), kind: 'drops' },
    { dir: join(PLUGIN_DIR, 'archify-examples'), kind: 'bundled' },
  ]
  for (const { dir, kind } of dirs) {
    if (!existsSync(dir)) continue
    try {
      for (const file of readdirSync(dir)) {
        if (!/\.html?$/i.test(file)) continue
        const full = join(dir, file)
        if (!statSync(full).isFile()) continue
        items.push({
          id: `${kind}-${file.replace(/\.html?$/i, '')}`,
          name: file,
          title: file.replace(/\.html?$/i, '').replace(/[_-]+/g, ' '),
          url: `/api/open-world/archify/${encodeURIComponent(file)}`,
          kind,
          mtime: statSync(full).mtimeMs,
        })
      }
    } catch { /* ignore */ }
  }
  items.sort((a, b) => (b.mtime || 0) - (a.mtime || 0))
  return { count: items.length, items: items.slice(0, 16) }
}

function resolveArchifyFile(home, name) {
  const safe = String(name || '').replace(/[/\\]/g, '')
  if (!safe || safe.includes('..')) return null
  const dirs = [
    join(home, 'open-world', 'archify'),
    join(home, '.dsh-drops'),
    join(PLUGIN_DIR, 'archify-examples'),
  ]
  for (const dir of dirs) {
    const full = join(dir, safe)
    if (existsSync(full) && statSync(full).isFile()) return full
  }
  return null
}

function syncNotificationsToMailbox(home, config, notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) return 0
  const messages = loadMailbox(home, config.messaging?.max_messages || MAX_MAILBOX)
  const seen = new Set(messages.map((m) => m.notifRef).filter(Boolean))
  let added = 0
  for (const n of notifications) {
    if (!n || !n.id || seen.has(n.id)) continue
    messages.unshift({
      id: `notif-${n.id}`,
      ts: n.ts || Date.now(),
      direction: 'in',
      from: n.source || 'notification-center',
      to: 'open-world',
      toLabel: '通知中心',
      body: `${n.title || '通知'}: ${n.body || ''}`,
      kind: 'notification',
      notifRef: n.id,
      notifKind: n.kind,
      read: false,
      payload: { notification: n },
    })
    seen.add(n.id)
    added += 1
  }
  if (added > 0) saveMailbox(home, messages, config)
  return added
}

async function buildIntegrationsHub(hostHeader, home, plugins) {
  const remote = plugins.find((p) => p.id === 'remote-web-ui')
  const [pairRes, notifRes, memoryPreview, archify] = await Promise.all([
    proxyLocal(hostHeader, 'GET', '/api/pair/status'),
    proxyLocal(hostHeader, 'GET', '/api/notification-center/list'),
    fetchHindsightSearch(home, ''),
    Promise.resolve(scanArchifyDiagrams(home)),
  ])
  const pairData = pairRes.ok ? pairRes.data : { ok: false, paired: false }
  const notifData = notifRes.ok ? notifRes.data : { notifications: [], unreadCount: 0 }
  return {
    pair: {
      available: Boolean(remote && remote.installed),
      online: Boolean(remote && remote.online),
      paired: Boolean(pairData.paired),
      phase: pairData.phase || (pairData.paired ? 'connected' : 'stopped'),
      deviceCount: pairData.deviceCount || 0,
      onlineCount: pairData.onlineCount || 0,
      lanAvailable: pairData.lanAvailable !== false,
      tokenExpiresAt: pairData.tokenExpiresAt,
    },
    notifications: {
      available: notifRes.ok && plugins.some((p) => p.id === 'notification-center' && p.installed),
      notifications: notifData.notifications || [],
      unreadCount: notifData.unreadCount || 0,
    },
    hindsight: memoryPreview,
    archify,
    remoteMessaging: {
      enabled: Boolean(remote && remote.installed),
      paired: Boolean(pairData.paired || (pairData.deviceCount || 0) > 0),
    },
  }
}

function collectRewindStats(home) {
  const roots = [
    join(home, 'rewind-snapshots'),
    join(home, 'storages', 'webui-rewind'),
  ]
  const sessionIds = new Set()
  let snapshots = 0
  let anchors = 0
  for (const root of roots) {
    if (!existsSync(root)) continue
    try {
      for (const sessionId of readdirSync(root)) {
        const sdir = join(root, sessionId)
        if (!statSync(sdir).isDirectory()) continue
        sessionIds.add(sessionId)
        for (const entry of readdirSync(sdir)) {
          const full = join(sdir, entry)
          if (statSync(full).isDirectory()) {
            anchors += 1
            for (const f of readdirSync(full)) {
              if (f.endsWith('.json')) snapshots += 1
            }
          } else if (entry.endsWith('.json')) {
            snapshots += 1
          }
        }
      }
    } catch { /* ignore */ }
  }
  return {
    available: sessionIds.size > 0 || existsSync(roots[0]) || existsSync(roots[1]),
    sessions: sessionIds.size,
    snapshots,
    anchors,
    storageRoot: roots[0],
    legacyRoot: roots[1],
  }
}

function buildRewindTimeline(home, sessions, limit = 28) {
  const roots = [
    { path: join(home, 'rewind-snapshots'), source: 'rewind-snapshots' },
    { path: join(home, 'storages', 'webui-rewind'), source: 'webui-rewind' },
  ]
  const points = []
  const activeId = sessions && sessions.activeId
  for (const { path: root, source } of roots) {
    if (!existsSync(root)) continue
    try {
      for (const sessionId of readdirSync(root)) {
        const sdir = join(root, sessionId)
        if (!statSync(sdir).isDirectory()) continue
        for (const entry of readdirSync(sdir)) {
          const full = join(sdir, entry)
          const st = statSync(full)
          if (st.isDirectory()) {
            const anchorSeq = Number(entry)
            let fileCount = 0
            let mtime = 0
            for (const f of readdirSync(full)) {
              if (!f.endsWith('.json')) continue
              fileCount += 1
              const fst = statSync(join(full, f))
              if (fst.mtimeMs > mtime) mtime = fst.mtimeMs
            }
            if (fileCount === 0) continue
            points.push({
              id: `${source}-${sessionId}-${entry}`,
              sessionId,
              anchorSeq: Number.isFinite(anchorSeq) ? anchorSeq : null,
              fileCount,
              ts: mtime,
              active: sessionId === activeId,
              source,
              label: Number.isFinite(anchorSeq) ? `锚点 @${anchorSeq}` : entry,
            })
          } else if (entry.endsWith('.json')) {
            points.push({
              id: `${source}-${sessionId}-${entry}`,
              sessionId,
              anchorSeq: null,
              fileCount: 1,
              ts: st.mtimeMs,
              active: sessionId === activeId,
              source,
              label: entry.replace(/\.json$/i, ''),
            })
          }
        }
      }
    } catch { /* ignore */ }
  }
  points.sort((a, b) => b.ts - a.ts)
  return { points: points.slice(0, limit), total: points.length }
}

/** @deprecated use collectRewindStats */
function countRewindSnapshots(home) {
  const stats = collectRewindStats(home)
  return {
    available: stats.available,
    sessions: stats.sessions,
    snapshots: stats.snapshots,
    anchors: stats.anchors,
  }
}

async function ventusProgressMetrics(hostHeader, plugins) {
  const online = Array.isArray(plugins) && plugins.some((p) => p.id === 'ventus-progress' && p.online)
  if (!hostHeader) {
    return { available: false, online: !!online, entries: [] }
  }
  const proxied = await proxyLocal(hostHeader, 'GET', '/api/ventus-progress/list')
  if (!proxied.ok || !proxied.data) {
    return { available: false, online: !!online, entries: [] }
  }
  const entries = Array.isArray(proxied.data.entries) ? proxied.data.entries : []
  return { available: true, online: true, entries }
}

function taskBoardMetrics(home) {
  const deps = new Set(profileDeps(home))
  const installed = deps.has('@linxin666/dsh-client-ui-task-board')
  const allTasks = loadTaskLedgerTasks(home)
  if (allTasks.length === 0) {
    return {
      available: installed,
      total: 0,
      running: 0,
      queued: 0,
      done: 0,
      scheduler: null,
      power: null,
      tasks: [],
      installed,
      allTasks: [],
    }
  }
  const ledger = readJson(join(home, 'task-board', 'ledger-v2.json'))
  const running = allTasks.filter((t) => t.running || t.status === 'running').length
  const queued = allTasks.filter((t) => t.status === 'queued' || t.status === 'pending').length
  const done = allTasks.filter((t) => t.status === 'done' || t.status === 'succeeded').length
  return {
    available: true,
    total: allTasks.length,
    running,
    queued,
    done,
    revision: ledger && ledger.revision,
    scheduler: ledger && ledger.scheduler || null,
    power: ledger && ledger.power || null,
    tasks: allTasks.slice(0, 12),
    installed: true,
    allTasks,
  }
}

function loadTaskLedgerTasks(home) {
  const ledger = readJson(join(home, 'task-board', 'ledger-v2.json'))
  if (!ledger || !Array.isArray(ledger.tasks)) return []
  return ledger.tasks.map((t) => {
    const running = Array.isArray(t.executions)
      && t.executions.some((e) => e.endedAt === undefined)
    return {
      id: t.id,
      title: t.title || '(untitled)',
      status: t.status || 'unknown',
      running,
      updatedAt: t.updatedAt || t.createdAt || 0,
    }
  }).sort((a, b) => b.updatedAt - a.updatedAt)
}

function sessionMetrics(sessions) {
  if (!sessions || typeof sessions.list !== 'function') {
    return { count: 0, items: [], activeCwd: null }
  }
  const list = sessions.list()
  const items = list.slice(0, 8).map((s) => ({
    id: s.id,
    cwd: (s.meta && s.meta.cwd) || null,
    seq: s.seq,
    createdAt: (s.header && s.header.createdAt) || null,
  }))
  const active = items[0]
  return {
    count: list.length,
    items,
    activeCwd: active && active.cwd,
    activeId: active && active.id,
  }
}

function profileDeps(home) {
  const pkg = readJson(join(home, 'profiles', 'desktop', 'package.json'))
  return pkg && pkg.dependencies ? Object.keys(pkg.dependencies) : []
}

/** 扫描 node_modules 中有 openWorld manifest 的插件 */
function scanOpenWorldManifests(home) {
  const nmDir = join(home, 'profiles', 'desktop', 'node_modules')
  if (!existsSync(nmDir)) return []
  const manifests = []
  try {
    for (const entry of readdirSync(nmDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      // scoped packages (@scope/name)
      if (entry.name.startsWith('@')) {
        const scopeDir = join(nmDir, entry.name)
        try {
          for (const sub of readdirSync(scopeDir, { withFileTypes: true })) {
            if (!sub.isDirectory()) continue
            _tryLoadManifest(join(scopeDir, sub.name), `${entry.name}/${sub.name}`, manifests)
          }
        } catch { /* permission */ }
      } else {
        _tryLoadManifest(join(nmDir, entry.name), entry.name, manifests)
      }
    }
  } catch { /* read error */ }
  return manifests
}

function _tryLoadManifest(pkgDir, pkgName, out) {
  const manifestPath = join(pkgDir, 'dsh.plugin.json')
  if (!existsSync(manifestPath)) return
  const manifest = readJson(manifestPath)
  const entry = scanManifestEntry(manifest, pkgName, pkgDir)
  if (entry) out.push(entry)
}

function probePlugins(home, taskBoard, rewind) {
  const deps = new Set(profileDeps(home))
  const rewindInstalled = deps.has('dsh-rewind-plugin') || deps.has('dsh-webui-rewind')
  const probes = {
    taskBoard: taskBoard.available,
    rewind: rewindInstalled,
    gitGraph: deps.has('@linxin666/dsh-client-ui-git-graph'),
    liveStats: deps.has('@linxin666/dsh-live-stats'),
    ssh: deps.has('@linxin666/dsh-ssh'),
    market: deps.has('dshmarket'),
    remoteWebUi: deps.has('@linxin666/dsh-client-ui-remote-web-ui') || deps.has('@linxin666/dsh-remote-web-ui'),
    communityPlugins: deps.has('@linxin666/dsh-client-ui-community-plugins'),
    workspaceAnalyzer: deps.has('@linxin666/dsh-client-ui-workspace-analyzer'),
    aionui: deps.has('@linxin666/dsh-client-ui-aionui-panel'),
    hindsight: deps.has('@vectorize-io/hindsight-coding-agents'),
    openWorld: deps.has('dsh-open-world'),
    describeImage: deps.has('@linxin666/dsh-tool-describe-image'),
    liangshen: deps.has('@linxin666/dsh-liangshen'),
    deepseekUsage: deps.has('dsh-deepseek-usage'),
    ventusProgress: deps.has('dsh-ventus-progress'),
    betterSidebar: deps.has('dsh-better-sidebar'),
    ventusSearch: deps.has('dsh-ventus-search'),
  }
  const manifests = scanOpenWorldManifests(home)
  return mergePluginResults({
    catalog: PLUGIN_CATALOG,
    probes,
    deps,
    manifests,
  })
}

function securityMetrics(home) {
  const credPath = join(home, '.credentials.yaml')
  const settingsPath = join(home, 'settings.yaml')
  let score = 72
  if (existsSync(credPath)) score += 12
  if (existsSync(settingsPath)) score += 8
  const credText = readText(credPath)
  if (/DEEPSEEK_API_KEY:\s*\S+/.test(credText)) score += 6
  return Math.min(100, score)
}

function networkMetrics({ sessions, taskBoard, plugins }) {
  const onlinePlugins = plugins.filter((p) => p.online).length
  const base = 35 + sessions.count * 10 + onlinePlugins * 4
  const taskBoost = taskBoard.available ? taskBoard.running * 8 + taskBoard.queued * 3 : 0
  return Math.min(100, base + taskBoost)
}

async function hindsightMetrics(plugins) {
  const installed = plugins.some((p) => p.id === 'hindsight' && p.installed)
  if (!installed) return { available: false, metric: 0, daemon: false }
  const daemon = await portOpen(9077)
  return {
    available: true,
    metric: daemon ? Math.min(100, 58 + 42) : 22,
    daemon,
    status: daemon ? 'online' : 'idle',
  }
}

function enrichNodes(nodes, plugins = []) {
  const byPluginId = Object.fromEntries(plugins.map((p) => [p.id, p]))
  return nodes.map((n) => {
    const action = NODE_ACTIONS[n.id] || (
      n.pluginId
        ? { type: 'settings', label: `打开 ${n.label}`, pluginId: n.pluginId, settingsHint: '插件' }
        : { type: 'monitor', label: '查看详情', pluginId: null }
    )
    const driver = byPluginId[action.pluginId || n.pluginId]
    const howToEnable = n.howToEnable
      || (driver && !driver.online ? driver.howToEnable : null)
      || null
    let hint = n.hint
    if (howToEnable && (n.status === 'offline' || (driver && !driver.installed))) {
      hint = howToEnable
    } else if (driver && !driver.online && driver.hint) {
      hint = driver.hint
    }
    return { ...n, action, howToEnable, hint }
  })
}

function resolveSynapseDefs(config, worldSynapses = []) {
  if (!config.merge_synapses && config.synapses.length > 0 && (!worldSynapses || worldSynapses.length === 0)) {
    return config.synapses
  }
  const merged = (!config.merge_synapses && config.synapses.length > 0)
    ? [...config.synapses]
    : [...DEFAULT_SYNAPSE_DEFS]
  const seen = new Set(merged.map(([a, b]) => `${a}->${b}`))
  for (const pair of [...config.synapses, ...(worldSynapses || [])]) {
    if (!Array.isArray(pair) || pair.length < 2) continue
    const key = `${pair[0]}->${pair[1]}`
    if (!seen.has(key)) {
      merged.push([pair[0], pair[1]])
      seen.add(key)
    }
  }
  return merged
}

function buildSynapses(nodes, synapseDefs, pulseEdges = []) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const pulseSet = new Set(pulseEdges)
  return synapseDefs.map(([from, to]) => {
    const a = byId[from]
    const b = byId[to]
    const wa = a ? a.metric / 100 : 0
    const wb = b ? b.metric / 100 : 0
    let weight = Math.round((wa * 0.55 + wb * 0.45) * 100) / 100
    if (pulseSet.has(`${from}->${to}`)) weight = Math.min(1, weight + 0.35)
    const active = a && b && a.status !== 'offline' && b.status !== 'offline' && weight > 0.08
    return { from, to, weight, active, pulsing: pulseSet.has(`${from}->${to}`), label: `${NODE_ZH[from] || from} → ${NODE_ZH[to] || to}` }
  })
}

function buildNeuralLayers(nodes, config) {
  const ids = new Set(nodes.map((n) => n.id))
  const pick = (list) => list.filter((id) => ids.has(id))
  const pluginNodes = nodes.filter((n) => n.dynamic).map((n) => n.id)
  const layers = [
    { id: 'input', label: 'INPUT', labelZh: '输入层', nodes: pick(['user-hub', 'network']) },
    { id: 'memory', label: 'MEMORY', labelZh: '记忆层', nodes: pick(['memory']) },
    { id: 'cognition', label: 'COGNITION', labelZh: '认知层', nodes: pick(['ai-engine', 'analytics']) },
    { id: 'execution', label: 'EXECUTION', labelZh: '执行层', nodes: pick(['task-board', 'runtime', 'security']) },
    { id: 'output', label: 'OUTPUT', labelZh: '输出层', nodes: pick(['storage', 'core']) },
  ].filter((l) => l.nodes.length > 0)
  if (config.dynamic_plugins && pluginNodes.length > 0) {
    layers.push({ id: 'plugins', label: 'PLUGINS', labelZh: '插件层', nodes: pluginNodes })
  }
  return layers
}

function buildNodes({ sessions, taskBoard, rewind, mem, plugins, hindsight, networkMetric, securityMetric }) {
  const sessionPct = Math.min(100, 40 + sessions.count * 8)
  const taskPct = taskBoard.available
    ? Math.min(100, Math.round((taskBoard.running * 30 + taskBoard.queued * 15 + taskBoard.done * 5)))
    : 0
  const rewindPct = rewind.available
    ? Math.min(100, Math.round(Math.log10(rewind.snapshots + 1) * 35))
    : 0
  const memPct = Math.min(100, Math.round((mem.heapUsed / mem.heapTotal) * 100))

  const nodes = [
    {
      id: 'core',
      label: 'Core System',
      metric: 100,
      status: 'online',
      role: 'session',
      hint: sessions.activeCwd || 'DSH Harness',
      dynamic: false,
    },
    {
      id: 'ai-engine',
      label: 'AI Engine',
      metric: sessionPct,
      status: sessions.count > 0 ? 'online' : 'idle',
      role: 'cognitive',
      hint: `${sessions.count} sessions`,
      dynamic: false,
    },
    {
      id: 'task-board',
      label: 'Task Queue',
      metric: taskPct || (taskBoard.available ? 12 : 0),
      status: taskBoard.available ? (taskBoard.running > 0 ? 'busy' : 'online') : 'offline',
      role: 'tasks',
      hint: taskBoard.available
        ? `${taskBoard.running} running / ${taskBoard.total} total`
        : howToEnableHint('web-ui-task-board', '任务看板'),
      howToEnable: taskBoard.available ? null : howToEnableHint('web-ui-task-board', '任务看板'),
      dynamic: false,
    },
    {
      id: 'storage',
      label: 'Storage',
      metric: rewindPct || 20,
      status: rewind.available ? 'online' : 'idle',
      role: 'rewind',
      hint: rewind.available
        ? `${rewind.anchors || 0} 锚点 · ${rewind.snapshots} 文件快照`
        : howToEnableHint('web-ui-rewind', '对话回退'),
      howToEnable: rewind.available ? null : howToEnableHint('web-ui-rewind', '对话回退'),
      dynamic: false,
    },
    {
      id: 'network',
      label: 'Network',
      metric: networkMetric,
      status: networkMetric > 50 ? 'online' : 'idle',
      role: 'loopback',
      hint: `${plugins.filter((p) => p.online).length} plugins online`,
      dynamic: false,
    },
    {
      id: 'security',
      label: 'Security',
      metric: securityMetric,
      status: securityMetric > 80 ? 'online' : 'warn',
      role: 'policy',
      hint: 'loopback + credentials',
      dynamic: false,
    },
    {
      id: 'analytics',
      label: 'Data Analytics',
      metric: Math.min(100, 50 + sessions.count * 6),
      status: 'online',
      role: 'workspace',
      hint: sessions.activeCwd ? 'workspace bound' : 'no cwd',
      dynamic: false,
    },
    {
      id: 'user-hub',
      label: 'User Hub',
      metric: Math.min(100, 55 + Math.min(sessions.count, 5) * 9),
      status: 'online',
      role: 'profile',
      hint: 'desktop profile',
      dynamic: false,
    },
    {
      id: 'runtime',
      label: 'Runtime',
      metric: memPct,
      status: memPct > 85 ? 'warn' : 'online',
      role: 'host',
      hint: `${Math.round(mem.heapUsed / 1024 / 1024)}MB heap`,
      dynamic: false,
    },
  ]

  if (hindsight.available) {
    nodes.push({
      id: 'memory',
      label: 'Memory Bank',
      metric: hindsight.metric,
      status: hindsight.daemon ? 'online' : 'idle',
      role: 'memory',
      hint: hindsight.daemon ? 'Hindsight :9077' : 'daemon offline',
      dynamic: false,
    })
  }

  return nodes
}

function appendDynamicPluginNodes(nodes, plugins, config, synapseDefs) {
  if (!config.dynamic_plugins) return { nodes, synapseDefs }
  const existing = new Set(nodes.map((n) => n.id))
  const out = [...nodes]
  const extraSynapses = [...synapseDefs]
  const seen = new Set(extraSynapses.map(([a, b]) => `${a}->${b}`))
  let colorIdx = 0
  for (const p of plugins) {
    if (!p.installed || p.status === 'missing') continue
    if (PLUGIN_TO_CORE[p.id]) continue
    const nodeId = `plugin-${p.id}`
    if (existing.has(nodeId)) continue
    const color = PLUGIN_COLORS[colorIdx % PLUGIN_COLORS.length]
    colorIdx += 1
    NODE_ZH[nodeId] = p.title
    out.push({
      id: nodeId,
      label: p.titleEn || p.title,
      metric: p.online ? 78 : 42,
      status: p.online ? 'online' : 'idle',
      role: 'plugin',
      hint: p.online ? p.dep : (p.howToEnable || p.hint || p.dep),
      howToEnable: p.online ? null : p.howToEnable,
      dynamic: true,
      pluginId: p.id,
      color,
    })
    existing.add(nodeId)
    const link = [nodeId, 'core']
    const key = `${link[0]}->${link[1]}`
    if (!seen.has(key)) {
      extraSynapses.push(link)
      seen.add(key)
    }
  }
  return { nodes: out, synapseDefs: extraSynapses }
}

function buildSocial({ sessions, plugins, taskBoard, events, mailbox, hub }) {
  const market = plugins.find((p) => p.id === 'market')
  const ssh = plugins.find((p) => p.id === 'ssh')
  const remote = plugins.find((p) => p.id === 'remote-web-ui')
  const community = plugins.find((p) => p.id === 'community-plugins')

  const presence = (sessions.items || []).map((s, i) => ({
    id: s.id,
    label: s.cwd ? s.cwd.split(/[/\\]/).pop() : `会话 #${s.seq ?? i + 1}`,
    cwd: s.cwd,
    active: s.id === sessions.activeId || i === 0,
    seq: s.seq,
  }))

  const channels = [
    {
      id: 'market',
      title: '插件市场',
      subtitle: '浏览与安装社区插件',
      installed: market?.installed,
      online: market?.online,
      icon: 'market',
    },
    {
      id: 'community-plugins',
      title: '社区索引',
      subtitle: '社区插件目录',
      installed: community?.installed,
      online: community?.online,
      icon: 'community',
    },
    {
      id: 'ssh',
      title: 'SSH 远程',
      subtitle: '连接其他机器',
      installed: ssh?.installed,
      online: ssh?.online,
      icon: 'ssh',
    },
    {
      id: 'remote-web-ui',
      title: '移动端远程',
      subtitle: '手机控制本机 DSH',
      installed: remote?.installed,
      online: remote?.online,
      icon: 'remote',
    },
    {
      id: 'task-collab',
      title: '任务协作',
      subtitle: taskBoard.available
        ? `${taskBoard.running} 运行 · ${taskBoard.queued} 排队`
        : 'task-board 离线',
      installed: taskBoard.available,
      online: taskBoard.running > 0,
      icon: 'tasks',
    },
  ]

  const feed = []
  for (const p of presence) {
    feed.push({
      id: `presence-${p.id}`,
      kind: 'presence',
      title: p.active ? '当前会话' : '并行会话',
      detail: p.cwd || p.label,
      ts: Date.now() - (p.active ? 0 : 60000),
    })
  }
  for (const t of (taskBoard.tasks || []).slice(0, 4)) {
    feed.push({
      id: `social-task-${t.id}`,
      kind: 'task',
      title: t.title,
      detail: t.running ? '任务进行中' : (t.status || '等待'),
      ts: t.updatedAt || Date.now(),
    })
  }
  for (const ev of events.slice(0, 8)) {
    feed.push({ ...ev, kind: ev.kind || 'system' })
  }
  for (const m of (mailbox || []).filter((x) => x.direction === 'in').slice(0, 6)) {
    feed.push({
      id: m.id,
      kind: 'message',
      title: m.toLabel || '消息',
      detail: m.body,
      ts: m.ts,
      unread: !m.read,
    })
  }
  if (hub && hub.notifications && hub.notifications.available) {
    for (const n of (hub.notifications.notifications || []).slice(0, 6)) {
      feed.push({
        id: `notif-feed-${n.id}`,
        kind: 'notification',
        title: n.title || '通知',
        detail: n.body,
        ts: n.ts || Date.now(),
        unread: true,
        notifId: n.id,
      })
    }
  }
  if (hub && hub.pair && hub.pair.paired) {
    feed.push({
      id: 'pair-connected',
      kind: 'remote',
      title: '跨机通道已配对',
      detail: `${hub.pair.onlineCount || hub.pair.deviceCount || 1} 台设备在线`,
      ts: Date.now(),
    })
  }
  feed.sort((a, b) => (b.ts || 0) - (a.ts || 0))

  const stats = mailboxStats(mailbox || [])

  return {
    tagline: 'DSH 全屏指挥舱 · 聚合会话、插件、任务、拓扑与消息',
    presenceCount: presence.length,
    channelCount: channels.filter((c) => c.installed).length,
    presence,
    channels,
    feed: feed.slice(0, 14),
    mailbox: stats,
  }
}

function appendSessionSocialNodes(nodes, sessions, synapseDefs) {
  if (!sessions.items || sessions.items.length === 0) return { nodes, synapseDefs }
  const out = [...nodes]
  const extra = [...synapseDefs]
  const seen = new Set(extra.map(([a, b]) => `${a}->${b}`))
  NODE_ZH['session-active'] = '当前会话'
  const active = sessions.items[0]
  if (active) {
    out.push({
      id: 'session-active',
      label: 'Active Session',
      metric: Math.min(100, 50 + sessions.count * 12),
      status: 'online',
      role: 'social',
      hint: active.cwd || active.id,
      dynamic: true,
      social: true,
      sessionId: active.id,
    })
    for (const pair of [['user-hub', 'session-active'], ['session-active', 'ai-engine']]) {
      const key = `${pair[0]}->${pair[1]}`
      if (!seen.has(key)) { extra.push(pair); seen.add(key) }
    }
  }
  return { nodes: out, synapseDefs: extra }
}

async function readBody(req) {
  let body = ''
  for await (const chunk of req) body += chunk
  return body
}

function mailboxFile(home) {
  return join(home, 'open-world', 'mailbox.json')
}

function outboxDir(home, config) {
  const rel = (config.messaging && config.messaging.outbox_dir) || 'open-world/outbox'
  return join(home, rel)
}

function loadMailbox(home, limit = MAX_MAILBOX) {
  const data = readJson(mailboxFile(home))
  const list = data && Array.isArray(data.messages) ? data.messages : []
  return list.slice(0, limit)
}

function saveMailbox(home, messages, config) {
  const max = (config.messaging && config.messaging.max_messages) || MAX_MAILBOX
  const dir = join(home, 'open-world')
  mkdirSync(dir, { recursive: true })
  writeFileSync(mailboxFile(home), JSON.stringify({ messages: messages.slice(0, max) }, null, 2))
}

function mailboxStats(messages) {
  const unread = messages.filter((m) => !m.read).length
  const outbox = messages.filter((m) => m.direction === 'out').length
  const inbox = messages.filter((m) => m.direction === 'in').length
  return { total: messages.length, unread, outbox, inbox }
}

function buildMessagePayload(input, snapshot) {
  const payload = input.payload && typeof input.payload === 'object' ? { ...input.payload } : {}
  if (input.attachSnapshot && snapshot) payload.topology = createSharePayload(snapshot)
  if (Array.isArray(input.attachments)) payload.attachments = input.attachments
  if (input.attachMemory) payload.memory = input.attachMemory
  if (input.attachArchify) payload.archify = input.attachArchify
  return Object.keys(payload).length > 0 ? payload : null
}

function createSharePayload(snapshot) {
  return {
    product: 'NEXORA-OPEN-WORLD',
    version: snapshot.version,
    capturedAt: snapshot.capturedAt,
    health: snapshot.core && snapshot.core.healthScore,
    nodes: (snapshot.nodes || []).map((n) => ({
      id: n.id, label: n.label, metric: n.metric, status: n.status,
    })),
    synapses: (snapshot.synapses || []).slice(0, 24),
    ati: snapshot.ati,
  }
}

function writeOutboxPackage(home, config, entry) {
  const dir = outboxDir(home, config)
  mkdirSync(dir, { recursive: true })
  const space = mergeSpaceConfig(config.space)
  const tok = loadSpaceToken(home, space) || (space.enabled ? ensureSpaceToken(home, space) : null)
  if (space.enabled && space.seal_outbox !== false && tok && tok.token) {
    const sealed = sealJson(tok.token, entry)
    const file = join(dir, `${entry.id}.sealed.json`)
    writeFileSync(file, JSON.stringify({
      ...sealed,
      meta: {
        id: entry.id,
        ts: entry.ts,
        to: entry.to,
        kind: entry.kind,
        sealed: true,
        protocol: SPACE_PROTOCOL,
      },
    }, null, 2))
    return file
  }
  const file = join(dir, `${entry.id}.json`)
  writeFileSync(file, JSON.stringify(entry, null, 2))
  return file
}

function sendMailboxMessage(home, config, input, snapshot) {
  const messaging = config.messaging || {}
  if (messaging.enabled === false) {
    return { ok: false, error: 'messaging-disabled' }
  }
  const to = input.to || 'broadcast'
  const body = String(input.body || '').trim()
  if (!body) return { ok: false, error: 'empty-body' }

  const toLabels = {
    broadcast: '全体广播',
    sessions: '全部会话',
    agent: 'AI 对话',
    clipboard: '剪贴板分享',
    external: '外发文件包',
    remote: '跨机远程',
  }
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    ts: Date.now(),
    direction: 'out',
    from: 'open-world',
    to,
    toLabel: toLabels[to] || to,
    body,
    kind: input.kind || 'message',
    read: true,
    payload: buildMessagePayload(input, snapshot),
  }
  const space = mergeSpaceConfig(config.space)
  if (space.enabled) {
    const tok = loadSpaceToken(home, space) || ensureSpaceToken(home, space)
    if (tok && tok.token) entry.sig = signMailboxEntry(tok.token, entry)
  }

  const messages = loadMailbox(home)
  messages.unshift(entry)

  if (to === 'broadcast' || to === 'sessions' || to === 'remote') {
    if (!messaging.allow_broadcast && to !== 'remote') return { ok: false, error: 'broadcast-disabled' }
    const inbound = {
      ...entry,
      id: `${entry.id}-in`,
      direction: 'in',
      read: false,
      ts: Date.now() + 1,
    }
    messages.unshift(inbound)
    pushEvent('message', `广播 · ${body.slice(0, 40)}`, to)
  } else {
    pushEvent('message', `发送 → ${entry.toLabel}`, body.slice(0, 60))
  }

  saveMailbox(home, messages, config)

  let outboxFile = null
  if (to === 'external' || to === 'remote') {
    outboxFile = writeOutboxPackage(home, config, entry)
  }

  return { ok: true, message: entry, outboxFile, share: entry.payload }
}

function markMessagesRead(home, config, ids) {
  const messages = loadMailbox(home)
  const set = new Set(ids || [])
  let changed = 0
  for (const m of messages) {
    if ((set.size === 0 || set.has(m.id)) && m.direction === 'in' && !m.read) {
      m.read = true
      changed += 1
    }
  }
  if (changed > 0) saveMailbox(home, messages, config)
  return changed
}

function loadIdeaPresetsBundle() {
  return readJson(join(PLUGIN_DIR, 'idea-presets.json')) || {
    overview: {},
    presets: [],
    treatSuggestions: [],
  }
}

function scanDshAgentPresets(home) {
  const root = join(home, '.agent-presets')
  if (!existsSync(root)) return []
  const out = []
  for (const name of readdirSync(root)) {
    const dir = join(root, name)
    try {
      if (!statSync(dir).isDirectory()) continue
      if (!existsSync(join(dir, 'preset.yml'))) continue
      const preset = readText(join(dir, 'preset.yml'))
      const titleMatch = preset.match(/^name:\s*(.+)$/m)
      const descMatch = preset.match(/^description:\s*(.+)$/m)
      out.push({
        id: `dsh-${name}`,
        title: titleMatch ? titleMatch[1].trim() : name,
        sub: 'DSH Agent 预设',
        dshPreset: name,
        treatHint: '',
        instruction: descMatch
          ? `${descMatch[1].trim()}（真切换预设请到 DSH 设置 → Agent 预设选择「${name}」）`
          : `请采用 DSH Agent 预设「${name}」的行为风格。真切换请到设置里选该预设。`,
      })
    } catch { /* skip */ }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
}

function buildIdeaLab(home, config) {
  const bundle = loadIdeaPresetsBundle()
  const enabled = !config.idea || config.idea.enabled !== false
  return {
    enabled,
    overview: bundle.overview || {},
    treatSuggestions: bundle.treatSuggestions || ['主人', '初学者', '架构师'],
    presets: [...(bundle.presets || []), ...scanDshAgentPresets(home)],
  }
}

function wrapIdeaPrompt(ideaLab, presetId, body, treatAs) {
  const preset = (ideaLab.presets || []).find((p) => p.id === presetId)
  if (!preset) return { ok: false, error: 'unknown-preset' }
  const userBody = String(body || '').trim()
  if (!userBody) return { ok: false, error: 'empty-body' }
  const treat = String(treatAs || preset.treatHint || '').trim()
  const lines = [
    `[IDEA Lab · ${preset.title}${preset.sub ? ` · ${preset.sub}` : ''}]`,
    `人格指令：${preset.instruction}`,
  ]
  if (treat) lines.push(`Treat me like：把对话对象当作「${treat}」。`)
  lines.push('', '---', '', userBody)
  return {
    ok: true,
    preset,
    wrapped: lines.join('\n'),
    treatAs: treat,
    body: userBody,
  }
}

function readClientBuildMeta() {
  try {
    const src = readFileSync(join(PLUGIN_DIR, 'client.js'), 'utf8')
    const m = src.match(/^\/\/ CLIENT_BUILD (\S+) (\S+) (\S+)/m)
    if (!m) return { clientBuild: null, clientBuiltAt: null, clientVer: null }
    return { clientBuild: m[1], clientBuiltAt: m[2], clientVer: m[3] }
  } catch {
    return { clientBuild: null, clientBuiltAt: null, clientVer: null }
  }
}

function frameworkVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(PLUGIN_DIR, 'package.json'), 'utf8'))
    const m = String(pkg.version).match(/^(\d+\.\d+)/)
    return m ? m[1] : String(pkg.version)
  } catch {
    return '2.46'
  }
}

function buildFramework(config) {
  const space = mergeSpaceConfig(config.space)
  const clientMeta = readClientBuildMeta()
  return {
    name: 'Open World ATI Framework',
    version: frameworkVersion(),
    protocol: space.enabled ? SPACE_PROTOCOL : 'owip/0.1',
    snapshotSchema: SNAPSHOT_SCHEMA_VERSION,
    clientBuild: clientMeta.clientBuild,
    clientBuiltAt: clientMeta.clientBuiltAt,
    clientVer: clientMeta.clientVer,
    actionLayers: actionLayersSummary(),
    pillars: ['topology', 'ml', 'dl', 'chemistry', 'ati-evolution', 'organs', 'messaging', 'social', 'integrations', 'idea', 'actions', 'rrm', 'space', 'fleet'],
    views: ['ati', 'idea', 'topology', 'monitor'],
    messaging: config.messaging,
    integrations: config.integrations,
    idea: config.idea,
    space: {
      enabled: !!space.enabled,
      require_token_for_lan: !!space.require_token_for_lan,
      seal_outbox: space.seal_outbox !== false,
      sync: space.sync !== false,
    },
    motto: '拓扑成骨 · 梯度成血 · 注意力成神经 · 化学键成身体 · 万物终将接入 ATI',
  }
}

function clampNum(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function buildTopologyLab({ sessions, taskBoard, plugins, hindsight }) {
  const spin = Math.floor(Date.now() / 24000) % TOPOLOGY_CATALOG.length
  const active = TOPOLOGY_CATALOG[spin]
  const onlinePlugins = plugins.filter((p) => p.online).length
  const curvature = clampNum(1.42 - taskBoard.running * 0.09 - onlinePlugins * 0.03, -0.62, 1.42)
  return {
    source: 'metaphor',
    active: active.id,
    activeLabel: active.label,
    activeZh: active.zh,
    curvature: Math.round(curvature * 100) / 100,
    betti: active.betti,
    eulerCharacteristic: active.euler,
    genus: active.genus,
    orientable: active.orientable,
    catalog: TOPOLOGY_CATALOG,
    homologyGroups: ['H₀ ≅ ℤ', `H₁ ≅ ℤ${active.betti[1] > 1 ? `²` : active.betti[1] ? '' : '=0'}`, `H₂ ≅ ${active.betti[2] ? 'ℤ' : '0'}`],
    persistentBarcode: [0, hindsight.daemon ? 3 : 1, sessions.count, onlinePlugins].sort((a, b) => a - b),
    note: active.orientable ? '可定向流形 · 三角剖分封闭' : '不可定向流形 · 需 4 维空间嵌入',
  }
}

function buildMlLab({ sessions, taskBoard, plugins, hindsight }) {
  const onlinePlugins = plugins.filter((p) => p.online).length
  const activity = sessions.count + taskBoard.running * 2.5 + taskBoard.queued * 0.8 + taskBoard.done * 0.04 + (hindsight.daemon ? 2 : 0)
  const targetLoss = Math.max(0.02, 3.1 * Math.exp(-activity / 6))
  const phase = Date.now() / 9000
  const loss = Math.max(0.008, targetLoss + 0.045 * Math.sin(phase) + 0.022 * Math.sin(phase * 2.7))
  mlLossHistory.push(Math.round(loss * 1000) / 1000)
  if (mlLossHistory.length > 90) mlLossHistory.shift()
  const accuracy = Math.round(clampNum(94 + Math.log10(activity + 1) * 3.2 - loss * 1.1, 82, 99.7) * 10) / 10
  return {
    source: 'metaphor',
    objective: 'min L(θ) · 器官图分类',
    optimizer: 'AdamW',
    lr: Math.round((0.0018 - activity * 0.00008) * 100000) / 100000,
    epochs: Math.min(420, 28 + Math.floor(Date.now() / 60000) % 220),
    batchSize: 8 + sessions.count * 2,
    samples: 64 + taskBoard.total * 12 + onlinePlugins * 8,
    loss: Math.round(loss * 1000) / 1000,
    accuracy,
    gradientNorm: Math.round(clampNum(loss * 0.42 + taskBoard.running * 0.12, 0.01, 2.4) * 100) / 100,
    history: [...mlLossHistory],
    weightDecay: 0.01,
    schedule: 'cosine-warmup',
  }
}

function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function tokenizeText(text) {
  if (!text) return []
  const tokens = []
  const re = /[A-Za-z][A-Za-z0-9_-]{1,}|[\u4e00-\u9fff]|[0-9]+/g
  let m
  while ((m = re.exec(text)) && tokens.length < 64) {
    tokens.push(m[0])
  }
  return tokens
}

function collectTokenCorpus({ sessions, taskBoard, social, events, plugins, hub }) {
  const parts = []
  try {
    const list = (sessions && typeof sessions.list === 'function') ? sessions.list() : []
    for (const s of list.slice(0, 3)) {
      for (const key of ['getMessages', 'messages', 'conversation', 'readMessages']) {
        if (s && typeof s[key] === 'function') {
          try {
            const msgs = s[key]()
            if (Array.isArray(msgs)) {
              for (const msg of msgs.slice(-50)) {
                const c = msg && (msg.content || msg.text || (msg.message && msg.message.content))
                if (typeof c === 'string' && c.trim()) parts.push(c.slice(0, 240))
              }
            }
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }
  if (taskBoard && Array.isArray(taskBoard.tasks)) taskBoard.tasks.forEach((t) => t.title && parts.push(t.title))
  if (social && Array.isArray(social.feed)) social.feed.forEach((f) => f.title && parts.push(f.title))
  if (Array.isArray(events)) events.forEach((e) => e.title && parts.push(e.title))
  if (Array.isArray(plugins)) plugins.forEach((p) => p.title && parts.push(p.title))
  if (hub && hub.archify && Array.isArray(hub.archify.items)) hub.archify.items.forEach((d) => (d.title || d.name) && parts.push(d.title || d.name))
  if (parts.length === 0) {
    parts.push('NEXORA', 'Open World', 'ATI', 'DSH', 'Harness', '拓扑', '梯度', '注意力')
  }
  return parts.join(' ').slice(0, 2000)
}

function buildTokenAttention(tokens, t) {
  const n = Math.min(10, Math.max(2, tokens.length))
  const use = tokens.slice(0, n)
  const dim = 8
  const vecs = use.map((tok, i) => {
    const v = new Array(dim).fill(0)
    for (let d = 0; d < dim; d++) {
      const h = hashStr(tok + '|' + i + '|' + d)
      v[d] = (h % 1000) / 1000 * 2 - 1
    }
    return v
  })
  const rows = vecs.map((vi, i) => {
    const scores = vecs.map((vj, j) => {
      let dot = 0
      for (let d = 0; d < dim; d++) dot += vi[d] * vj[d]
      const bias = i === j ? 1.4 : 0
      const recency = (j > i) ? 0.04 * Math.exp(-(j - i) * 0.6) : 0
      return dot * 0.6 + bias + recency + 0.05 * Math.sin(t * 0.31 + i * 1.7 + j * 2.9)
    })
    const max = Math.max(...scores)
    const exps = scores.map((s) => Math.exp((s - max) * 1.6))
    const sum = exps.reduce((a, b) => a + b, 0)
    return { token: use[i], values: exps.map((e) => Math.round((e / sum) * 1000) / 1000) }
  })
  return rows
}

function buildDlLab({ sessions, taskBoard, plugins, nodes, corpusTokens }) {
  const onlinePlugins = plugins.filter((p) => p.online).length
  const t = Math.floor(Date.now() / 2500)
  let attention = null
  if (corpusTokens && corpusTokens.length > 1) {
    attention = buildTokenAttention(corpusTokens, t)
  }
  if (!attention) {
    const tokens = ['会话', '任务', '记忆', '网络', '插件', '安全']
    attention = tokens.map((token, i) => ({
      token,
      values: tokens.map((_, j) => {
        const base = i === j ? 0.72 : 0.08 + 0.55 * Math.exp(-Math.abs(i - j) * 0.75)
        const wave = 0.18 * Math.sin(t * 0.31 + i * 1.7 + j * 2.9)
        return Math.round(clampNum(base + wave, 0.02, 1) * 100) / 100
      }),
    }))
  }
  return {
    source: 'metaphor',
    stack: [
      { label: 'TOKENIZER', zh: '词元化', node: 'user-hub' },
      { label: 'EMBEDDING', zh: '嵌入层', node: 'network' },
      { label: 'ATTENTION', zh: '多头注意力', node: 'ai-engine' },
      { label: 'FFN', zh: '前馈网络', node: 'analytics' },
      { label: 'OPTIMIZER', zh: '梯度优化', node: 'task-board' },
      { label: 'OUTPUT', zh: 'ATI 输出头', node: 'core' },
    ],
    attention,
    tokenCount: corpusTokens ? corpusTokens.length : 6,
    heads: Math.min(16, 4 + sessions.count * 2),
    depth: 6 + Math.min(18, onlinePlugins),
    params: 320 + sessions.count * 120 + nodes.length * 40 + taskBoard.total * 8,
    temperature: Math.round((0.62 + 0.02 * sessions.count) * 100) / 100,
    dropout: Math.round((0.12 - Math.min(0.07, taskBoard.running * 0.01)) * 100) / 100,
    flashAttention: true,
    lossScale: Math.round(clampNum(1.8 - taskBoard.running * 0.1, 0.6, 1.8) * 100) / 100,
  }
}

function buildChemistryLab({ sessions, taskBoard, plugins, nodes }) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const onlinePlugins = plugins.filter((p) => p.online).length
  const elements = CHEM_ELEMENTS.map((el) => ({
    ...el,
    metric: byId[el.node] ? byId[el.node].metric : 0,
    status: byId[el.node] ? byId[el.node].status : 'offline',
  }))
  return {
    source: 'metaphor',
    elements,
    bonds: [['C', 'H'], ['C', 'O'], ['C', 'N'], ['O', 'P'], ['P', 'S'], ['Fe', 'N'], ['Mg', 'C'], ['C', 'C']],
    molecules: [
      { formula: 'C₆H₆', name: '苯环 · 记忆回环', note: '芳香性 ↔ 注意力回环' },
      { formula: 'C₁₀H₁₆N₅O₁₃P₃', name: 'ATP · 任务能量', note: '高能键 ↔ 运行中任务' },
      { formula: 'C₈H₁₁NO₂', name: '多巴胺 · 社交反馈', note: '奖励信号 ↔ 会话协作' },
      { formula: 'C₁₀H₁₂N₂O', name: '血清素 · 系统稳态', note: '稳态 ↔ 健康度' },
    ],
    freeEnergy: Math.round((-(18 + sessions.count * 2.4 + taskBoard.running * 3.2 + onlinePlugins * 1.1)) * 10) / 10,
    entropy: Math.round((14 + sessions.count * 3.1 + onlinePlugins * 1.6 + taskBoard.queued * 0.5) * 10) / 10,
    reactionRate: Math.round(clampNum(0.35 + taskBoard.running * 0.2 + sessions.count * 0.06, 0.1, 3.2) * 100) / 100,
    orbitalEnergy: Math.round((-(0.9 + taskBoard.running * 0.4 + sessions.count * 0.12)) * 100) / 100,
  }
}

function buildAtiEvolution({ health, sessions, taskBoard, plugins, hindsight }) {
  const onlinePlugins = plugins.filter((p) => p.online).length
  let readiness = 10 + health * 0.28
  readiness += sessions.count * 7
  readiness += onlinePlugins * 4
  if (taskBoard.available) readiness += 8
  readiness += taskBoard.running * 3
  readiness += hindsight.daemon ? 10 : (hindsight.available ? 5 : 0)
  readiness = Math.round(clampNum(readiness, 0, 100))
  let stageIndex = 0
  for (let i = 0; i < ATI_STAGES.length; i++) {
    if (readiness >= ATI_STAGES[i].threshold) stageIndex = i
  }
  const stage = ATI_STAGES[stageIndex]
  const next = ATI_STAGES[stageIndex + 1]
  const progress = next
    ? clampNum((readiness - stage.threshold) / (next.threshold - stage.threshold), 0, 1)
    : 1
  return {
    source: 'derived',
    readiness,
    stageIndex,
    stage: { ...stage },
    progress: Math.round(progress * 100) / 100,
    next: next ? { ...next } : null,
    stages: ATI_STAGES.map((s, i) => ({
      ...s,
      unlocked: i <= stageIndex,
      reached: readiness >= s.threshold,
    })),
    signature: `κ=${Math.round((health / 100) * 1.42 * 10) / 10} · ∇L=${Math.round(clampNum(taskBoard.running * 0.9, 0, 9) * 10) / 10} · heads=${Math.min(16, 4 + sessions.count * 2)}`,
  }
}

function buildAtiMetrics({ sessions, taskBoard, hindsight, health, nodes, evolution }) {
  const gradientNorm = Math.min(9.99, taskBoard.running * 1.2 + sessions.count * 0.35 + (taskBoard.queued * 0.15))
  return {
    source: 'derived',
    manifoldCurvature: Math.round((health / 100) * 1.42 * 100) / 100,
    gradientNorm: Math.round(gradientNorm * 100) / 100,
    molecularBonds: hindsight.daemon ? 6 : (hindsight.available ? 3 : 0),
    attentionHeads: Math.min(16, 4 + sessions.count * 2),
    bettiNumbers: evolution
      ? (evolution.stage && evolution.stage.id === 'dl' ? [1, 2, 1] : [1, hindsight.daemon ? 2 : 1, taskBoard.running > 0 ? 1 : 0])
      : [1, 1, 0],
    lossManifold: health,
    topologyGenus: evolution && evolution.stageIndex >= 3 ? 2 : 1,
    layerDepth: 6 + Math.min(18, sessions.count),
    activation: nodes.find((n) => n.id === 'ai-engine')?.metric ?? 0,
    atiReadiness: evolution ? evolution.readiness : 0,
    atiStage: evolution ? evolution.stage.zh : '拓扑胚',
  }
}

function healthScore(nodes) {
  if (nodes.length === 0) return 0
  const weights = { online: 1, busy: 0.95, idle: 0.7, warn: 0.5, offline: 0.2 }
  let sum = 0
  for (const n of nodes) {
    const w = weights[n.status] ?? 0.5
    sum += n.metric * w
  }
  return Math.round(sum / nodes.length)
}

let lastFingerprint = ''
let lastFingerprintParts = {}
let _lastChangedFields = []

/** 提交 fingerprint；返回变更字段。emitEvents=true 时写 events 时间轴（仅全量 snapshot 路径） */
function commitFingerprint(fingerprintParts, { emitEvents = false } = {}) {
  const fingerprint = JSON.stringify(fingerprintParts)
  const changedFields = []
  if (lastFingerprint !== '') {
    for (const [key, val] of Object.entries(fingerprintParts)) {
      if (lastFingerprintParts[key] !== val) changedFields.push(key)
    }
    if (emitEvents && changedFields.length > 0) {
      if (fingerprintParts.taskRunning > 0) {
        pushEvent('task', 'Task board activity', `${fingerprintParts.taskRunning} running`)
      }
      if (fingerprintParts.hindsightDaemon) {
        pushEvent('memory', 'Hindsight 在线', 'memory → ai-engine')
      }
      pushEvent('system', 'World snapshot updated', `${fingerprintParts.sessions} sessions`)
    }
  }
  lastFingerprint = fingerprint
  lastFingerprintParts = fingerprintParts
  _lastChangedFields = changedFields
  return changedFields
}

/** 轻量 fingerprint：有 SSE 客户端时主动探测，推 snapshot-delta，避免只靠全量轮询 */
async function probeWorldFingerprint(ctx) {
  const home = dshHome()
  const config = loadOpenWorldConfig(home)
  const sessions = sessionMetrics(ctx.sessions)
  const taskBoard = taskBoardMetrics(home)
  const rewind = collectRewindStats(home)
  const plugins = probePlugins(home, taskBoard, rewind)
  const hindsight = await hindsightMetrics(plugins)
  const mailboxFresh = loadMailbox(home, config.messaging?.max_messages || MAX_MAILBOX)
  return commitFingerprint({
    sessions: sessions.count,
    taskRunning: taskBoard.running,
    taskTotal: taskBoard.total,
    rewindSnapshots: rewind.snapshots,
    hindsightDaemon: hindsight.daemon,
    mailboxUnread: mailboxFresh.filter((m) => m.direction === 'in' && !m.read).length,
    pluginCount: plugins.filter((p) => p.online).length,
  }, { emitEvents: false })
}

function buildRrmReport(home, config, eventList) {
  const resolved = resolveRrmConfig(home, config.rrm)
  const rrm = resolved.rrm
  const activeMeta = { source: resolved.source, session: resolved.session }
  const list = Array.isArray(eventList) ? eventList : []
  const eventProj = reconcileEvents(list, home, rrm)
  const memory = slimMemoryForSnapshot(eventProj, rrm, activeMeta)
  attachNeuralStubToMemory(memory, config.rra)

  const mailboxMsgs = loadMailbox(home, config.messaging?.max_messages || MAX_MAILBOX)
  const mailboxProj = reconcileMailbox(home, mailboxMsgs, rrm)
  if (!mailboxProj.skipped) {
    memory.mailbox = {
      meta: mailboxProj.meta,
      falsify: mailboxProj.falsify,
      archive: mailboxProj.archiveStats,
      hint: formatMemoryHint(mailboxProj.meta).replace('记忆', '信箱'),
    }
  }

  const allTasks = loadTaskLedgerTasks(home)
  const taskProj = reconcileTasks(home, allTasks, rrm)
  if (!taskProj.skipped) {
    memory.tasks = {
      meta: taskProj.meta,
      falsify: taskProj.falsify,
      archive: taskProj.archiveStats,
      hint: formatMemoryHint(taskProj.meta).replace('记忆', '任务'),
      hotPinned: taskProj.meta.hotPinned,
    }
  }

  const compare = compareRrmAllChannels({
    events: list,
    mailbox: mailboxMsgs,
    tasks: allTasks,
  }, defaultCompareVariants(rrm))
  memory.compare = compare
  memory.archives = attachArchiveTails(home, rrm, summarizeArchives({
    events: memory.archive || readArchiveStats(home, rrm),
    mailbox: (memory.mailbox && memory.mailbox.archive)
      || mailboxProj.archiveStats
      || readArchiveStats(home, mailboxChannelConfig(rrm)),
    tasks: (memory.tasks && memory.tasks.archive)
      || taskProj.archiveStats
      || readArchiveStats(home, taskChannelConfig(rrm)),
  }), 5)

  return {
    memory,
    neural: memory.neuralStub || buildNeuralStub(config.rra),
    archive: {
      events: readArchiveStats(home, rrm),
      mailbox: mailboxProj.archiveStats || null,
      tasks: taskProj.archiveStats || null,
    },
    compare,
    resolved,
  }
}

async function buildSnapshot(ctx, pulseEdges = [], hostHeader) {
  const home = dshHome()
  const config = loadOpenWorldConfig(home)
  const world = loadWorldState(home)
  const sessions = sessionMetrics(ctx.sessions)
  const taskBoard = taskBoardMetrics(home)
  const rewind = collectRewindStats(home)
  const idea = buildIdeaLab(home, config)
  const rewindTimeline = buildRewindTimeline(home, sessions)
  const mem = process.memoryUsage()
  const plugins = probePlugins(home, taskBoard, rewind)
  const hindsight = await hindsightMetrics(plugins)
  const ventus = await ventusProgressMetrics(hostHeader, plugins)
  const fleet = buildFleetView({ sessions, taskBoard, ventus })
  const networkMetric = networkMetrics({ sessions, taskBoard, plugins })
  const securityMetric = securityMetrics(home)
  let nodes = buildNodes({
    sessions, taskBoard, rewind, mem, plugins, hindsight, networkMetric, securityMetric,
  })
  let synapseDefs = resolveSynapseDefs(config, world.synapses)
  const dynamic = appendDynamicPluginNodes(nodes, plugins, config, synapseDefs)
  nodes = dynamic.nodes
  synapseDefs = dynamic.synapseDefs
  const socialNodes = appendSessionSocialNodes(nodes, sessions, synapseDefs)
  nodes = socialNodes.nodes
  synapseDefs = socialNodes.synapseDefs
  nodes = enrichNodes(nodes, plugins)
  const synapses = buildSynapses(nodes, synapseDefs, pulseEdges)
  const neuralLayers = buildNeuralLayers(nodes, config)
  const uptimeSec = Math.round(process.uptime())
  const mailbox = loadMailbox(home, config.messaging?.max_messages || MAX_MAILBOX)
  const hub = await buildIntegrationsHub(hostHeader, home, plugins)
  if (hub.notifications.available) {
    syncNotificationsToMailbox(home, config, hub.notifications.notifications)
  }
  const mailboxFresh = loadMailbox(home, config.messaging?.max_messages || MAX_MAILBOX)
  const health = healthScore(nodes)
  const social = buildSocial({ sessions, plugins, taskBoard, events, mailbox: mailboxFresh, hub })
  const resolvedRrm = resolveRrmConfig(home, config.rrm)
  const rrm = resolvedRrm.rrm
  const activeMeta = { source: resolvedRrm.source, session: resolvedRrm.session }
  const rrmProjection = reconcileEvents(events, home, rrm)
  const memory = slimMemoryForSnapshot(rrmProjection, rrm, activeMeta)
  await attachNeuralStubToMemoryAsync(memory, config.rra)

  let mailboxLive = mailboxFresh
  const mailboxProjection = reconcileMailbox(home, mailboxFresh, rrm)
  if (!mailboxProjection.skipped) {
    mailboxLive = mailboxProjection.messages
    saveMailbox(home, mailboxLive, config)
    memory.mailbox = {
      meta: mailboxProjection.meta,
      falsify: mailboxProjection.falsify,
      archive: mailboxProjection.archiveStats,
      hint: formatMemoryHint(mailboxProjection.meta).replace('记忆', '信箱'),
    }
  }

  const taskProjection = reconcileTasks(home, taskBoard.allTasks || taskBoard.tasks || [], rrm)
  let taskBoardView = taskBoard
  if (!taskProjection.skipped) {
    taskBoardView = {
      ...taskBoard,
      tasks: taskProjection.tasks.slice(0, 12),
    }
    memory.tasks = {
      meta: taskProjection.meta,
      falsify: taskProjection.falsify,
      archive: taskProjection.archiveStats,
      hint: formatMemoryHint(taskProjection.meta).replace('记忆', '任务'),
      hotPinned: taskProjection.meta.hotPinned,
    }
  }
  delete taskBoardView.allTasks

  memory.compare = compareRrmAllChannels({
    events,
    mailbox: mailboxLive,
    tasks: taskBoard.allTasks || taskBoard.tasks || [],
  }, defaultCompareVariants(rrm))
  memory.archives = attachArchiveTails(home, rrm, summarizeArchives({
    events: memory.archive || readArchiveStats(home, rrm),
    mailbox: (memory.mailbox && memory.mailbox.archive)
      || mailboxProjection.archiveStats
      || readArchiveStats(home, mailboxChannelConfig(rrm)),
    tasks: (memory.tasks && memory.tasks.archive)
      || taskProjection.archiveStats
      || readArchiveStats(home, taskChannelConfig(rrm)),
  }), 5)

  const topology = buildTopologyLab({ sessions, taskBoard, plugins, hindsight })
  const ml = buildMlLab({ sessions, taskBoard, plugins, hindsight })
  const corpusTokens = tokenizeText(collectTokenCorpus({ sessions, taskBoard, social, events, plugins, hub }))
  const dl = buildDlLab({ sessions, taskBoard, plugins, nodes, corpusTokens })
  const chemistry = buildChemistryLab({ sessions, taskBoard, plugins, nodes })
  const evolution = buildAtiEvolution({ health, sessions, taskBoard, plugins, hindsight })

  commitFingerprint({
    sessions: sessions.count,
    taskRunning: taskBoard.running,
    taskTotal: taskBoard.total,
    rewindSnapshots: rewind.snapshots,
    hindsightDaemon: hindsight.daemon,
    mailboxUnread: mailboxLive.filter((m) => m.direction === 'in' && !m.read).length,
    pluginCount: plugins.filter((p) => p.online).length,
  }, { emitEvents: true })

  return {
    ok: true,
    product: 'NEXORA',
    version: SNAPSHOT_SCHEMA_VERSION,
    capturedAt: new Date().toISOString(),
    uptimeSec,
    config: {
      default_view: config.default_view,
      merge_synapses: config.merge_synapses,
      dynamic_plugins: config.dynamic_plugins,
      synapseCount: synapseDefs.length,
      messaging: config.messaging,
      integrations: config.integrations,
      idea: config.idea,
      rrm: {
        enabled: config.rrm?.enabled !== false,
        tau_ms: rrm.tau_ms,
        alpha: rrm.alpha,
        byte_budget: rrm.byte_budget,
        source: resolvedRrm.source,
      },
      rra: {
        probe: config.rra?.probe === true,
        sketch: config.rra?.sketch === true,
      },
    },
    framework: buildFramework(config),
    core: {
      healthScore: health,
      healthScoreSource: 'derived',
      sessionCount: sessions.count,
      activeSessionId: sessions.activeId,
      activeCwd: sessions.activeCwd,
    },
    load: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
      uptimeSec,
      taskRunning: taskBoard.running,
      taskQueued: taskBoard.queued,
    },
    integrations: {
      taskBoard: taskBoard.available,
      rewind: rewind.available,
      hindsight: hindsight.available,
      hindsightDaemon: hindsight.daemon,
      pair: hub.pair,
      notifications: {
        available: hub.notifications.available,
        unreadCount: hub.notifications.unreadCount,
      },
      archifyCount: hub.archify.count,
    },
    hub,
    plugins,
    synapses,
    neuralLayers,
    taskBoard: taskBoardView,
    rewind: {
      ...rewind,
      timeline: rewindTimeline,
    },
    idea,
    hindsight,
    lab: { topology, ml, dl, chemistry, evolution },
    ati: buildAtiMetrics({ sessions, taskBoard, hindsight, health, nodes, evolution }),
    social: buildSocial({ sessions, plugins, taskBoard: taskBoardView, events, mailbox: mailboxLive, hub }),
    mailbox: {
      messages: mailboxLive.slice(0, 40),
      ...mailboxStats(mailboxLive),
    },
    sessions,
    nodes,
    memory,
    world: worldStateForSnapshot(home),
    fleet,
    space: spaceStatus(home, config.space),
    events: events.slice(0, 16),
  }
}

/** OWIP Core Actions — Map<name, handler(parsed, env) => { status, body }> */
const CORE_ACTION_NAMES = new Set([
  'send-message', 'mark-read', 'share-snapshot', 'memory-search',
  'pair-issue', 'pair-stop', 'notification-ack-all', 'notification-publish',
  'idea-inject', 'idea-compare',
])

function buildActionRegistry() {
  const registry = new Map()

  registry.set('send-message', async (parsed, env) => {
    const snap = parsed.attachSnapshot
      ? await env.buildSnapshot(env.ctx, [], env.hostHeader)
      : null
    const result = sendMailboxMessage(env.home, env.config, parsed, snap)
    env.notifyStream(env.home)
    return { status: result.ok ? 200 : 400, body: result }
  })

  registry.set('memory-search', async (parsed, env) => {
    const result = await fetchHindsightSearch(env.home, parsed.query || parsed.q || '')
    return { status: 200, body: { ok: true, ...result } }
  })

  registry.set('pair-issue', async (parsed, env) => {
    const proxied = await proxyLocal(env.hostHeader, 'POST', '/api/pair/issue', {
      workspaceId: parsed.workspaceId,
      address: parsed.address,
    })
    return { status: proxied.ok ? 200 : 400, body: proxied.data || { ok: false } }
  })

  registry.set('pair-stop', async (_parsed, env) => {
    const proxied = await proxyLocal(env.hostHeader, 'POST', '/api/pair/stop')
    return { status: proxied.ok ? 200 : 400, body: proxied.data || { ok: false } }
  })

  registry.set('notification-ack-all', async (_parsed, env) => {
    const proxied = await proxyLocal(env.hostHeader, 'POST', '/api/notification-center/ack-all')
    return { status: proxied.ok ? 200 : 400, body: proxied.data || { ok: false } }
  })

  registry.set('notification-publish', async (parsed, env) => {
    const proxied = await proxyLocal(env.hostHeader, 'POST', '/api/notification-center/publish', {
      kind: parsed.kind || 'info',
      title: parsed.title || 'Open World',
      body: parsed.body || '',
      source: 'open-world',
    })
    return { status: proxied.ok ? 200 : 400, body: proxied.data || { ok: false } }
  })

  registry.set('mark-read', async (parsed, env) => {
    const changed = markMessagesRead(env.home, env.config, parsed.ids)
    env.notifyStream(env.home)
    return { status: 200, body: { ok: true, changed } }
  })

  registry.set('share-snapshot', async (parsed, env) => {
    const snap = await env.buildSnapshot(env.ctx, [], env.hostHeader)
    const result = sendMailboxMessage(env.home, env.config, {
      to: parsed.to || 'external',
      body: parsed.body || '拓扑快照分享',
      kind: 'topology-share',
      attachSnapshot: true,
    }, snap)
    env.notifyStream(env.home)
    return { status: 200, body: { ok: true, ...result, share: createSharePayload(snap) } }
  })

  registry.set('idea-wrap', async (parsed, env) => handleIdeaAction('idea-wrap', parsed, env))
  registry.set('idea-inject', async (parsed, env) => handleIdeaAction('idea-inject', parsed, env))
  registry.set('idea-compare', async (parsed, env) => handleIdeaAction('idea-compare', parsed, env))

  registry.set('world-state-save', async (parsed, env) => {
    const patch = parsed.state && typeof parsed.state === 'object' ? parsed.state : parsed
    const saved = saveWorldState(env.home, patch)
    if (typeof env.notifyStream === 'function') {
      try { env.notifyStream(env.home) } catch { /* ignore */ }
    }
    return { status: 200, body: { ok: true, world: saved } }
  })

  registry.set('world-state-get', async (_parsed, env) => {
    return { status: 200, body: { ok: true, world: loadWorldState(env.home) } }
  })

  registry.set('space-token-status', async (_parsed, env) => {
    return { status: 200, body: { ok: true, space: spaceStatus(env.home, env.config.space) } }
  })

  registry.set('space-token-issue', async (parsed, env) => {
    const reveal = parsed.reveal !== false
    const ttlHours = parsed.ttl_hours != null ? Number(parsed.ttl_hours) : undefined
    const opts = {
      label: parsed.label,
      ...(Number.isFinite(ttlHours) ? { ttl_hours: ttlHours } : {}),
    }
    const rotated = parsed.rotate
      ? rotateSpaceToken(env.home, env.config.space, opts)
      : ensureSpaceToken(env.home, env.config.space, opts)
    const status = spaceStatus(env.home, env.config.space)
    return {
      status: 200,
      body: {
        ok: true,
        space: status,
        token: reveal ? rotated.token : undefined,
        created: !!rotated.created,
        expiresAt: rotated.expiresAt,
        ttlHours: rotated.ttlHours,
        note: reveal ? '请妥善保存 token；status 接口不会再次回传明文；轮换/吊销可使旧 token 立即失效' : '未回传明文 token',
      },
    }
  })

  registry.set('space-token-revoke', async (_parsed, env) => {
    const result = revokeSpaceToken(env.home, env.config.space)
    return {
      status: 200,
      body: { ok: true, ...result, space: spaceStatus(env.home, env.config.space) },
    }
  })

  registry.set('rrm-session-apply', async (parsed, env) => {
    const result = saveRrmSessionOverride(env.home, {
      alpha: parsed.alpha,
      tau_ms: parsed.tau_ms,
      byte_budget: parsed.byte_budget,
    }, { label: parsed.label || 'session' })
    if (!result.ok) return { status: 400, body: result }
    const resolved = resolveRrmConfig(env.home, env.config.rrm)
    if (typeof env.pushEvent === 'function') {
      env.pushEvent('memory', 'RRM 会话覆盖已应用', result.session?.label || 'session')
    }
    if (typeof env.notifyStream === 'function') {
      try { env.notifyStream(env.home) } catch { /* ignore */ }
    }
    return {
      status: 200,
      body: {
        ok: true,
        session: result.session,
        active: {
          tau_ms: resolved.rrm.tau_ms,
          alpha: resolved.rrm.alpha,
          byte_budget: resolved.rrm.byte_budget,
          source: resolved.source,
        },
        note: '仅会话覆盖 · 未改 open-world.yml',
      },
    }
  })

  registry.set('rrm-session-clear', async (_parsed, env) => {
    const result = saveRrmSessionOverride(env.home, null)
    const resolved = resolveRrmConfig(env.home, env.config.rrm)
    if (typeof env.pushEvent === 'function') {
      env.pushEvent('memory', 'RRM 会话覆盖已清除', '恢复 yml')
    }
    if (typeof env.notifyStream === 'function') {
      try { env.notifyStream(env.home) } catch { /* ignore */ }
    }
    return {
      status: 200,
      body: {
        ok: true,
        cleared: true,
        active: {
          tau_ms: resolved.rrm.tau_ms,
          alpha: resolved.rrm.alpha,
          byte_budget: resolved.rrm.byte_budget,
          source: resolved.source,
        },
        note: '已恢复 open-world.yml 基线',
      },
    }
  })

  return registry
}

async function handleIdeaAction(actionName, parsed, env) {
  const ideaLab = buildIdeaLab(env.home, env.config)
  if (!ideaLab.enabled) {
    return { status: 400, body: { ok: false, error: 'idea-disabled' } }
  }

  if (actionName === 'idea-compare') {
    const ids = Array.isArray(parsed.presetIds) && parsed.presetIds.length
      ? parsed.presetIds
      : (ideaLab.presets || []).slice(0, 3).map((p) => p.id)
    const body = parsed.body || ''
    const treatAs = parsed.treatAs || ''
    const variants = ids.map((id) => {
      const w = wrapIdeaPrompt(ideaLab, id, body, treatAs)
      return w.ok
        ? { presetId: id, title: w.preset.title, wrapped: w.wrapped }
        : { presetId: id, error: w.error }
    })
    const compareBody = variants.filter((v) => v.wrapped).map((v, i) => (
      `### 人格 ${i + 1} · ${v.title}\n\n${v.wrapped}`
    )).join('\n\n---\n\n')
    if (compareBody) {
      sendMailboxMessage(env.home, env.config, {
        to: 'broadcast',
        body: `[IDEA 对比]\n\n${compareBody}`,
        kind: 'idea-compare',
      }, null)
      env.notifyStream(env.home)
      env.pushEvent('idea', 'IDEA 人格对比', `${variants.filter((v) => v.wrapped).length} 种口吻`)
    }
    return { status: 200, body: { ok: true, variants, compareBody } }
  }

  const wrapped = wrapIdeaPrompt(ideaLab, parsed.presetId, parsed.body, parsed.treatAs)
  if (!wrapped.ok) {
    return { status: 400, body: wrapped }
  }
  if (actionName === 'idea-inject' && parsed.logMailbox !== false) {
    sendMailboxMessage(env.home, env.config, {
      to: 'agent',
      body: wrapped.wrapped,
      kind: 'idea-inject',
      idea: { presetId: parsed.presetId, treatAs: wrapped.treatAs },
    }, null)
    env.notifyStream(env.home)
    env.pushEvent('idea', `IDEA · ${wrapped.preset.title}`, wrapped.treatAs || '注入对话')
  }
  return { status: 200, body: wrapped }
}

const ACTION_REGISTRY = buildActionRegistry()

async function dispatchOpenWorldAction(actionName, parsed, env) {
  const handler = ACTION_REGISTRY.get(actionName)
  if (!handler) {
    return { status: 400, body: { ok: false, error: 'unknown-action' } }
  }
  return handler(parsed, env)
}

export async function apply(ctx) {
  let pulseEdges = []
  /** @type {Set<{ res: import('node:http').ServerResponse, role: string }>} */
  const streamClients = new Set()

  function writeStream(payloadObj) {
    const payload = `data: ${JSON.stringify(payloadObj)}\n\n`
    for (const client of streamClients) {
      try { client.res.write(payload) } catch { streamClients.delete(client) }
    }
  }

  function writeStreamTo(clients, payloadObj) {
    const payload = `data: ${JSON.stringify(payloadObj)}\n\n`
    for (const client of clients) {
      try { client.res.write(payload) } catch { streamClients.delete(client) }
    }
  }

  function notifyStream(home) {
    const msgs = loadMailbox(home)
    const stats = mailboxStats(msgs)
    writeStream({ type: 'mailbox', ...stats })
  }

  function notifyStreamDelta(changedFields) {
    if (!changedFields || !changedFields.length) return
    writeStream({ type: 'snapshot-delta', changed: changedFields })
  }

  async function pushSecondScreenSync(hostHeader = '127.0.0.1') {
    const targets = [...streamClients].filter((c) => c.role === 'second-screen')
    if (!targets.length) return
    const home = dshHome()
    const config = loadOpenWorldConfig(home)
    if (mergeSpaceConfig(config.space).sync === false) return
    try {
      const snap = await buildSnapshot(ctx, [], hostHeader)
      const payload = buildSecondScreenPayload(snap, spaceStatus(home, config.space))
      writeStreamTo(targets, { type: 'second-screen', ...payload })
    } catch { /* ignore */ }
  }

  // 有 SSE 订阅时主动探测 fingerprint → snapshot-delta（不依赖客户端全量轮询）
  const FINGERPRINT_WATCH_MS = 4000
  setInterval(async () => {
    if (streamClients.size === 0) return
    try {
      const changed = await probeWorldFingerprint(ctx)
      notifyStreamDelta(changed)
      if (changed && changed.length) await pushSecondScreenSync()
    } catch { /* ignore */ }
  }, FINGERPRINT_WATCH_MS)

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (req, res) => {
      const home = dshHome()
      const config = loadOpenWorldConfig(home)
      const auth = authorizeSpaceRequest(req, home, config.space)
      if (!auth.ok) {
        sendJson(res, auth.status || 403, { ok: false, error: auth.error || 'forbidden' })
        return
      }
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      const sub = url.pathname.slice(API_PREFIX.length) || '/'
      const hostHeader = req.headers.host || '127.0.0.1'

      if (sub === '/snapshot' || sub === '/snapshot/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const data = await buildSnapshot(ctx, pulseEdges, hostHeader)
        pulseEdges = []
        // SSE delta 推送
        if (_lastChangedFields.length > 0) {
          notifyStreamDelta(_lastChangedFields)
        }
        sendJson(res, 200, data)
        return
      }

      if (sub === '/integrations' || sub === '/integrations/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const plugins = probePlugins(home, taskBoardMetrics(home), countRewindSnapshots(home))
        const hub = await buildIntegrationsHub(hostHeader, home, plugins)
        sendJson(res, 200, { ok: true, hub })
        return
      }

      if (sub.startsWith('/rewind/timeline')) {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const sessions = sessionMetrics(ctx.sessions)
        const timeline = buildRewindTimeline(home, sessions)
        const stats = collectRewindStats(home)
        sendJson(res, 200, { ok: true, stats, ...timeline })
        return
      }

      if (sub.startsWith('/memory/search')) {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const q = url.searchParams.get('q') || url.searchParams.get('query') || ''
        const result = await fetchHindsightSearch(home, q)
        sendJson(res, 200, { ok: true, ...result })
        return
      }

      if (sub.startsWith('/archify/')) {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const name = decodeURIComponent(sub.slice('/archify/'.length))
        const file = resolveArchifyFile(home, name)
        if (!file) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('not found')
          return
        }
        const html = readText(file) || '<!DOCTYPE html><html><body>empty</body></html>'
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(html)
        return
      }

      if (sub === '/messages' || sub === '/messages/') {
        if (req.method === 'GET') {
          const unreadOnly = url.searchParams.get('unread') === '1'
          let messages = loadMailbox(home, config.messaging?.max_messages || MAX_MAILBOX)
          if (unreadOnly) messages = messages.filter((m) => m.direction === 'in' && !m.read)
          sendJson(res, 200, { ok: true, messages, ...mailboxStats(messages) })
          return
        }
        sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
        return
      }

      if (sub === '/world-state' || sub === '/world-state/') {
        if (req.method === 'GET') {
          sendJson(res, 200, { ok: true, world: loadWorldState(home) })
          return
        }
        if (req.method === 'PUT' || req.method === 'POST') {
          let parsed = {}
          try { parsed = JSON.parse(await readBody(req) || '{}') } catch { /* ignore */ }
          const patch = parsed.world && typeof parsed.world === 'object' ? parsed.world : parsed
          const saved = saveWorldState(home, patch)
          try { notifyStream(home) } catch { /* ignore */ }
          sendJson(res, 200, { ok: true, world: saved })
          return
        }
        sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
        return
      }

      if (sub === '/space' || sub === '/space/' || sub === '/space/status' || sub === '/space/status/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        if (mergeSpaceConfig(config.space).enabled) ensureSpaceToken(home, config.space)
        sendJson(res, 200, { ok: true, space: spaceStatus(home, config.space), auth: { via: auth.via, loopback: auth.loopback } })
        return
      }

      if (sub === '/space/view' || sub === '/space/view/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const htmlPath = join(PLUGIN_DIR, 'bridge', 'space-view.html')
        const html = readText(htmlPath)
        if (!html) {
          sendJson(res, 404, { ok: false, error: 'space-view-missing' })
          return
        }
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        })
        res.end(html)
        return
      }

      if (sub === '/space/second-screen' || sub === '/space/second-screen/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const snap = await buildSnapshot(ctx, [], hostHeader)
        sendJson(res, 200, buildSecondScreenPayload(snap, spaceStatus(home, config.space)))
        return
      }

      if (sub === '/action' || sub === '/action/') {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        let parsed = {}
        try { parsed = JSON.parse(await readBody(req) || '{}') } catch { /* ignore */ }
        const action = parsed.action || parsed.kind
        const actionEnv = {
          home,
          config,
          ctx,
          hostHeader,
          buildSnapshot,
          notifyStream,
          pushEvent,
        }
        const result = await dispatchOpenWorldAction(action, parsed, actionEnv)
        sendJson(res, result.status, result.body)
        return
      }

      if (sub === '/pulse' || sub === '/pulse/') {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        let body = ''
        for await (const chunk of req) body += chunk
        try {
          const parsed = JSON.parse(body || '{}')
          if (Array.isArray(parsed.edges)) {
            pulseEdges = parsed.edges.filter((e) => typeof e === 'string')
          }
        } catch { /* ignore */ }
        sendJson(res, 200, { ok: true, queued: pulseEdges.length })
        return
      }

      if (sub === '/stream' || sub === '/stream/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const role = url.searchParams.get('role') === 'second-screen' ? 'second-screen' : 'shell'
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        })
        const client = { res, role }
        streamClients.add(client)
        const stats = mailboxStats(loadMailbox(home))
        const hello = { type: 'hello', role, protocol: SPACE_PROTOCOL, ...stats }
        if (role === 'second-screen' && mergeSpaceConfig(config.space).sync !== false) {
          try {
            const snap = await buildSnapshot(ctx, [], hostHeader)
            hello.secondScreen = buildSecondScreenPayload(snap, spaceStatus(home, config.space))
          } catch { /* ignore */ }
        }
        res.write(`data: ${JSON.stringify(hello)}\n\n`)
        req.on('close', () => { streamClients.delete(client) })
        return
      }

      if (sub === '/events' || sub === '/events/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        sendJson(res, 200, { ok: true, events })
        return
      }

      if (sub === '/memory/archives' || sub === '/memory/archives/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const homeArch = dshHome()
        const configArch = loadOpenWorldConfig(homeArch)
        const q = url.searchParams.get('q') || url.searchParams.get('query') || ''
        const per = Number(url.searchParams.get('limit') || 5)
        const found = searchLocalArchives(homeArch, configArch.rrm, q, { perChannel: per })
        sendJson(res, 200, { ok: true, ...found })
        return
      }

      if (sub === '/rra' || sub === '/rra/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const homeRra = dshHome()
        const configRra = loadOpenWorldConfig(homeRra)
        const wantProbe = url.searchParams.get('probe') === '1' || configRra.rra?.probe === true
        const wantSketch = url.searchParams.get('sketch') === '1' || configRra.rra?.sketch === true
        const stub = wantProbe
          ? buildNeuralStub({ probe: true, sketch: wantSketch }, { deepResult: await probeRraProtoDeep() })
          : buildNeuralStub({ probe: false, sketch: wantSketch })
        sendJson(res, 200, {
          ok: true,
          neural: false,
          implemented: false,
          stub,
          config: {
            probe: configRra.rra?.probe === true,
            sketch: configRra.rra?.sketch === true,
          },
          note: 'L5/M4 probe+optional sketch · never enables full neural path',
        })
        return
      }

      if (sub === '/memory' || sub === '/memory/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const homeMem = dshHome()
        const configMem = loadOpenWorldConfig(homeMem)
        const report = buildRrmReport(homeMem, configMem, events)
        sendJson(res, 200, { ok: true, ...report })
        return
      }

      if (sub === '/memory/compare' || sub === '/memory/compare/') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const homeCmp = dshHome()
        const configCmp = loadOpenWorldConfig(homeCmp)
        const resolved = resolveRrmConfig(homeCmp, configCmp.rrm)
        const rrm = resolved.rrm
        const mailboxCmp = loadMailbox(homeCmp, configCmp.messaging?.max_messages || MAX_MAILBOX)
        const tasksCmp = loadTaskLedgerTasks(homeCmp)
        const compare = compareRrmAllChannels({
          events,
          mailbox: mailboxCmp,
          tasks: tasksCmp,
        }, defaultCompareVariants(rrm))
        sendJson(res, 200, { ok: true, compare, active: {
          tau_ms: rrm.tau_ms,
          alpha: rrm.alpha,
          byte_budget: rrm.byte_budget,
          source: resolved.source,
          session: resolved.session,
        }, note: compare.note })
        return
      }

      sendJson(res, 404, { ok: false, error: 'not-found' })
    },
  }), 'dsh-open-world: routes')

  pushEvent('system', 'Open World v2.46 online', `${SPACE_PROTOCOL} · RRA L5 probe-only adapter (neural still off)`)
  try {
    const homeBoot = dshHome()
    const cfgBoot = loadOpenWorldConfig(homeBoot)
    if (mergeSpaceConfig(cfgBoot.space).enabled) ensureSpaceToken(homeBoot, cfgBoot.space)
  } catch { /* ignore */ }
}

export const __test = {
  parseOpenWorldConfig,
  buildSnapshot,
  buildIdeaLab,
  buildFramework,
  readClientBuildMeta,
  frameworkVersion,
  wrapIdeaPrompt,
  sendMailboxMessage,
  markMessagesRead,
  dispatchOpenWorldAction,
  ACTION_REGISTRY,
  CORE_ACTION_NAMES,
  loadOpenWorldConfig,
  scanOpenWorldManifests,
  commitFingerprint,
  probeWorldFingerprint,
  mergePluginResults,
  scanManifestEntry,
  howToEnableHint,
  PLUGIN_CATALOG,
  NODE_ACTIONS,
  SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_SCHEMA_NOTES,
  classifyAction,
  actionLayersSummary,
  HOST_ACTION_IDS,
  BRIDGE_ACTION_TYPES,
  taskBoardMetrics,
  projectLiveMemory,
  mergeRrmConfig,
  formatMemoryHint,
  describeNeuralRra,
  assertShellDoesNotClaimNeural,
  defaultRraConfig,
  mergeRraConfig,
  buildNeuralStub,
  probeRraProtoSync,
  tryApplyRraSketch,
  attachNeuralStubToMemory,
  defaultRrmConfig,
  reconcileMailbox,
  projectMailboxMemory,
  reconcileTasks,
  projectTaskMemory,
  compareRrmParams,
  defaultCompareVariants,
  compareRrmAllChannels,
  summarizeArchives,
  attachArchiveTails,
  searchLocalArchives,
  buildRrmReport,
  resolveRrmConfig,
  saveRrmSessionOverride,
  loadRrmSessionOverride,
  tierLabel,
  loadWorldState,
  saveWorldState,
  normalizeWorldState,
  defaultWorldState,
  worldStatePath,
  worldStateForSnapshot,
  buildFleetView,
  emptyFleetView,
  authorizeSpaceRequest,
  ensureSpaceToken,
  rotateSpaceToken,
  spaceStatus,
  sealJson,
  signMailboxEntry,
  mergeSpaceConfig,
  defaultSpaceConfig,
  buildSecondScreenPayload,
  revokeSpaceToken,
}
