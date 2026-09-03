// ati-core · 工作流规划器
// 接收目标 → 分解子目标 → 自动生成拓扑图 → 执行 → 评估

import { Graph } from './topology.js'
import { GraphExecutor } from './executor.js'
import {
  SensorOperator, LogicOperator, NnOperator,
  ToolOperator, MemoryOperator, ActuatorOperator, Operator,
} from './operators.js'

let _planSeq = 0

export class Planner {
  constructor({ memory = null } = {}) {
    this.memory = memory
    this._plans = new Map() // planId → { goal, graph, executor, result, score }
  }

  /**
   * 注册子目标执行器（用户提前注入能力）
   * capability: { id, type, operator: Operator }
   */
  registerCapability(capId, nodeType, operator) {
    if (!(operator instanceof Operator)) throw new TypeError('expects Operator instance')
    this._capabilities.set(capId, { type: nodeType, operator })
    return this
  }

  _capabilities = new Map()

  /**
   * 从声明式蓝图生成拓扑 + 算子
   * blueprint:
   *   nodes: [{ id, type, capability?, config? }]
   *   edges: [{ from, to, data? }]
   */
  buildFromBlueprint(blueprint, { directed = true, allowCycles = false } = {}) {
    const g = new Graph({ directed, allowCycles })
    const ops = new Map()
    for (const n of blueprint.nodes || []) {
      g.addNode(n.id, { type: n.type || 'custom', ...n.config })
      // 如果有注册的 capability 就用它的算子；否则按类型创建默认算子
      if (n.capability && this._capabilities.has(n.capability)) {
        ops.set(n.id, this._capabilities.get(n.capability).operator)
      } else {
        ops.set(n.id, this._defaultOperator(n))
      }
    }
    for (const e of blueprint.edges || []) {
      g.addEdge(e.from, e.to, e.data || {})
    }
    return { graph: g, operators: ops }
  }

  _defaultOperator(nodeSpec) {
    switch (nodeSpec.type) {
      case 'sensor':
        return new SensorOperator({ source: () => null })
      case 'logic':
        return new LogicOperator({ condition: () => true })
      case 'nn':
        return new NnOperator({ model: async (x) => x })
      case 'tool':
        return new ToolOperator({ execute: async (x) => x })
      case 'memory':
        return new MemoryOperator({ mode: 'read-write' })
      case 'actuator':
        return new ActuatorOperator({ actuate: async (x) => x })
      default:
        return new ToolOperator({ execute: async (x) => x })
    }
  }

  /**
   * 规划并执行一个目标
   * @param {string} description — 目标描述
   * @param {Object} blueprint — 拓扑蓝图（或由 LLM 生成后传入）
   * @param {any} input — 初始输入
   * @returns {{ planId, output, trace, graph }}
   */
  async executePlan(description, blueprint, input = null) {
    const planId = `plan-${++_planSeq}-${Date.now()}`
    const { graph, operators } = this.buildFromBlueprint(blueprint)
    const executor = new GraphExecutor(graph, operators)
    if (this.memory) executor.setMemory(this.memory.shortTerm)

    let result
    try {
      result = await executor.run(input)
    } catch (err) {
      result = { output: null, trace: executor.trace(), error: err.message }
    }

    const entry = {
      planId,
      description,
      graph,
      executor,
      result,
      score: this._autoScore(result),
      ts: Date.now(),
    }
    this._plans.set(planId, entry)

    if (this.memory) {
      this.memory.remember(`plan:${planId}`, { description, output: result.output, score: entry.score })
    }
    return entry
  }

  /** 自动评分：无错误 + 有输出 + trace 全 ok = 高分 */
  _autoScore(result) {
    if (result.error) return 0.0
    if (!result.trace || result.trace.length === 0) return 0.1
    const allOk = result.trace.every((t) => t.ok !== false)
    const hasOutput = result.output != null
    return (allOk ? 0.6 : 0.2) + (hasOutput ? 0.4 : 0.0)
  }

  getPlan(planId) { return this._plans.get(planId) }
  plans() { return [...this._plans.values()] }
  recentPlans(limit = 10) { return this.plans().slice(-limit) }

  /** 获取历史高分拓扑模式（供复用） */
  bestPatterns(minScore = 0.8, limit = 5) {
    return this.plans()
      .filter((p) => p.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}
