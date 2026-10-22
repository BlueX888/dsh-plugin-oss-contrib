import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentRunner } from '../../lib/services/agent-runner.js'
import { Config } from '../../lib/config.js'
function runtime({ failure = false, hang = false } = {}) {
  const listeners = new Map()
  let disposed = false,
    message,
    guard,
    resolveIdle
  const idle = new Promise((r) => (resolveIdle = r))
  const agent = {
    session: { id: 'unused' },
    cancel() {
      resolveIdle()
    },
    whenIdle: () => idle,
    followup(m) {
      message = m
      assert.equal(m.role, 'user')
      assert.match(m.id, /^[a-f0-9-]+$/)
      assert.ok(Object.isFrozen(m))
      if (hang) return
      const emit = listeners.get('session/event')
      emit(
        { id: agent.id },
        {
          type: 'assistant/message',
          data: {
            message: {
              content: [
                { type: 'text', text: '{"status":"done","reason":"Verified","evidence_paths":[]}' },
              ],
            },
          },
        },
      )
      emit(
        { id: agent.id },
        { type: 'turn/end', data: { reason: { kind: failure ? 'error' : 'completed' } } },
      )
      resolveIdle()
    },
  }
  const ctx = {
    get(name) {
      if (name === 'agents')
        return {
          async create(options) {
            agent.id = options.sessionId
            await options.setup(
              { on: (n, cb) => listeners.set(n, cb), tools: { guard: (g) => (guard = g) } },
              agent,
            )
            return {
              agent,
              async dispose() {
                disposed = true
              },
            }
          },
        }
    },
  }
  return {
    ctx,
    listeners,
    get disposed() {
      return disposed
    },
    get message() {
      return message
    },
    get guard() {
      return guard
    },
  }
}
test('runner sends identified UserMessage, requires durable turn end and disposes handle', async () => {
  const r = runtime(),
    runner = new AgentRunner(r.ctx, Config({}))
  assert.equal(
    (await runner.execute('test', '/fixture', new AbortController().signal, async () => {})).status,
    'done',
  )
  assert.equal(r.disposed, true)
  assert.match(r.guard({ name: 'oss_run_execute' }), /coordinator/)
  assert.equal(r.guard({ name: 'read_file' }), undefined)
  const gate = r.listeners.get('tools/pre-execute')
  assert.equal((await gate({}, async () => ({ kind: 'ask' }))).kind, 'deny')
})
test('runner does not turn model failure into successful work', async () => {
  const r = runtime({ failure: true })
  await assert.rejects(
    () =>
      new AgentRunner(r.ctx, Config({})).execute(
        'test',
        '/fixture',
        new AbortController().signal,
        async () => {},
      ),
    /did not complete/,
  )
  assert.equal(r.disposed, true)
})
test('runner deadline cancels and drains the handle', async () => {
  const r = runtime({ hang: true })
  await assert.rejects(
    () =>
      new AgentRunner(r.ctx, Config({ agent: { taskTimeoutMs: 100 } })).execute(
        'test',
        '/fixture',
        new AbortController().signal,
        async () => {},
      ),
    /deadline/,
  )
  assert.equal(r.disposed, true)
})
