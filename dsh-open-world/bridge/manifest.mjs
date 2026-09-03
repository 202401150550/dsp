/**
 * Host：合并 PLUGIN_CATALOG 与 dsh.plugin.json → openWorld 声明。
 */

export function scanManifestEntry(manifest, pkgName, pkgDir) {
  if (!manifest?.openWorld) return null
  const ow = manifest.openWorld
  const node = ow.node || ow.organ || {}
  return {
    packageName: pkgName,
    dir: pkgDir,
    node: {
      id: node.id || node.nodeId || pkgName.replace(/^@[^/]+\//, '').replace(/\//g, '-'),
      label: node.label || node.title || pkgName,
      labelEn: node.labelEn || node.titleEn || pkgName,
      probe: node.probe || null,
      dynamic: node.dynamic === true,
    },
    actions: Array.isArray(ow.actions) ? ow.actions : [],
    subscribe: ow.subscribe || {},
  }
}

/** Honest enable tip aligned with dsh-desktop-toggle/plugins.yml feature ids. */
export function howToEnableHint(featureId, title) {
  if (!featureId) {
    return `${title || '该驱动'}未启用 · 检查 desktop profile 依赖后重启 Desktop`
  }
  return `${title || featureId}未启用 · 在 plugins.yml 将 ${featureId}: enabled 设为 true，运行 apply.cmd 后重启 Desktop`
}

/**
 * @param {object} opts
 * @param {Array} opts.catalog - PLUGIN_CATALOG rows
 * @param {object} opts.probes - probe name → boolean
 * @param {Set<string>} opts.deps - profile dependency names
 * @param {Array} opts.manifests - scanManifestEntry results
 */
export function mergePluginResults({ catalog, probes, deps, manifests = [] }) {
  const results = catalog.map((p) => {
    const installed = deps.has(p.dep)
    const online = probes[p.probe] === true
    const featureId = p.featureId || null
    const howToEnable = online ? null : howToEnableHint(featureId, p.title)
    return {
      id: p.id,
      title: p.title,
      titleEn: p.titleEn,
      dep: p.dep,
      featureId,
      installed,
      online,
      status: online ? 'online' : (installed ? 'idle' : 'missing'),
      enabled: installed,
      howToEnable,
      hint: online
        ? (p.titleEn || p.title)
        : (installed
          ? `${p.title}已装但探测未就绪`
          : howToEnable),
      source: 'catalog',
    }
  })

  const knownIds = new Set(results.map((r) => r.id))
  const knownDeps = new Set(results.map((r) => r.dep))

  for (const m of manifests) {
    if (!m?.node?.id) continue
    const depName = m.packageName
    const nodeId = m.node.id

    const catalogIdx = results.findIndex((r) => r.id === nodeId || r.dep === depName)
    if (catalogIdx >= 0) {
      const row = results[catalogIdx]
      if (m.node.label && !row.title) row.title = m.node.label
      if (m.node.labelEn) row.titleEn = m.node.labelEn
      if (m.actions?.length) row.manifestActions = m.actions
      row.manifest = true
      continue
    }

    if (knownIds.has(nodeId)) continue
    knownIds.add(nodeId)
    const installed = deps.has(depName)
    const probeOnline = m.node.probe && probes[m.node.probe] === true
    const online = probeOnline || (installed && m.node.probe == null)
    results.push({
      id: nodeId,
      title: m.node.label || depName,
      titleEn: m.node.labelEn || depName,
      dep: depName,
      featureId: null,
      installed,
      online,
      status: online ? 'online' : (installed ? 'idle' : 'missing'),
      enabled: installed,
      howToEnable: online ? null : howToEnableHint(null, m.node.label || depName),
      hint: online ? (m.node.labelEn || m.node.label) : howToEnableHint(null, m.node.label || depName),
      dynamic: m.node.dynamic !== false,
      manifestActions: m.actions || [],
      source: 'manifest',
    })
    knownDeps.add(depName)
  }

  return results
}

/**
 * 将 manifest 声明的 bridge action 转为 Client Bridge 可执行形状（浅映射）。
 */
export function manifestActionToBridge(action) {
  if (!action || typeof action !== 'object') return null
  return { ...action }
}
