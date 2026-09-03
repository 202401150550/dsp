// ati-core · 算子层
// 统一 forward(input) → output 协议
// 四种节点算子：NN / Logic / Tool / Memory，挂载在拓扑节点上

/**
 * 所有算子的基类。子类必须实现 forward(input, ctx)。
 * input: 任意值（由上游节点输出决定）
 * ctx:   { graph, nodeId, memory: Map, log: (msg) => void }
 */
export class Operator {
  constructor(config = {}) {
    this.config = config
    this._callCount = 0
    this._lastError = null
  }

  async forward(input, ctx) {
    throw new Error(`${this.constructor.name} must implement forward()`)
  }

  /** 子类可覆盖以声明自己接受的输入描述（用于校验/文档） */
  get inputSchema() { return 'any' }
  get outputSchema() { return 'any' }

  stats() {
    return {
      type: this.constructor.name,
      calls: this._callCount,
      lastError: this._lastError,
    }
  }

  _record(input) {
    this._callCount++
    this._lastInput = input
  }

  _fail(err) {
    this._lastError = err
    throw err
  }
}

// ── NN 算子（占位：后续接真模型）─────────────────────────

export class NnOperator extends Operator {
  /**
   * config:
   *   model: async (input) => output  — 外部注入的推理函数
   *   name: string                    — 显示名
   */
  constructor(config = {}) {
    super(config)
    if (typeof config.model !== 'function') {
      throw new Error('NnOperator requires config.model: async function')
    }
  }

  async forward(input, ctx) {
    this._record(input)
    try {
      const output = await this.config.model(input)
      return output
    } catch (err) {
      this._fail(new Error(`NnOperator[${this.config.name || '?'}] inference failed: ${err.message}`))
    }
  }
}

// ── 逻辑算子 ─────────────────────────────────────────────

export class LogicOperator extends Operator {
  /**
   * config:
   *   condition: (input, ctx) => bool        — 判断函数
   *   trueTarget / falseTarget: nodeId|null  — 条件路由（executor 用）
   *   transform: (input) => any              — 可选变换
   */
  constructor(config = {}) {
    super(config)
    if (typeof config.condition !== 'function') {
      throw new Error('LogicOperator requires config.condition')
    }
  }

  async forward(input, ctx) {
    this._record(input)
    const passes = !!this.config.condition(input, ctx)
    const result = {
      branch: passes ? 'true' : 'false',
      value: typeof this.config.transform === 'function'
        ? this.config.transform(input)
        : input,
    }
    return result
  }
}

// ── 工具算子 ─────────────────────────────────────────────

export class ToolOperator extends Operator {
  /**
   * config:
   *   execute: async (input, ctx) => any  — 实际工具调用
   *   name: string                        — 工具名
   *   timeoutMs: number                   — 超时
   */
  constructor(config = {}) {
    super(config)
    if (typeof config.execute !== 'function') {
      throw new Error('ToolOperator requires config.execute')
    }
    this.timeoutMs = config.timeoutMs ?? 30000
  }

  async forward(input, ctx) {
    this._record(input)
    try {
      const result = await Promise.race([
        Promise.resolve(this.config.execute(input, ctx)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`tool timeout (${this.timeoutMs}ms)`)), this.timeoutMs)),
      ])
      return result
    } catch (err) {
      this._fail(new Error(`ToolOperator[${this.config.name || '?'}]: ${err.message}`))
    }
  }
}

// ── 记忆算子 ─────────────────────────────────────────────

export class MemoryOperator extends Operator {
  /**
   * config:
   *   mode: 'read' | 'write' | 'read-write'
   *   key: string | (input) => string       — 读写的键
   *   defaultValue: any                     — read 时 miss 的默认值
   *   serialize / deserialize: 可选转换
   */
  constructor(config = {}) {
    super(config)
    this.mode = config.mode || 'read-write'
    if (!['read', 'write', 'read-write'].includes(this.mode)) {
      throw new Error(`MemoryOperator invalid mode "${this.mode}"`)
    }
  }

  _resolveKey(input) {
    return typeof this.config.key === 'function' ? this.config.key(input) : this.config.key
  }

  async forward(input, ctx) {
    this._record(input)
    if (!ctx.memory || !(ctx.memory instanceof Map)) {
      this._fail(new Error('ctx.memory must be a Map'))
    }
    const key = this._resolveKey(input)

    if (this.mode === 'write') {
      ctx.memory.set(key, input)
      return { written: key, value: input }
    }
    if (this.mode === 'read') {
      const val = ctx.memory.has(key) ? ctx.memory.get(key) : this.config.defaultValue
      return val
    }
    // read-write: 读旧值，写新值，返回旧值
    const oldVal = ctx.memory.has(key) ? ctx.memory.get(key) : undefined
    ctx.memory.set(key, input)
    return { previous: oldVal, current: input }
  }
}

// ── 传感器 / 执行器（轻量封装）───────────────────────────

export class SensorOperator extends Operator {
  /** config.source: () => any 或 async */
  constructor(config = {}) {
    super(config)
    if (typeof config.source !== 'function') {
      throw new Error('SensorOperator requires config.source')
    }
  }

  async forward(input, ctx) {
    this._record(input)
    return await this.config.source(ctx)
  }
}

export class ActuatorOperator extends Operator {
  /** config.actuate: async (input, ctx) => any */
  constructor(config = {}) {
    super(config)
    if (typeof config.actuate !== 'function') {
      throw new Error('ActuatorOperator requires config.actuate')
    }
  }

  async forward(input, ctx) {
    this._record(input)
    return await this.config.actuate(input, ctx)
  }
}

// ── 算子注册表 ───────────────────────────────────────────

const OPERATOR_REGISTRY = new Map()

export function registerOperator(type, operatorClass) {
  OPERATOR_REGISTRY.set(type, operatorClass)
}

export function createOperator(type, config) {
  const Cls = OPERATOR_REGISTRY.get(type)
  if (!Cls) throw new Error(`no operator registered for type "${type}"`)
  return new Cls(config)
}

// 内置注册
registerOperator('nn', NnOperator)
registerOperator('logic', LogicOperator)
registerOperator('tool', ToolOperator)
registerOperator('memory', MemoryOperator)
registerOperator('sensor', SensorOperator)
registerOperator('actuator', ActuatorOperator)
