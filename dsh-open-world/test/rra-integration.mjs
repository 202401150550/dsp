#!/usr/bin/env node
/** OWIP smoke tests — no browser, no DSH process required */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { __test } from '../index.js'

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${msg}`)
  } else {
    failed += 1
    console.error(`  ✗ ${msg}`)
  }
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, `${msg} (got ${JSON.stringify(actual)})`)
}

import { existsSync } from 'node:fs'
const dir = __test.resolveRraProtoDir()
if (!dir || !existsSync(join(dir, 'src/l4-longctx.mjs'))) {
  console.error('RRA integration requires the separate rra-proto checkout adjacent to Open World. No tests were skipped; prerequisite missing.')
  process.exit(1)
}
assert(existsSync(join(dir, 'package.json')), 'rra-proto package present')
assert(existsSync(join(dir, 'src/l4-longctx.mjs')), 'rra-proto l4-longctx.mjs')
// M4：sketch 默认关；显式开可跑草图且不宣称 implemented
{
  const skipped = await __test.tryApplyRraSketch({
    q: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    queryPos: 3,
    causal: true,
    k_layers: { exact: [] },
  }, { sketch: false })
  assert(skipped.skipped === true && skipped.ok === false, 'M4 sketch default-off skips')
  const ran = await __test.tryApplyRraSketch({
    q: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    queryPos: 0,
    causal: true,
    k_layers: {
      exact: [{
        vec: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        pos: 0,
      }],
    },
  }, { sketch: true })
  assert(ran.ok === true && ran.sketch === true, 'M4 sketch opt-in runs')
  assert(ran.implemented === false && ran.fullNeuralRra === false, 'M4 sketch stays honest')
  assert(ran.output && ran.output.meta && ran.output.meta.sketch === true, 'M4 sketch meta tag')
  assert(ran.output.meta.compressWeightsLoaded !== true, 'M4 sketch without weights flag')
}

// M5：可选 compressWeights → readAt；dim 不符必拒
{
  const { writeFileSync, mkdtempSync, rmSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')
  const { pathToFileURL } = await import('node:url')
  const dir = __test.resolveRraProtoDir()
  assert(!!dir, 'rra-proto dir for compress weights')
  const compressUrl = pathToFileURL(join(dir, 'src', 'compress.mjs')).href
  const { createCompressModel, snapshotCompressModel, trainToySteps } = await import(compressUrl)
  const model = createCompressModel({ dim: 16, compressedDim: 4, seedScale: 0.05 })
  trainToySteps(model, { steps: 8, lr: 0.08, blockSize: 4, batchBlocks: 2 })
  const tmp = mkdtempSync(join(tmpdir(), 'ow-m5w-'))
  const wpath = join(tmp, 'compress-weights.json')
  writeFileSync(wpath, JSON.stringify(snapshotCompressModel(model)))
  const q16 = Array.from({ length: 16 }, (_, i) => 0.01 * (i + 1))
  const withW = await __test.tryApplyRraSketch({
    q: q16,
    queryPos: 4,
    causal: true,
    k_layers: {
      exact: [{ vec: q16, pos: 4 }],
      compressed: [{
        code: Array.from({ length: 4 }, () => 0.1),
        pooled: q16,
        meanPos: 1,
        count: 4,
      }],
    },
  }, { sketch: true, compressWeights: wpath })
  assert(withW.ok === true, 'M5 compressWeights sketch ok')
  assert(withW.weights && withW.weights.dim === 16, 'M5 weights meta dim')
  assert(withW.output?.meta?.compressWeightsLoaded === true, 'M5 compressWeightsLoaded meta')
  assert(withW.implemented === false && withW.fullNeuralRra === false, 'M5 weights stay honest')

  const badDim = await __test.tryApplyRraSketch({
    q: Array.from({ length: 8 }, (_, i) => 0.01 * (i + 1)),
    queryPos: 2,
    causal: true,
    k_layers: { exact: [] },
  }, { sketch: true, compressWeights: wpath })
  assert(badDim.ok === false, 'M5 dim mismatch rejects')
  assert(String(badDim.error || '').includes('dim'), `M5 dim mismatch message (${badDim.error})`)

  const missing = await __test.tryApplyRraSketch({
    q: q16,
    queryPos: 1,
    causal: true,
    k_layers: { exact: [] },
  }, { sketch: true, compressWeights: join(tmp, 'no-such.json') })
  assert(missing.ok === false && String(missing.error || '').includes('not found'), 'M5 missing weights rejects')

  const fakePath = join(tmp, 'fake-prod.json')
  writeFileSync(fakePath, JSON.stringify({
    protocol: 'rra/1.0-full-neural',
    dim: 16,
    compressedDim: 4,
    implemented: true,
    fullNeuralRra: true,
    Wdown: Array(4 * 16).fill(0),
    Wup: Array(16 * 4).fill(0),
  }))
  const fake = await __test.tryApplyRraSketch({
    q: q16,
    queryPos: 1,
    causal: true,
    k_layers: { exact: [] },
  }, { sketch: true, compressWeights: fakePath })
  assert(fake.ok === false && String(fake.error || '').includes('contract'), `M5-D rejects fake prod (${fake.error})`)

  rmSync(tmp, { recursive: true, force: true })
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
