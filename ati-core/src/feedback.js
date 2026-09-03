// ati-core · 自我反馈 + 拓扑微调
// 执行结果好 → 保留拓扑模式；不好 → rewire 尝试新连接

import { Graph } from './topology.js'

let _feedbackSeq = 0

export class FeedbackLoop {
  constructor({ memory = null, learningRate = 0.1 } = {}) {
    this.memory = memory
    this.learningRate = learningRate
    this._history = [] // { planId, score, structureHash, adjustments }
    this._edgeScores = new Map() // "a→b" → running average score
  }

  /**
   * 记录一次执行结果并更新边权重
   * @param {{planId, graph, score}} entry
   */
  record(entry) {
    const id = `fb-${++_feedbackSeq}`
    const adjustments = []
    for (const e of entry.graph.edges()) {
      const key = `${e.from}→${e.to}`
      const old = this._edgeScores.get(key) ?? 0.5
      // 指数移动平均：好结果提升边权重，差结果降低
      const updated = old + this.learningRate * (entry.score - old)
      this._edgeScores.set(key, Math.max(0, Math.min(1, updated)))
      if (Math.abs(updated - old) > 0.05) {
        adjustments.push({ edge: key, from: old.toFixed(3), to: updated.toFixed(3) })
      }
    }
    this._history.push({ ...entry, id, ts: Date.now(), adjustments })
    if (this._history.length > 200) this._history.shift()
    return { id, adjustments }
  }

  /** 获取某条边的当前信任度 */
  edgeScore(from, to) {
    return this._edgeScores.get(`${from}→${to}`) ?? null
  }

  /** 所有边的信任度排名 */
  rankedEdges() {
    return [...this._edgeScores.entries()]
      .map(([key, score]) => ({ key, score }))
      .sort((a, b) => b.score - a.score)
  }

  /** 找到最弱的 N 条边（rewire 候选） */
  weakestEdges(n = 3) {
    return this.rankedEdges().slice(-n).reverse()
  }

  /**
   * 基于反馈自动调整拓扑：
   *   1. 删除信任度 < pruneThreshold 的边
   *   2. 返回调整后的图（不修改原图）
   */
  adjustTopology(graph, { pruneThreshold = 0.2, maxRewires = 3 } = {}) {
    const adjusted = graph.clone()
    const actions = []
    for (const e of [...adjusted.edges()]) {
      const score = this.edgeScore(e.from, e.to)
      if (score != null && score < pruneThreshold && adjusted.degree(e.from) > 1 && adjusted.degree(e.to) > 1) {
        adjusted.removeEdge(e.from, e.to)
        actions.push({ action: 'prune-edge', from: e.from, to: e.to, score })
      }
    }
    // 如果删了太多，尝试 rewire 补回连通性
    if (!adjusted.isConnected() && adjusted.nodeCount() > 0 && actions.length > 0) {
      actions.push({ action: 'warning', message: 'topology may have become disconnected after pruning' })
    }
    return { graph: adjusted, actions }
  }

  history(limit = 20) { return this._history.slice(-limit) }

  /** 平均得分趋势 */
  trend() {
    if (this._history.length < 2) return 'stable'
    const half = Math.floor(this._history.length / 2)
    const early = this._history.slice(0, half).reduce((s, h) => s + h.score, 0) / half
    const late = this._history.slice(half).reduce((s, h) => s + h.score, 0) / (this._history.length - half)
    if (late > early + 0.05) return 'improving'
    if (late < early - 0.05) return 'declining'
    return 'stable'
  }
}
