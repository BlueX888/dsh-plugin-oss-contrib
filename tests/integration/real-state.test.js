import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { harness } from '../helpers.js'
test('all state reads and configured paths use an isolated ledger', async () => {
  const h = await harness()
  try {
    for (const name of ['brief', 'summary', 'worklist'])
      assert.equal(
        typeof (await h.definitions.get('oss_state_' + name).execute({})).output,
        'string',
      )
    const d = await h.definitions.get('oss_doctor').execute({})
    assert.equal(d.state, h.state)
    assert.equal(d.tasks, h.config.paths.tasks)
    assert.equal(d.compatible, true)
  } finally {
    await h.close()
  }
})
test('state preview never mutates; explicit apply persists through native locking', async () => {
  const h = await harness()
  try {
    const svc = h.ctx['oss-contrib/state'],
      before = await readFile(join(h.state, 'state.json'), 'utf8')
    await svc.set('audit', 1, false)
    await svc.update({ audit: 2 }, false)
    assert.equal(await readFile(join(h.state, 'state.json'), 'utf8'), before)
    await svc.set('audit', 3, true)
    assert.equal(await svc.get('audit'), 3)
    await svc.update({ audit: 4 }, true)
    assert.equal(await svc.get('audit'), 4)
  } finally {
    await h.close()
  }
})
test('native quota assertions fail closed without silently rewriting ledger', async () => {
  const h = await harness({ quota: { pauseThreshold: 99 } })
  try {
    await assert.rejects(
      () => h.ctx['oss-contrib/native'].assertCompatible(),
      /threshold|pauseThreshold/,
    )
  } finally {
    await h.close()
  }
})
test('state service claim and release use native identity and positional contracts', async () => {
  const h = await harness()
  try {
    await writeFile(
      join(h.state, 'state.json'),
      JSON.stringify({ ready_queue: [{ repo: 'test/repo', slug: 'fix', score: 100 }] }),
    )
    const state = h.ctx['oss-contrib/state']
    const rows = await state.readyTake('test-run', 'native:test-run', process.pid, 1)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].lease.run_id, 'test-run')
    await state.readyRelease('test/repo', 'fix', 'test-run')
    assert.equal((await state.readyPeek())[0].lease, undefined)
  } finally {
    await h.close()
  }
})
