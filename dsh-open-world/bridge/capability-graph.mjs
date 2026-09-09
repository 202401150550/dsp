/**
 * CapabilityGraph · L0 稳定核（derived，可单测）
 * 节点 = 可进入世界 / 能力；边权 = online 与默认优先级；不冒充 ML。
 */
import { CAPABILITY_REGISTRY, EMBED_PLUGIN_ID, resolveEmbedGate } from './capability-registry.mjs'

/** 主航道可进入世界（阶段 1–2）；meta 后置不进此表 */
export const WORLD_DEFS = Object.freeze([
  {
    id: 'tasks',
    title: '任务',
    titleFull: '任务世界',
    panel: 'task-board',
    featureId: 'web-ui-task-board',
    pluginId: 'task-board',
    priority: 1, // 越小越优先（60% 默认）
    cta: '进入 · 任务',
    defaultAction: '看队列或新建一条',
  },
  {
    id: 'rewind',
    title: '回退',
    titleFull: '回退世界',
    panel: 'rewind',
    featureId: 'web-ui-rewind',
    pluginId: 'rewind',
    priority: 2,
    cta: '进入 · 回退',
    defaultAction: '打开时间轴',
  },
])

/** 离线惩罚（图论边权加法）；online 为 0 */
export const OFFLINE_COST = 1000

/**
 * 进场代价：priority +（offline ? OFFLINE_COST : 0）
 * source=derived · 公式稳定可测
 */
export function enterCost(worldDef, online) {
  const base = Number(worldDef?.priority) || 99
  return online ? base : base + OFFLINE_COST
}

export function worldDefById(id) {
  return WORLD_DEFS.find((w) => w.id === id) || null
}

export function worldDefByPanel(panel) {
  return WORLD_DEFS.find((w) => w.panel === panel) || null
}

/**
 * @param {Array} plugins probe 结果
 * @returns {{
 *   source: 'derived',
 *   nodes: Array,
 *   edges: Array,
 *   defaultWorldId: string|null,
 *   default: object|null,
 * }}
 */
export function buildCapabilityGraph(plugins = []) {
  const list = plugins || []
  const nodes = WORLD_DEFS.map((w) => {
    const plug = list.find((p) => p.id === w.pluginId)
    const online = !!(plug && plug.online)
    const gate = resolveEmbedGate(w.panel, list)
    const cost = enterCost(w, online)
    return {
      id: w.id,
      title: w.title,
      titleFull: w.titleFull,
      panel: w.panel,
      featureId: w.featureId,
      pluginId: w.pluginId,
      online,
      enterable: gate.ok && online,
      cost,
      cta: w.cta,
      defaultAction: w.defaultAction,
      howToEnable: gate.ok ? null : (gate.howToEnable || (plug && plug.howToEnable) || null),
      source: 'derived',
    }
  })

  // 壳 → 各世界的星型边（简单拓扑；后续可加世界间边）
  const edges = nodes.map((n) => ({
    from: 'shell',
    to: n.id,
    weight: n.cost,
    kind: 'enter',
    source: 'derived',
  }))

  const enterable = nodes.filter((n) => n.enterable).sort((a, b) => a.cost - b.cost)
  const defaultNode = enterable[0] || null

  return {
    source: 'derived',
    schema: 1,
    shellId: 'shell',
    nodes,
    edges,
    defaultWorldId: defaultNode ? defaultNode.id : null,
    default: defaultNode,
    registrySize: CAPABILITY_REGISTRY.length,
    embedMapSize: Object.keys(EMBED_PLUGIN_ID).length,
  }
}

/** 选默认世界：最低代价且 enterable；无人可进则仍返回 tasks 占位（UI 展示如何启用） */
export function pickDefaultWorld(graph) {
  if (graph && graph.default) return graph.default
  const tasks = (graph && graph.nodes || []).find((n) => n.id === 'tasks')
  return tasks || null
}
