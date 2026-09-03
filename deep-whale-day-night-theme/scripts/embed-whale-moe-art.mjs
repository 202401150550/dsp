/**
 * Embed the whale-musume mascot artwork as data URIs, mirroring
 * embed-deep-whale-art.mjs. The ported whale-moe presenter resolves every
 * pose through WHALE_MOE_POSE_ART, so the installed skin needs no remote
 * asset service and no DSH dist/assets patching.
 *
 * Inputs (build-time, kept in the repo):
 *   mascot-assets/generated/dsh-whale-state-<pose>.webp   — 43 pose sprites
 *   mascot-assets/generated/dsh-whale-<id>-peek.webp      — 3 peek sprites
 *   mascot-assets/peek-calibration.json                   — peek bbox data
 *
 * Output:
 *   src/client/mascot/art.generated.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const generatedDir = resolve(root, 'mascot-assets', 'generated')

function collectPoses() {
  const poses = new Map()
  const re = /^dsh-whale-state-(.+)\.webp$/
  for (const name of readdirSync(generatedDir).sort()) {
    const match = re.exec(name)
    if (!match) continue
    const encoded = readFileSync(resolve(generatedDir, name)).toString('base64')
    poses.set(match[1], encoded)
  }
  return poses
}

function collectPeeks() {
  const peeks = new Map()
  for (const [id, name] of [
    ['home-peek', 'dsh-whale-home-peek.webp'],
    ['workbench-peek', 'dsh-whale-workbench-peek.webp'],
    ['settings-peek', 'dsh-whale-settings-peek.webp'],
  ]) {
    const encoded = readFileSync(resolve(generatedDir, name)).toString('base64')
    peeks.set(id, encoded)
  }
  return peeks
}

const calibration = JSON.parse(readFileSync(resolve(root, 'mascot-assets', 'peek-calibration.json'), 'utf8'))
const poses = collectPoses()
const peeks = collectPeeks()

const lines = [
  '/** Generated whale-musume mascot artwork. Do not edit; run `pnpm embed:mascot`. */',
  '',
  '/** Pose sprites: state name -> webp data URI (43 poses). */',
  'export const WHALE_MOE_POSE_ART: Readonly<Record<string, string>> = {',
  ...[...poses.keys()].sort().map((pose) => {
    return `  '${pose}': 'data:image/webp;base64,${poses.get(pose)}',`
  }),
  '}',
  '',
  '/** Peek sprites: peek id -> webp data URI (3 sprites). */',
  'export const WHALE_MOE_PEEK_ART: Readonly<Record<string, string>> = {',
  ...[...peeks.keys()].sort().map((id) => {
    return `  '${id}': 'data:image/webp;base64,${peeks.get(id)}',`
  }),
  '}',
  '',
  '/** Peek bbox calibration, copied from mascot-assets/peek-calibration.json. */',
  `export const WHALE_MOE_PEEK_CALIBRATION: Readonly<Record<string, Readonly<{ w: number; h: number; bboxW: number; bboxH: number; padLeft: number; padRight: number; padTop: number; padBottom: number }>>> = ${JSON.stringify(calibration, null, 2)}`,
  '',
]

writeFileSync(resolve(root, 'src/client/mascot/art.generated.ts'), lines.join('\n'))
console.log(`[embed-whale-moe-art] wrote src/client/mascot/art.generated.ts (${poses.size} poses, ${peeks.size} peeks)`)
