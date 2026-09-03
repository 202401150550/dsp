// ati-core · ACI 编排器（顶层入口）
// 把 Planner + MemorySystem + FeedbackLoop + ConflictResolver 串成闭环

import { MemorySystem } from './memory.js'
import { Planner } from './planner.js'
import { FeedbackLoop } from './feedback.js'
import { ConflictResolver } from './conflict.js'

export class AtiOrchestrator {
  constructor({ persistPath = null, learningRate = 0.1 } = {}) {
    this.memory = new MemorySystem({ persistPath })
    this.planner = new Planner({ memory: this.memory })
    this.feedback = new FeedbackLoop({ memory: this.memory, learningRate })
    this.conflicts = new ConflictResolver()
    this._cycle = 0
  }

  registerCapability(capId, nodeType, operator) {
    return this.planner.registerCapability(capId, nodeType, operator)
  }

  /**
   * 完整 ACI 循环：
   *   1. 冲突检测 → 仲裁
   *   2. 执行计划
   *   3. 记录反馈
   *   4. 自动调整拓扑
   */
  async think(goalId, description, blueprint, input = null) {
    const cycleId = `think-${++this._cycle}-${Date.now()}`

    // 1. 声明目标并检测冲突
    const resources = (blueprint.nodes || []).map((n) => n.type).filter(Boolean)
    try { this.conflicts.addGoal(goalId, { description, priority: 5, resources }) } catch { /* duplicate ok */ }
    const arbitration = this.conflicts.resolve()

    if (!arbitration.approved.includes(goalId)) {
      return {
        cycleId,
        status: 'deferred',
        reason: 'resource conflict with higher-priority goal',
        arbitration,
        output: null,
        score: 0,
      }
    }

    // 2. 从记忆中查找类似历史
    const pastPlans = this.memory.recallPattern(description.slice(0, 10))

    // 3. 执行
    const entry = await this.planner.executePlan(description, blueprint, input)

    // 4. 反馈 + 学习
    const fbResult = this.feedback.record(entry)
    if (this.memory) {
      this.memory.memorize(`plan-result:${entry.planId}`, {
        description,
        score: entry.score,
        adjustments: fbResult.adjustments,
        similarPast: pastPlans.length,
      })
    }

    // 5. 拓扑调整建议
    const adjustment = this.feedback.adjustTopology(entry.graph)

    return {
      cycleId,
      status: entry.result.error ? 'failed' : 'completed',
      planId: entry.planId,
      description,
      output: entry.result.output,
      error: entry.result.error || null,
      trace: entry.result.trace,
      score: entry.score,
      feedbackAdjustments: fbResult.adjustments,
      suggestedTopologyActions: adjustment.actions,
      pastSimilarPlans: pastPlans.length,
      trend: this.feedback.trend(),
    }
  }

  /** 获取系统自我认知摘要 */
  selfModel() {
    return {
      cycles: this._cycle,
      plansExecuted: this.planner.plans().length,
      averageScore: this._avgScore(),
      trend: this.feedback.trend(),
      strongestEdges: this.feedback.rankedEdges().slice(0, 5),
      weakestEdges: this.feedback.weakestEdges(3),
      memoryStats: this.memory.stats(),
      conflictStats: this.conflicts.stats(),
    }
  }

  _avgScore() {
    const plans = this.planner.recentPlans(50)
    if (plans.length === 0) return null
    return Math.round(plans.reduce((s, p) => s + p.score, 0) / plans.length * 100) / 100
  }
}
