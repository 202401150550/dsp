import test from 'node:test'
import assert from 'node:assert/strict'
import { SocialNetwork } from '../src/social.js'

// ── 身份与在场 ─────────────────────────────────────────

test('join / leave users', () => {
  const sn = new SocialNetwork()
  sn.join('alice')
  sn.join('bob')
  assert.equal(sn.users().length, 2)
  sn.leave('bob')
  assert.equal(sn.users().length, 1)
  assert.ok(!sn.graph.hasNode('bob'))
})

test('join with displayName and bot flag', () => {
  const sn = new SocialNetwork()
  sn.join('ai', { displayName: 'ATI Core', isBot: true })
  const users = sn.users()
  assert.equal(users[0].displayName, 'ATI Core')
  assert.equal(users[0].type, 'bot')
})

test('duplicate join throws', () => {
  const sn = new SocialNetwork()
  sn.join('x')
  assert.throws(() => sn.join('x'), /already joined/)
})

test('presence online/offline', () => {
  const sn = new SocialNetwork()
  sn.join('a')
  assert.ok(sn.isOnline('a'))
  sn.setPresence('a', 'offline')
  assert.ok(!sn.isOnline('a'))
})

test('presence for unknown user throws', () => {
  const sn = new SocialNetwork()
  assert.throws(() => sn.setPresence('ghost', 'online'), /not found/)
})

// ── 连接（好友关系）────────────────────────────────────

test('connect two users', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b')
  sn.connect('a', 'b')
  assert.ok(sn.isConnected('a', 'b'))
  assert.deepEqual(sn.connections('a'), ['b'])
  assert.deepEqual(sn.connections('b'), ['a'])
})

test('connect unknown user throws', () => {
  const sn = new SocialNetwork()
  sn.join('a')
  assert.throws(() => sn.connect('a', 'ghost'), /not found/)
})

test('double connect throws', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b')
  sn.connect('a', 'b')
  assert.throws(() => sn.connect('a', 'b'), /already connected/)
})

test('disconnect', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b')
  sn.connect('a', 'b')
  sn.disconnect('a', 'b')
  assert.ok(!sn.isConnected('a', 'b'))
})

test('suggestions: friend-of-friend', () => {
  const sn = new SocialNetwork()
  sn.join('alice'); sn.join('bob'); sn.join('carol')
  sn.connect('alice', 'bob')
  sn.connect('bob', 'carol')
  // alice 不直接认识 carol，但 bob 认识
  const sugg = sn.suggestions('alice')
  assert.deepEqual(sugg, ['carol'])
})

// ── 房间（群聊）────────────────────────────────────────

test('create room and join/leave', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b'); sn.join('c')
  sn.createRoom('r1', 'General', ['a', 'b'])
  assert.deepEqual(sn.roomMembers('r1').sort(), ['a', 'b'])
  sn.joinRoom('r1', 'c')
  assert.deepEqual(sn.roomMembers('r1').sort(), ['a', 'b', 'c'])
  sn.leaveRoom('r1', 'b')
  assert.deepEqual(sn.roomMembers('r1').sort(), ['a', 'c'])
})

test('roomsOf returns user rooms', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b')
  sn.createRoom('r1', 'Chat', ['a'])
  sn.createRoom('r2', 'Dev', ['a', 'b'])
  const rooms = sn.roomsOf('a')
  assert.equal(rooms.length, 2)
  assert.deepEqual(rooms.map((r) => r.id).sort(), ['r1', 'r2'])
})

test('leave removes user from rooms', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b')
  sn.createRoom('r', 'Test', ['a', 'b'])
  sn.leave('a')
  assert.deepEqual(sn.roomMembers('r'), ['b'])
})

test('last member leaving destroys room', () => {
  const sn = new SocialNetwork()
  sn.join('a')
  sn.createRoom('solo', 'Alone', ['a'])
  sn.leave('a')
  assert.ok(!sn.graph.hasNode('solo'))
})

// ── 消息传递 ───────────────────────────────────────────

test('send direct message', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b')
  sn.connect('a', 'b')
  const msg = sn.sendMessage('a', 'b', 'hello')
  assert.equal(msg.body, 'hello')
  assert.equal(sn.inbox('b').length, 1)
  assert.equal(sn.inbox('b')[0].from, 'a')
})

test('send without connection throws', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b')
  assert.throws(() => sn.sendMessage('a', 'b', 'hi'), /no connection/)
})

test('send to unknown user throws', () => {
  const sn = new SocialNetwork()
  sn.join('a')
  assert.throws(() => sn.sendMessage('a', 'nobody', 'hi'), /not found/)
})

test('unread count and markRead', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b')
  sn.connect('a', 'b')
  sn.sendMessage('a', 'b', 'msg1')
  sn.sendMessage('a', 'b', 'msg2')
  assert.equal(sn.unreadCount('b'), 2)
  const msgs = sn.inbox('b')
  sn.markRead('b', [msgs[0].seq])
  assert.equal(sn.unreadCount('b'), 1)
  sn.markRead('b') // mark all
  assert.equal(sn.unreadCount('b'), 0)
})

test('sendToRoom broadcasts to all members except sender', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b'); sn.join('c')
  sn.createRoom('r', 'Team', ['a', 'b', 'c'])
  sn.sendToRoom('a', 'r', 'meeting at 3')
  assert.equal(sn.inbox('b').length, 1)
  assert.equal(sn.inbox('c').length, 1)
  assert.equal(sn.inbox('a').length, 0) // sender doesn't get it
})

test('sendToRoom from non-member throws', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b')
  sn.createRoom('r', 'Private', ['a'])
  assert.throws(() => sn.sendToRoom('b', 'r', 'sneak'), /not in room/)
})

// ── 社交网络指标 ───────────────────────────────────────

test('socialStats', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b'); sn.join('bot1', { isBot: true })
  sn.connect('a', 'b')
  sn.createRoom('r', 'Room', ['a', 'b'])
  const stats = sn.socialStats()
  assert.equal(stats.users, 3)
  assert.equal(stats.bots, 1)
  assert.equal(stats.rooms, 1)
  assert.ok(stats.onlineUsers >= 0)
})

test('degreesOfSeparation', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b'); sn.join('c'); sn.join('d')
  sn.connect('a', 'b')
  sn.connect('b', 'c')
  sn.connect('c', 'd')
  assert.equal(sn.degreesOfSeparation('a', 'a'), 0)
  assert.equal(sn.degreesOfSeparation('a', 'b'), 1)
  assert.equal(sn.degreesOfSeparation('a', 'c'), 2)
  assert.equal(sn.degreesOfSeparation('a', 'd'), 3)
  // 不连通
  sn.join('x')
  assert.equal(sn.degreesOfSeparation('a', 'x'), -1)
})

// ── 序列化 ─────────────────────────────────────────────

test('serialize/deserialize roundtrip', () => {
  const sn = new SocialNetwork()
  sn.join('a', { displayName: 'Alice' })
  sn.join('b')
  sn.connect('a', 'b')
  sn.createRoom('r', 'Chat', ['a', 'b'])
  sn.sendMessage('a', 'b', 'persist me')
  const json = sn.serialize()
  const sn2 = SocialNetwork.deserialize(json)
  assert.deepEqual(sn2.users().map((u) => u.id).sort(), ['a', 'b'])
  assert.ok(sn2.isConnected('a', 'b'))
  assert.deepEqual(sn2.roomMembers('r').sort(), ['a', 'b'])
  assert.equal(sn2.inbox('b').length, 1)
  assert.equal(sn2.inbox('b')[0].body, 'persist me')
})

// ── 事件回调 ───────────────────────────────────────────

test('onEvent callback fires for social actions', () => {
  const events = []
  const sn = new SocialNetwork({ onEvent: (ev) => events.push(ev.kind) })
  sn.join('a')
  sn.join('b')
  sn.connect('a', 'b')
  sn.sendMessage('a', 'b', 'hey')
  assert.ok(events.includes('join'))
  assert.ok(events.includes('connect'))
  assert.ok(events.includes('message'))
})

// ── 底层拓扑图可导出 ───────────────────────────────────

test('topology() returns underlying graph for visualization', () => {
  const sn = new SocialNetwork()
  sn.join('a'); sn.join('b')
  sn.connect('a', 'b')
  const g = sn.topology()
  assert.equal(g.nodeCount(), 2)
  assert.equal(g.edgeCount(), 1)
  assert.equal(g.nodeType('a'), 'person')
})
