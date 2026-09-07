/**
 * S1 适配器 → M3 apply 草图桥（玩具尺度）。
 * - 用 S1 compressGroup 建银行条目（无 RoPE 池；与 compress.mjs rope-then-pool 不同）
 * - 经 snapshot/restore 后条目码一致
 * - 条目以 pooled 路径喂 applyRraSketch（不把 S1 Wdown 假装成 RoPE 压缩模型）
 * 不宣称完整神经 RRA / 几何互通。
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareTask, trainBranch, buildEntries } from './s1-train.mjs'
import {
  snapshotS1Adapter, restoreS1Adapter, maxAbsWeightDiff,
} from './s1-adapter.mjs'
import { applyRraSketch, SKETCH_PROTOCOL } from './m3-apply.mjs'
import { l2 } from './math.mjs'

function round4(n) {
  return Math.round(n * 10000) / 10000
}

/**
 * 把 S1 条目转成 apply 草图可用的 compressed 块（走 pooled，不要求 model）。
 */
export function entriesToSketchBlocks(entries) {
  return entries.map((e) => ({
    code: e.code,
    pooled: e.pooled,
    meanPos: e.meanPos,
    count: e.count,
    maxPos: e.maxPos,
  }))
}

/**
 * 端到端：短训 → 存盘 → 恢复 → 打包 → applyRraSketch。
 */
export function runS1SketchBridgeEval(opts = {}) {
  const length = opts.length || 256
  const dim = opts.dim || 32
  const nEntries = opts.nEntries || 8
  const steps = opts.steps || 2500
  const seed = opts.seed || 51
  const codeDim = opts.codeDim || 16

  const task = prepareTask({
    length,
    dim,
    nSeq: opts.nSeq || 8,
    nTrain: opts.nTrain || 5,
    seed,
    trueEvery: 1,
    salientScale: 6.8,
    distractorScale: 3.9,
  })
  const trained = trainBranch(task, {
    kind: 'query',
    steps,
    lr: 0.12,
    nEntries,
    seed,
    codeDim,
    topicWeight: 0.4,
    rlWeight: 0,
    farHeavy: true,
    salientBias: true,
  })
  const live = trained.adapter
  const snap = snapshotS1Adapter(live)

  const outDir = opts.outDir || null
  let weightPath = null
  let restored
  if (outDir) {
    mkdirSync(outDir, { recursive: true })
    weightPath = join(outDir, 's1-bridge-weights-latest.json')
    writeFileSync(weightPath, JSON.stringify(snap))
    const fromDisk = JSON.parse(readFileSync(weightPath, 'utf8'))
    restored = restoreS1Adapter(fromDisk)
  } else {
    restored = restoreS1Adapter(snap)
  }

  const weightDiff = maxAbsWeightDiff(live, restored)
  const evalSeq = task.seqs.find((s) => !s.isTrain) || task.seqs[0]
  const pr = evalSeq.probes[Math.floor(evalSeq.probes.length / 2)]

  const livePack = buildEntries(live, task, evalSeq, {
    recipe: 'reciprocal', nEntries, farHeavy: true, salientBias: true, queryT: pr.t,
  })
  const restPack = buildEntries(restored, task, evalSeq, {
    recipe: 'reciprocal', nEntries, farHeavy: true, salientBias: true, queryT: pr.t,
  })

  let codeMaxDiff = 0
  const n = Math.min(livePack.entries.length, restPack.entries.length)
  for (let i = 0; i < n; i++) {
    const a = livePack.entries[i].code
    const b = restPack.entries[i].code
    for (let d = 0; d < a.length; d++) codeMaxDiff = Math.max(codeMaxDiff, Math.abs(a[d] - b[d]))
  }

  const blocks = entriesToSketchBlocks(restPack.entries)
  const windowTokens = task.windowTokens
  const exact = []
  for (let p = pr.t - windowTokens + 1; p <= pr.t; p++) {
    if (p < 0) continue
    exact.push({ vec: evalSeq.tokens[p], pos: p })
  }

  const sketch = applyRraSketch({
    q: pr.hWin,
    queryPos: pr.t,
    causal: true,
    model: null, // 诚实：S1 无 RoPE Wup，走 pooled
    k_layers: {
      exact,
      compressed: blocks,
      landmark: blocks.filter((_, i) => i % 2 === 0),
    },
    cfg: {
      exactRadius: windowTokens,
      compressRadius: Math.floor(length / 2),
      alpha: 1.0,
      falsify: false,
    },
  })

  let causalThrow = false
  try {
    applyRraSketch({ q: pr.hWin, queryPos: pr.t, causal: false, k_layers: { exact } })
  } catch {
    causalThrow = true
  }

  const ctxFinite = sketch.context.every((x) => Number.isFinite(x))
  const ctxNorm = l2(sketch.context)

  return {
    ok: weightDiff < 1e-12
      && codeMaxDiff < 1e-12
      && n > 0
      && ctxFinite
      && ctxNorm > 0
      && sketch.meta.sketch === true
      && sketch.meta.protocol === SKETCH_PROTOCOL
      && sketch.meta.implemented === false
      && sketch.meta.fullNeuralRra === false
      && causalThrow
      && live.trained === true,
    weightDiff,
    codeMaxDiff,
    nEntriesUsed: n,
    ctxNorm: round4(ctxNorm),
    sketchMeta: sketch.meta,
    weightPath,
    note: 'S1→sketch bridge · pooled path · not RoPE-model equivalent · not full neural RRA',
    implemented: false,
    fullNeuralRra: false,
  }
}

/** CLI / gate 用：默认写出 reports */
export function runS1SketchBridgeGate(opts = {}) {
  const here = dirname(fileURLToPath(import.meta.url))
  const outDir = opts.outDir || join(here, '..', 'reports')
  return runS1SketchBridgeEval({ ...opts, outDir })
}
