#!/usr/bin/env node
import { describeProto, applyReciprocalResolutionAttention } from '../src/status.mjs'
import { runByteMatchedBench } from '../src/baselines.mjs'
import {
  ropeNormError, ropeInvertError, ropePoolInconsistency,
} from '../src/rope.mjs'
import {
  createCompressModel, compressBlock, reconstructionLoss, trainToySteps,
  positionReadError, assertCausalBlock, readAt,
  snapshotCompressModel, restoreCompressModel, maxAbsCompressWeightDiff,
} from '../src/compress.mjs'
import { runL3Gate } from '../src/l3-eval.mjs'
import { runL4Gate, runLongContextByteMatch } from '../src/l4-longctx.mjs'
import { runKvBankRoundtrip, runKvBankContinueTrain, hotRead, createKvBank, trainOnRawBatch } from '../src/kv-bank.mjs'
import { runM2Gate } from '../src/l6-m2-hotread.mjs'
import { runS1, causalChecks, prepareTask, buildEntries } from '../src/s1-train.mjs'
import { createS1Adapter, compressGroup, matchingLoss, reinforceTopicReadout, zeroGrads, sgdStepAll, slotModFromEntry, snapshotS1Adapter, restoreS1Adapter, maxAbsWeightDiff } from '../src/s1-adapter.mjs'
import { BEAT_DEFAULTS, BEAT_EQ_DEFAULTS, BEAT_EQ_CONTENT_DEFAULTS, BEAT_EQ_NOSLOT_DEFAULTS } from '../src/s1-beat.mjs'
import { createFrozenBackbone, backboneForward, createBackboneCache, synthCorpus } from '../src/s1-backbone.mjs'
import { runS1SketchBridgeEval } from '../src/s1-sketch-bridge.mjs'
import { runM5RopeBridgeEval } from '../src/m5-rope-bridge.mjs'
import { runM5DimContractEval } from '../src/m5-dim-contract.mjs'
import { runOnlineCausalEval } from '../src/m3-online.mjs'
import { runApplySketchEval, applyRraSketch, SKETCH_PROTOCOL } from '../src/m3-apply.mjs'
import { zeros, randn, l2 } from '../src/math.mjs'
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

console.log('\n=== rra-proto L6/M4 smoke ===\n')

const st = describeProto()
ok(st.stage === 'L6-M4', `stage L6-M4 (got ${st.stage})`)
ok(st.implemented === false, 'neural still unimplemented')
ok(st.fullNeuralRra !== true, 'not claiming full neural RRA')
ok(st.modules.includes('l6-m2-hotread'), 'm2 module listed')
ok(st.modules.includes('s1-train'), 's1 module listed')
ok(st.modules.includes('m3-online') && st.modules.includes('m3-apply'), 'm3 modules listed')

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
ok(trainToySteps(model, { steps: 120, lr: 0.1 }).improved, 'L2 toy train improves')
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

// ── S1：冻结骨干适配（论文 6.2 脚手架）──
{
  // 骨干前向：缓存因果、权重冻结
  const bb = createFrozenBackbone({ dim: 16, seed: 3 })
  const cache = createBackboneCache(bb)
  const toks = [randn(16, 1), randn(16, 1), randn(16, 1)]
  const hs = backboneForward(bb, toks, [0, 1, 2], cache)
  ok(hs.length === 3 && hs[2].length === 16, 'S1 backbone forward')
  // 梯度数值校验（小型）
  const ad = createS1Adapter({ dim: 16, codeDim: 4, nTiers: 3, kind: 'query', seed: 5 })
  const groups = []
  for (let gI = 0; gI < 4; gI++) {
    const vs = [], ps = []
    for (let i = 0; i < 2; i++) {
      const v = zeros(16)
      for (let d = 0; d < 16; d++) v[d] = Math.sin(gI * 5 + i + d)
      vs.push(v); ps.push(gI * 2 + i)
    }
    groups.push({ vs, ps })
  }
  const hWin = zeros(16), hFull = zeros(16)
  for (let d = 0; d < 16; d++) { hWin[d] = Math.cos(d); hFull[d] = Math.sin(d * 0.5) * 2 }
  const lossOf = () => {
    const es = groups.map((gI) => compressGroup(ad, gI.vs, gI.ps))
    return matchingLoss(ad, es, hWin, hFull, 30, { windowTokens: 8 }).loss
  }
  zeroGrads(ad)
  const es = groups.map((gI) => compressGroup(ad, gI.vs, gI.ps))
  matchingLoss(ad, es, hWin, hFull, 30, { windowTokens: 8, accumulateGrad: true })
  const eps = 1e-5
  const tensorNames = []
  for (const [k, w] of Object.entries(ad.comp)) tensorNames.push([`comp.${k}`, w])
  for (const [k, w] of Object.entries(ad.read)) tensorNames.push([`read.${k}`, w])
  for (const [k, w] of Object.entries(ad.meta)) tensorNames.push([`meta.${k}`, w])
  let worstRel = 0
  for (const [name, w] of tensorNames) {
    for (let i = 0; i < w.length; i++) {
      const old = w[i]
      w[i] = old + eps; const lp = lossOf()
      w[i] = old - eps; const lm = lossOf()
      w[i] = old
      const num = (lp - lm) / (2 * eps)
      const ana = ad.grads[name][i]
      const rel = Math.abs(num - ana) / Math.max(1e-6, Math.abs(num))
      if (num > 1e-6 && rel > worstRel) worstRel = rel
    }
  }
  ok(worstRel < 1e-3, `S1 grad check (worstRel=${worstRel.toExponential(2)})`)
  ok(sgdStepAll(ad, 0.01) === undefined, 'S1 sgd step runs')
  // 因果检查
  const task = prepareTask({ length: 128, nSeq: 4, nTrain: 2 })
  const cc = causalChecks(task, { nEntries: 16 })
  ok(cc.causalOk === true, 'S1 causal checks (leak/deterministic/closed)')
  // queryT 因果打包：条目必须全部落在探针远区内；序列末打包在早探针上会混入「相对未来」块
  {
    const tq = prepareTask({ length: 256, nSeq: 4, nTrain: 2, probeStride: 40 })
    const seq = tq.seqs.find((s) => s.probes.length > 2) || tq.seqs[0]
    const pr = seq.probes[0]
    const ad = createS1Adapter({ dim: tq.dim, kind: 'mean', seed: 3 })
    const causal = buildEntries(ad, tq, seq, { recipe: 'reciprocal', nEntries: 8, queryT: pr.t, farHeavy: true })
    const farEnd = pr.t - tq.windowTokens
    const allCausal = causal.entries.every((e) => e.maxPos < farEnd)
    ok(allCausal && causal.entries.length > 0, 'S1 queryT packing stays in causal far zone')
    const seqEnd = buildEntries(ad, tq, seq, { recipe: 'reciprocal', nEntries: 8, farHeavy: true })
    const leaked = seqEnd.entries.some((e) => e.meanPos > farEnd)
    ok(leaked === true, 'S1 seq-end packing can include post-cutoff blocks (contrast)')
  }
  // 小规模端到端：学习信号方向（主题字典须与训练一致：nSeq 12 / nTrain 8 覆盖 8 主题）
  const rep = runS1({ length: 256, nSeq: 12, nTrain: 8, steps: 1500, nEntries: 16, lr: 0.12 })
  const qB = rep.branches['reciprocal-query-trained']
  const uB = rep.branches['reciprocal-untrained']
  ok(qB.meanRelErr < uB.meanRelErr, `S1 learn signal (${qB.meanRelErr} < ${uB.meanRelErr})`)
  ok(qB.topicAcc > rep.branches['sliding-window'].topicAcc, 'S1 beats sliding on topic probe')
  ok(rep.implemented === false && rep.fullNeuralRra === false, 'S1 stays honest')
  // 玩具 REINFORCE：硬采样一条记忆，返回 reward∈{0,1}
  {
    const tRl = prepareTask({ length: 128, nSeq: 4, nTrain: 2, probeStride: 40 })
    const seq = tRl.seqs.find((s) => s.probes.length) || tRl.seqs[0]
    const pr = seq.probes[0]
    const ad = createS1Adapter({ dim: tRl.dim, kind: 'query', seed: 5, codeDim: 8 })
    const { entries } = buildEntries(ad, tRl, seq, { recipe: 'reciprocal', nEntries: 8, queryT: pr.t })
    zeroGrads(ad)
    const rl = reinforceTopicReadout(ad, entries, pr.hWin, pr.t, {
      windowTokens: tRl.windowTokens,
      topicDirs: tRl.probe.dirs,
      targetTopic: pr.targetTopic,
      baseline: 0.5,
      rlWeight: 1,
      rng: () => 0.1,
      accumulateGrad: true,
    })
    ok(rl.skipped === false && (rl.reward === 0 || rl.reward === 1), `S1 REINFORCE reward=${rl.reward}`)
  }
  // 等范数槽位模：块内显著格点 → residue；无显著 → other 桶
  {
    const smTrue = slotModFromEntry({ maxPos: 192, count: 1, meanPos: 192 }, 64, 4)
    const smDist = slotModFromEntry({ maxPos: 64, count: 1, meanPos: 64 }, 64, 4)
    const smOther = slotModFromEntry({ maxPos: 37, count: 4, meanPos: 35.5 }, 64, 4)
    ok(smTrue === 0 && smDist === 1 && smOther === 3, `S1 slotModFromEntry (true=${smTrue}, dist=${smDist}, other=${smOther})`)
  }
  // S1 权重快照 roundtrip
  {
    const a = createS1Adapter({ dim: 16, codeDim: 4, kind: 'query', seed: 3, nSlotMod: 4 })
    a.comp.Wdown[0] += 0.42
    a.trained = true
    const snap = snapshotS1Adapter(a)
    const b = restoreS1Adapter(snap)
    ok(snap.protocol === 'rra/0.10-s1-adapter-weights', 'S1 weight snapshot protocol')
    ok(maxAbsWeightDiff(a, b) < 1e-15, `S1 weight restore exact (diff=${maxAbsWeightDiff(a, b)})`)
    ok(b.trained === true && b.nSlotMod === 4, 'S1 restore keeps meta flags')
  }
  // 破周期：trueRandom 改变真点布局（同 seed 下与周期格子不同）
  {
    const per = synthCorpus({ nSeq: 1, nTrain: 1, length: 256, dim: 8, trueEvery: 3, trueRandom: false, seed: 9 })
    const rnd = synthCorpus({ nSeq: 1, nTrain: 1, length: 256, dim: 8, trueEvery: 3, trueRandom: true, seed: 9 })
    ok(per.trueRandom === false && rnd.trueRandom === true, 'S1 trueRandom flag on corpus')
    ok(per.seqs[0].nTrue !== rnd.seqs[0].nTrue || per.seqs[0].nDistractor !== rnd.seqs[0].nDistractor,
      `S1 trueRandom changes layout (per true=${per.seqs[0].nTrue} rnd true=${rnd.seqs[0].nTrue})`)
  }
  ok(BEAT_DEFAULTS.nEntries === 1 && BEAT_DEFAULTS.salientScale !== BEAT_DEFAULTS.distractorScale, 'S1 beat default is e1-gap')
  ok(BEAT_EQ_DEFAULTS.slotMod === true
    && BEAT_EQ_DEFAULTS.salientScale === BEAT_EQ_DEFAULTS.distractorScale
    && BEAT_EQ_DEFAULTS.nEntries <= 8, 'S1 beat-eq defaults are equal-norm+slotMod')
  ok(BEAT_EQ_CONTENT_DEFAULTS.slotMod === false
    && BEAT_EQ_CONTENT_DEFAULTS.salientScale === BEAT_EQ_CONTENT_DEFAULTS.distractorScale
    && BEAT_EQ_CONTENT_DEFAULTS.nEntries <= 12
    && Number(BEAT_EQ_CONTENT_DEFAULTS.attnImitateWeight) > 0,
  'S1 beat-eq-content defaults are equal-norm/no-slotMod/imitate')
  ok(BEAT_EQ_NOSLOT_DEFAULTS === BEAT_EQ_CONTENT_DEFAULTS, 'S1 BEAT_EQ_NOSLOT alias = content defaults')
  ok(existsSync(join(root, 'src/s1-train.mjs')), 's1-train.mjs present')
  ok(existsSync(join(root, 'bench/s1-beat-eq-gate.mjs')), 's1-beat-eq-gate.mjs present')
  ok(existsSync(join(root, 'bench/s1-beat-eq-content-gate.mjs')), 's1-beat-eq-content-gate.mjs present')
  ok(existsSync(join(root, 'bench/s1-true-random-ceiling.mjs')), 's1-true-random-ceiling.mjs present')
  ok(existsSync(join(root, 'bench/s1-weight-gate.mjs')), 's1-weight-gate.mjs present')
  ok(existsSync(join(root, 'src/s1-sketch-bridge.mjs')), 's1-sketch-bridge.mjs present')
  ok(existsSync(join(root, 'bench/s1-sketch-bridge-gate.mjs')), 's1-sketch-bridge-gate.mjs present')
  {
    const br = runS1SketchBridgeEval({ length: 128, steps: 400, nSeq: 6, nTrain: 4, seed: 9 })
    ok(br.ok === true, `S1 sketch bridge eval (entries=${br.nEntriesUsed})`)
    ok(br.implemented === false && br.fullNeuralRra === false, 'S1 sketch bridge stays honest')
  }
  ok(existsSync(join(root, 'src/m5-rope-bridge.mjs')), 'm5-rope-bridge.mjs present')
  ok(existsSync(join(root, 'bench/m5-rope-bridge-gate.mjs')), 'm5-rope-bridge-gate.mjs present')
  {
    const m5 = runM5RopeBridgeEval({ length: 64, dim: 16, trainSteps: 40, seed: 3 })
    ok(m5.ok === true, `M5-R rope bridge (compressed=${m5.compressedTokens}, Δpooled=${m5.pathDiff})`)
    ok(m5.implemented === false && m5.fullNeuralRra === false, 'M5-R stays honest')
  }
  ok(existsSync(join(root, 'src/m5-dim-contract.mjs')), 'm5-dim-contract.mjs present')
  ok(existsSync(join(root, 'bench/m5-dim-contract-gate.mjs')), 'm5-dim-contract-gate.mjs present')
  {
    const d = runM5DimContractEval()
    ok(d.ok === true, 'M5-D dim contract eval')
    ok(d.implemented === false && d.fullNeuralRra === false, 'M5-D stays honest')
  }
}

// ── M3：在线因果 + RoPE apply 草图 ──
{
  const online = runOnlineCausalEval({ length: 48, dim: 16, blockSize: 4 })
  ok(online.ok === true, 'M3 online causal (oracle≡prefill, poison/order)')
  ok(online.prefillEquiv.ok === true, 'M3 prefill ≡ token oracle')
  ok(online.poison.caught === true, 'M3 poison future caught')

  const sketch = runApplySketchEval({ length: 40, dim: 16, blockSize: 4, windowExact: 6 })
  ok(sketch.ok === true, `M3 apply sketch (${sketch.protocol})`)
  ok(sketch.leakIgnored === true, 'M3 sketch ignores future exact')
  ok(sketch.protocol === SKETCH_PROTOCOL, 'M3 sketch protocol tag')

  let causalFalseThrows = false
  try {
    applyRraSketch({ q: randn(16, 1), queryPos: 2, causal: false, k_layers: { exact: [] } })
  } catch { causalFalseThrows = true }
  ok(causalFalseThrows, 'M3 sketch rejects causal:false')
  ok(existsSync(join(root, 'src/m3-online.mjs')), 'm3-online.mjs present')
  ok(existsSync(join(root, 'src/m3-apply.mjs')), 'm3-apply.mjs present')
}

console.log(`\n=== rra-proto: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
