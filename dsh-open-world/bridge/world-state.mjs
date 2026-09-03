/**
 * Open World · 世界布局存档（阶段 B）
 * 落盘：~/.dsh/open-world/world-state.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const WORLD_STATE_VERSION = 1
export const WORLD_STATE_REL = 'open-world/world-state.json'

const WM_MODES = new Set(['fullscreen', 'split', 'float', 'minimized'])
const LEFT_TABS = new Set(['status', 'actions', 'events'])

export function defaultWorldState() {
  return {
    version: WORLD_STATE_VERSION,
    updatedAt: null,
    shell: {
      wmMode: 'split',
      floatPos: null,
      open: false,
    },
    ui: {
      leftTab: 'status',
      view: 'ati',
      selected: 'core',
      atiPreset: 'ati-unified',
      deepSpace: true,
      embed: null,
      detailOpen: true,
    },
    synapses: [],
    pulseEdges: [],
  }
}

export function worldStatePath(home) {
  return join(home, WORLD_STATE_REL)
}

function clampFloatPos(pos) {
  if (!pos || typeof pos !== 'object') return null
  const left = Number(pos.left)
  const top = Number(pos.top)
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null
  return { left: Math.round(left), top: Math.round(top) }
}

function sanitizeSynapses(list) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const row of list.slice(0, 64)) {
    if (Array.isArray(row) && row.length >= 2) {
      const a = String(row[0] || '').trim()
      const b = String(row[1] || '').trim()
      if (a && b) out.push([a, b])
    } else if (row && typeof row === 'object' && row.from && row.to) {
      out.push([String(row.from), String(row.to)])
    }
  }
  return out
}

function sanitizePulseEdges(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter((e) => typeof e === 'string' && e.includes('->'))
    .map((e) => e.trim())
    .slice(0, 48)
}

/** 合并 patch 到基线，做字段校验 */
export function normalizeWorldState(input, base = defaultWorldState()) {
  const src = input && typeof input === 'object' ? input : {}
  const shellIn = src.shell && typeof src.shell === 'object' ? src.shell : src
  const uiIn = src.ui && typeof src.ui === 'object' ? src.ui : src

  const wmModeRaw = shellIn.wmMode || src.wmMode || base.shell.wmMode
  const wmMode = WM_MODES.has(wmModeRaw) ? wmModeRaw : base.shell.wmMode

  const leftTabRaw = uiIn.leftTab || src.leftTab || base.ui.leftTab
  const leftTab = LEFT_TABS.has(leftTabRaw) ? leftTabRaw : base.ui.leftTab

  let view = String(uiIn.view || src.view || base.ui.view || 'ati').slice(0, 48)
  if (view === 'manifold3d' || view === 'neural' || view === 'galaxy') view = 'ati'

  return {
    version: WORLD_STATE_VERSION,
    updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt : base.updatedAt,
    shell: {
      wmMode,
      floatPos: clampFloatPos(shellIn.floatPos ?? src.floatPos ?? base.shell.floatPos),
      open: !!(shellIn.open ?? src.open ?? base.shell.open),
    },
    ui: {
      leftTab,
      view,
      selected: String(uiIn.selected || src.selected || base.ui.selected || 'core').slice(0, 64),
      atiPreset: String(uiIn.atiPreset || src.atiPreset || base.ui.atiPreset || 'ati-unified').slice(0, 64),
      deepSpace: uiIn.deepSpace != null ? !!uiIn.deepSpace : (src.deepSpace != null ? !!src.deepSpace : base.ui.deepSpace),
      embed: uiIn.embed != null ? uiIn.embed : (src.embed !== undefined ? src.embed : base.ui.embed),
      detailOpen: uiIn.detailOpen != null ? !!uiIn.detailOpen : (src.detailOpen != null ? !!src.detailOpen : base.ui.detailOpen),
    },
    synapses: sanitizeSynapses(src.synapses ?? base.synapses),
    pulseEdges: sanitizePulseEdges(src.pulseEdges ?? base.pulseEdges),
  }
}

export function loadWorldState(home) {
  const file = worldStatePath(home)
  if (!existsSync(file)) return defaultWorldState()
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    return normalizeWorldState(raw)
  } catch {
    return defaultWorldState()
  }
}

export function saveWorldState(home, patch) {
  const prev = loadWorldState(home)
  const p = patch && typeof patch === 'object' ? patch : {}
  const shellPatch = p.shell && typeof p.shell === 'object' ? p.shell : {}
  const uiPatch = p.ui && typeof p.ui === 'object' ? p.ui : {}

  const merged = {
    version: WORLD_STATE_VERSION,
    updatedAt: prev.updatedAt,
    shell: {
      ...prev.shell,
      ...shellPatch,
      ...(p.wmMode != null ? { wmMode: p.wmMode } : {}),
      ...(p.floatPos !== undefined ? { floatPos: p.floatPos } : {}),
      ...(p.open != null ? { open: p.open } : {}),
    },
    ui: {
      ...prev.ui,
      ...uiPatch,
      ...(p.leftTab != null ? { leftTab: p.leftTab } : {}),
      ...(p.view != null ? { view: p.view } : {}),
      ...(p.selected != null ? { selected: p.selected } : {}),
      ...(p.atiPreset != null ? { atiPreset: p.atiPreset } : {}),
      ...(p.deepSpace != null ? { deepSpace: p.deepSpace } : {}),
      ...(p.embed !== undefined ? { embed: p.embed } : {}),
      ...(p.detailOpen != null ? { detailOpen: p.detailOpen } : {}),
    },
    synapses: p.synapses !== undefined ? p.synapses : prev.synapses,
    pulseEdges: p.pulseEdges !== undefined ? p.pulseEdges : prev.pulseEdges,
  }

  const next = normalizeWorldState(merged)
  next.updatedAt = new Date().toISOString()
  const file = worldStatePath(home)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function worldStateForSnapshot(home) {
  const state = loadWorldState(home)
  return {
    version: state.version,
    updatedAt: state.updatedAt,
    shell: state.shell,
    ui: state.ui,
    synapses: state.synapses,
    pulseEdges: state.pulseEdges,
    path: WORLD_STATE_REL,
  }
}
