import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { harness, seedRun } from '../helpers.js'
test('executor resumes a native task, saves result and settles exactly once', async () => {
  const h = await harness()
  try {
    await seedRun(h)
    let calls = 0
    const e = h.ctx['oss-contrib/executor']
    e.runner = {
      available: () => true,
      execute: async (prompt, cwd, signal, session) => {
        calls++
        assert.match(prompt, /TASK DATA/)
        await session('fixture-session')
        return { status: 'done', reason: 'Local fixture verified', evidence_paths: [] }
      },
    }
    const result = await e.run({ runId: 'r1', mode: 'followup' })
    assert.equal(result.status, 'finished')
    assert.equal(result.counts.done, 1)
    assert.equal(calls, 1)
    assert.equal((await e.status()).sessions[0].sessionId, 'fixture-session')
    await e.run({ runId: 'r1', mode: 'followup' })
    assert.equal(calls, 1)
  } finally {
    await h.close()
  }
})
test('saved result recovers without repeating Agent work', async () => {
  const h = await harness()
  try {
    await seedRun(h)
    const native = h.ctx['oss-contrib/native']
    const { token } = await native.adapter(['watch-session', 'r1'])
    await native.adapter(
      [
        'save-result',
        'r1',
        't0',
        '--json',
        JSON.stringify({ status: 'done', reason: 'Already verified', evidence_paths: [] }),
      ],
      {},
      token,
    )
    await native.adapter(['stop', 'r1', token])
    const e = h.ctx['oss-contrib/executor']
    e.runner = {
      available: () => true,
      execute: async () => {
        throw Error('MUST NOT EXECUTE')
      },
    }
    assert.equal((await e.run({ runId: 'r1', mode: 'followup' })).counts.done, 1)
  } finally {
    await h.close()
  }
})
test('worker failure settles retry and continues its peers', async () => {
  const h = await harness()
  try {
    await seedRun(h, 'r1', 2)
    let n = 0
    const e = h.ctx['oss-contrib/executor']
    e.runner = {
      available: () => true,
      execute: async () => {
        if (n++ === 0) throw Error('model failure')
        return { status: 'waiting', reason: 'Pending CI', wait_for: ['ci'], evidence_paths: [] }
      },
    }
    const result = await e.run({ runId: 'r1', mode: 'followup' })
    assert.equal(result.counts.retry, 1)
    assert.equal(result.counts.waiting, 1)
  } finally {
    await h.close()
  }
})
test('live native adapter ownership prevents a second worker', async () => {
  const h = await harness()
  try {
    await seedRun(h)
    const native = h.ctx['oss-contrib/native'],
      { token } = await native.adapter(['watch-session', 'r1'])
    const e = h.ctx['oss-contrib/executor']
    let calls = 0
    e.runner = {
      available: () => true,
      execute: async () => {
        calls++
      },
    }
    await assert.rejects(() => e.run({ runId: 'r1', mode: 'followup' }), /another adapter/)
    assert.equal(calls, 0)
    await native.adapter(['stop', 'r1', token])
  } finally {
    await h.close()
  }
})
test('cancellation drains worker, releases adapter session and retains recoverable task', async () => {
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
    const running = e.run({ runId: 'r1', mode: 'followup' })
    const rejection = assert.rejects(running, /cancel/)
    await ready
    await e.cancel()
    await rejection
    assert.equal((await e.status()).status, 'interrupted')
    const store = JSON.parse(await readFile(join(h.state, 'state.json'), 'utf8'))
    assert.equal(store.automation.tasks.k0.status, 'running')
    e.runner = {
      available: () => true,
      execute: async () => ({ status: 'done', reason: 'Recovered', evidence_paths: [] }),
    }
    assert.equal((await e.recover()).counts.done, 1)
  } finally {
    await h.close()
  }
})
test('prepare-to-finish uses native scoped selection with a snapshot fixture', async () => {
  const h = await harness()
  try {
    const snapshot = join(h.dir, 'snapshot.json')
    await writeFile(
      snapshot,
      JSON.stringify({
        readable: true,
        complete: true,
        generated_at: new Date().toISOString(),
        prs: [{ repo: 'fixture/repo', number: 1, state: 'open', head_sha: 'abc' }],
        closed_60d_external: [],
        pending_plan: [],
      }),
    )
    const e = h.ctx['oss-contrib/executor']
    e.runner = {
      available: () => true,
      execute: async () => ({
        status: 'done',
        reason: 'Current fixture inspected',
        evidence_paths: [],
      }),
    }
    const result = await e.run({ snapshot, mode: 'followup', targets: ['fixture/repo#1'] })
    assert.ok(['finished', 'idle'].includes(result.status))
    assert.equal((await h.ctx['oss-contrib/state'].get('automation')).active_run, undefined)
  } finally {
    await h.close()
  }
})
