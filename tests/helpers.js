import { Context, Service } from '@deepseek-ai/cordis'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import * as plugin from '../lib/index.js'
export const core = resolve(process.env.OSS_TEST_ROOT || '..')
export async function harness(overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'oss-plugin-'))
  const state = join(dir, 'state')
  await mkdir(state)
  await writeFile(
    join(state, 'state.json'),
    JSON.stringify({
      automation: { hunt_enabled: false },
      ready_queue: [],
      open_prs: [],
      merged_prs: [],
    }),
  )
  const definitions = new Map(),
    ctx = new Context()
  class Tools extends Service {
    constructor(ctx) {
      super(ctx, 'tools')
    }
    register(d) {
      definitions.set(d.name, d)
      return this.ctx.effect(() => () => definitions.delete(d.name))
    }
  }
  await ctx.plugin(Tools)
  const config = plugin.Config({
    paths: { root: core, state, tasks: join(dir, 'tasks'), archive: join(dir, 'archive') },
    ...overrides,
  })
  await ctx.plugin(plugin, config)
  await new Promise((r) => setImmediate(r))
  return {
    ctx,
    definitions,
    dir,
    state,
    config,
    async close() {
      await ctx.fiber.dispose()
      await rm(dir, { recursive: true, force: true })
    },
  }
}
export async function seedRun(h, runId = 'r1', count = 1) {
  const tasks = Array.from({ length: count }, (_, i) => ({
    task_id: 't' + i,
    key: 'k' + i,
    kind: 'COMMENT',
    repo: 'fixture/repo',
    number: i + 1,
    status: 'running',
    run_id: runId,
    attempts: 1,
    execution: { class: 'read' },
  }))
  const plan = { run_id: runId, status: 'ready', mode: 'followup', targets: [], tasks }
  await writeFile(
    join(h.state, 'state.json'),
    JSON.stringify({
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
    }),
  )
  return plan
}
