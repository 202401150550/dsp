#!/usr/bin/env node
import { describeProto, applyReciprocalResolutionAttention } from '../src/status.mjs'
import { runByteMatchedBench } from '../src/baselines.mjs'
import {
  ropeNormError, ropeInvertError, ropePoolInconsistency,
} from '../src/rope.mjs'
import {
  createCompressModel, compressBlock, reconstructionLoss, trainToySteps,
  positionReadError, assertCausalBlock, readAt,
} from '../src/compress.mjs'
import { runL3Gate } from '../src/l3-eval.mjs'
import { runL4Gate, runLongContextByteMatch } from '../src/l4-longctx.mjs'
import { runKvBankRoundtrip, runKvBankContinueTrain, hotRead, createKvBank, trainOnRawBatch } from '../src/kv-bank.mjs'
import { runM2Gate } from '../src/l6-m2-hotread.mjs'
import { randn, l2 } from '../src/math.mjs'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

console.log('\n=== rra-proto L6/M2 smoke ===\n')

const st = describeProto()
ok(st.stage === 'L6-M2', `stage L6-M2 (got ${st.stage})`)
ok(st.implemented === false, 'neural still unimplemented')
ok(st.fullNeuralRra !== true, 'not claiming full neural RRA')
ok(st.modules.includes('l6-m2-hotread'), 'm2 module listed')

let threw = false
try { applyReciprocalResolutionAttention() } catch { threw = true }
ok(threw, 'full apply still throws')

ok(runByteMatchedBench({ length: 128, byteBudget: 8_000 }).implemented === false, 'L1 bench honest')

const v = randn(16, 1)
ok(ropeNormError(v, 7) < 1e-9, 'RoPE norm')
ok(ropeInvertError(v, 13) < 1e-9, 'RoPE invertible')
ok(ropePoolInconsistency([randn(16, 1), randn(16, 1), randn(16, 1), randn(16, 1)], [0, 1, 2, 3]) > 1e-6, 'RoPE pool gap')

const model = createCompressModel({ dim: 16, compressedDim: 4 })
const vecs = [randn(16, 1), randn(16, 1), randn(16, 1), randn(16, 1)]
const positions = [10, 11, 12, 13]
ok(trainToySteps(model, { steps: 80, lr: 0.1 }).improved, 'L2 toy train improves')
ok(positionReadError(model, vecs, positions, 1).rel < 3, 'position error bounded')
ok(assertCausalBlock(positions) === true, 'causal ok')
ok(l2(readAt(model, compressBlock(model, vecs, positions), 12)) > 0, 'readAt ok')

const gate3 = runL3Gate({ steps: 80, lr: 0.12, targetRatio: 0.5 })
ok(gate3.ok, 'L3 gate still passes')

const long = runLongContextByteMatch({ length: 2048, budgetFractions: [0.15, 0.3, 0.45] })
ok(long.input.length >= 2048, 'L4 length ≥ 2048')
ok(long.summary.comparableSweeps >= 2, `L4 comparable sweeps=${long.summary.comparableSweeps}`)
ok(long.implemented === false, 'L4 report not claiming neural')

const gate4 = runL4Gate({ length: 2048 })
ok(gate4.ok === true, `L4 gate passes (${gate4.note})`)
ok(gate4.fullNeuralRra === false, 'L4 gate stays honest')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
ok(existsSync(join(root, 'src/kv-bank.mjs')), 'kv-bank.mjs present')
ok(existsSync(join(root, 'PRODUCTION.md')), 'PRODUCTION.md present')

const l6 = runKvBankRoundtrip({
  filePath: join(tmpdir(), `rra-smoke-kv-${Date.now()}.json`),
  steps: 35,
  lr: 0.12,
})
ok(l6.ok === true, 'L6 kv-bank roundtrip with snapshots')
ok(l6.snapOk === true, 'snapshots present after reload')
ok(l6.fullNeuralRra === false, 'L6 stays honest')

const m1 = runKvBankContinueTrain({
  filePath: join(tmpdir(), `rra-smoke-m1-${Date.now()}.json`),
  steps: 20,
  continueSteps: 25,
  lr: 0.12,
})
ok(m1.ok === true, 'M1 continue-train gate')
ok(m1.continued && m1.continued.usedRaw >= 1, 'M1 used raw snapshots')
ok(m1.continuedPooled && m1.continuedPooled.usedPooled >= 1, 'M1 pooled-only continue')

{
  const b = createKvBank({ dim: 16, compressedDim: 4, keepRaw: true })
  const bat = {
    id: 'h0',
    vecs: [randn(16, 1), randn(16, 1), randn(16, 1), randn(16, 1)],
    positions: [0, 1, 2, 3],
  }
  trainOnRawBatch(b, [bat], { steps: 20, lr: 0.1, append: true })
  const out = hotRead(b, 2, { topK: 2 })
  ok(out.vec && out.vec.length === 16, 'hotRead returns dim vec')
  ok(out.hits.length >= 1, 'hotRead hits')
}

const m2 = runM2Gate({ length: 2048, trainSteps: 30, lr: 0.12 })
ok(m2.ok === true, `M2 gate (${m2.note})`)
ok(m2.fullNeuralRra === false, 'M2 stays honest')
ok(existsSync(join(root, 'src/l6-m2-hotread.mjs')), 'l6-m2-hotread.mjs present')

console.log(`\n=== rra-proto: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
