import { Context, Service } from 'cordis'
import { PythonBridge } from './python-bridge.js'

export interface TaskModel {
  id: string
  type: 'bugfix' | 'issue_only' | 'maintenance'
  repo: string
  slug?: string
  issue?: number
  pr?: number
  pr_url?: string
  stage: 'discovered' | 'reproduced' | 'fix_ready' | 'reviewed' | 'published' | 'following' | 'terminal' | 'showcased' | 'archived'
  terminal?: string | null
  lease?: any
  evidence?: Record<string, string>
  artifact_dir?: string
  showcase?: {
    listed: boolean
    last_synced_at?: string
  }
  stage_history?: Array<{ stage: string; at: string; by: string }>
  legacy?: any
}

export interface StateBrief {
  open_pr_count: number
  merged_pr_count: number
  issue_count: number
  paused: boolean
  pause_threshold: number
  blocked_count: number
  watch_count: number
}

export class StateService extends Service {
  static inject = ['oss-contrib']

  private get bridge(): PythonBridge {
    return this.ctx['oss-contrib'].bridge
  }

  private get rootPath(): string {
    return this.ctx['oss-contrib'].config.paths.root
  }

  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/state')

    ctx.on('ready', () => {
      ctx.logger('oss-contrib').debug('State service ready')
    })
  }

  /**
   * Get state brief (summary statistics)
   */
  async brief(): Promise<StateBrief> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/state.py`,
      ['brief', '--json'],
      { timeout: 30000 }
    )

    if (result.code !== 0) {
      throw new Error(`state.py brief failed: ${result.stderr}`)
    }

    return JSON.parse(result.stdout)
  }

  /**
   * Take a task from ready queue
   */
  async readyTake(runId: string, owner: string, ownerPid: number): Promise<any> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/state.py`,
      [
        'ready-take',
        '--run-id', runId,
        '--owner', owner,
        '--owner-pid', ownerPid.toString(),
        '--json'
      ],
      { timeout: 10000 }
    )

    if (result.code !== 0) {
      throw new Error(`state.py ready-take failed: ${result.stderr}`)
    }

    return JSON.parse(result.stdout)
  }

  /**
   * Peek at ready queue without taking
   */
  async readyPeek(): Promise<any[]> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/state.py`,
      ['ready-peek', '--json'],
      { timeout: 10000 }
    )

    if (result.code !== 0) {
      throw new Error(`state.py ready-peek failed: ${result.stderr}`)
    }

    return JSON.parse(result.stdout)
  }

  /**
   * Release a task back to ready queue
   */
  async readyRelease(taskId: string, runId: string): Promise<void> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/state.py`,
      ['ready-release', taskId, '--run-id', runId],
      { timeout: 10000 }
    )

    if (result.code !== 0) {
      throw new Error(`state.py ready-release failed: ${result.stderr}`)
    }
  }

  /**
   * Mark task as done
   */
  async readyDone(taskId: string, runId: string): Promise<void> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/state.py`,
      ['ready-done', taskId, '--run-id', runId],
      { timeout: 10000 }
    )

    if (result.code !== 0) {
      throw new Error(`state.py ready-done failed: ${result.stderr}`)
    }
  }

  /**
   * Get specific state value
   */
  async get(path: string): Promise<any> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/state.py`,
      ['get', path, '--json'],
      { timeout: 10000 }
    )

    if (result.code !== 0) {
      throw new Error(`state.py get failed: ${result.stderr}`)
    }

    return JSON.parse(result.stdout)
  }

  /**
   * Set specific state value
   */
  async set(path: string, value: any, apply: boolean = false): Promise<void> {
    const args = ['set', path, JSON.stringify(value)]
    if (apply) args.push('--apply')

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/state.py`,
      args,
      { timeout: 10000 }
    )

    if (result.code !== 0) {
      throw new Error(`state.py set failed: ${result.stderr}`)
    }
  }

  /**
   * Update state with mutation
   */
  async update(updates: Record<string, any>, apply: boolean = false): Promise<void> {
    const args = ['update', JSON.stringify(updates)]
    if (apply) args.push('--apply')

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/state.py`,
      args,
      { timeout: 10000 }
    )

    if (result.code !== 0) {
      throw new Error(`state.py update failed: ${result.stderr}`)
    }
  }

  /**
   * Get worklist (active tasks)
   */
  async worklist(): Promise<any[]> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/state.py`,
      ['worklist', '--json'],
      { timeout: 10000 }
    )

    if (result.code !== 0) {
      throw new Error(`state.py worklist failed: ${result.stderr}`)
    }

    return JSON.parse(result.stdout)
  }

  /**
   * Get state summary
   */
  async summary(): Promise<any> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/state.py`,
      ['summary', '--json'],
      { timeout: 30000 }
    )

    if (result.code !== 0) {
      throw new Error(`state.py summary failed: ${result.stderr}`)
    }

    return JSON.parse(result.stdout)
  }
}
