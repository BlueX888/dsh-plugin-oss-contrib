import { Context, Service } from '@deepseek-ai/cordis'
import { readFile } from 'node:fs/promises'
export class ShipPhase extends Service {
  static inject = ['oss-contrib/native']
  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/ship')
  }
  private get native() {
    return this.ctx['oss-contrib/native']
  }
  async checkQuota() {
    const r = await this.native.exec('quota.py', ['--json'], {}, [0, 2])
    return { ...JSON.parse(r.stdout), exitCode: r.code }
  }
  async publish(options: {
    manifest: string
    kind?: 'issue' | 'pr' | 'update'
    execute?: boolean
    runId: string
  }) {
    if (!options.runId) throw new Error('runId is required by the native publisher')
    const manifest = JSON.parse(await readFile(options.manifest, 'utf8'))
    if (options.kind && options.kind !== (manifest.kind || 'pr'))
      throw new Error('kind must match manifest.kind')
    await this.native.assertCompatible()
    const r = await this.native.exec(
      'publish.py',
      [
        '--manifest',
        options.manifest,
        '--run-id',
        options.runId,
        ...(options.execute ? ['--execute'] : []),
      ],
      { timeout: 300000 },
      [0, 2, 3],
    )
    const result = JSON.parse(r.stdout)
    return {
      ...result,
      exitCode: r.code,
      success: r.code === 0 && !['blocked', 'error'].includes(result.status),
    }
  }
  async evidence(options: {
    color?: string
    role?: string
    actor: 'implementer' | 'reviewer'
    runId: string
    worktree: string
    outputPath: string
    command: string[]
    timeout?: number
    harness?: string[]
  }) {
    const role = options.role || options.color
    if (!role || !options.actor || !options.runId)
      throw new Error('role, actor and runId are required')
    const args = [
      '--worktree',
      options.worktree,
      '--role',
      role,
      '--actor',
      options.actor,
      '--run-id',
      options.runId,
      '--out',
      options.outputPath,
      '--timeout',
      String(Math.floor((options.timeout || 600000) / 1000)),
      ...(options.harness || []).flatMap((p) => ['--harness', p]),
      '--',
      ...options.command,
    ]
    const r = await this.native.exec(
      'evidence.py',
      args,
      { timeout: (options.timeout || 600000) + 10000 },
      [0, 2],
    )
    return { ...JSON.parse(r.stdout), success: r.code === 0, exitCode: r.code }
  }
}
