import test from 'node:test'
import assert from 'node:assert/strict'
import { SocialNetwork } from '../src/social.js'
import { AtiServer } from '../src/server.js'

const PORT = 17300
let server
const BASE = `http://127.0.0.1:${PORT}`

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  return res.json()
}

test.before(async () => {
  const sn = new SocialNetwork()
  server = new AtiServer(sn, { port: PORT, host: '127.0.0.1' })
  await server.start()
})

test.after(async () => {
  await server.stop()
})

// ── 健康检查 ──

test('GET /health', async () => {
  const data = await api('/health')
  assert.ok(data.ok)
  assert.ok(data.version)
})

// ── 用户管理 ──

test('POST /join creates user', async () => {
  const res = await api('/join', { method: 'POST', body: { userId: 'alice', displayName: 'Alice' } })
  assert.ok(res.ok)
})

test('POST /join without userId returns 400', async () => {
  const res = await fetch(`${BASE}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(res.status, 400)
})

test('GET /users lists users', async () => {
  await api('/join', { method: 'POST', body: { userId: 'bob' } })
  const data = await api('/users')
  assert.equal(data.users.length, 2)
  assert.deepEqual(data.users.map((u) => u.id).sort(), ['alice', 'bob'])
})

test('DELETE /user/:id removes user', async () => {
  await api('/join', { method: 'POST', body: { userId: 'temp' } })
  const res = await fetch(`${BASE}/user/temp`, { method: 'DELETE' })
  const data = await res.json()
  assert.ok(data.removed)
})

test('DELETE unknown user returns 404', async () => {
  const res = await fetch(`${BASE}/user/ghost`, { method: 'DELETE' })
  assert.equal(res.status, 404)
})

// ── 连接 ──

test('POST /connect two users', async () => {
  const res = await api('/connect', { method: 'POST', body: { userA: 'alice', userB: 'bob' } })
  assert.ok(res.connected)
})

test('GET /connections/:id', async () => {
  const data = await api('/connections/alice')
  assert.deepEqual(data.connections, ['bob'])
})

test('double connect returns 409', async () => {
  const res = await fetch(`${BASE}/connect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userA: 'alice', userB: 'bob' }),
  })
  assert.equal(res.status, 409)
})

// ── 消息 ──

test('POST /message sends DM', async () => {
  const res = await api('/message', { method: 'POST', body: { from: 'alice', to: 'bob', body: 'hi via API' } })
  assert.ok(res.ok)
  assert.equal(res.delivered, 1)
})

test('message without connection returns 400', async () => {
  await api('/join', { method: 'POST', body: { userId: 'charlie' } })
  const res = await fetch(`${BASE}/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ from: 'charlie', to: 'alice', body: 'stranger' }),
  })
  assert.equal(res.status, 400)
})

test('GET /inbox/:id returns messages', async () => {
  const data = await api('/inbox/bob')
  assert.ok(data.messages.length >= 1)
  assert.equal(data.messages[0].body, 'hi via API')
  assert.ok(data.unread >= 1)
})

test('POST inbox read marks messages read', async () => {
  const res = await api(`/inbox/bob/read`, { method: 'POST', body: {} })
  assert.ok(res.changed > 0)
  const after = await api('/inbox/bob?unread=1')
  assert.equal(after.messages.length, 0)
})

// ── 房间 ──

test('POST /rooms creates room', async () => {
  const res = await api('/rooms', { method: 'POST', body: { roomId: 'r1', name: 'General', members: ['alice', 'bob'] } })
  assert.ok(res.ok)
})

test('GET room members', async () => {
  const data = await api('/rooms/r1/members')
  assert.deepEqual(data.members.sort(), ['alice', 'bob'])
})

test('room broadcast delivers to all except sender', async () => {
  await api('/join', { method: 'POST', body: { userId: 'dave' } })
  // dave joins room via API
  await api('/rooms/r1/join', { method: 'POST', body: { userId: 'dave' } })
  const res = await api('/message', { method: 'POST', body: { from: 'alice', room: 'r1', body: 'hello all' } })
  assert.ok(res.delivered >= 2)
  // check bob got it
  const bobInbox = await api('/inbox/bob')
  assert.ok(bobInbox.messages.some((m) => m.body === 'hello all'))
})

// ── 社交分析 ──

test('GET /stats', async () => {
  const data = await api('/stats')
  assert.ok(data.stats.users >= 3)
  assert.ok(data.stats.rooms >= 1)
})

test('GET /distance/a/b', async () => {
  const data = await api('/distance/alice/bob')
  assert.equal(data.degrees, 1)
})

// ── 拓扑导出 ──

test('GET /topology returns graph structure', async () => {
  const data = await api('/topology')
  assert.ok(data.topology)
  assert.ok(data.topology.nodes.length >= 3)
  assert.ok(data.stats.nodes >= 3)
})

test('GET /export returns full serializable state', async () => {
  const res = await fetch(`${BASE}/export`)
  const raw = await res.json()
  assert.ok(raw.graph)
  assert.ok(raw.presence)
})

// ── SSE 流 ──

test('SSE stream receives hello and message events', async () => {
  const controller = new AbortController()
  const events = []
  const es = await fetch(`${BASE}/stream/bob`, { signal: controller.signal })
  assert.equal(es.headers.get('content-type'), 'text/event-stream; charset=utf-8')

  // 读流
  const reader = es.body.getReader()
  const decoder = new TextDecoder()

  // 先收 hello
  let buf = ''
  while (!buf.includes('hello')) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
  }
  assert.ok(buf.includes('hello'))

  // 从另一个用户发消息给 bob → 应该收到 SSE push
  const sendPromise = api('/message', { method: 'POST', body: { from: 'alice', to: 'bob', body: 'sse test' } })

  // 等待 message event
  while (!buf.includes('"type":"message"')) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
  }
  await sendPromise
  assert.ok(buf.includes('"type":"message"'))
  assert.ok(buf.includes('sse test'))

  controller.abort()
})
