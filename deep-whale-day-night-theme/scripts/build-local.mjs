#!/usr/bin/env node
/**
 * Standalone local rebuild for machines without the dsh monorepo toolchain.
 *
 * Reproduces what `pnpm run build` (tsdown + the monorepo clientBundle
 * helper) produces, using esbuild directly:
 *
 *   lib/index.js  — host half: one ESM file, node:fs external, catalog
 *                   registration tolerant of a missing themeCatalog.
 *   lib/client.js — client half: one `window.__ModuleLoader__.load({ id,
 *                   factory })` CJS bundle. The `.module.css` import becomes
 *                   a style-tag injection module (same contract as the
 *                   upstream `\0dsh-css:` plugin), and @deepseek-ai/*
 *                   imports are all type-only so the bundle is
 *                   self-contained.
 *
 * Usage:
 *   node scripts/build-local.mjs            # uses repo-local esbuild if present
 *   ESBUILD_JS=<path> node scripts/build-local.mjs
 *
 * `pnpm run build` remains the official path when the monorepo is available.
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG_ID = '@dsh-external/dsh-client-ui-skin-deep-whale-day-night'

function resolveEsbuild() {
  if (process.env.ESBUILD_JS) {
    try { return require(process.env.ESBUILD_JS) } catch (error) {
      throw new Error(`ESBUILD_JS points to an unresolvable module: ${process.env.ESBUILD_JS}\n${error.message}`)
    }
  }
  try {
    return require(require.resolve('esbuild', { paths: [root] }))
  } catch {
    /* fall through to the error below */
  }
  throw new Error(
    'esbuild not found. Run `pnpm add -D esbuild` in this repo (requires the monorepo registry) ' +
    'or pass ESBUILD_JS=<path-to-esbuild-main.js>.',
  )
}

/** Replicates the upstream CSS-module loader: inline the CSS text and inject
 *  a namespaced <style> tag guarded by data-plugin-css, so the skin's
 *  stylesheet survives a single-file bundle. */
function cssModulePlugin() {
  return {
    name: 'dsh-css',
    setup(build) {
      build.onLoad({ filter: /\.module\.css$/ }, (args) => {
        const css = readFileSync(args.path, 'utf8')
        const tagId = `${PKG_ID}/${basename(args.path)}`
        const contents = [
          `const css = ${JSON.stringify(css)};`,
          `const tagId = ${JSON.stringify(tagId)};`,
          `if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {`,
          `  const tag = document.createElement("style");`,
          `  tag.dataset.plugin = ${JSON.stringify(PKG_ID)};`,
          `  tag.dataset.pluginCss = tagId;`,
          `  tag.textContent = css;`,
          `  document.head.appendChild(tag);`,
          `}`,
          `export {};`,
          ``,
        ].join('\n')
        return { contents, loader: 'js' }
      })
    },
  }
}

const esbuild = resolveEsbuild()

async function buildHost() {
  const outfile = resolve(root, 'lib/index.js')
  await esbuild.build({
    entryPoints: [resolve(root, 'src/index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outfile,
    sourcemap: false,
    logLevel: 'warning',
  })
  console.log('[build-local] wrote lib/index.js')
}

async function buildClient() {
  const tmp = resolve(root, 'lib/.client.tmp.js')
  await esbuild.build({
    entryPoints: [resolve(root, 'src/client/index.ts')],
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2020',
    outfile: tmp,
    plugins: [cssModulePlugin()],
    sourcemap: false,
    logLevel: 'warning',
  })
  const bundled = readFileSync(tmp, 'utf8')
  rmSync(tmp)
  const wrapped = [
    `window.__ModuleLoader__.load({`,
    `\tid: ${JSON.stringify(PKG_ID)},`,
    `\tfactory: (require) => {`,
    `\t\tvar module = { exports: {} };`,
    `\t\tvar exports = module.exports;`,
    `\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });`,
    bundled,
    `\t\treturn module.exports;`,
    `\t}`,
    `});`,
    ``,
  ].join('\n')
  writeFileSync(resolve(root, 'lib/client.js'), wrapped)
  console.log('[build-local] wrote lib/client.js')
}

await buildHost()
await buildClient()
