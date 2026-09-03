#!/usr/bin/env node
/**
 * Desktop 2.0.4 ships @deepseek-ai/dsh-api-remotes@alpha.1 whose main entry no
 * longer re-exports agent-lookup helpers. Legacy @deepseek-ai/dsh-host-apiproxy
 * (still on disk as rc.7) imports those names from the package root and fails
 * to load — which leaves task-board pending on apiProxy.
 *
 * Idempotent: appends a marked re-export of ./types/agent-lookup.js.
 *
 *   node patch-api-remotes-exports.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MARKER = 'DSP-PATCH: api-remotes agent-lookup re-export for host-apiproxy'
const EXPORT_BLOCK = `
// ${MARKER}
export {
\tApiRemoteSessionNotFound,
\tApiRemoteSubagentSessionOwnership,
\tapiRemoteSubagentOwnershipError,
\tcreateApiRemoteAgentResolver,
\thasApiRemoteSubagentOwner,
\tinspectApiRemoteSession,
} from "./types/agent-lookup.js";
`

export function defaultRemotesIndex() {
  const local = process.env.LOCALAPPDATA || ''
  return path.join(
    local,
    'Programs',
    'DSH Desktop',
    'resources',
    'app.asar.unpacked',
    'node_modules',
    '@deepseek-ai',
    'dsh-api-remotes',
    'lib',
    'index.js',
  )
}

export function patchApiRemotesExports(targetPath = process.env.DSH_API_REMOTES_INDEX || defaultRemotesIndex()) {
  if (!fs.existsSync(targetPath)) {
    return { ok: false, skipped: true, reason: 'missing', path: targetPath }
  }
  const agentLookup = path.join(path.dirname(targetPath), 'types', 'agent-lookup.js')
  if (!fs.existsSync(agentLookup)) {
    return { ok: false, skipped: true, reason: 'missing-agent-lookup', path: targetPath, agentLookup }
  }
  const text = fs.readFileSync(targetPath, 'utf8')
  if (text.includes(MARKER)) {
    return { ok: true, already: true, path: targetPath }
  }
  const bak = `${targetPath}.bak-dsp-apiproxy`
  if (!fs.existsSync(bak)) fs.copyFileSync(targetPath, bak)
  fs.writeFileSync(targetPath, `${text.replace(/\s*$/, '')}\n${EXPORT_BLOCK.trimStart()}`, 'utf8')
  return { ok: true, patched: true, path: targetPath, bak }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  const result = patchApiRemotesExports()
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}
