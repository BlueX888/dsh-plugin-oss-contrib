import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Service } from '@deepseek-ai/cordis'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { harness, seedRun } from '../helpers.js'
test('scheduler activates from service injection without a nonexistent ready event', async () => {
  const h = await harness({
    scheduler: { enabled: true, interval: '0 */6 * * *', runOnStart: false },
  })
  try {
    class Agents extends Service {
      constructor(ctx) {
        super(ctx, 'agents')
      }
    }
    class Loop extends Service {
      constructor(ctx) {
        super(ctx, 'agentLoop')
      }
    }
    await h.ctx.plugin(Agents)
    await h.ctx.plugin(Loop)
    await new Promise((r) => setTimeout(r, 100))
    assert.ok(h.ctx['oss-contrib/scheduler'].nextRunAt)
  } finally {
    await h.close()
  }
})
test('tool caller cancellation reaches the active Agent worker', async () => {
  const h = await harness()
  try {
    await seedRun(h)
    let entered
    const ready = new Promise((r) => (entered = r))
    h.ctx['oss-contrib/executor'].runner = {
      available: () => true,
      execute: async (p, c, signal) =>
        new Promise((resolve, reject) => {
          entered()
          signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true })
        }),
    }
    const controller = new AbortController()
    const promise = h.definitions
      .get('oss_run_execute')
      .execute({ runId: 'r1', mode: 'followup' }, { signal: controller.signal })
    const rejected = assert.rejects(promise, /cancelled/)
    await ready
    controller.abort()
    await rejected
    assert.equal((await h.ctx['oss-contrib/executor'].status()).active, false)
  } finally {
    await h.close()
  }
})
test('plugin unload cancels its active worker and drains all resources', async () => {
  const h = await harness()
  try {
    await seedRun(h)
    let entered
    const ready = new Promise((r) => (entered = r))
    const executor = h.ctx['oss-contrib/executor']
    executor.runner = {
      available: () => true,
      execute: async (p, c, signal) =>
        new Promise((resolve, reject) => {
          entered()
          signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true })
        }),
    }
    const promise = executor.run({ runId: 'r1', mode: 'followup' }),
      rejected = assert.rejects(promise, /cancelled/)
    await ready
    await h.ctx.fiber.dispose()
    await rejected
    assert.equal(h.definitions.size, 0)
  } finally {
    await h.close()
  }
})
test('expired crashed run is reclaimed by native prepare under a new run ID', async () => {
  const h = await harness()
  try {
    await seedRun(h)
    const store = JSON.parse(await readFile(join(h.state, 'state.json'), 'utf8'))
    store.automation.active_run.expires_at = new Date(Date.now() - 1000).toISOString()
    await writeFile(join(h.state, 'state.json'), JSON.stringify(store))
    const e = h.ctx['oss-contrib/executor']
    e.runner = {
      available: () => true,
      execute: async () => ({ status: 'done', reason: 'Recovered fixture', evidence_paths: [] }),
    }
    const snapshot = join(h.dir, 'snapshot.json')
    await writeFile(
      snapshot,
      JSON.stringify({
        readable: true,
        complete: true,
        generated_at: new Date().toISOString(),
        prs: [],
        closed_60d_external: [],
        pending_plan: [],
      }),
    )
    await assert.rejects(() => e.run({ runId: 'r1', mode: 'followup', snapshot }), /expired/)
    const result = await e.recover()
    assert.ok(['finished', 'idle'].includes(result.status))
    assert.notEqual(result.run_id, 'r1')
  } finally {
    await h.close()
  }
})

test('rejected scope change does not poison the recovery journal', async () => {
  const h = await harness()
  try {
    await seedRun(h)
    const e = h.ctx['oss-contrib/executor']
    let entered
    const ready = new Promise((r) => (entered = r))
    e.runner = {
      available: () => true,
      execute: async (p, c, signal) =>
        new Promise((resolve, reject) => {
          entered()
          signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true })
        }),
    }
    const run = e.run({ runId: 'r1', mode: 'followup' }),
      rejected = assert.rejects(run, /cancelled/)
    await ready
    await e.cancel()
    await rejected
    const before = await readFile(join(h.state, 'dsh-plugin', 'latest.json'), 'utf8')
    await assert.rejects(() => e.run({ runId: 'r1', mode: 'hunt' }), /scope/)
    assert.equal(await readFile(join(h.state, 'dsh-plugin', 'latest.json'), 'utf8'), before)
    e.runner = {
      available: () => true,
      execute: async () => ({ status: 'done', reason: 'Recovered unchanged scope' }),
    }
    assert.equal((await e.recover()).counts.done, 1)
  } finally {
    await h.close()
  }
})

test('cron ticks serialize runs and stop when the plugin unloads', async () => {
  const h = await harness({
    scheduler: { enabled: true, interval: '* * * * * *', runOnStart: true },
  })
  let calls = 0,
    active = 0,
    maxActive = 0
  try {
    const e = h.ctx['oss-contrib/executor']
    e.status = async () => ({ status: 'idle', active: active > 0 })
    e.run = async () => {
      calls++
      maxActive = Math.max(maxActive, ++active)
      await new Promise((r) => setTimeout(r, 1100))
      active--
      return { status: 'finished' }
    }
    class Agents extends Service {
      constructor(ctx) {
        super(ctx, 'agents')
      }
    }
    class Loop extends Service {
      constructor(ctx) {
        super(ctx, 'agentLoop')
      }
    }
    await h.ctx.plugin(Agents)
    await h.ctx.plugin(Loop)
    const end = Date.now() + 6000
    while (calls < 2 && Date.now() < end) await new Promise((r) => setTimeout(r, 50))
    assert.ok(calls >= 2)
    assert.equal(maxActive, 1)
    await h.ctx.fiber.dispose()
    const atStop = calls
    await new Promise((r) => setTimeout(r, 1300))
    assert.equal(calls, atStop)
  } finally {
    await h.close()
  }
})
