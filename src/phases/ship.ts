import { Context, Service } from 'cordis'
import { PythonBridge } from '../services/python-bridge.js'

/**
 * Ship Phase Service
 * Covers: fix_ready → reviewed → published
 */
export class ShipPhase extends Service {
  static inject = ['oss-contrib']

  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/ship')
  }

  private get bridge(): PythonBridge {
    return this.ctx['oss-contrib'].bridge
  }

  private get rootPath(): string {
    return this.ctx['oss-contrib'].config.paths.root
  }

  /**
   * Check publishing quota
   */
  async checkQuota(): Promise<any> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/quota.py`,
      ['--json'],
      { timeout: 30000 }
    )

    if (result.code !== 0) {
      throw new Error(`quota check failed: ${result.stderr}`)
    }

    return JSON.parse(result.stdout)
  }

  /**
   * Generate claim comment for an issue
   */
  async claim(options: {
    issue: string
    repo: string
    slug?: string
    rootCause?: string
    fixNote?: string
    dryRun?: boolean
  }): Promise<any> {
    const args = ['auto']
    if (options.repo) args.push('--repo', options.repo)
    if (options.issue) args.push('--issue', options.issue)
    if (options.slug) args.push('--slug', options.slug)
    if (options.rootCause) args.push('--root-cause', options.rootCause)
    if (options.fixNote) args.push('--fix-note', options.fixNote)
    if (options.dryRun) args.push('--dry-run')
    else args.push('--mode', 'comment-only')

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/claim.py`,
      args,
      { timeout: 60000 }
    )

    return {
      success: result.code === 0,
      output: result.stdout,
      stderr: result.stderr,
    }
  }

  /**
   * Publish PR/issue
   */
  async publish(options: {
    manifest: string
    kind: 'issue' | 'pr' | 'update'
    execute?: boolean
    runId?: string
    inspect?: boolean
  }): Promise<any> {
    const args = ['--manifest', options.manifest, 'kind: ' + options.kind]
    if (options.execute) args.push('--execute')
    if (options.runId) args.push('--run-id', options.runId)
    if (options.inspect) args.push('--inspect')

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/publish.py`,
      args,
      { timeout: 300000 }
    )

    return {
      success: result.code === 0,
      exitCode: result.code,
      output: result.stdout,
      stderr: result.stderr,
    }
  }

  /**
   * Generate evidence receipt (red or green)
   */
  async evidence(options: {
    color: 'red' | 'green'
    worktree: string
    outputPath: string
    command: string[]
    timeout?: number
  }): Promise<any> {
    const args = [
      options.color,
      '--worktree', options.worktree,
      '--out', options.outputPath,
      '--',
      ...options.command,
    ]

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/evidence.py`,
      args,
      { timeout: options.timeout || 600000 }
    )

    return {
      receiptPath: options.outputPath,
      success: result.code === 0,
      output: result.stdout,
      stderr: result.stderr,
    }
  }

  /**
   * Post a comment to PR/issue
   */
  async comment(options: {
    repo: string
    number: number
    bodyFile: string
    execute?: boolean
    eventId?: string
  }): Promise<any> {
    const args = [
      '--repo', options.repo,
      '--number', options.number.toString(),
      '--body-file', options.bodyFile,
    ]
    if (options.execute) args.push('--execute')
    if (options.eventId) args.push('--event-id', options.eventId)

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/comment.py`,
      args,
      { timeout: 60000 }
    )

    return {
      success: result.code === 0,
      output: result.stdout,
    }
  }
}
