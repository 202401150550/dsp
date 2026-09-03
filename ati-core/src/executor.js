// ati-core · 图执行器
// 按拓扑序遍历图，把上游输出作为下游输入，驱动整张拓扑图

import { Graph } from './topology.js'

export class GraphExecutor {
  /**
   * @param {Graph} graph
   * @param {Map<string, Operator>} operators  nodeId → Operator 实例
   */
  constructor(graph, operators) {
    if (!(graph instanceof Graph)) throw new TypeError('expects Graph instance')
    if (!(operators instanceof Map)) throw new TypeError('expects Map<nodeId, Operator>')
    // 校验：每个参与边的节点都必须有算子
    const connected = new Set()
    for (const e of graph.edges()) {
      connected.add(e.from)
      connected.add(e.to)
    }
    for (const id of connected) {
      if (!operators.has(id)) {
        throw new Error(`node "${id}" is connected but has no operator`)
      }
    }
    this.graph = graph
    this.operators = operators
    this._trace = []
    this._memory = new Map()
  }

  get memory() { return this._memory }
  setMemory(mem) { this._memory = mem; return this }

  trace(limit = 100) { return this._trace.slice(-limit) }

  /**
   * 执行一次完整推理
   * @param {any} input  初始输入
   * @param {string} entryNode  入口节点 id（可选，默认用拓扑序第一个）
   * @returns {{ output: any, trace: Array }}
   */
  async run(input, entryNode = null) {
    const order = this.graph.topologicalSort()
    if (!order) {
      throw new Error('graph has a cycle — cannot execute (use allowCycles=false at construction)')
    }
    const startIdx = entryNode ? order.indexOf(entryNode) : 0
    if (startIdx === -1) throw new Error(`entryNode "${entryNode}" not in topological order`)

    this._trace = []
    // nodeOutputs: nodeId → 最后一次 forward 的输出
    const nodeOutputs = new Map()

    for (let i = startIdx; i < order.length; i++) {
      const nodeId = order[i]
      const op = this.operators.get(nodeId)
      if (!op) continue // 孤立节点无算子，跳过

      // 收集所有上游输出作为本节点输入
      const upstream = []
      for (const e of this.graph.edges()) {
        if (e.to === nodeId && nodeOutputs.has(e.from)) {
          upstream.push({ from: e.from, value: nodeOutputs.get(e.from) })
        }
      }

      let input
      if (upstream.length === 0) {
        input = input ?? null
      } else if (upstream.length === 1) {
        input = upstream[0].value
      } else {
        input = upstream // 多上游时给数组
      }

      // 首节点且无上游 → 用外部 input
      if (upstream.length === 0 && i === startIdx) {
        input = input ?? null
      }

      const ctx = {
        graph: this.graph,
        nodeId,
        memory: this._memory,
        log: (msg) => this._trace.push({ node: nodeId, msg, ts: Date.now() }),
      }

      const t0 = Date.now()
      try {
        const output = await op.forward(input, ctx)
        const dt = Date.now() - t0
        nodeOutputs.set(nodeId, output)
        this._trace.push({
          node: nodeId,
          type: this.graph.nodeType(nodeId),
          input,
          output,
          ms: dt,
          ok: true,
          ts: Date.now(),
        })
      } catch (err) {
        this._trace.push({
          node: nodeId,
          type: this.graph.nodeType(nodeId),
          input,
          error: err.message,
          ok: false,
          ts: Date.now(),
        })
        throw new Error(`executor failed at node "${nodeId}": ${err.message}`)
      }
    }

    // 返回最后一个有输出的节点的结果
    let finalOutput = null
    for (const id of [...nodeOutputs.keys()].reverse()) {
      finalOutput = nodeOutputs.get(id)
      break
    }
    return { output: finalOutput, trace: this.trace() }
  }

  /** 只执行到某个节点（部分推理） */
  async runTo(input, targetNodeId) {
    const order = this.graph.topologicalSort()
    const idx = order.indexOf(targetNodeId)
    if (idx === -1) throw new Error(`node "${targetNodeId}" not in graph`)
    const sub = this.graph.subgraph(order.slice(0, idx + 1))
    const subOps = new Map()
    for (const id of sub.nodeIds()) {
      if (this.operators.has(id)) subOps.set(id, this.operators.get(id))
    }
    const subExec = new GraphExecutor(sub, subOps)
    return subExec.run(input)
  }

  reset() {
    this._trace = []
    this._memory.clear()
  }
}
