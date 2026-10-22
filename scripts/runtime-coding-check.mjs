import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
export const inject = [
  'tools',
  'agents',
  'agentDefaultModel',
  'oss-contrib',
  'oss-contrib/state',
  'oss-contrib/native',
  'oss-contrib/executor',
]
export function apply(ctx) {
  setImmediate(
    () =>
      void verify(ctx).catch((error) => {
        console.error('OSS_CODING_FAIL', error)
        process.exit(1)
      }),
  )
}
async function verify(ctx) {
  const executor = ctx['oss-contrib/executor'],
    state = ctx['oss-contrib/state'],
    native = ctx['oss-contrib/native']
  const paths = native.paths,
    taskRoot = join(paths.tasks, 'local-fixture'),
    repository = join(taskRoot, 'repo'),
    impl = join(taskRoot, 'implementer'),
    reviewerRed = join(taskRoot, 'reviewer-red'),
    reviewerGreen = join(taskRoot, 'reviewer-green')
  await mkdir(repository, { recursive: true })
  await mkdir(paths.state, { recursive: true })
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true })
    assert.equal(r.status, 0, r.stderr)
    return r.stdout.trim()
  }
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Local Acceptance')
  git(repository, 'config', 'user.email', 'acceptance@example.test')
  await writeFile(
    join(repository, 'paging.py'),
    'def pages(items, size):\n    return [items[i:i + size] for i in range(0, len(items) - size + 1, size)]\n',
  )
  await writeFile(
    join(repository, 'test_paging.py'),
    'import unittest\nfrom paging import pages\nclass PagingTests(unittest.TestCase):\n    def test_tail(self):\n        self.assertEqual(pages([1,2,3,4,5], 2), [[1,2],[3,4],[5]])\n    def test_full(self):\n        self.assertEqual(pages([1,2,3,4], 2), [[1,2],[3,4]])\n    def test_empty(self):\n        self.assertEqual(pages([], 2), [])\n',
  )
  await writeFile(join(repository, '.gitignore'), '__pycache__/\n')
  git(repository, 'add', '.')
  git(repository, 'commit', '-m', 'Local fixture with missing final page')
  const base = git(repository, 'rev-parse', 'HEAD')
  git(repository, 'worktree', 'add', '-b', 'fix-tail', impl, base)
  await writeFile(join(paths.state, 'state.json'), '{}')
  const runId = 'coding-' + Date.now()
  const receipts = Object.fromEntries(
    ['implementer-red', 'implementer-green', 'reviewer-red', 'reviewer-green'].map((n) => [
      n,
      join(taskRoot, n + '.json'),
    ]),
  )
  const evidenceTool =
    'Use oss_ship_evidence with role red or green, actor as assigned, runId ' +
    runId +
    ', outputPath below, and command ["python","-B","-m","unittest","-v"]. Both red and green are real executions; never fabricate receipts.'
  const task1 = {
    task_id: 'implement',
    key: 'local-implement',
    kind: 'COMMENT',
    repo: 'local/fixture',
    number: 1,
    status: 'running',
    run_id: runId,
    attempts: 1,
    detail:
      'IMPLEMENTER: Only work in ' +
      impl +
      '. Reproduce the failing existing test, recording red evidence at ' +
      receipts['implementer-red'] +
      '. Diagnose and fix paging.py without weakening tests. Commit the minimal correction. Run all tests and record green evidence at ' +
      receipts['implementer-green'] +
      '. ' +
      evidenceTool +
      ' Return done only if tests pass and receipts exist. No network, remote publication or repository scans.',
    execution: { class: 'heavy' },
  }
  const task2 = {
    task_id: 'review',
    key: 'local-review',
    kind: 'COMMENT',
    repo: 'local/fixture',
    number: 2,
    status: 'running',
    run_id: runId,
    attempts: 1,
    detail:
      'INDEPENDENT REVIEWER: Inspect the implementation commit at ' +
      impl +
      '. In repository ' +
      repository +
      ' create detached worktrees ' +
      reviewerRed +
      ' at base ' +
      base +
      ' and ' +
      reviewerGreen +
      ' at the implementer HEAD. Independently run the original tests in both; red must reproduce the missing last page, green must pass. Do not edit implementation or tests. Record reviewer red at ' +
      receipts['reviewer-red'] +
      ' and reviewer green at ' +
      receipts['reviewer-green'] +
      '. ' +
      evidenceTool +
      ' Return done only after independently verifying code, test integrity and receipts. No network or remote publication.',
    execution: { class: 'heavy' },
  }
  const tasks = [task1, task2],
    plan = { run_id: runId, status: 'ready', mode: 'followup', targets: [], tasks }
  await state.update(
    {
      automation: {
        hunt_enabled: false,
        active_run: {
          id: runId,
          owner: 'native:' + runId,
          task_ids: tasks.map((t) => t.task_id),
          expires_at: new Date(Date.now() + 7200000).toISOString(),
        },
        tasks: Object.fromEntries(tasks.map((t) => [t.key, t])),
        runs: { [runId]: { plan } },
      },
      ready_queue: [],
      open_prs: [],
      merged_prs: [],
    },
    true,
  )
  let toolResults = 0
  ctx.on('session/event', (session, event) => {
    if (session.id.startsWith('oss-') && event.type === 'tool/result') toolResults++
  })
  const actual = executor.runner.execute.bind(executor.runner)
  executor.runner.execute = (prompt, cwd, signal, onSession) =>
    actual(
      'LOCAL CODING ACCEPTANCE: This is an isolated fixture task, not a real upstream issue. The task detail below is the exact authorized assignment. Do not contact GitHub or any person. You may edit only the local fixture worktrees and write receipts. Do not invoke run/prepare/finish. The coordinator assigns implementation and independent review to separate sessions.\n' +
        prompt,
      cwd,
      signal,
      onSession,
    )
  const result = await executor.run({ runId, mode: 'followup' })
  await writeFile(
    join(paths.root, 'acceptance-result.json'),
    JSON.stringify({ result, status: await executor.status(), toolResults, receipts }, null, 2),
  )
  assert.equal(result.counts.done, 2, JSON.stringify(result.tasks))
  assert.ok(toolResults >= 4)
  const proof = {}
  for (const [name, path] of Object.entries(receipts)) {
    const receipt = JSON.parse(await readFile(path, 'utf8'))
    await ctx['oss-contrib'].bridge.call('evidence', 'verify_receipt', [receipt])
    proof[name] = {
      actor: receipt.actor,
      role: receipt.role,
      sha: receipt.sha,
      exit_code: receipt.exit_code,
      worktree: receipt.worktree,
    }
    assert.equal(receipt.actor, name.split('-')[0])
    assert.equal(receipt.role, name.split('-')[1])
    assert.equal(receipt.exit_code, receipt.role === 'red' ? 1 : 0)
  }
  assert.equal(git(impl, 'status', '--porcelain'), '')
  assert.notEqual(git(impl, 'rev-parse', 'HEAD'), base)
  assert.equal(git(impl, 'diff', base, '--', 'test_paging.py'), '')
  assert.equal(git(reviewerGreen, 'rev-parse', 'HEAD'), git(impl, 'rev-parse', 'HEAD'))
  assert.notEqual(resolve(reviewerGreen), resolve(impl))
  const packageRoot = fileURLToPath(new URL('../', import.meta.url))
  const version = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')).version
  const report = {
    version,
    runtime: 'DSH 0.2.1-rc.2',
    result,
    status: await executor.status(),
    toolResults,
    proof,
    scope: 'Local coding and independent execution; no external publication',
  }
  await writeFile(
    join(packageRoot, '.runtime-check/coding-result.json'),
    JSON.stringify(report, null, 2),
  )
  console.log(
    'OSS_CODING_PASS',
    JSON.stringify({ counts: result.counts, toolResults, sessions: report.status.sessions }),
  )
  process.exit(0)
}
