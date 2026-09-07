/**
 * M3 · 与 RoPE 读一致的 apply 草图
 * 形状对齐 RRA_NEURAL.md ApplyRraInput / ApplyRraOutput。
 * - exact：近端 raw 向量直接 RoPE 到 query 帧
 * - compressed：银行码经 readAt（expand + 相对旋转）
 * - landmark：更粗的跨块均值（仍走相对旋转）
 * 不宣称完整神经 RRA；正式 applyReciprocalResolutionAttention 仍抛错。
 */
import { applyRope } from './rope.mjs'
import { readAt } from './compress.mjs'
import { zeros, l2, meanVec, addInPlace, randn } from './math.mjs'
import { createOnlineStream, pushToken } from './m3-online.mjs'
import { estimateBankBytes } from './kv-bank.mjs'

export const SKETCH_PROTOCOL = 'rra/0.10-proto-m3-sketch'

function distanceTier(dist, { exactRadius, compressRadius }) {
  if (dist <= exactRadius) return 'exact'
  if (dist <= compressRadius) return 'compressed'
  return 'landmark'
}

/**
 * 幂律权重：更近 → 更大（用于混合）。
 */
function powerWeight(dist, alpha = 1.0) {
  return 1 / Math.pow(1 + Math.max(0, dist), alpha)
}

/**
 * @param {object} input
 * @param {Float64Array|number[]} input.q — 查询态（dim）
 * @param {object} [input.k_layers] — { exact?: {vec,pos}[], compressed?: bankBlocks, landmark?: bankBlocks }
 * @param {number} input.queryPos
 * @param {object} [input.cfg]
 * @param {boolean} [input.causal=true]
 * @returns {ApplyRraOutput}
 */
export function applyRraSketch(input = {}) {
  if (input.causal === false) {
    throw new Error('applyRraSketch: causal must be true (no future peek)')
  }
  const q = input.q
  if (!q || !q.length) throw new Error('applyRraSketch: missing q')
  const dim = q.length
  const queryPos = Number(input.queryPos)
  if (!Number.isFinite(queryPos)) throw new Error('applyRraSketch: missing queryPos')

  const cfg = input.cfg || {}
  const exactRadius = cfg.exactRadius ?? cfg.tau_tokens ?? 8
  const compressRadius = cfg.compressRadius ?? Math.max(exactRadius * 4, 32)
  const alpha = cfg.alpha ?? 1.0
  const topK = cfg.topK ?? 8
  const theta = cfg.theta ?? 10000

  const layers = input.k_layers || {}
  const exact = Array.isArray(layers.exact) ? layers.exact : []
  const compressed = Array.isArray(layers.compressed) ? layers.compressed : []
  const landmark = Array.isArray(layers.landmark) ? layers.landmark : []
  const model = input.model || null

  // 因果过滤：任何 pos > queryPos 一律丢弃
  const filterCausal = (items, posKey = 'pos') =>
    items.filter((it) => {
      const p = it[posKey] ?? it.meanPos
      return p != null && p <= queryPos
    })

  const exactOk = filterCausal(exact, 'pos')
  const compOk = filterCausal(compressed, 'meanPos')
  const landOk = filterCausal(landmark, 'meanPos')

  const contribs = []
  const tierBytes = { exact: 0, compressed: 0, landmark: 0 }
  const tierCounts = { exact: 0, compressed: 0, landmark: 0 }

  // exact：近端 raw
  for (const it of exactOk) {
    const dist = queryPos - it.pos
    const tier = distanceTier(dist, { exactRadius, compressRadius })
    if (tier !== 'exact') continue
    const want = applyRope(it.vec, queryPos, theta)
    contribs.push({ vec: want, w: powerWeight(dist, alpha), tier: 'exact', pos: it.pos })
    tierBytes.exact += dim * 8
    tierCounts.exact++
  }

  // compressed：readAt
  const rankedComp = compOk
    .map((b) => ({ b, dist: Math.abs((b.meanPos ?? 0) - queryPos) }))
    .sort((a, c) => a.dist - c.dist)
    .slice(0, topK)

  for (const { b, dist } of rankedComp) {
    const tier = distanceTier(dist, { exactRadius, compressRadius })
    if (tier !== 'compressed') continue
    if (model) {
      const vec = readAt(model, { code: b.code, meanPos: b.meanPos }, queryPos)
      contribs.push({ vec, w: powerWeight(dist, alpha), tier: 'compressed', pos: b.meanPos })
    } else if (b.pooled) {
      const vec = applyRope(b.pooled, queryPos - b.meanPos, theta)
      contribs.push({ vec, w: powerWeight(dist, alpha) * 0.5, tier: 'compressed', pos: b.meanPos })
    } else continue
    tierBytes.compressed += (b.code?.length || 4) * 8
    tierCounts.compressed++
  }

  // landmark：更粗——对远块做均值再相对旋转
  const far = landOk.length
    ? landOk
    : compOk.filter((b) => Math.abs((b.meanPos ?? 0) - queryPos) > compressRadius)
  if (far.length) {
    const pick = far
      .map((b) => ({ b, dist: Math.abs((b.meanPos ?? 0) - queryPos) }))
      .sort((a, c) => a.dist - c.dist)
      .slice(0, Math.max(1, Math.floor(topK / 2)))
    for (const { b, dist } of pick) {
      let vec
      if (model && b.code) {
        vec = readAt(model, { code: b.code, meanPos: b.meanPos }, queryPos)
      } else if (b.pooled) {
        vec = applyRope(b.pooled, queryPos - b.meanPos, theta)
      } else continue
      tierBytes.landmark += (b.code?.length || 4) * 8
      tierCounts.landmark++
      contribs.push({ vec, w: powerWeight(dist, alpha) * 0.25, tier: 'landmark', pos: b.meanPos })
    }
  }

  const context = zeros(dim)
  let wSum = 0
  for (const c of contribs) {
    addInPlace(context, c.vec, c.w)
    wSum += c.w
  }
  if (wSum > 1e-12) {
    for (let d = 0; d < dim; d++) context[d] /= wSum
  } else {
    // 无历史：退回 q 自身（仍有限）
    for (let d = 0; d < dim; d++) context[d] = q[d]
  }

  // 可选：与同字节固定窗口对照
  let falsify = null
  if (cfg.falsify && exact.length) {
    const budgetTokens = Math.max(1, Math.floor(
      (tierBytes.exact + tierBytes.compressed + tierBytes.landmark) / (dim * 8),
    ))
    const window = exactOk
      .filter((it) => it.pos > queryPos - budgetTokens && it.pos <= queryPos)
      .map((it) => applyRope(it.vec, queryPos, theta))
    if (window.length) {
      const fw = meanVec(window)
      falsify = {
        vsFixedWindowRel: l2(context, fw) / Math.max(1e-8, l2(fw)),
        budgetTokens,
        note: '草图 vs 同字节固定窗口；非神经质量声明',
      }
    }
  }

  return {
    context,
    meta: {
      protocol: SKETCH_PROTOCOL,
      queryPos,
      tiers: {
        exact: { tokens: tierCounts.exact, bytes: tierBytes.exact },
        compressed: { tokens: tierCounts.compressed, bytes: tierBytes.compressed },
        landmark: { tokens: tierCounts.landmark, bytes: tierBytes.landmark },
      },
      contribs: contribs.length,
      sketch: true,
      implemented: false,
      fullNeuralRra: false,
    },
    falsify,
  }
}

/**
 * 端到端：在线流 → 银行 → apply 草图。
 * 验证 RoPE 一致性：压缩块 readAt ≈ sketch 中 compressed 贡献路径。
 */
export function runApplySketchEval(opts = {}) {
  const length = opts.length || 48
  const dim = opts.dim || 16
  const blockSize = opts.blockSize || 4
  const windowExact = opts.windowExact || 8
  const queryPos = opts.queryPos ?? (length - 1)

  const stream = createOnlineStream({ dim, blockSize, compressedDim: opts.compressedDim || 4 })
  const exactTokens = []
  for (let i = 0; i < length; i++) {
    const v = randn(dim, 1)
    pushToken(stream, v, i)
    exactTokens.push({ vec: v, pos: i })
  }
  // 不 flush 尾：开放段留 buffer，apply 时只能用已 seal 块 + exact 窗口

  const bank = stream.bank
  const exactWindow = exactTokens.filter((t) => t.pos > queryPos - windowExact && t.pos <= queryPos)

  const out = applyRraSketch({
    q: exactTokens[queryPos].vec,
    queryPos,
    causal: true,
    model: bank.model,
    k_layers: {
      exact: exactWindow,
      compressed: bank.blocks,
      landmark: bank.blocks.filter((_, i) => i % 2 === 0),
    },
    cfg: {
      exactRadius: windowExact,
      compressRadius: Math.floor(length / 2),
      alpha: 1.0,
      falsify: true,
      theta: bank.theta,
    },
  })

  // RoPE 一致性：对每个有 raw 的块，readAt(pos) 与 applyRope(raw, pos) 的相对误差有界
  let ropeChecks = 0
  let ropeMaxRel = 0
  for (const b of bank.blocks) {
    if (!b.raw?.length) continue
    const idx = 0
    const got = readAt(bank.model, b, b.positions[idx])
    const want = applyRope(b.raw[idx], b.positions[idx], bank.theta)
    const rel = l2(got, want) / Math.max(1e-8, l2(want))
    ropeMaxRel = Math.max(ropeMaxRel, rel)
    ropeChecks++
  }

  // 未来泄漏：注入 queryPos+1 的 exact 应被忽略
  const leakExact = exactWindow.concat([{
    vec: exactTokens[Math.max(0, queryPos - 1)].vec,
    pos: queryPos + 5,
  }])
  const out2 = applyRraSketch({
    q: exactTokens[queryPos].vec,
    queryPos,
    causal: true,
    model: bank.model,
    k_layers: { exact: leakExact, compressed: bank.blocks },
    cfg: { exactRadius: windowExact, compressRadius: length, falsify: false },
  })
  const leakIgnored = out2.meta.tiers.exact.tokens === out.meta.tiers.exact.tokens

  const ctxFinite = out.context.every((x) => Number.isFinite(x))
  const ctxNorm = l2(out.context)

  return {
    ok: ctxFinite
      && ctxNorm > 0
      && leakIgnored
      && ropeChecks > 0
      && out.meta.sketch === true
      && out.meta.fullNeuralRra === false
      && out.meta.protocol === SKETCH_PROTOCOL,
    queryPos,
    sealed: stream.sealed,
    bufferLen: stream.buffer.length,
    contextNorm: Math.round(ctxNorm * 1e6) / 1e6,
    tiers: out.meta.tiers,
    falsify: out.falsify,
    ropeChecks,
    ropeMaxRel: Math.round(ropeMaxRel * 1e4) / 1e4,
    leakIgnored,
    bankBytes: estimateBankBytes(bank, { includeRaw: false }),
    protocol: out.meta.protocol,
    note: 'apply 草图：RoPE 相对读 + 因果过滤 + 分层混合；非完整神经 RRA',
  }
}
