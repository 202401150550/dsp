/**
 * P2-2b：统一影响摘要。
 * 旧调用方继续读 `impact` 行数组；新调用方读 `impact_summary`。
 */
export function emptyImpactSummary() {
  return {
    paths: [],
    network: false,
    config_keys: [],
    snapshot: null,
    rows: [],
  }
}

function asPath(value) {
  if (value == null) return null
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean)
  const s = String(value).trim()
  return s ? [s] : []
}

/**
 * @param {string} tool
 * @param {object} args
 * @param {Array<{path?:string,from?:unknown,to?:unknown}>} rows
 * @param {object} [extra]
 */
export function buildImpactSummary(tool, args = {}, rows = [], extra = {}) {
  const summary = emptyImpactSummary()
  summary.rows = Array.isArray(rows) ? rows.slice() : []

  const pathSet = new Set()
  for (const row of summary.rows) {
    for (const p of asPath(row && row.path) || []) pathSet.add(p)
  }
  for (const p of asPath(args.path) || []) pathSet.add(p)
  for (const p of asPath(args.files) || []) pathSet.add(p)
  if (args.cwd) pathSet.add(String(args.cwd))
  summary.paths = [...pathSet]

  if (tool === 'shell.run' || tool === 'dsh.restart' || tool === 'ssh' || tool === 'remote-web-ui') {
    summary.network = /curl|wget|http|ssh|scp|fetch/i.test(JSON.stringify(args.argv || args))
      || tool === 'dsh.restart'
  }
  if (tool === 'doctor.fix' || tool === 'baseline.save' || tool === 'vision.wizard.apply') {
    summary.config_keys = tool === 'vision.wizard.apply'
      ? ['describe-image.baseURL', 'describe-image.model', 'describe-image.apiKeyEnv', 'describe-image.apiStyle']
      : tool === 'doctor.fix'
        ? ['profile/.dsh-market/hot-*.yml']
        : ['dsp/dsh-doctor/baselines/current']
  }

  if (extra && typeof extra === 'object') {
    if (extra.will_snapshot != null || extra.snapshot_id || extra.callId || extra.snapshot_path) {
      summary.snapshot = {
        will_snapshot: extra.will_snapshot === true,
        callId: extra.callId || null,
        snapshot_id: extra.snapshot_id || null,
        snapshot_path: extra.snapshot_path || null,
        existed: extra.existed,
      }
    } else if (tool === 'fs.write') {
      summary.snapshot = { will_snapshot: true, callId: null, snapshot_id: null, snapshot_path: null }
    }
  } else if (tool === 'fs.write') {
    summary.snapshot = { will_snapshot: true, callId: null, snapshot_id: null, snapshot_path: null }
  }

  return summary
}

export function formatImpactSummary(summary) {
  if (!summary || typeof summary !== 'object') return '无写影响'
  const bits = []
  if (summary.paths && summary.paths.length) bits.push(`paths=${summary.paths.join(',')}`)
  if (summary.network) bits.push('network=yes')
  if (summary.config_keys && summary.config_keys.length) bits.push(`config=${summary.config_keys.join(',')}`)
  if (summary.snapshot && summary.snapshot.will_snapshot) bits.push('snapshot=yes')
  if (Array.isArray(summary.rows) && summary.rows.length) {
    bits.push(summary.rows.map((row) => `${row.path || '?'}:${String(row.from ?? '')}→${String(row.to ?? '')}`).join('；'))
  }
  return bits.join(' | ').slice(0, 800) || '无写影响'
}
