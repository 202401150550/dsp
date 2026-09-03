// ati-core · 接口层
// 把 SocialNetwork + GraphExecutor 暴露为 HTTP/SSE 服务
// 依赖：node:http（零外部依赖）

import { createServer } from 'node:http'
import { SocialNetwork } from './social.js'

export class AtiServer {
  /**
   * @param {SocialNetwork} social
   * @param {Object} opts
   * @param {number} opts.port
   * @param {string} opts.host
   */
  constructor(social, { port = 7300, host = '127.0.0.1' } = {}) {
    if (!(social instanceof SocialNetwork)) {
      throw new TypeError('expects SocialNetwork instance')
    }
    this.social = social
    this.port = port
    this.host = host
    this._sseClients = new Map()   // userId → Set<res>
    this._server = null
  }

  // ── SSE 推送 ─────────────────────────────────────────
  _pushTo(userId, event) {
    const clients = this._sseClients.get(userId)
    if (!clients) return
    const payload = `data: ${JSON.stringify(event)}\n\n`
    for (const res of clients) {
      try { res.write(payload) } catch { clients.delete(res) }
    }
  }

  _broadcast(event) {
    const payload = `data: ${JSON.stringify(event)}\n\n`
    for (const [, clients] of this._sseClients) {
      for (const res of clients) {
        try { res.write(payload) } catch { clients.delete(res) }
      }
    }
  }

  _sendError(res, status, message) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: message }))
  }

  _sendOk(res, data = {}) {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify({ ok: true, ...data }))
  }

  async _readBody(req) {
    let body = ''
    for await (const chunk of req) body += chunk
    if (!body) return {}
    try { return JSON.parse(body) } catch { return {} }
  }

  // ── 路由 ─────────────────────────────────────────────
  async handle(req, res) {
    const url = new URL(req.url || '/', `http://${this.host}`)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const method = req.method || 'GET'

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    try {
      // ── 健康 ──
      if (path === '/health' && method === 'GET') {
        return this._sendOk(res, { version: '0.4.0', uptime: process.uptime() })
      }

      // ── 加入 / 离开 ──
      if (path === '/join' && method === 'POST') {
        const body = await this._readBody(req)
        const { userId, displayName, isBot } = body
        if (!userId) return this._sendError(res, 400, 'userId required')
        this.social.join(userId, { displayName, isBot })
        this._broadcast({ type: 'user-joined', userId })
        return this._sendOk(res, { userId })
      }

      if (path.startsWith('/user/') && method === 'DELETE') {
        const userId = decodeURIComponent(path.split('/')[2])
        const removed = this.social.leave(userId)
        if (!removed) return this._sendError(res, 404, `user "${userId}" not found`)
        this._broadcast({ type: 'user-left', userId })
        return this._sendOk(res, { removed: true })
      }

      // ── 用户列表 ──
      if (path === '/users' && method === 'GET') {
        return this._sendOk(res, { users: this.social.users() })
      }

      // ── 在场状态 ──
      if (path === '/presence' && method === 'POST') {
        const { userId, status } = await this._readBody(req)
        try {
          this.social.setPresence(userId, status)
        } catch (err) { return this._sendError(res, 404, err.message) }
        this._broadcast({ type: 'presence-changed', userId, status })
        return this._sendOk(res, { userId, status })
      }

      // ── 连接管理 ──
      if (path === '/connect' && method === 'POST') {
        const { userA, userB } = await this._readBody(req)
        try {
          this.social.connect(userA, userB)
        } catch (err) { return this._sendError(res, 409, err.message) }
        this._pushTo(userA, { type: 'connected', peer: userB })
        this._pushTo(userB, { type: 'connected', peer: userA })
        return this._sendOk(res, { connected: true })
      }

      if (path === '/disconnect' && method === 'POST') {
        const { userA, userB } = await this._readBody(req)
        const removed = this.social.disconnect(userA, userB)
        return this._sendOk(res, { removed })
      }

      if (path.startsWith('/connections/') && method === 'GET') {
        const userId = decodeURIComponent(path.split('/')[2])
        return this._sendOk(res, { connections: this.social.connections(userId) })
      }

      // ── 房间 ──
      if (path === '/rooms' && method === 'POST') {
        const { roomId, name, members } = await this._readBody(req)
        try {
          this.social.createRoom(roomId, name || roomId, members || [])
        } catch (err) { return this._sendError(res, 409, err.message) }
        this._broadcast({ type: 'room-created', roomId, name: name || roomId })
        return this._sendOk(res, { roomId })
      }

      if (path.startsWith('/rooms/') && method === 'GET') {
        const parts = path.split('/')
        if (parts[3] === 'members') {
          const roomId = decodeURIComponent(parts[2])
          return this._sendOk(res, { members: this.social.roomMembers(roomId) })
        }
        return this._sendError(res, 404, 'unknown room endpoint')
      }

      if (path.startsWith('/rooms/') && path.endsWith('/join') && method === 'POST') {
        const parts = path.split('/')
        const roomId = decodeURIComponent(parts[2])
        const { userId } = await this._readBody(req)
        try { this.social.joinRoom(roomId, userId) } catch (err) { return this._sendError(res, 409, err.message) }
        this._broadcast({ type: 'room-joined', roomId, userId })
        return this._sendOk(res, { joined: true })
      }

      if (path.startsWith('/rooms/') && path.endsWith('/leave') && method === 'POST') {
        const parts = path.split('/')
        const roomId = decodeURIComponent(parts[2])
        const { userId } = await this._readBody(req)
        this.social.leaveRoom(roomId, userId)
        return this._sendOk(res, { left: true })
      }

      // ── 消息 ──
      if (path === '/message' && method === 'POST') {
        const { from, to, room, body } = await this._readBody(req)
        if (!from || !body) return this._sendError(res, 400, 'from and body required')
        try {
          let msgs
          if (room) {
            msgs = this.social.sendToRoom(from, room, body)
            this._broadcast({ type: 'room-message', from, room, count: msgs.length })
          } else {
            msgs = [this.social.sendMessage(from, to, body)]
            this._pushTo(to, { type: 'message', from, body, seq: msgs[0].seq, ts: msgs[0].ts })
          }
          return this._sendOk(res, { delivered: msgs.length })
        } catch (err) { return this._sendError(res, 400, err.message) }
      }

      if (path.startsWith('/inbox/') && method === 'GET') {
        const userId = decodeURIComponent(path.split('/')[2])
        const unreadOnly = url.searchParams.get('unread') === '1'
        const messages = this.social.inbox(userId, { unreadOnly })
        return this._sendOk(res, { messages, unread: this.social.unreadCount(userId) })
      }

      if (path.startsWith('/inbox/') && path.endsWith('/read') && method === 'POST') {
        const userId = decodeURIComponent(path.split('/')[2])
        const { seqs } = await this._readBody(req)
        const changed = this.social.markRead(userId, seqs)
        return this._sendOk(res, { changed })
      }

      // ── 社交分析 ──
      if (path === '/stats' && method === 'GET') {
        return this._sendOk(res, { stats: this.social.socialStats() })
      }

      if (path.startsWith('/distance/') && method === 'GET') {
        const parts = path.split('/')
        const a = decodeURIComponent(parts[2])
        const b = decodeURIComponent(parts[3] || '')
        return this._sendOk(res, { degrees: this.social.degreesOfSeparation(a, b) })
      }

      if (path.startsWith('/suggestions/') && method === 'GET') {
        const userId = decodeURIComponent(path.split('/')[2])
        return this._sendOk(res, { suggestions: this.social.suggestions(userId) })
      }

      // ── 拓扑导出 ──
      if (path === '/topology' && method === 'GET') {
        const g = this.social.topology()
        return this._sendOk(res, {
          topology: JSON.parse(g.serialize()),
          stats: g.stats(),
        })
      }

      // ── SSE 实时流 ──
      if (path.startsWith('/stream/') && method === 'GET') {
        const userId = decodeURIComponent(path.split('/')[2])
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        })
        if (!this._sseClients.has(userId)) this._sseClients.set(userId, new Set())
        this._sseClients.get(userId).add(res)
        res.write(`data: ${JSON.stringify({ type: 'hello', userId })}\n\n`)
        req.on('close', () => {
          this._sseClients.get(userId)?.delete(res)
        })
        return
      }

      // ── 序列化 ──
      if (path === '/export' && method === 'GET') {
        return new Promise((resolve) => {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          res.end(this.social.serialize())
          resolve()
        })
      }

      return this._sendError(res, 404, `no route: ${method} ${path}`)
    } catch (err) {
      return this._sendError(res, 500, err.message)
    }
  }

  start() {
    return new Promise((resolve) => {
      this._server = createServer((req, res) => this.handle(req, res))
      this._server.listen(this.port, this.host, () => resolve(this))
    })
  }

  stop() {
    return new Promise((resolve) => {
      if (!this._server) return resolve()
      for (const [, clients] of this._sseClients) {
        for (const res of clients) { try { res.end() } catch { /* ignore */ } }
      }
      this._sseClients.clear()
      this._server.close(() => resolve())
      this._server = null
    })
  }
}
