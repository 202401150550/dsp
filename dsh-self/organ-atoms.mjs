/**
 * Host-side organ atom gate (reads organs.yml + organs-state.json).
 */
import { organsCatalog } from './adopt.mjs'

export function isAtomEnabled(organId, atomId) {
  const cat = organsCatalog()
  const organ = (cat.organs || []).find((o) => o.id === organId)
  if (!organ) return false
  const atom = (organ.atoms || []).find((a) => a.id === atomId)
  return !!(atom && atom.enabled)
}

export function anyAtomEnabled(organId, atomIds) {
  return atomIds.some((id) => isAtomEnabled(organId, id))
}
