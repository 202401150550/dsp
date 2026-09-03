#!/usr/bin/env node
/** 将 client/modules/* + client/client-main.js 拼成根目录 client.js（含 CLIENT_BUILD 戳） */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROOT,
  MODULE_ORDER,
  hashSources,
  sourcePaths,
  clientVerFromPackage,
} from './client-build-meta.mjs'

const modulesDir = join(ROOT, 'client', 'modules')
const mainPath = join(ROOT, 'client', 'client-main.js')
const outPath = join(ROOT, 'client.js')
const bridgeSrc = join(ROOT, 'bridge', 'execute.mjs')

function generateBridgeModule() {
  let src = readFileSync(bridgeSrc, 'utf8')
  src = src.replace(/^export const /gm, 'const ')
  src = src.replace(/^export function /gm, 'function ')
  return `// AUTO-GENERATED from bridge/execute.mjs
window.__ModuleLoader__.load({
  id: 'dsh-open-world/bridge',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
${src.split('\n').map((line) => `    ${line}`).join('\n')}
    module.exports = {
      createBridge,
      BRIDGE_CAPABILITY_MAP,
      BRIDGE_HEALTH_KEY,
      BRIDGE_HEALTH_TTL,
      describeBridgeStrategy,
      summarizeBridgeSurface,
    };
    return module.exports;
  },
});
`
}

function patchConstants(src, { clientVer, build, builtAt }) {
  let out = src
  if (/exports\.CLIENT_VER = '/.test(out)) {
    out = out.replace(/exports\.CLIENT_VER = '[^']*'/, `exports.CLIENT_VER = '${clientVer}'`)
  }
  if (/exports\.CLIENT_BUILD = '/.test(out)) {
    out = out.replace(/exports\.CLIENT_BUILD = '[^']*'/, `exports.CLIENT_BUILD = '${build}'`)
  } else {
    out = out.replace(
      /(exports\.CLIENT_VER = '[^']*'\n)/,
      `$1    exports.CLIENT_BUILD = '${build}'\n`,
    )
  }
  if (/exports\.CLIENT_BUILT_AT = '/.test(out)) {
    out = out.replace(/exports\.CLIENT_BUILT_AT = '[^']*'/, `exports.CLIENT_BUILT_AT = '${builtAt}'`)
  } else {
    out = out.replace(
      /(exports\.CLIENT_BUILD = '[^']*'\n)/,
      `$1    exports.CLIENT_BUILT_AT = '${builtAt}'\n`,
    )
  }
  return out
}

const build = hashSources(sourcePaths())
const builtAt = new Date().toISOString()
const { clientVer, version } = clientVerFromPackage()

const parts = [
  `// CLIENT_BUILD ${build} ${builtAt} ${clientVer}`,
  '// dsh-open-world · Client — composed from client/modules + client-main',
  '// Run: npm run build:client  |  Check: npm run check:client',
  '',
  generateBridgeModule(),
  '',
]

for (const name of MODULE_ORDER) {
  const p = join(modulesDir, name)
  if (!existsSync(p)) {
    console.warn(`skip missing module: ${name}`)
    continue
  }
  let src = readFileSync(p, 'utf8')
  if (name === 'constants.js') {
    src = patchConstants(src, { clientVer, build, builtAt })
  }
  parts.push(src)
  parts.push('')
}

const mainSrc = existsSync(mainPath)
  ? readFileSync(mainPath, 'utf8')
  : readFileSync(outPath, 'utf8')
parts.push(mainSrc)

writeFileSync(outPath, `${parts.join('\n')}\n`, 'utf8')
console.log(`Wrote ${outPath}`)
console.log(`  CLIENT_VER=${clientVer} (package ${version})`)
console.log(`  CLIENT_BUILD=${build}`)
console.log(`  CLIENT_BUILT_AT=${builtAt}`)
