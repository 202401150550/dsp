/**
 * Phase 3 — 插件权限 manifest（dsh.capability.json）读校验。
 * 缺文件时退回 capability-registry 名称匹配；有文件则强制字段齐全并参与 owner 去重。
 */
import fs from 'node:fs'
import path from 'node:path'

export const MANIFEST_FILE = 'dsh.capability.json'

export const REQUIRED_FIELDS = [
  'id',
  'bucket',
  'owner_capability',
  'risk',
  'reads',
  'writes',
  'side_effects',
  'reversible',
  'conflicts_with',
  'taint_labels',
  'requires_confirm_above',
  'default_presets',
  'forbidden_with',
]

const ARRAY_FIELDS = ['reads', 'writes', 'side_effects', 'conflicts_with', 'taint_labels', 'default_presets', 'forbidden_with']

/** 策略层永久禁装（与 native-contract refuse / organs forbidden 对齐）。 */
export const POLICY_FORBIDDEN = [
  { re: /web-ui-all|dsh-web-ui-all/i, id: 'web-ui-all' },
  { re: /skin-center|dsh-skins$/i, id: 'skin-center' },
]

export function policyForbiddenReason(name, dir = '') {
  const hay = `${name} ${dir}`
  for (const row of POLICY_FORBIDDEN) {
    if (row.re.test(hay)) return row.id
  }
  return null
}

export function readManifestFile(root) {
  const file = path.join(root, MANIFEST_FILE)
  if (!fs.existsSync(file)) return { ok: true, missing: true, path: file, doc: null }
  let doc
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    return { ok: false, missing: false, path: file, error: 'manifest-parse-failed', detail: String(err && err.message || err), doc: null }
  }
  return { ok: true, missing: false, path: file, doc }
}

/**
 * @returns {{ok:boolean, errors:string[], warnings:string[]}}
 */
export function validateManifest(doc) {
  const errors = []
  const warnings = []
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: ['manifest-not-object'], warnings }
  }
  for (const key of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(doc, key)) errors.push(`missing:${key}`)
  }
  if (doc.id != null && typeof doc.id !== 'string') errors.push('id-not-string')
  if (doc.owner_capability != null && typeof doc.owner_capability !== 'string') errors.push('owner_capability-not-string')
  if (doc.bucket != null && typeof doc.bucket !== 'string') errors.push('bucket-not-string')
  if (doc.risk != null && typeof doc.risk !== 'string') errors.push('risk-not-string')
  if (doc.reversible != null && typeof doc.reversible !== 'boolean') errors.push('reversible-not-boolean')
  if (doc.requires_confirm_above != null && typeof doc.requires_confirm_above !== 'string') {
    errors.push('requires_confirm_above-not-string')
  }
  for (const key of ARRAY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(doc, key) && !Array.isArray(doc[key])) {
      errors.push(`${key}-not-array`)
    }
  }
  if (doc.owner_capability === '') errors.push('owner_capability-empty')
  if (Array.isArray(doc.forbidden_with) && doc.forbidden_with.includes('web-ui-all') === false) {
    // soft tip only — packages may omit; not an error
  }
  return { ok: errors.length === 0, errors, warnings }
}

export function loadAndValidateManifest(root) {
  const loaded = readManifestFile(root)
  if (loaded.missing) return { ...loaded, validation: null }
  if (!loaded.ok) return { ...loaded, validation: { ok: false, errors: [loaded.error], warnings: [] } }
  const validation = validateManifest(loaded.doc)
  return { ...loaded, ok: validation.ok, validation }
}

/**
 * 在已启用条目之间检测 owner_capability 抢注。
 * @param {Array<{id:string, owner_capability?:string|null}>} claims
 */
export function findOwnerConflicts(claims) {
  const grouped = new Map()
  for (const row of claims) {
    const cap = row && row.owner_capability
    if (!cap) continue
    const arr = grouped.get(cap) || []
    arr.push(row.id)
    grouped.set(cap, arr)
  }
  const conflicts = []
  for (const [capability, ids] of grouped) {
    const uniq = [...new Set(ids)]
    if (uniq.length > 1) conflicts.push({ capability, owners: uniq })
  }
  return conflicts
}
