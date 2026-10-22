import { Context, Service } from '@deepseek-ai/cordis'
import { CronExpressionParser } from 'cron-parser'
import { RunOptions } from './executor.js'
export function nextScheduledAt(expression: string, timezone: string, now = new Date()) {
  return CronExpressionParser.parse(expression, { tz: timezone, currentDate: now }).next().toDate()
}
export class SchedulerService extends Service {
  static inject = ['oss-contrib', 'oss-contrib/native', 'oss-contrib/executor']
  private timer?: NodeJS.Timeout
  private stopped = false
  nextRunAt?: string
  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/scheduler')
    const config = ctx['oss-contrib'].config.scheduler
    if (config.enabled) nextScheduledAt(config.interval, config.timezone)
    ctx.effect(() => () => {
      this.stopped = true
      if (this.timer) clearTimeout(this.timer)
    })
    if (config.enabled)
      ctx.inject(['agents', 'agentLoop'], (ready) => {
        const timer = setTimeout(() => {
          void this.start().catch((error) => ctx.logger('oss-contrib').error(String(error)))
        }, 0)
        ready.effect(() => () => {
          clearTimeout(timer)
          if (this.timer) clearTimeout(this.timer)
        })
      })
  }
  private async start() {
    const executor = this.ctx['oss-contrib/executor']
    try {
      const status = await executor.status()
      if (status.runId && !['finished', 'idle', 'busy', 'cancelled'].includes(status.status))
        await executor.recover()
      else if (this.ctx['oss-contrib'].config.scheduler.runOnStart) await this.tick()
    } finally {
      this.schedule()
    }
  }
  private schedule() {
    if (this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    const c = this.ctx['oss-contrib'].config.scheduler
    const next = nextScheduledAt(c.interval, c.timezone)
    this.nextRunAt = next.toISOString()
    // Clamp long timers and recalculate instead of overflowing Node's 32-bit timer.
    const delay = next.getTime() - Date.now()
    this.timer = setTimeout(
      () => {
        if (delay > 2147483647) {
          this.schedule()
          return
        }
        void this.tick()
          .catch((e) => this.ctx.logger('oss-contrib').error(String(e)))
          .finally(() => this.schedule())
      },
      Math.min(delay, 2147483647),
    )
  }
  private async tick() {
    const c = this.ctx['oss-contrib'].config.scheduler
    const e = this.ctx['oss-contrib/executor'],
      status = await e.status()
    if (status.active) return
    if (status.runId && !['finished', 'idle', 'busy', 'cancelled'].includes(status.status))
      return e.recover()
    return e.run({ mode: c.mode, targets: c.targets, batchSize: c.batchSize })
  }
  prepare(runId: string, options: RunOptions = {}) {
    return this.ctx['oss-contrib/native'].json(
      'cycle.py',
      [
        'prepare',
        '--run-id',
        runId,
        '--mode',
        options.mode || 'all',
        '--host-slots',
        '1',
        ...(options.targets || []).flatMap((t) => ['--target', t]),
        ...(options.batchSize ? ['--batch-size', String(options.batchSize)] : []),
        ...(options.snapshot ? ['--snapshot', options.snapshot] : []),
      ],
      { timeout: 3600000 },
    )
  }
  heartbeat(runId: string) {
    return this.ctx['oss-contrib/native'].json('cycle.py', ['heartbeat', runId])
  }
  finishTask(runId: string, taskId: string, resultPath: string) {
    return this.ctx['oss-contrib/native'].json('cycle.py', [
      'finish-task',
      runId,
      taskId,
      '--result',
      resultPath,
    ])
  }
  finish(runId: string) {
    return this.ctx['oss-contrib/native'].json('cycle.py', ['finish', runId])
  }
}
