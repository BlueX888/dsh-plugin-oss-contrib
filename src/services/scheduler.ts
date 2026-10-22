import { Context, Service } from 'cordis'
import { PythonBridge } from './python-bridge.js'

export interface CycleResult {
  runId: string
  status: 'done' | 'waiting' | 'retry' | 'needs_user'
  tasksCompleted: number
  tasksPending: number
  errors?: string[]
}

export class SchedulerService extends Service {
  static inject = ['oss-contrib', 'oss-contrib/state']

  private intervalId?: NodeJS.Timeout
  private currentRunId?: string

  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/scheduler')

    const config = ctx['oss-contrib'].config

    ctx.on('ready', () => {
      if (config.scheduler.enabled) {
        ctx.logger('oss-contrib').info('Scheduler enabled')
        // For now, manual triggering only
        // TODO: implement cron-based scheduling if interval is set
      } else {
        ctx.logger('oss-contrib').info('Scheduler disabled (manual mode)')
      }
    })
  }

  private get bridge(): PythonBridge {
    return this.ctx['oss-contrib'].bridge
  }

  private get rootPath(): string {
    return this.ctx['oss-contrib'].config.paths.root
  }

  /**
   * Prepare a new cycle run
   */
  async prepare(runId: string, options: {
    mode?: 'all' | 'hunt' | 'ship' | 'followup'
    targets?: string[]
    batchSize?: number
  } = {}): Promise<any> {
    const logger = this.ctx.logger('oss-contrib')
    logger.info(`Preparing cycle run: ${runId}`)

    const args = ['prepare', '--run-id', runId]
    if (options.mode) args.push('--mode', options.mode)
    if (options.batchSize) args.push('--batch-size', options.batchSize.toString())

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/cycle.py`,
      args,
      { timeout: 120000 }
    )

    if (result.code !== 0) {
      throw new Error(`cycle.py prepare failed: ${result.stderr}`)
    }

    this.currentRunId = runId

    // Emit event
    this.ctx.emit('oss-cycle:prepare', runId)

    return {
      runId,
      output: result.stdout,
      stderr: result.stderr,
    }
  }

  /**
   * Heartbeat: check run status and pending tasks
   */
  async heartbeat(runId: string): Promise<any> {
    const logger = this.ctx.logger('oss-contrib')
    logger.debug(`Heartbeat for run: ${runId}`)

    const args = ['heartbeat', '--run-id', runId, '--json']

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/cycle.py`,
      args,
      { timeout: 60000 }
    )

    if (result.code !== 0) {
      throw new Error(`cycle.py heartbeat failed: ${result.stderr}`)
    }

    const data = JSON.parse(result.stdout)

    // Emit event
    this.ctx.emit('oss-cycle:heartbeat', runId, data.tasks || [])

    return data
  }

  /**
   * Finish a specific task in the cycle
   */
  async finishTask(runId: string, taskId: string, taskResult: any): Promise<any> {
    const logger = this.ctx.logger('oss-contrib')
    logger.info(`Finishing task: ${taskId}`)

    const args = [
      'finish-task',
      '--run-id', runId,
      '--result', JSON.stringify(taskResult),
    ]

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/cycle.py`,
      args,
      { timeout: 60000 }
    )

    if (result.code !== 0) {
      throw new Error(`cycle.py finish-task failed: ${result.stderr}`)
    }

    return {
      taskId,
      settled: true,
      output: result.stdout,
    }
  }

  /**
   * Finish the entire cycle run
   */
  async finish(runId: string, options: { snapshot?: string } = {}): Promise<CycleResult> {
    const logger = this.ctx.logger('oss-contrib')
    logger.info(`Finishing cycle run: ${runId}`)

    const args = ['finish', '--run-id', runId]
    if (options.snapshot) args.push('--snapshot', options.snapshot)

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/cycle.py`,
      args,
      { timeout: 300000 }
    )

    const cycleResult: CycleResult = {
      runId,
      status: result.code === 0 ? 'done' : 'needs_user',
      tasksCompleted: 0, // TODO: parse from output
      tasksPending: 0,
      errors: result.code !== 0 ? [result.stderr] : undefined,
    }

    // Emit event
    this.ctx.emit('oss-cycle:finish', runId, cycleResult)

    this.currentRunId = undefined

    return cycleResult
  }

  /**
   * Get current run ID
   */
  getCurrentRunId(): string | undefined {
    return this.currentRunId
  }

  /**
   * Check if a run is active
   */
  isRunActive(): boolean {
    return this.currentRunId !== undefined
  }
}
