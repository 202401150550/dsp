/**
 * Optional world packs（WORLD_PLAN 阶段 4 · 后置）
 * 与主航道 WORLD_DEFS 分家：不进 60% 世界地图；默认全关；无真实包时不可 enter。
 */
export const WORLD_PACK_DEFS = Object.freeze([
  {
    id: 'all-in-all',
    title: '元宇宙',
    titleFull: 'ALL-IN-ALL 世界包',
    panel: 'all-in-all',
    featureId: 'ow-world-pack-all-in-all',
    packageName: 'dsh-open-world-pack-all-in-all',
    priority: 90,
    cta: '进入 · 元宇宙',
    defaultAction: '后置接口 · 未装包',
    defaultEnabled: false,
  },
])

export function defaultWorldsConfig() {
  const packs = {}
  for (const p of WORLD_PACK_DEFS) packs[p.id] = false
  return { packs }
}

export function mergeWorldsConfig(raw) {
  const base = defaultWorldsConfig()
  const incoming = (raw && raw.packs && typeof raw.packs === 'object') ? raw.packs : {}
  const packs = { ...base.packs }
  for (const [k, v] of Object.entries(incoming)) {
    packs[k] = v === true
  }
  return { packs }
}

export function worldPackById(id) {
  return WORLD_PACK_DEFS.find((p) => p.id === id) || null
}

export function worldPackByPanel(panel) {
  return WORLD_PACK_DEFS.find((p) => p.panel === panel) || null
}

export function isWorldPackOptedIn(config, packId) {
  const worlds = mergeWorldsConfig(config && config.worlds)
  return worlds.packs[packId] === true
}

/**
 * 世界包进场门禁：阶段 4 一律不可进（即使 yml 选开，也须真实包落地后再放行）。
 * @returns {{ applies:boolean, ok?:boolean, pack?:object, howToEnable?:string }}
 */
export function resolveWorldPackGate(panelOrId, config) {
  const pack = worldPackByPanel(panelOrId) || worldPackById(panelOrId)
  if (!pack) return { applies: false }
  const opted = isWorldPackOptedIn(config, pack.id)
  if (!opted) {
    return {
      applies: true,
      ok: false,
      pack,
      howToEnable: `后置世界包默认关闭 · open-world.yml → worlds.packs.${pack.id}: true（仍需安装真实包）`,
    }
  }
  return {
    applies: true,
    ok: false,
    pack,
    howToEnable: `${pack.titleFull} 已在配置中选开，但本机尚未安装世界包（接口预留 · 不可空壳进入）`,
  }
}

/** 快照块：轻量、可测；source=reserved */
export function buildWorldPacksSnapshot(config) {
  const worlds = mergeWorldsConfig(config && config.worlds)
  const packs = WORLD_PACK_DEFS.map((p) => {
    const gate = resolveWorldPackGate(p.id, { worlds })
    return {
      id: p.id,
      title: p.title,
      titleFull: p.titleFull,
      panel: p.panel,
      featureId: p.featureId,
      optedIn: worlds.packs[p.id] === true,
      enterable: false,
      defaultInPath: false,
      howToEnable: gate.howToEnable,
      source: 'reserved',
    }
  })
  return {
    source: 'reserved',
    schema: 1,
    defaultInPath: false,
    enabled: packs.some((p) => p.optedIn),
    packs,
  }
}

/** shell 瘦身：不拖冷启、不进主文案 */
export function slimWorldPacksForShell(full) {
  if (!full) return { source: 'reserved', defaultInPath: false, enabled: false, count: 0 }
  return {
    source: 'reserved',
    defaultInPath: false,
    enabled: !!full.enabled,
    count: Array.isArray(full.packs) ? full.packs.length : 0,
  }
}
