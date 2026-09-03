// ati-core · 冲突检测与仲裁
// 多个目标/计划冲突时，基于优先级和资源约束选最优解

export class ConflictResolver {
  constructor() {
    this._goals = new Map() // goalId → { description, priority, resources: Set, planId? }
  }

  /**
   * 声明一个目标
   * @param {string} goalId
   * @param {Object} opts
   * @param {string} opts.description
   * @param {number} opts.priority — 1-10，越高越重要
   * @param {string[]} opts.resources — 需要占用的资源 id（如 'cpu','memory','api-key'）
   */
  addGoal(goalId, { description = '', priority = 5, resources = [] } = {}) {
    if (this._goals.has(goalId)) throw new Error(`goal "${goalId}" already exists`)
    this._goals.set(goalId, { description, priority, resources: new Set(resources) })
    return this
  }

  removeGoal(goalId) { return this._goals.delete(goalId) }
  goals() { return [...this._goals.entries()].map(([id, g]) => ({ id, ...g, resources: [...g.resources] })) }

  /**
   * 检测资源冲突：多个目标争抢同一资源
   * @returns {{ resource, contenders[] }[]}
   */
  detectConflicts() {
    const resourceMap = new Map()
    for (const [goalId, g] of this._goals) {
      for (const res of g.resources) {
        if (!resourceMap.has(res)) resourceMap.set(res, [])
        resourceMap.get(res).push({ goalId, priority: g.priority })
      }
    }
    const conflicts = []
    for (const [resource, contenders] of resourceMap) {
      if (contenders.length > 1) {
        conflicts.push({ resource, contenders: contenders.sort((a, b) => b.priority - a.priority) })
      }
    }
    return conflicts
  }

  hasConflicts() { return this.detectConflicts().length > 0 }

  /**
   * 仲裁：按优先级排序，高优先级先执行；同级按 FIFO
   * 返回：{ approved[], deferred[{ goalId, blockedBy }] }
   */
  resolve() {
    const conflicts = this.detectConflicts()
    const lockedResources = new Set()
    const approved = []
    const deferred = []

    // 全局按优先级排序（同级按声明顺序）
    const sorted = this.goals().sort((a, b) => b.priority - a.priority)

    for (const goal of sorted) {
      const blocking = []
      for (const res of goal.resources) {
        if (lockedResources.has(res)) {
          // 找到谁占了
          const winner = approved.find((g) => g.resources.includes(res))
          blocking.push({ resource: res, heldBy: winner?.id || 'unknown' })
        }
      }
      if (blocking.length > 0) {
        deferred.push({ goalId: goal.id, blockedBy: blocking })
      } else {
        approved.push(goal)
        for (const res of goal.resources) lockedResources.add(res)
      }
    }

    return {
      approved: approved.map((g) => g.id),
      deferred,
      conflicts,
    }
  }

  /** 清空所有目标 */
  reset() { this._goals.clear(); return this }

  stats() {
    return {
      totalGoals: this._goals.size,
      conflicts: this.detectConflicts().length,
      resourcesTracked: new Set([...this._goals.values()].flatMap((g) => [...g.resources])).size,
    }
  }
}
