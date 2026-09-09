/**
 * Open World ↔ Desktop 插件能力注册表（契约真源）
 * featureId = plugins.yml key · insertId = cordis insert · packageName = dep
 * owSurfaces = 壳内表面 id · embedIds = setEmbed 面板名 · defaultInPresets = presets.yml
 */
import { howToEnableHint } from './manifest.mjs'
import { worldPackByPanel } from './world-packs.mjs'

export const CAPABILITY_REGISTRY = Object.freeze([
  {
    featureId: 'dsh-open-world',
    insertId: 'dsh-open-world',
    packageName: 'dsh-open-world',
    title: '开放世界',
    probe: 'openWorld',
    owSurfaces: ['shell', 'hub', 'space'],
    hostActions: ['*'],
    embedIds: ['sidebar'],
    defaultInPresets: ['bridge', 'full'],
    satellite: true,
  },
  {
    featureId: 'web-ui-rewind',
    insertId: 'dsh-rewind-plugin',
    packageName: 'dsh-rewind-plugin',
    title: '对话回退',
    probe: 'rewind',
    owSurfaces: ['rewind', 'timeline'],
    hostActions: [],
    embedIds: ['rewind'],
    defaultInPresets: ['daily', 'bridge', 'full'],
    satellite: true,
  },
  {
    featureId: 'web-ui-task-board',
    insertId: 'web-ui-task-board',
    packageName: '@linxin666/dsh-client-ui-task-board',
    title: '任务看板',
    probe: 'taskBoard',
    owSurfaces: ['tasks'],
    hostActions: [],
    embedIds: ['task-board'],
    defaultInPresets: ['bridge', 'full'],
    satellite: true,
  },
  {
    featureId: 'apiproxy-compat',
    insertId: 'api-proxy',
    packageName: 'dsh-apiproxy-compat',
    title: 'ApiProxy 兼容层',
    probe: null,
    owSurfaces: [],
    hostActions: [],
    embedIds: [],
    defaultInPresets: ['bridge', 'full'],
    satellite: true,
  },
  {
    featureId: 'web-ui-remote-web-ui',
    insertId: 'web-ui-remote-web-ui',
    packageName: '@linxin666/dsh-remote-web-ui',
    title: '移动端远程 Pair',
    probe: 'remoteWebUi',
    owSurfaces: ['pair', 'remote'],
    hostActions: ['pair-issue', 'pair-stop'],
    embedIds: ['remote'],
    defaultInPresets: [], // 默认关；枢纽诚实显示未安装/未启用
    satellite: true,
  },
  {
    featureId: 'ventus-progress',
    insertId: 'dsh-ventus-progress',
    packageName: 'dsh-ventus-progress',
    title: '子代理进度',
    probe: 'ventusProgress',
    owSurfaces: ['fleet'],
    hostActions: [],
    embedIds: ['fleet'],
    defaultInPresets: ['daily', 'bridge', 'full'],
    satellite: true,
  },
  {
    featureId: 'hindsight',
    insertId: 'hindsight',
    packageName: '@vectorize-io/hindsight-coding-agents',
    title: 'Hindsight 记忆',
    probe: 'hindsight',
    owSurfaces: ['memory'],
    hostActions: ['memory-search'],
    embedIds: ['memory'],
    defaultInPresets: [], // 9077 不通时勿默认开
    satellite: true,
  },
  {
    featureId: 'web-ui-live-stats',
    insertId: 'web-ui-live-stats',
    packageName: '@linxin666/dsh-live-stats',
    title: '实时状态',
    probe: 'liveStats',
    owSurfaces: ['fleet'],
    hostActions: [],
    embedIds: ['fleet'],
    defaultInPresets: ['bridge', 'full'],
    satellite: false,
  },
  {
    // WORLD_PLAN 阶段4 · 后置接口；永不进 presets；无真实包前不可 embed
    featureId: 'ow-world-pack-all-in-all',
    insertId: null,
    packageName: 'dsh-open-world-pack-all-in-all',
    title: 'ALL-IN-ALL 世界包',
    probe: null,
    owSurfaces: ['metaverse'],
    hostActions: [],
    embedIds: ['all-in-all'],
    defaultInPresets: [],
    satellite: false,
    worldPack: true,
  },
])

/** embed 面板 → 负责探测的 plugin catalog id（与 PLUGIN_CATALOG.id 对齐） */
export const EMBED_PLUGIN_ID = Object.freeze({
  rewind: 'rewind',
  'task-board': 'task-board',
  remote: 'remote-web-ui',
  memory: 'hindsight',
  fleet: 'live-stats',
  market: 'market',
  ssh: 'ssh',
  analytics: 'workspace-analyzer',
  sidebar: 'open-world',
})

export function capabilityByFeatureId(featureId) {
  return CAPABILITY_REGISTRY.find((c) => c.featureId === featureId) || null
}

export function capabilityByPackage(packageName) {
  return CAPABILITY_REGISTRY.find((c) => c.packageName === packageName) || null
}

export function satelliteFeatureIds() {
  return CAPABILITY_REGISTRY.filter((c) => c.satellite).map((c) => c.featureId)
}

export function capabilitiesForPreset(presetName) {
  const name = String(presetName || '')
  return CAPABILITY_REGISTRY.filter((c) => (c.defaultInPresets || []).includes(name))
}

/**
 * setEmbed / 快捷操作前探测：离线则返回 howToEnable，禁止空壳嵌入。
 * @param {string} panel embed id
 * @param {Array} plugins probePlugins 结果
 * @returns {{ ok:boolean, panel:string, plugin?:object, howToEnable?:string }}
 */
export function resolveEmbedGate(panel, plugins = []) {
  const id = String(panel || '')
  // 壳内自有面：不依赖外部插件
  if (!id || id === 'monitor' || id === 'fleet' || id === 'sidebar') {
    return { ok: true, panel: id }
  }
  // 后置世界包：阶段4无真实包，禁止空壳 embed（不看 plugins 空列表放行）
  const pack = worldPackByPanel(id)
  if (pack) {
    return {
      ok: false,
      panel: id,
      howToEnable: `后置世界包「${pack.title}」仅接口预留 · 默认关 · 不可空壳进入`,
    }
  }
  const pluginId = EMBED_PLUGIN_ID[id]
  if (!pluginId) return { ok: true, panel: id }
  const list = plugins || []
  // 无探测上下文时不拦（测试 / 早启动）；仅当明确 offline 才拒绝
  if (list.length === 0) return { ok: true, panel: id }
  const plug = list.find((p) => p.id === pluginId)
  if (!plug) return { ok: true, panel: id }
  if (plug.online) return { ok: true, panel: id, plugin: plug }
  const cap = CAPABILITY_REGISTRY.find((c) => (c.embedIds || []).includes(id))
  const hint = (plug && plug.howToEnable)
    || howToEnableHint(cap && cap.featureId, (plug && plug.title) || (cap && cap.title) || id)
  return { ok: false, panel: id, plugin: plug || null, howToEnable: hint }
}

/** 合并进 mergePluginResults 行：补 insertId / defaultInPresets */
export function enrichPluginWithRegistry(row) {
  if (!row) return row
  const byFeature = row.featureId && capabilityByFeatureId(row.featureId)
  const byPkg = !byFeature && row.dep && capabilityByPackage(row.dep)
  const cap = byFeature || byPkg
  if (!cap) return row
  return {
    ...row,
    insertId: row.insertId || cap.insertId,
    defaultInPresets: cap.defaultInPresets || [],
    satellite: !!cap.satellite,
    owSurfaces: cap.owSurfaces || [],
  }
}
