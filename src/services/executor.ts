import { Context, Service } from '@deepseek-ai/cordis'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { AgentRunner, WorkerResult } from './agent-runner.js'
import { NativeService } from './native.js'
export interface RunOptions {
  runId?: string
  mode?: 'all' | 'hunt' | 'ship' | 'followup'
  targets?: string[]
  batchSize?: number
  snapshot?: string
}
export async function atomicJSON(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true })
  const temp = path + '.' + randomUUID() + '.tmp'
  await writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
  await rename(temp, path)
}
export class ExecutorService extends Service {
  static inject = ['oss-contrib', 'oss-contrib/native', 'oss-contrib/state']
  private pending?: Promise<any>
  private controller?: AbortController
  private stopped = false
  private live: any
  private core: NativeService
  runner: AgentRunner
  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/executor')
    this.core = ctx['oss-contrib/native']
    this.runner = new AgentRunner(ctx, ctx['oss-contrib'].config)
    ctx.effect(() => () => this.disposeExecution())
  }
  private get native() {
    return this.core
  }
  private get pointer() {
    return join(this.native.paths.state, 'dsh-plugin', 'latest.json')
  }
  async status() {
    try {
      return { ...JSON.parse(await readFile(this.pointer, 'utf8')), active: !!this.pending }
    } catch (e: any) {
      if (e.code === 'ENOENT') return { status: 'idle', active: !!this.pending }
      throw e
    }
  }
  async cancel() {
    this.controller?.abort()
    await this.pending?.catch(() => {})
    return this.status()
  }
  private async disposeExecution() {
    this.stopped = true
    await this.cancel()
  }
  async run(options: RunOptions = {}, signal?: AbortSignal) {
    if (this.stopped) throw new Error('Executor disposed')
    if (signal?.aborted) throw new Error('Operation cancelled')
    if (this.pending) return { status: 'busy', run_id: this.live?.runId }
    this.controller = new AbortController()
    const controller = this.controller
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const promise = this.execute(options, this.controller.signal)
    this.pending = promise
    try {
      return await promise
    } finally {
      signal?.removeEventListener('abort', abort)
      this.pending = undefined
      this.controller = undefined
    }
  }
  private async record(patch: Record<string, any>) {
    this.live = { ...this.live, ...patch, updatedAt: new Date().toISOString() }
    if (this.live.runId)
      await atomicJSON(
        join(this.native.paths.state, 'dsh-plugin', 'runs', this.live.runId + '.json'),
        this.live,
      )
    await atomicJSON(this.pointer, this.live)
  }
  async recover(signal?: AbortSignal) {
    const last = await this.status()
    if (!last.runId || ['finished', 'idle', 'busy', 'cancelled'].includes(last.status)) return last
    const store = await this.ctx['oss-contrib/state'].get('automation')
    const active = store?.active_run
    if (active?.id === last.runId && Date.parse(active.expires_at) > Date.now()) {
      // A hard crash leaves a native adapter session. Never steal it while the lease is live.
      return this.run({ ...last.options, runId: last.runId }, signal)
    }
    return this.run(last.options || {}, signal)
  }
  private async execute(options: RunOptions, signal: AbortSignal) {
    await this.native.assertCompatible()
    if (!this.runner.available()) throw new Error('DSH agent execution is unavailable')
    const mode = options.mode || 'all',
      targets = [...new Set((options.targets || []).map((t) => t.toLowerCase()))]
    const runId = options.runId || 'dsh-' + Date.now() + '-' + randomUUID().slice(0, 8)
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(runId)) throw new Error('Invalid runId')
    if (targets.some((x) => !/^[\w.-]+\/[\w.-]+#[1-9][0-9]*$/.test(x)))
      throw new Error('targets must be owner/repo#N')
    let prior: any
    if (options.runId) {
      try {
        prior = JSON.parse(
          await readFile(
            join(this.native.paths.state, 'dsh-plugin', 'runs', runId + '.json'),
            'utf8',
          ),
        )
      } catch (error: any) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    if (
      prior?.options &&
      (prior.options.mode !== mode ||
        JSON.stringify([...prior.options.targets].sort()) !== JSON.stringify([...targets].sort()))
    )
      throw new Error('Cannot change the scope of an existing run')
    this.live = {
      ...prior,
      runId,
      options: { ...options, runId: undefined, mode, targets },
      status: 'preparing',
      error: undefined,
      sessions: prior?.sessions || [],
      startedAt: prior?.startedAt || new Date().toISOString(),
    }
    await this.record({})
    let token: string | undefined,
      heartbeat: NodeJS.Timeout | undefined,
      beat: Promise<any> | undefined,
      ownershipError: Error | undefined
    const adapter = (args: string[], withSignal = true) =>
      this.native.adapter(args, { ...(withSignal ? { signal } : {}), timeout: 120000 }, token)
    try {
      let plan = options.runId
        ? await adapter([
            'resume',
            runId,
            '--mode',
            mode,
            ...targets.flatMap((t) => ['--target', t]),
          ])
        : { status: 'absent' }
      if (plan.status === 'finished') {
        await this.record({ status: 'finished', result: plan.result })
        return plan.result
      }
      if (plan.status === 'absent')
        plan = await this.native.json(
          'cycle.py',
          [
            'prepare',
            '--run-id',
            runId,
            '--mode',
            mode,
            '--host-slots',
            '1',
            ...(options.batchSize ? ['--batch-size', String(options.batchSize)] : []),
            ...targets.flatMap((t) => ['--target', t]),
            ...(options.snapshot ? ['--snapshot', options.snapshot] : []),
          ],
          { signal, timeout: 3600000 },
        )
      if (plan.status === 'busy') {
        await this.record({ status: 'busy', result: plan })
        return plan
      }
      if (plan.status === 'idle') {
        await this.record({ status: 'idle', result: plan })
        return plan
      }
      if (plan.status !== 'ready')
        throw new Error('Unexpected native plan: ' + JSON.stringify(plan))
      token = (await adapter(['watch-session', runId])).token
      await this.record({ status: 'running', taskCount: plan.tasks.length })
      const renew = async () => {
        await adapter(['check', runId], false)
        await adapter(['native', 'run', 'heartbeat', runId], false)
      }
      await renew()
      heartbeat = setInterval(() => {
        if (beat) return
        beat = renew()
          .catch((error) => {
            ownershipError = error
            this.controller?.abort()
          })
          .finally(() => {
            beat = undefined
          })
      }, 30000)
      for (const task of plan.tasks) {
        if (signal.aborted) throw ownershipError || new Error('Operation cancelled')
        await adapter(['check', runId])
        await this.record({ taskId: task.task_id })
        try {
          const spec = await adapter([
            'describe',
            runId,
            task.task_id,
            '--python',
            this.native.plugin.bridge.pythonBin,
          ])
          let result: WorkerResult = spec.saved_result
          if (!result) {
            result = await this.runner.execute(
              spec.prompt +
                '\nExecute only this task. The DSH coordinator runs one worker at a time. Return the native JSON result.\n',
              this.native.paths.root,
              signal,
              async (id) => {
                await this.record({
                  sessions: [...this.live.sessions, { taskId: task.task_id, sessionId: id }],
                })
              },
            )
            await adapter(['check', runId])
            await adapter(['save-result', runId, task.task_id, '--json', JSON.stringify(result)])
          }
          await adapter([
            'native',
            'run',
            'finish-task',
            runId,
            task.task_id,
            '--result',
            spec.result_path,
          ])
        } catch (error) {
          if (signal.aborted) throw error
          await adapter(['check', runId])
          const saved = await adapter([
            'save-failure',
            runId,
            task.task_id,
            '--reason',
            String(error),
          ])
          if (saved.status !== 'already_settled')
            await adapter([
              'native',
              'run',
              'finish-task',
              runId,
              task.task_id,
              '--result',
              saved.result_path,
            ])
        }
      }
      if (heartbeat) {
        clearInterval(heartbeat)
        heartbeat = undefined
      }
      await beat
      if (ownershipError) throw ownershipError
      const result = await adapter(['native', 'run', 'finish', runId])
      await this.record({ status: 'finished', result })
      return result
    } catch (error) {
      await this.record({ status: signal.aborted ? 'interrupted' : 'error', error: String(error) })
      throw error
    } finally {
      if (heartbeat) clearInterval(heartbeat)
      await beat
      if (token)
        await this.native
          .adapter(['stop', runId, token], { timeout: 30000 })
          .catch((error) =>
            this.ctx.logger('oss-contrib').warn('Adapter stop failed: ' + String(error)),
          )
    }
  }
}
