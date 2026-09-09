/**
 * Optional world packs（WORLD_PLAN 阶段 4 · 后置）
 * 与主航道 WORLD_DEFS 分家：不进默认 60% 地图；默认全关。
 * opt-in 后可进「诚实占位」世界（说明未装真实包），禁止假空壳 ATI。
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
    defaultAction: '查看占位说明（未装真实包）',
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
 * 世界包进场门禁。
 * - 未 opt-in：不可进
 * - 已 opt-in：可进诚实占位（mode=placeholder）；真实包落地前不装素材
 * @returns {{ applies:boolean, ok?:boolean, mode?:string, pack?:object, howToEnable?:string }}
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
      howToEnable: `后置世界包默认关闭 · open-world.yml → worlds.packs.${pack.id}: true（可进诚实占位，仍无真实素材）`,
    }
  }
  return {
    applies: true,
    ok: true,
    mode: 'placeholder',
    pack,
    howToEnable: null,
  }
}

/** 快照块：轻量、可测；source=reserved */
export function buildWorldPacksSnapshot(config) {
  const worlds = mergeWorldsConfig(config && config.worlds)
  const packs = WORLD_PACK_DEFS.map((p) => {
    const gate = resolveWorldPackGate(p.id, { worlds })
    const optedIn = worlds.packs[p.id] === true
    return {
      id: p.id,
      title: p.title,
      titleFull: p.titleFull,
      panel: p.panel,
      featureId: p.featureId,
      cta: p.cta,
      defaultAction: p.defaultAction,
      optedIn,
      enterable: !!gate.ok,
      mode: gate.mode || null,
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

/**
 * shell 瘦身：默认不带 packs 载荷；仅当有 opt-in 时附带可进占位条目（不拖冷启）
 */
export function slimWorldPacksForShell(full) {
  if (!full) return { source: 'reserved', defaultInPath: false, enabled: false, count: 0 }
  const opted = (full.packs || []).filter((p) => p && p.optedIn)
  const base = {
    source: 'reserved',
    defaultInPath: false,
    enabled: !!full.enabled,
    count: Array.isArray(full.packs) ? full.packs.length : 0,
  }
  if (!opted.length) return base
  return {
    ...base,
    packs: opted.map((p) => ({
      id: p.id,
      title: p.title,
      titleFull: p.titleFull,
      panel: p.panel,
      cta: p.cta,
      enterable: !!p.enterable,
      mode: p.mode || 'placeholder',
      defaultInPath: false,
      howToEnable: p.howToEnable || null,
    })),
  }
}
