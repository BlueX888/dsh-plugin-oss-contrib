import { Context, Service } from '@deepseek-ai/cordis'
export class HuntPhase extends Service {
  static inject = ['oss-contrib/native']
  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/hunt')
  }
  private get native() {
    return this.ctx['oss-contrib/native']
  }
  async discover(repo: string) {
    return { output: (await this.native.exec('discover.py', [repo], { timeout: 120000 })).stdout }
  }
  async probe(target: string) {
    const r = await this.native.exec('probe.py', [target], { timeout: 180000 }, [0, 1, 2, 3])
    return { output: r.stdout, stderr: r.stderr, exitCode: r.code }
  }
  async screen(options: {
    repo?: string
    issue?: string
    kw?: string
    path?: string
    reposFile?: string
  }) {
    let args: string[]
    if (options.reposFile) args = ['sweep', options.reposFile]
    else if (options.issue) args = ['io', options.issue]
    else if (options.repo && (options.kw || options.path))
      args = [
        'clash',
        options.repo,
        ...(options.kw ? ['--kw', options.kw] : []),
        ...(options.path ? ['--path', options.path] : []),
      ]
    else if (options.repo) args = ['repo', options.repo]
    else throw new Error('screen requires repo, issue (owner/repo#N), or reposFile')
    const r = await this.native.exec('screen.py', args, { timeout: 120000 })
    return { output: r.stdout, exitCode: r.code }
  }
  async getPolicy(repo: string) {
    return { output: (await this.native.exec('policy.py', [repo, '--full'])).stdout }
  }
  async preflight() {
    const r = await this.native.exec('preflight.py', ['--json'], {}, [0, 3, 4])
    return { ...JSON.parse(r.stdout), exitCode: r.code }
  }
}
