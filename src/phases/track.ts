import { Context, Service } from 'cordis'
import { PythonBridge } from '../services/python-bridge.js'

/**
 * Track Phase Service
 * Covers: following → terminal
 */
export class TrackPhase extends Service {
  static inject = ['oss-contrib']

  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/track')
  }

  private get bridge(): PythonBridge {
    return this.ctx['oss-contrib'].bridge
  }

  private get rootPath(): string {
    return this.ctx['oss-contrib'].config.paths.root
  }

  /**
   * Take a tracking snapshot
   */
  async snapshot(options: {
    outputDir: string
    incremental?: boolean
    previous?: string
    resume?: string
  }): Promise<any> {
    const args = ['--out-dir', options.outputDir]
    if (options.incremental) args.push('--incremental')
    if (options.previous) args.push('--previous', options.previous)
    if (options.resume) args.push('--resume', options.resume)

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/track.py`,
      args,
      { timeout: 600000 }
    )

    return {
      snapshotDir: options.outputDir,
      success: result.code === 0,
      output: result.stdout,
      stderr: result.stderr,
    }
  }

  /**
   * Generate change cards for PRs/issues
   */
  async cards(options: {
    outputDir: string
    since?: string
    workers?: number
    mode?: 'batch' | 'pr' | 'issue' | 'ci'
  }): Promise<any> {
    const mode = options.mode || 'batch'
    const args = [mode, '--out', options.outputDir]

    if (options.since) args.push('--since', options.since)
    if (options.workers) args.push('--workers', options.workers.toString())

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/cards.py`,
      args,
      { timeout: 300000 }
    )

    return {
      cardsDir: options.outputDir,
      success: result.code === 0,
      output: result.stdout,
    }
  }

  /**
   * Run followup (legacy wrapper)
   */
  async followup(options: {
    outputDir: string
    since?: string
    all?: boolean
  }): Promise<any> {
    const args = ['--out-dir', options.outputDir]
    if (options.since) args.push('--since', options.since)
    if (options.all) args.push('--all')

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/followup.py`,
      args,
      { timeout: 300000 }
    )

    return {
      outputDir: options.outputDir,
      success: result.code === 0,
      output: result.stdout,
    }
  }
}
