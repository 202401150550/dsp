import { readFileSync, writeFileSync } from 'node:fs'

const p = new URL('../src/s1-train.mjs', import.meta.url)
let s = readFileSync(p, 'utf8')
const needle = '按配方把远区折成'
const i = s.indexOf(needle)
const start = s.lastIndexOf('/**', i)
const end = s.indexOf('/** 三类内存账本 + 活跃字节 */', i)
if (start < 0 || end < 0) throw new Error(`markers not found ${start} ${end}`)

const repl = `/**
 * 互易打包的「区间计划」（与适配器权重无关，可缓存）。
 * 返回 [[start, end), ...]，再交给 compressGroup。
 */
export function planReciprocalRanges(task, seq, {
  nEntries = 32,
  nTiers = 8,
  maxGroupWidth = null,
  farHeavy = false,
  salientBias = false,
  queryT = null,
} = {}) {
  const { length: Tseq, windowTokens: W, blockSize, dim } = task
  const T = queryT != null ? queryT : Tseq
  const farEnd = Math.max(0, T - W)
  if (farEnd <= 0) return { ranges: [], tierQuota: [], queryT: queryT ?? null, farEnd }

  const tierWeights = []
  for (let b = 0; b < nTiers; b++) tierWeights.push(farHeavy ? (b + 1) : 1)
  const wSum = tierWeights.reduce((a, c) => a + c, 0)
  const tierQuota = tierWeights.map((w) => Math.max(1, Math.round(nEntries * w / wSum)))
  let qSum = tierQuota.reduce((a, c) => a + c, 0)
  while (qSum > nEntries) {
    for (let b = 0; b < nTiers && qSum > nEntries; b++) {
      if (tierQuota[b] > 1) { tierQuota[b]--; qSum-- }
    }
  }
  while (qSum < nEntries) {
    tierQuota[nTiers - 1]++; qSum++
  }

  let norms = seq._tokenNorm2
  if (salientBias && !norms) {
    norms = new Float64Array(Tseq)
    for (let p = 0; p < Tseq; p++) {
      let n2 = 0
      const tok = seq.tokens[p]
      for (let d = 0; d < dim; d++) n2 += tok[d] * tok[d]
      norms[p] = n2
    }
    seq._tokenNorm2 = norms
  }

  const ranges = []
  for (let b = 0; b < nTiers; b++) {
    const quota = tierQuota[b]
    const hi = T - W * Math.pow(2, b)
    const lo = Math.max(0, T - W * Math.pow(2, b + 1))
    if (hi <= 0) break
    const blocks = []
    for (let s = Math.floor(lo / blockSize) * blockSize; s < Math.min(hi, farEnd); s += blockSize) {
      const e = Math.min(s + blockSize, Math.min(hi, farEnd))
      if (e > s) {
        let score = 1
        if (salientBias) {
          let best = 0
          for (let p = s; p < e; p++) if (norms[p] > best) best = norms[p]
          score = best
        }
        blocks.push([s, e, score])
      }
    }
    if (!blocks.length) continue

    if (salientBias) {
      const ranked = blocks.slice().sort((a, c) => c[2] - a[2] || a[0] - c[0])
      const picked = ranked.slice(0, quota).sort((a, c) => a[0] - c[0])
      for (const [startR, endR] of picked) {
        if (ranges.length >= nEntries) break
        if (maxGroupWidth && endR - startR > maxGroupWidth) continue
        ranges.push([startR, endR])
      }
    } else {
      const per = Math.max(1, Math.ceil(blocks.length / quota))
      for (let j = 0; j < blocks.length && ranges.length < nEntries; j += per) {
        const group = blocks.slice(j, j + per)
        const startR = group[0][0]
        const endR = group[group.length - 1][1]
        if (maxGroupWidth && endR - startR > maxGroupWidth) continue
        ranges.push([startR, endR])
      }
    }
  }
  return { ranges, tierQuota, queryT: queryT ?? null, farEnd, farHeavy: !!farHeavy, salientBias: !!salientBias }
}

/**
 * 按配方把远区折成 ≤ nEntries 条记忆。
 * reciprocal：按对数时龄层均分条目（层内连续块成组）；
 * fixed-chunk：等宽组；uniform：等步长单 token。
 * queryT：若给定，按该探针时刻做因果打包（远区端 = queryT−W，时龄相对 queryT）；
 * 否则退化为序列末 T（旧行为，仅用于无探针的构建检查）。
 * packCache：可选 Map，缓存 reciprocal 区间计划（键与权重无关）。
 */
export function buildEntries(adapter, task, seq, {
  recipe = 'reciprocal',
  nEntries = 32,
  maxGroupWidth = null,
  macs = null,
  farHeavy = false,
  salientBias = false,
  queryT = null,
  packCache = null,
} = {}) {
  const { length: Tseq, windowTokens: W, blockSize } = task
  const T = queryT != null ? queryT : Tseq
  const farEnd = Math.max(0, T - W)
  if (farEnd <= 0) return { entries: [], recipe, queryT: queryT ?? null }
  if (recipe === 'uniform') {
    const stride = Math.max(1, Math.floor(farEnd / nEntries))
    const entries = []
    for (let p = farEnd - 1; p >= 0 && entries.length < nEntries; p -= stride) {
      entries.push(compressGroup(adapter, [seq.tokens[p]], [p], macs))
    }
    return { entries: entries.reverse(), recipe, queryT: queryT ?? null }
  }
  if (recipe === 'fixed-chunk') {
    const chunkW = Math.max(blockSize, Math.floor(farEnd / nEntries))
    const entries = []
    for (let endPos = farEnd; endPos > 0 && entries.length < nEntries; endPos -= chunkW) {
      const startPos = Math.max(0, endPos - chunkW)
      entries.push(compressGroup(adapter, seq.tokens.slice(startPos, endPos), seq.positions.slice(startPos, endPos), macs))
    }
    return { entries: entries.reverse(), recipe, chunkW, queryT: queryT ?? null }
  }
  const cacheKey = packCache
    ? (String(seq.si ?? 0) + '|' + T + '|' + nEntries + '|' + adapter.nTiers + '|' + (farHeavy ? 1 : 0) + '|' + (salientBias ? 1 : 0) + '|' + (maxGroupWidth ?? 0))
    : null
  let planned = cacheKey && packCache.get(cacheKey)
  if (!planned) {
    planned = planReciprocalRanges(task, seq, {
      nEntries, nTiers: adapter.nTiers, maxGroupWidth, farHeavy, salientBias, queryT: T,
    })
    if (cacheKey) packCache.set(cacheKey, planned)
  }
  const entries = []
  for (const [startPos, endPos] of planned.ranges) {
    if (entries.length >= nEntries) break
    entries.push(compressGroup(adapter, seq.tokens.slice(startPos, endPos), seq.positions.slice(startPos, endPos), macs))
  }
  return {
    entries, recipe, farHeavy: !!farHeavy, salientBias: !!salientBias,
    tierQuota: planned.tierQuota, queryT: queryT ?? null,
  }
}

`
writeFileSync(p, s.slice(0, start) + repl + s.slice(end))
console.log('patched ok')
