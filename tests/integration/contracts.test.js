import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { harness, seedRun } from '../helpers.js'
test('publish rejects business-invalid manifest instead of argparse mismatch', async () => {
  const h = await harness()
  try {
    const manifest = join(h.dir, 'manifest.json')
    await writeFile(manifest, '{"kind":"pr"}')
    const result = await h.definitions.get('oss_ship_publish').execute({ manifest, runId: 'r1' })
    assert.equal(result.success, false)
    assert.match(result.reason, /repo|manifest|missing/)
    await assert.rejects(
      () => h.definitions.get('oss_ship_publish').execute({ manifest, runId: 'r1', kind: 'issue' }),
      /match/,
    )
  } finally {
    await h.close()
  }
})
test('evidence tool executes real red and green commands in local Git worktree', async () => {
  const h = await harness()
  try {
    const wt = join(h.dir, 'repo')
    await mkdir(wt)
    const git = (...args) => {
      const r = spawnSync('git', args, { cwd: wt, encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr)
    }
    git('init')
    await writeFile(join(wt, 'tracked.txt'), 'fixture')
    git('add', '.')
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      'commit',
      '-m',
      'fixture',
    )
    for (const role of ['red', 'green']) {
      const out = join(h.dir, role + '.json')
      const result = await h.definitions.get('oss_ship_evidence').execute({
        role,
        actor: 'implementer',
        runId: 'r1',
        worktree: wt,
        outputPath: out,
        command: ['python', '-c', 'raise SystemExit(' + (role === 'red' ? 1 : 0) + ')'],
      })
      assert.equal(result.success, true)
      assert.equal(JSON.parse(await readFile(out, 'utf8')).role, role)
    }
  } finally {
    await h.close()
  }
})
test('finish-task passes both identities and a real result file; finish is idempotent', async () => {
  const h = await harness()
  try {
    await seedRun(h)
    const resultPath = join(h.dir, 'result.json')
    await writeFile(
      resultPath,
      JSON.stringify({ status: 'done', reason: 'Fixture verified', evidence_paths: [] }),
    )
    const settled = await h.definitions
      .get('oss_run_finish_task')
      .execute({ runId: 'r1', taskId: 't0', resultPath })
    assert.equal(settled.status, 'settled')
    const done = await h.definitions.get('oss_run_finish').execute({ runId: 'r1' })
    assert.equal(done.counts.done, 1)
    assert.deepEqual(await h.definitions.get('oss_run_finish').execute({ runId: 'r1' }), done)
  } finally {
    await h.close()
  }
})
test('screen and cards preserve required native positional inputs', async () => {
  const h = await harness()
  try {
    const calls = []
    h.ctx['oss-contrib'].bridge.exec = async (script, args) => {
      calls.push({ script, args })
      return { stdout: 'fixture', stderr: '', code: 0 }
    }
    await h.definitions.get('oss_hunt_screen').execute({ repo: 'org/repo' })
    assert.deepEqual(calls.at(-1).args, ['repo', 'org/repo'])
    await h.definitions.get('oss_hunt_screen').execute({ issue: 'org/repo#1' })
    assert.deepEqual(calls.at(-1).args, ['io', 'org/repo#1'])
    await h.definitions
      .get('oss_track_cards')
      .execute({ targets: ['org/repo#1'], outputDir: h.dir })
    assert.deepEqual(calls.at(-1).args, ['batch', 'org/repo#1', '--out', h.dir])
  } finally {
    await h.close()
  }
})
