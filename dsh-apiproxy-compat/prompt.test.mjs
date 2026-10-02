import test from 'node:test'
import assert from 'node:assert/strict'
import { createCompatApiProxy } from './index.js'
const request = text => ({ rpcId: 'contract-rpc', payload: { sessionId: 'mock-only', mode: 'queue', content: [{ type: 'text', text }] } })
for (const text of ['/permission workspace-write', ' \n /permission unrestricted', '/unknown-command']) {
  test(`reject unsupported command before admission: ${JSON.stringify(text)}`, async () => {
    let called = 0
    const api = createCompatApiProxy({ sessionController: { prompt: async () => { called++; return { accepted: true } } } })
    const reply = await api.sessions.prompt(request(text))
    assert.equal(reply.result.ok, false)
    assert.equal(reply.result.error.code, 'compat/command-unsupported')
    assert.equal(called, 0)
    assert.equal(reply.rpcId, 'contract-rpc')
  })
}
test('ordinary prompt preserves admission without inventing completion', async () => {
  let actual
  const api = createCompatApiProxy({ sessionController: { prompt: async p => { actual = p; return { accepted: true } } } })
  const reply = await api.sessions.prompt(request('Explain /permission without running it'))
  assert.deepEqual(reply.result, { ok: true, value: { accepted: true } })
  assert.equal(actual.requestId, 'contract-rpc')
  assert.equal(actual.sessionId, 'mock-only')
})
test('caller request identity is retained', async () => {
  let actual
  const api = createCompatApiProxy({ sessionController: { prompt: async p => { actual = p; return { accepted: true } } } })
  const req = request('fixed response'); req.payload.requestId = 'caller-owned'
  await api.sessions.prompt(req)
  assert.equal(actual.requestId, 'caller-owned')
})
test('controller failure is not converted into success', async () => {
  const api = createCompatApiProxy({ sessionController: { prompt: async () => { throw new Error('mock admission failed') } } })
  const reply = await api.sessions.prompt(request('fixed response'))
  assert.equal(reply.result.ok, false)
  assert.equal(reply.result.error.message, 'mock admission failed')
})
