// ati-core · 社交拓扑层（元宇宙原型）
// 每个人 = 一个 person 节点；边 = 对话通道；超边 = 群聊房间
// 复用底层 Graph 全部数学能力（连通性、拉普拉斯、环检测）

import { Graph } from './topology.js'

let _msgSeq = 0

export class SocialNetwork {
  constructor({ onEvent = null } = {}) {
    this.graph = new Graph({
      directed: false,       // 社交关系默认双向
      allowCycles: true,     // 人际网允许环（朋友的朋友）
      maxNodes: Infinity,
      edgeCompat: {
        person: ['person', 'bot', 'room'],
        bot:    ['person', 'bot', 'room'],
        room:   ['*'],
        custom: ['*'],
      },
      onEvent,
    })
    this._inboxes = new Map()   // userId → [{ from, body, ts, seq }]
    this._presence = new Map()  // userId → 'online' | 'offline'
    this._rooms = new Map()     // roomId → { name, members:Set }
    this._onEvent = onEvent
  }

  _emit(kind, detail) {
    if (typeof this._onEvent === 'function') {
      try { this._onEvent({ kind, detail, ts: Date.now() }) } catch { /* ignore */ }
    }
  }

  // ── 身份与在场 ────────────────────────────────────────
  join(userId, { displayName = '', isBot = false } = {}) {
    if (this.graph.hasNode(userId)) throw new Error(`user "${userId}" already joined`)
    const type = isBot ? 'bot' : 'person'
    this.graph.addNode(userId, { type, displayName: displayName || userId })
    this._inboxes.set(userId, [])
    this._presence.set(userId, 'online')
    this._emit('join', { userId, type })
    return this
  }

  leave(userId) {
    if (!this.graph.hasNode(userId)) return false
    // 清理所有包含此用户的房间
    for (const [rid, room] of [...this._rooms]) {
      if (room.members.has(userId)) {
        room.members.delete(userId)
        if (room.members.size === 0) {
          this._rooms.delete(rid)
          this.graph.removeNode(rid)
        }
      }
    }
    this.graph.removeNode(userId)
    this._inboxes.delete(userId)
    this._presence.delete(userId)
    this._emit('leave', { userId })
    return true
  }

  isOnline(userId) { return this._presence.get(userId) === 'online' }
  setPresence(userId, status) {
    if (!this._presence.has(userId)) throw new Error(`user "${userId}" not found`)
    this._presence.set(userId, status)
    this._emit('presence', { userId, status })
    return this
  }

  users() {
    return [...this._presence.keys()].map((id) => ({
      id,
      type: this.graph.nodeType(id),
      displayName: this.graph.nodeData(id)?.displayName || id,
      online: this.isOnline(id),
    }))
  }

  // ── 连接（好友 / 关注）────────────────────────────────
  connect(userA, userB, data = {}) {
    for (const u of [userA, userB]) {
      if (!this.graph.hasNode(u)) throw new Error(`user "${u}" not found — join first`)
    }
    if (this.graph.hasEdge(userA, userB)) {
      throw new Error(`${userA} and ${userB} already connected`)
    }
    this.graph.addEdge(userA, userB, { kind: 'connection', ...data })
    this._emit('connect', { userA, userB })
    return this
  }

  disconnect(userA, userB) {
    const removed = this.graph.removeEdge(userA, userB)
    if (removed) this._emit('disconnect', { userA, userB })
    return removed
  }

  connections(userId) { return this.graph.neighbors(userId) }
  isConnected(a, b) { return this.graph.hasEdge(a, b) }

  /** 好友的好友（二度人脉） */
  suggestions(userId) {
    const direct = new Set(this.connections(userId))
    const out = new Set()
    for (const friend of direct) {
      for (const foaf of this.connections(friend)) {
        if (foaf !== userId && !direct.has(foaf)) out.add(foaf)
      }
    }
    return [...out]
  }

  // ── 房间（群聊，基于超边）─────────────────────────────
  createRoom(roomId, name, memberIds) {
    if (this.graph.hasNode(roomId)) throw new Error(`room "${roomId}" already exists`)
    for (const m of memberIds) {
      if (!this.graph.hasNode(m)) throw new Error(`member "${m}" not found`)
    }
    this.graph.addNode(roomId, { type: 'room', displayName: name })
    this._rooms.set(roomId, { name, members: new Set(memberIds) })
    // 房间节点和每个成员连一条边（方便图遍历）
    for (const m of memberIds) {
      this.graph.addEdge(m, roomId, { kind: 'member-of' })
    }
    this._emit('create-room', { roomId, name, members: [...memberIds] })
    return this
  }

  joinRoom(roomId, userId) {
    const room = this._rooms.get(roomId)
    if (!room) throw new Error(`room "${roomId}" not found`)
    if (!this.graph.hasNode(userId)) throw new Error(`user "${userId}" not found`)
    if (room.members.has(userId)) throw new Error(`"${userId}" already in room`)
    room.members.add(userId)
    this.graph.addEdge(userId, roomId, { kind: 'member-of' })
    this._emit('join-room', { roomId, userId })
    return this
  }

  leaveRoom(roomId, userId) {
    const room = this._rooms.get(roomId)
    if (!room) return false
    room.members.delete(userId)
    this.graph.removeEdge(userId, roomId)
    this._emit('leave-room', { roomId, userId })
    return true
  }

  roomsOf(userId) {
    const out = []
    for (const [rid, room] of this._rooms) {
      if (room.members.has(userId)) out.push({ id: rid, name: room.name })
    }
    return out
  }

  roomMembers(roomId) {
    const room = this._rooms.get(roomId)
    return room ? [...room.members] : []
  }

  // ── 消息传递 ─────────────────────────────────────────
  sendMessage(from, to, body) {
    if (!this.graph.hasNode(from)) throw new Error(`sender "${from}" not found`)
    if (!this.graph.hasNode(to)) throw new Error(`recipient "${to}" not found`)
    if (!this.isConnected(from, to)) {
      throw new Error(`${from} → ${to}: no connection established`)
    }
    const msg = {
      seq: ++_msgSeq,
      from,
      to,
      body,
      ts: Date.now(),
    }
    if (!this._inboxes.has(to)) this._inboxes.set(to, [])
    this._inboxes.get(to).push(msg)
    // sender 也留一份 sent 记录
    if (!this._inboxes.has(`__sent:${from}`)) this._inboxes.set(`__sent:${from}`, [])
    this._inboxes.get(`__sent:${from}`).push(msg)
    this._emit('message', { from, to, seq: msg.seq, body: msg.body })
    return msg
  }

  sendToRoom(from, roomId, body) {
    const room = this._rooms.get(roomId)
    if (!room) throw new Error(`room "${roomId}" not found`)
    if (!room.members.has(from)) throw new Error(`"${from}" is not in room "${roomId}"`)
    const messages = []
    for (const member of room.members) {
      if (member === from) continue
      // 房间广播不要求点对点连接——room 本身就是通道
      const msg = {
        seq: ++_msgSeq,
        from,
        to: member,
        room: roomId,
        body,
        ts: Date.now(),
      }
      if (!this._inboxes.has(member)) this._inboxes.set(member, [])
      this._inboxes.get(member).push(msg)
      messages.push(msg)
    }
    this._emit('room-message', { from, roomId, count: messages.length })
    return messages
  }

  inbox(userId, { unreadOnly = false } = {}) {
    const msgs = this._inboxes.get(userId) || []
    if (unreadOnly) return msgs.filter((m) => !m.read)
    return [...msgs]
  }

  markRead(userId, seqs = null) {
    const msgs = this._inboxes.get(userId) || []
    let changed = 0
    for (const m of msgs) {
      if (seqs && !seqs.includes(m.seq)) continue
      if (!m.read) { m.read = true; changed++ }
    }
    return changed
  }

  unreadCount(userId) {
    return (this._inboxes.get(userId) || []).filter((m) => !m.read).length
  }

  // ── 图分析（社交网络指标）─────────────────────────────
  socialStats() {
    const gs = this.graph.stats()
    return {
      ...gs,
      users: this.users().length,
      onlineUsers: this.users().filter((u) => u.online).length,
      bots: this.users().filter((u) => u.type === 'bot').length,
      rooms: this._rooms.size,
      totalMessages: _msgSeq,
      density: gs.density,
    }
  }

  /** 最短消息路径（通过多少个中间人） */
  degreesOfSeparation(userA, userB) {
    if (!this.graph.hasNode(userA) || !this.graph.hasNode(userB)) return -1
    if (userA === userB) return 0
    const visited = new Set([userA])
    let frontier = [userA]
    let dist = 0
    while (frontier.length) {
      dist++
      const next = []
      for (const cur of frontier) {
        for (const nb of this.graph.neighbors(cur)) {
          if (nb === userB) return dist
          if (!visited.has(nb)) {
            visited.add(nb)
            next.push(nb)
          }
        }
      }
      frontier = next
    }
    return -1
  }

  /** 底层拓扑图（供可视化/导出用） */
  topology() { return this.graph }

  serialize() {
    return JSON.stringify({
      graph: JSON.parse(this.graph.serialize()),
      presence: Object.fromEntries(this._presence),
      rooms: Object.fromEntries([...this._rooms].map(([k, v]) => [k, { name: v.name, members: [...v.members] }])),
      inboxes: Object.fromEntries([...this._inboxes].map(([k, v]) => [k, v])),
    })
  }

  static deserialize(json) {
    const raw = typeof json === 'string' ? JSON.parse(json) : json
    const sn = new SocialNetwork()
    sn.graph = Graph.deserialize(raw.graph)
    for (const [k, v] of Object.entries(raw.presence || {})) sn._presence.set(k, v)
    for (const [k, v] of Object.entries(raw.rooms || {})) {
      sn._rooms.set(k, { name: v.name, members: new Set(v.members) })
    }
    for (const [k, v] of Object.entries(raw.inboxes || {})) {
      sn._inboxes.set(k, v)
    }
    return sn
  }
}
