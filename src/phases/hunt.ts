import { Context, Service } from 'cordis'
import { PythonBridge } from '../services/python-bridge.js'

/**
 * Hunt Phase Service
 * Covers: discovered → reproduced → fix_ready
 */
export class HuntPhase extends Service {
  static inject = ['oss-contrib']

  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/hunt')
  }

  private get bridge(): PythonBridge {
    return this.ctx['oss-contrib'].bridge
  }

  private get rootPath(): string {
    return this.ctx['oss-contrib'].config.paths.root
  }

  /**
   * Discover issues from a repository
   */
  async discover(repo: string): Promise<{ issues: any[]; output: string }> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/discover.py`,
      [repo],
      { timeout: 120000 }
    )

    if (result.code !== 0) {
      throw new Error(`discover failed: ${result.stderr}`)
    }

    return {
      issues: [], // TODO: parse output
      output: result.stdout,
    }
  }

  /**
   * Probe a specific issue (deep investigation)
   */
  async probe(target: string): Promise<any> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/probe.py`,
      [target],
      { timeout: 180000 }
    )

    return {
      target,
      exitCode: result.code,
      output: result.stdout,
      stderr: result.stderr,
    }
  }

  /**
   * Screen for policy violations and duplicates
   */
  async screen(options: { issue?: string; repo?: string; kw?: string }): Promise<{ passed: boolean; output: string }> {
    const args = ['sweep']
    if (options.issue) args.push('--issue', options.issue)
    if (options.repo) args.push('--path', options.repo)
    if (options.kw) args.push('--kw', options.kw)

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/screen.py`,
      args,
      { timeout: 60000 }
    )

    return {
      passed: result.code === 0,
      output: result.stdout,
    }
  }

  /**
   * Check collision (duplicate detection)
   */
  async checkCollision(issue: string, options: { days?: number; path?: string }): Promise<boolean> {
    const args = ['--issue', issue]
    if (options.days) args.push('--days', options.days.toString())
    if (options.path) args.push('--path', options.path)

    const result = await this.bridge.exec(
      `${this.rootPath}/bin/collide.py`,
      args,
      { timeout: 30000 }
    )

    return result.code === 0
  }

  /**
   * Get repository policy summary
   */
  async getPolicy(repo: string): Promise<any> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/policy.py`,
      [repo, '--full'],
      { timeout: 60000 }
    )

    return {
      repo,
      output: result.stdout,
    }
  }

  /**
   * Run preflight checks (circuit breaker, rotation)
   */
  async preflight(): Promise<{ passed: boolean; exitCode: number | null; output: string }> {
    const result = await this.bridge.exec(
      `${this.rootPath}/bin/preflight.py`,
      ['--json'],
      { timeout: 30000 }
    )

    return {
      passed: result.code === 0,
      exitCode: result.code,
      output: result.stdout,
    }
  }
}

