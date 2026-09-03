/**
 * L3：短序列过拟合 + 在线因果评测（丢因果即 fail）。
 * 仍非完整神经 RRA。
 */
import { sgdStep, l2 } from './math.mjs'
import {
  createCompressModel,
  compressBlock,
  reconstructionLoss,
  assertCausalBlock,
  readAt,
} from './compress.mjs'

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function randnSeeded(dim, scale, rng) {
  const out = new Float64Array(dim)
  for (let i = 0; i < dim; i++) {
    const u = Math.max(1e-12, 1 - rng())
    const v = rng()
    out[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * scale
  }
  return out
}

/** 固定短数据集，便于过拟合证伪 */
export function makeShortDataset({
  blocks = 6,
  blockSize = 4,
  dim = 16,
  seed = 42,
} = {}) {
  const rng = mulberry32(seed)
  const set = []
  for (let b = 0; b < blocks; b++) {
    const vecs = []
    const positions = []
    const base = b * blockSize
    for (let i = 0; i < blockSize; i++) {
      vecs.push(randnSeeded(dim, 1, rng))
      positions.push(base + i)
    }
    set.push({ vecs, positions, id: `b${b}` })
  }
  return set
}

export function datasetLoss(model, dataset) {
  let sum = 0
  let errSum = 0
  for (const row of dataset) {
    assertCausalBlock(row.positions)
    const compressed = compressBlock(model, row.vecs, row.positions)
    const { loss, err } = reconstructionLoss(model, compressed, { accumulateGrad: false })
    sum += loss
    errSum += err
  }
  const n = Math.max(1, dataset.length)
  return { loss: sum / n, err: errSum / n }
}

/**
 * 在固定短集上过拟合；要求末损明显低于初损。
 */
export function overfitShortSequence(model, dataset, {
  steps = 120,
  lr = 0.1,
  targetRatio = 0.45,
} = {}) {
  const curve = []
  const first = datasetLoss(model, dataset)
  curve.push({ step: 0, ...first })

  for (let s = 1; s <= steps; s++) {
    for (const row of dataset) {
      assertCausalBlock(row.positions)
      const compressed = compressBlock(model, row.vecs, row.positions)
      reconstructionLoss(model, compressed, { accumulateGrad: true })
    }
    sgdStep(model.Wdown, model.dWdown, lr / dataset.length, 1e-5)
    sgdStep(model.Wup, model.dWup, lr / dataset.length, 1e-5)
    if (s % 10 === 0 || s === steps) {
      curve.push({ step: s, ...datasetLoss(model, dataset) })
    }
  }

  const last = curve[curve.length - 1]
  const ratio = last.loss / Math.max(1e-12, first.loss)
  return {
    ok: ratio <= targetRatio,
    first,
    last,
    ratio,
    targetRatio,
    curve,
    note: '短序列过拟合玩具 · 非长上下文神经质量',
  }
}

/**
 * 在线因果流：每步只能看见 prefix；压缩块不得含未来。
 * 故意注入未来时应被检出并 fail。
 */
export function runCausalStreamEval(model, {
  length = 24,
  blockSize = 4,
  dim = null,
  seed = 7,
} = {}) {
  const d = dim || model.dim
  const rng = mulberry32(seed)
  const stream = []
  for (let i = 0; i < length; i++) {
    stream.push({ vec: randnSeeded(d, 1, rng), pos: i })
  }

  const steps = []
  let illegalCaught = 0
  let illegalMissed = 0
  let legalOk = 0

  for (let t = blockSize - 1; t < length; t++) {
    const window = stream.slice(t - blockSize + 1, t + 1)
    const vecs = window.map((x) => x.vec)
    const positions = window.map((x) => x.pos)

    try {
      assertCausalBlock(positions, t)
      const compressed = compressBlock(model, vecs, positions)
      const got = readAt(model, compressed, t)
      if (!Number.isFinite(l2(got))) throw new Error('non-finite read')
      legalOk++
      steps.push({ t, legal: true, readNorm: l2(got) })
    } catch (err) {
      steps.push({ t, legal: false, error: String(err.message || err) })
    }

    if (t + 1 < length) {
      const leakVecs = vecs.concat([stream[t + 1].vec])
      const leakPos = positions.concat([stream[t + 1].pos])
      try {
        assertCausalBlock(leakPos, t)
        compressBlock(model, leakVecs, leakPos)
        illegalMissed++
      } catch {
        illegalCaught++
      }
    }
  }

  const pass = legalOk > 0 && illegalMissed === 0 && illegalCaught > 0
  return {
    ok: pass,
    length,
    blockSize,
    legalOk,
    illegalCaught,
    illegalMissed,
    steps: steps.slice(-5),
    note: pass
      ? '在线因果评测通过：合法可读、含未来必拒'
      : '在线因果评测失败：存在漏检或合法路径异常',
  }
}

/** 一键 L3 门槛 */
export function runL3Gate(opts = {}) {
  const dim = opts.dim || 16
  const model = createCompressModel({ dim, compressedDim: opts.compressedDim || 4, seedScale: 0.12 })
  const dataset = makeShortDataset({
    blocks: opts.blocks || 6,
    blockSize: opts.blockSize || 4,
    dim,
    seed: opts.seed || 42,
  })
  const overfit = overfitShortSequence(model, dataset, {
    steps: opts.steps || 120,
    lr: opts.lr || 0.12,
    targetRatio: opts.targetRatio || 0.45,
  })
  const causal = runCausalStreamEval(model, {
    length: opts.streamLen || 24,
    blockSize: opts.blockSize || 4,
    dim,
    seed: (opts.seed || 42) + 1,
  })
  return {
    stage: 'L3',
    implemented: false,
    fullNeuralRra: false,
    ok: overfit.ok && causal.ok,
    overfit,
    causal,
    disclaimer: 'L3 玩具门槛；非完整神经 RRA，禁止 OW neural:true',
  }
}
