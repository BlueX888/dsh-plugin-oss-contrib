import { Context, Service } from 'cordis'
import { PythonBridge } from '../services/python-bridge.js'

/**
 * Homepage Phase Service
 * Covers: terminal → showcased
 */
export class HomepagePhase extends Service {
  static inject = ['oss-contrib']

  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/homepage')
  }

  private get bridge(): PythonBridge {
    return this.ctx['oss-contrib'].bridge
  }

  private get rootPath(): string {
    return this.ctx['oss-contrib'].config.paths.root
  }

  /**
   * Diagnose homepage sync status
   */
  async syncStatus(options: {
    repo?: string
    noFetch?: boolean
    snapshot?: string
  } = {}): Promise<any> {
    const args = ['--json']
    if (options.repo) args.push('--repo', options.repo)
    if (options.noFetch) args.push('--no-fetch')
    if (options.snapshot) args.push('--snapshot', options.snapshot)

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/homepage_sync.py`,
      args,
      { timeout: 120000 }
    )

    if (result.code !== 0) {
      throw new Error(`homepage_sync failed: ${result.stderr}`)
    }

    return JSON.parse(result.stdout)
  }

  /**
   * Publish profile update to GitHub
   */
  async publish(options: {
    repo: string
    worktree: string
    execute?: boolean
    runId?: string
    baseSha?: string
    headSha?: string
    reviewReceipt?: string
  }): Promise<any> {
    const args = ['--repo', options.repo, '--worktree', options.worktree]
    if (options.execute) args.push('--execute')
    if (options.runId) args.push('--run-id', options.runId)
    if (options.baseSha) args.push('--base-sha', options.baseSha)
    if (options.headSha) args.push('--head-sha', options.headSha)
    if (options.reviewReceipt) args.push('--review-receipt', options.reviewReceipt)

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/profile_publish.py`,
      args,
      { timeout: 180000 }
    )

    return {
      success: result.code === 0,
      output: result.stdout,
      stderr: result.stderr,
    }
  }
}
