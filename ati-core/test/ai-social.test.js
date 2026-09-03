import test from 'node:test'
import assert from 'node:assert/strict'
import { LlmConfig, LlmOperator } from '../src/llm.js'
import { SocialNetwork } from '../src/social.js'
import { AtiOrchestrator } from '../src/aci.js'
import { AiSocialBridge } from '../src/ai-social.js'

// ── LlmConfig ──────────────────────────────────────────

test('LlmConfig defaults', () => {
  const cfg = new LlmConfig({})
  assert.ok(cfg.baseUrl)
  assert.ok(cfg.model)
  // no key in test env
  assert.equal(typeof cfg.available, 'boolean')
})

test('LlmConfig with explicit key', () => {
  const cfg = new LlmConfig({ apiKey: 'sk-test' })
  assert.ok(cfg.available)
})

test('LlmOperator mock mode when no key', async () => {
  const op = new LlmOperator({
    llm: new LlmConfig({ apiKey: '' }),
    systemPrompt: 'test',
  })
  const out = await op.forward('hello')
  assert.ok(out.includes('[MOCK'))
  assert.ok(out.length > 0)
})

// ── AiSocialBridge ─────────────────────────────────────

test('bridge: bot auto-joins social network if not present', () => {
  const sn = new SocialNetwork()
  const aci = new AtiOrchestrator()
  new AiSocialBridge(sn, aci, { botId: 'my-bot' })
  assert.ok(sn.graph.hasNode('my-bot'))
  assert.equal(sn.graph.nodeType('my-bot'), 'bot')
})

test('bridge: replyTo generates response and sends message', async () => {
  const sn = new SocialNetwork()
  sn.join('alice')
  const aci = new AtiOrchestrator()
  const bridge = new AiSocialBridge(sn, aci, {
    botId: 'ati',
    llm: new LlmConfig({ apiKey: '' }), // mock mode
  })

  const { reply } = await bridge.replyTo('alice', 'hello')
  assert.ok(reply) // got a response (mock)
  assert.ok(sn.isConnected('alice', 'ati')) // auto-connected

  const inbox = sn.inbox('alice')
  assert.ok(inbox.some((m) => m.from === 'ati'))
})

test('bridge: conversation history is maintained per user', async () => {
  const sn = new SocialNetwork()
  sn.join('u1')
  const aci = new AtiOrchestrator()
  const bridge = new AiSocialBridge(sn, aci, { botId: 'bot', llm: new LlmConfig({ apiKey: '' }) })

  await bridge.replyTo('u1', 'first msg')
  await bridge.replyTo('u1', 'second msg')

  assert.ok(bridge.conversationCount >= 1)
  assert.ok(bridge.totalReplies >= 2)

  const history = bridge._conversationHistory.get('u1')
  assert.ok(history.length >= 4) // 2 user + 2 assistant
  assert.equal(history[0].role, 'user')
  assert.equal(history[0].content, 'first msg')
})

test('bridge: start() enables auto-reply on incoming message', async () => {
  const sn = new SocialNetwork()
  sn.join('user-a')
  const aci = new AtiOrchestrator()
  const bridge = new AiSocialBridge(sn, aci, { botId: 'auto-bot', llm: new LlmConfig({ apiKey: '' }) })
  bridge.start()

  // user sends message to bot → bot should auto-reply after a tick
  sn.connect('user-a', 'auto-bot')
  sn.sendMessage('user-a', 'auto-bot', 'are you there?')

  // wait for async reply
  await new Promise((r) => setTimeout(r, 300))

  const inbox = sn.inbox('user-a')
  const replies = inbox.filter((m) => m.from === 'auto-bot')
  assert.ok(replies.length >= 1, `expected at least 1 reply, got ${replies.length}`)

  bridge.stop()
})
