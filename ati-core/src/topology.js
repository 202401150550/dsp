// ati-core · 拓扑 / 图论子模块
// 通用图抽象：节点 + 边 + 超边，支持静态和动态操作
// 不绑定神经网络，上层可复用为：计算图、知识图、Agent 工作流
//
// v0.2 新增：
//   - 节点类型系统（sensor/logic/nn/tool/memory/actuator/custom）
//   - 边类型兼容性校验（可配置）
//   - 动态结构变更事件流（可观测）
//   - 拓扑校验器（环限制 / 节点上限 / 孤立节点 / 类型兼容）
//   - 快照 / 回滚（undo）
//   - rewire（改一条边的目标）

import { Mat } from './linalg.js'

export const NODE_TYPES = ['sensor', 'logic', 'nn', 'tool', 'memory', 'actuator', 'person', 'room', 'bot', 'custom']

/** 默认边兼容矩阵：from.type → 允许连接的 to.type 集合；'*' 表示任意 */
export const DEFAULT_EDGE_COMPAT = {
  sensor:   ['logic', 'nn', 'memory'],
  logic:    ['nn', 'tool', 'actuator', 'memory', 'logic'],
  nn:       ['actuator', 'memory', 'logic', 'nn'],
  tool:     ['logic', 'memory', 'actuator'],
  memory:   ['logic', 'nn', 'sensor', 'actuator'],
  actuator: ['memory'],
  // 社交拓扑：person ↔ person 双向对话；person → bot；person/bot → room
  person:   ['person', 'bot', 'room', 'memory', 'custom'],
  bot:      ['person', 'bot', 'room', 'nn', 'tool', 'memory', 'custom'],
  room:     ['*'],
  custom:   ['*'],
}

export class Graph {
  constructor({
    directed = false,
    maxNodes = Infinity,
    allowCycles = true,
    edgeCompat = DEFAULT_EDGE_COMPAT,
    onEvent = null,
  } = {}) {
    this.directed = directed
    this.maxNodes = maxNodes
    this.allowCycles = allowCycles
    this.edgeCompat = edgeCompat || DEFAULT_EDGE_COMPAT
    this._nodes = new Map()
    this._edges = new Map()
    this._hyper = new Map()
    this._events = []
    this._onEvent = onEvent
  }

  _emit(kind, detail) {
    const ev = { kind, detail, ts: Date.now(), seq: this._events.length }
    this._events.push(ev)
    if (this._events.length > 500) this._events.shift()
    if (typeof this._onEvent === 'function') {
      try { this._onEvent(ev) } catch { /* listener error must not break graph */ }
    }
  }

  eventLog(limit = 100) { return this._events.slice(-limit) }

  // ── 节点 ─────────────────────────────────────────────
  addNode(id, data = {}) {
    if (this._nodes.has(id)) throw new Error(`node "${id}" already exists`)
    if (this._nodes.size >= this.maxNodes) {
      throw new Error(`maxNodes (${this.maxNodes}) reached`)
    }
    const type = data.type || 'custom'
    if (!NODE_TYPES.includes(type)) {
      throw new Error(`invalid node type "${type}" (allowed: ${NODE_TYPES.join(', ')})`)
    }
    this._nodes.set(id, { ...data, type })
    this._emit('add-node', { id, type })
    return this
  }

  hasNode(id) { return this._nodes.has(id) }

  removeNode(id) {
    if (!this._nodes.has(id)) return false
    const droppedEdges = []
    this._nodes.delete(id)
    for (const [key, edge] of [...this._edges]) {
      if (edge.from === id || edge.to === id) {
        droppedEdges.push(`${edge.from}→${edge.to}`)
        this._edges.delete(key)
      }
    }
    for (const [hid, h] of [...this._hyper]) {
      if (h.members.has(id)) this.removeHyperedge(hid)
    }
    this._emit('remove-node', { id, droppedEdges })
    return true
  }

  nodeIds() { return [...this._nodes.keys()] }
  nodeData(id) { return this._nodes.get(id) }
  nodeType(id) { return this._nodes.get(id)?.type || null }

  nodesByType(type) {
    return [...this._nodes.entries()].filter(([, d]) => d.type === type).map(([id]) => id)
  }

  // ── 边 ───────────────────────────────────────────────
  _edgeKey(a, b) {
    return this.directed ? `${a}\u0000${b}` : [a, b].sort().join('\u0000')
  }

  _edgeAllowed(from, to) {
    const ft = this.nodeType(from)
    const tt = this.nodeType(to)
    const allowed = this.edgeCompat[ft] || this.edgeCompat.custom || ['*']
    return allowed.includes('*') || allowed.includes(tt)
  }

  addEdge(from, to, data = {}) {
    if (!this._nodes.has(from)) throw new Error(`node "${from}" not found`)
    if (!this._nodes.has(to)) throw new Error(`node "${to}" not found`)
    const key = this._edgeKey(from, to)
    if (this._edges.has(key)) throw new Error(`edge ${from}↔${to} already exists`)
    if (!this._edgeAllowed(from, to)) {
      throw new Error(`edge type mismatch: ${this.nodeType(from)} → ${this.nodeType(to)} not allowed`)
    }
    this._edges.set(key, { from, to, ...data })
    this._emit('add-edge', { from, to })
    if (!this.allowCycles && this.hasCycle()) {
      this._edges.delete(key)
      this._emit('reject-edge', { from, to, reason: 'would-create-cycle' })
      throw new Error(`edge ${from}→${to} would create a cycle (allowCycles=false)`)
    }
    return this
  }

  hasEdge(from, to) { return this._edges.has(this._edgeKey(from, to)) }

  removeEdge(from, to) {
    const removed = this._edges.delete(this._edgeKey(from, to))
    if (removed) this._emit('remove-edge', { from, to })
    return removed
  }

  /** 改一条边的目标（ACI 结构搜索常用） */
  rewire(from, oldTo, newTo) {
    if (!this.hasEdge(from, oldTo)) throw new Error(`edge ${from}→${oldTo} not found`)
    if (this.hasEdge(from, newTo)) throw new Error(`edge ${from}→${newTo} already exists`)
    if (!this._edgeAllowed(from, newTo)) {
      throw new Error(`rewire type mismatch: ${this.nodeType(from)} → ${this.nodeType(newTo)} not allowed`)
    }
    const data = { ...this._edges.get(this._edgeKey(from, oldTo)) }
    this.removeEdge(from, oldTo)
    try {
      this.addEdge(from, newTo, data)
      this._emit('rewire', { from, fromOld: oldTo, to: newTo })
    } catch (err) {
      this.addEdge(from, oldTo, data)
      throw err
    }
    return this
  }

  edges() { return [...this._edges.values()] }
  edgeCount() { return this._edges.size }
  nodeCount() { return this._nodes.size }

  neighbors(id) {
    const out = []
    for (const e of this._edges.values()) {
      if (e.from === id) out.push(e.to)
      else if (!this.directed && e.to === id) out.push(e.from)
    }
    return out
  }

  degree(id) {
    let d = 0
    for (const e of this._edges.values()) {
      if (e.from === id) d++
      if (!this.directed && e.to === id) d++
    }
    return d
  }

  // ── 超边 ─────────────────────────────────────────────
  addHyperedge(id, memberIds, data = {}) {
    for (const m of memberIds) {
      if (!this._nodes.has(m)) throw new Error(`hyperedge member "${m}" not found`)
    }
    if (this._hyper.has(id)) throw new Error(`hyperedge "${id}" already exists`)
    this._hyper.set(id, { members: new Set(memberIds), ...data })
    this._emit('add-hyperedge', { id, members: [...memberIds] })
    return this
  }

  removeHyperedge(id) {
    const removed = this._hyper.delete(id)
    if (removed) this._emit('remove-hyperedge', { id })
    return removed
  }

  hyperedges() {
    return [...this._hyper.entries()].map(([id, h]) => ({ ...h, id, members: [...h.members] }))
  }

  // ── 矩阵表示 ─────────────────────────────────────────
  adjacencyMatrix() {
    const ids = this.nodeIds()
    const idx = new Map(ids.map((id, i) => [id, i]))
    const n = ids.length
    const m = Mat.zeros(n, n)
    for (const e of this._edges.values()) {
      const i = idx.get(e.from), j = idx.get(e.to)
      m.set(i, j, 1)
      if (!this.directed) m.set(j, i, 1)
    }
    return { matrix: m, nodeOrder: ids }
  }

  laplacianMatrix(normalized = false) {
    const { matrix: A, nodeOrder: ids } = this.adjacencyMatrix()
    const n = ids.length
    const D = Array.from({ length: n }, (_, i) => {
      let deg = 0
      for (let j = 0; j < n; j++) deg += A.get(i, j)
      return deg
    })
    const L = Mat.zeros(n, n)
    if (!normalized) {
      for (let i = 0; i < n; i++) {
        L.set(i, i, D[i])
        for (let j = 0; j < n; j++) L.set(i, j, L.get(i, j) - A.get(i, j))
      }
    } else {
      for (let i = 0; i < n; i++) {
        const di = D[i] > 0 ? Math.sqrt(D[i]) : 1
        for (let j = 0; j < n; j++) {
          const dj = D[j] > 0 ? Math.sqrt(D[j]) : 1
          L.set(i, j, (i === j ? 1 : 0) - A.get(i, j) / (di * dj))
        }
      }
    }
    return { matrix: L, nodeOrder: ids }
  }

  // ── 分析 ─────────────────────────────────────────────
  connectedComponents() {
    const visited = new Set()
    const comps = []
    for (const start of this._nodes.keys()) {
      if (visited.has(start)) continue
      const comp = []
      const stack = [start]
      while (stack.length) {
        const cur = stack.pop()
        if (visited.has(cur)) continue
        visited.add(cur)
        comp.push(cur)
        for (const nb of this.neighbors(cur)) stack.push(nb)
      }
      comps.push(comp.sort())
    }
    return comps
  }

  isConnected() {
    if (this.nodeCount() === 0) return true
    return this.connectedComponents().length === 1
  }

  hasCycle() {
    if (this.directed) return this._hasCycleDirected()
    return this._hasCycleUndirected()
  }

  _hasCycleDirected() {
    const color = new Map()
    for (const id of this._nodes.keys()) color.set(id, 'white')
    const visit = (id) => {
      color.set(id, 'gray')
      for (const nb of this.neighbors(id)) {
        const c = color.get(nb)
        if (c === 'gray') return true
        if (c === 'white' && visit(nb)) return true
      }
      color.set(id, 'black')
      return false
    }
    for (const id of this._nodes.keys()) {
      if (color.get(id) === 'white' && visit(id)) return true
    }
    return false
  }

  _hasCycleUndirected() {
    const parent = new Map([...this._nodes.keys()].map((id) => [id, id]))
    const find = (x) => {
      while (parent.get(x) !== x) x = parent.get(x)
      return x
    }
    const union = (a, b) => {
      const ra = find(a), rb = find(b)
      if (ra === rb) return true
      parent.set(ra, rb)
      return false
    }
    for (const e of this._edges.values()) {
      if (union(e.from, e.to)) return true
    }
    return false
  }

  topologicalSort() {
    if (!this.directed) throw new Error('topological sort requires directed graph')
    if (this.hasCycle()) return null
    const inDeg = new Map([...this._nodes.keys()].map((id) => [id, 0]))
    for (const e of this._edges.values()) inDeg.set(e.to, inDeg.get(e.to) + 1)
    const queue = [...inDeg.entries()].filter(([, d]) => d === 0).map(([id]) => id)
    const order = []
    while (queue.length) {
      const cur = queue.shift()
      order.push(cur)
      for (const nb of this.neighbors(cur)) {
        inDeg.set(nb, inDeg.get(nb) - 1)
        if (inDeg.get(nb) === 0) queue.push(nb)
      }
    }
    return order.length === this.nodeCount() ? order : null
  }

  subgraph(ids) {
    const set = new Set(ids)
    const g = new Graph({
      directed: this.directed,
      maxNodes: this.maxNodes,
      allowCycles: this.allowCycles,
      edgeCompat: this.edgeCompat,
    })
    for (const id of ids) {
      if (!this._nodes.has(id)) continue
      g.addNode(id, this._nodes.get(id))
    }
    for (const e of this._edges.values()) {
      if (set.has(e.from) && set.has(e.to)) g.addEdge(e.from, e.to, e.data ?? {})
    }
    return g
  }

  // ── 校验器 ───────────────────────────────────────────
  validate() {
    const errors = []
    const warnings = []

    if (this.nodeCount() > this.maxNodes) {
      errors.push(`node count ${this.nodeCount()} exceeds maxNodes ${this.maxNodes}`)
    }
    if (!this.allowCycles && this.hasCycle()) {
      errors.push('cycle detected but allowCycles=false')
    }
    // 孤立节点
    const orphans = [...this._nodes.keys()].filter((id) => this.degree(id) === 0)
    if (orphans.length > 0) {
      warnings.push(`orphan nodes (no edges): ${orphans.join(', ')}`)
    }
    // 边类型兼容
    for (const e of this._edges.values()) {
      if (!this._edgeAllowed(e.from, e.to)) {
        errors.push(`edge type mismatch: ${e.from}(${this.nodeType(e.from)}) → ${e.to}(${this.nodeType(e.to)})`)
      }
    }
    return { ok: errors.length === 0, errors, warnings }
  }

  /** 结构统计摘要 */
  stats() {
    const typeDist = {}
    for (const d of this._nodes.values()) {
      typeDist[d.type || 'custom'] = (typeDist[d.type || 'custom'] || 0) + 1
    }
    const n = this.nodeCount()
    const maxEdges = this.directed ? n * (n - 1) : n * (n - 1) / 2
    return {
      nodes: n,
      edges: this.edgeCount(),
      hyperedges: this._hyper.size,
      density: maxEdges > 0 ? this.edgeCount() / maxEdges : 0,
      typeDistribution: typeDist,
      hasCycle: this.hasCycle(),
      components: this.connectedComponents().length,
      connected: this.isConnected(),
      events: this._events.length,
    }
  }

  // ── 动态拓扑 ─────────────────────────────────────────
  clone() {
    const g = new Graph({
      directed: this.directed,
      maxNodes: this.maxNodes,
      allowCycles: this.allowCycles,
      edgeCompat: this.edgeCompat,
    })
    for (const [id, d] of this._nodes) g.addNode(id, { ...d })
    for (const e of this._edges.values()) g.addEdge(e.from, e.to, e.data ?? {})
    for (const [hid, h] of this._hyper) g.addHyperedge(hid, [...h.members], h.data ?? {})
    return g
  }

  mergeEdges(other) {
    for (const e of other.edges()) {
      if (!this.hasNode(e.from)) this.addNode(e.from, {})
      if (!this.hasNode(e.to)) this.addNode(e.to, {})
      if (!this.hasEdge(e.from, e.to)) this.addEdge(e.from, e.to, e.data ?? {})
    }
    return this
  }

  // ── 快照 / 回滚 ──────────────────────────────────────
  snapshot() {
    return {
      nodes: new Map([...this._nodes].map(([id, d]) => [id, { ...d }])),
      edges: new Map([...this._edges]),
      hyper: new Map([...this._hyper].map(([id, h]) => [id, { ...h, members: new Set(h.members) }])),
      directed: this.directed,
    }
  }

  restore(snap) {
    this._nodes = new Map([...snap.nodes].map(([id, d]) => [id, { ...d }]))
    this._edges = new Map([...snap.edges])
    this._hyper = new Map([...snap.hyper].map(([id, h]) => [id, { ...h, members: new Set(h.members) }]))
    this.directed = snap.directed
    this._emit('restore', { nodes: this.nodeCount(), edges: this.edgeCount() })
    return this
  }

  // ── 序列化 ───────────────────────────────────────────
  serialize() {
    return JSON.stringify({
      directed: this.directed,
      maxNodes: this.maxNodes,
      allowCycles: this.allowCycles,
      nodes: [...this._nodes].map(([id, d]) => ({ id, data: d })),
      edges: [...this._edges.values()],
      hyperedges: this.hyperedges(),
    })
  }

  static deserialize(json) {
    const raw = typeof json === 'string' ? JSON.parse(json) : json
    const g = new Graph({
      directed: !!raw.directed,
      maxNodes: raw.maxNodes ?? Infinity,
      allowCycles: raw.allowCycles !== false,
    })
    for (const n of raw.nodes || []) g.addNode(n.id, n.data || {})
    for (const e of raw.edges || []) g.addEdge(e.from, e.to, e.data || {})
    for (const h of raw.hyperedges || []) g.addHyperedge(h.id, h.members, h.data || {})
    return g
  }
}
