import { Context } from '@deepseek-ai/cordis'
const string = (description: string) => ({ type: 'string', description })
const boolean = (description: string) => ({ type: 'boolean', description, default: false })
const strings = (description: string) => ({ type: 'array', items: { type: 'string' }, description })
export function registerTools(ctx: Context) {
  const state = ctx['oss-contrib/state'],
    hunt = ctx['oss-contrib/hunt'],
    ship = ctx['oss-contrib/ship'],
    track = ctx['oss-contrib/track'],
    native = ctx['oss-contrib/native'],
    scheduler = ctx['oss-contrib/scheduler'],
    executor = ctx['oss-contrib/executor']
  const register = (
    name: string,
    description: string,
    properties: Record<string, any>,
    required: string[],
    execute: (args: any, execution?: any) => Promise<any>,
  ) => {
    ctx.tools.register({
      name,
      description,
      parameters: { type: 'object', properties, required, additionalProperties: false },
      execute,
      output: {
        schema: {},
        render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }],
      },
    })
  }
  register('oss_state_brief', 'Read native status summary', {}, [], () => state.brief())
  register('oss_state_summary', 'Read detailed native summary', {}, [], () => state.summary())
  register('oss_state_worklist', 'Read active worklist', {}, [], () => state.worklist())
  register('oss_state_ready_peek', 'Read the ready queue without claiming', {}, [], () =>
    state.readyPeek(),
  )
  register(
    'oss_hunt_discover',
    'Discover repository issues',
    { repo: string('owner/repo') },
    ['repo'],
    (a) => hunt.discover(a.repo),
  )
  register(
    'oss_hunt_probe',
    'Investigate an existing issue',
    { target: string('owner/repo#N') },
    ['target'],
    (a) => hunt.probe(a.target),
  )
  register(
    'oss_hunt_screen',
    'Read repository policy, issue intake or collision evidence. Supply repo, issue or reposFile.',
    {
      repo: string('owner/repo'),
      issue: string('owner/repo#N'),
      kw: string('Collision keyword'),
      path: string('Repository-relative source path for collision search'),
      reposFile: string('Absolute file listing repositories'),
    },
    [],
    (a) => hunt.screen(a),
  )
  register('oss_hunt_preflight', 'Read contribution gates', {}, [], () => hunt.preflight())
  register(
    'oss_ship_quota',
    'Read native quota. Inspect allow_publish and verdict, not only exit code.',
    {},
    [],
    () => ship.checkQuota(),
  )
  register(
    'oss_ship_publish',
    'Validate or publish through the native evidence, policy and quota gates. Dry-run unless execute=true.',
    {
      manifest: string('Absolute manifest.json path'),
      kind: { type: 'string', enum: ['issue', 'pr', 'update'] },
      runId: string('Native owning run ID'),
      execute: boolean('Perform the gated external write'),
    },
    ['manifest', 'runId'],
    (a) => ship.publish(a),
  )
  register(
    'oss_ship_evidence',
    'Execute a verification command and register an authentic receipt',
    {
      role: {
        type: 'string',
        enum: ['red', 'green', 'acceptance', 'baseline', 'candidate', 'correctness'],
      },
      actor: { type: 'string', enum: ['implementer', 'reviewer'] },
      runId: string('Native owning run ID'),
      worktree: string('Absolute isolated worktree'),
      outputPath: string('Absolute receipt destination'),
      command: strings('Executable and argv'),
      harness: strings('Verification paths relative to worktree'),
    },
    ['role', 'actor', 'runId', 'worktree', 'outputPath', 'command'],
    (a) => ship.evidence(a),
  )
  register(
    'oss_track_snapshot',
    'Collect current remote contribution state; preserves partial-read diagnostics',
    {
      outputDir: string('Absolute snapshot directory'),
      incremental: boolean('Reuse existing observations'),
    },
    ['outputDir'],
    (a) => track.snapshot(a),
  )
  register(
    'oss_track_cards',
    'Collect feedback cards for explicit targets',
    {
      targets: strings('owner/repo#N or owner/repo#N=issue'),
      outputDir: string('Absolute output directory'),
      since: string('Time range'),
    },
    ['targets', 'outputDir'],
    (a) => track.cards(a),
  )
  const runProps = {
    runId: string('Optional existing run to resume; new ID generated otherwise'),
    mode: { type: 'string', enum: ['all', 'hunt', 'ship', 'followup'] },
    targets: strings('Restrict to owner/repo#N'),
    batchSize: { type: 'integer', minimum: 1, maximum: 100 },
    snapshot: string('Optional existing tracker snapshot file'),
  }
  register(
    'oss_run_execute',
    'Execute or resume one native contribution cycle with DSH agents; preserves native gates.',
    runProps,
    [],
    (a, e) => executor.run(a, e?.signal),
  )
  register(
    'oss_run_recover',
    'Recover the last interrupted plugin run without stealing a live native lease',
    {},
    [],
    (_a, e) => executor.recover(e?.signal),
  )
  register('oss_run_status', 'Read durable run result and Agent session IDs', {}, [], async () => ({
    ...(await executor.status()),
    nextRunAt: scheduler.nextRunAt,
  }))
  register(
    'oss_run_cancel',
    'Cancel active plugin workers and retain the run for recovery',
    {},
    [],
    () => executor.cancel(),
  )
  register(
    'oss_run_prepare',
    'Advanced: prepare only; execute with oss_run_execute using the same scope.',
    runProps,
    ['runId'],
    (a) => scheduler.prepare(a.runId, a),
  )
  register(
    'oss_run_heartbeat',
    'Renew a native run lease',
    { runId: string('Native run ID') },
    ['runId'],
    (a) => scheduler.heartbeat(a.runId),
  )
  register(
    'oss_run_finish_task',
    'Settle a native task using a durable JSON result FILE',
    {
      runId: string('Native run ID'),
      taskId: string('Native task ID'),
      resultPath: string('Absolute JSON result file'),
    },
    ['runId', 'taskId', 'resultPath'],
    (a) => scheduler.finishTask(a.runId, a.taskId, a.resultPath),
  )
  register(
    'oss_run_finish',
    'Finish a run after every task is durably settled',
    { runId: string('Native run ID') },
    ['runId'],
    (a) => scheduler.finish(a.runId),
  )
  register(
    'oss_homepage_status',
    'Read profile synchronization diagnostics',
    { noFetch: boolean('Skip fetch') },
    [],
    (a) => ctx['oss-contrib/homepage'].syncStatus(a),
  )
  register(
    'oss_doctor',
    'Check plugin paths, native core and effective ledger settings',
    {},
    [],
    () => native.diagnostics(),
  )
}
