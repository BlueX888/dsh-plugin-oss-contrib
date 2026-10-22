import { Context, Service } from '@deepseek-ai/cordis'
export class TrackPhase extends Service {
  static inject = ['oss-contrib/native']
  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/track')
  }
  private get native() {
    return this.ctx['oss-contrib/native']
  }
  async snapshot(options: {
    outputDir: string
    incremental?: boolean
    previous?: string
    resume?: string
  }) {
    const r = await this.native.exec(
      'track.py',
      [
        '--out-dir',
        options.outputDir,
        ...(options.incremental ? ['--incremental'] : []),
        ...(options.previous ? ['--previous', options.previous] : []),
        ...(options.resume ? ['--resume', options.resume] : []),
      ],
      { timeout: 3600000 },
      [0, 2],
    )
    return { ...JSON.parse(r.stdout), exitCode: r.code }
  }
  async cards(options: { targets: string[]; outputDir: string; since?: string; workers?: number }) {
    if (!options.targets?.length) throw new Error('cards requires at least one owner/repo#N target')
    const r = await this.native.exec(
      'cards.py',
      [
        'batch',
        options.targets.join(','),
        '--out',
        options.outputDir,
        ...(options.since ? ['--since', options.since] : []),
        ...(options.workers ? ['--workers', String(options.workers)] : []),
      ],
      { timeout: 300000 },
      [0, 2],
    )
    return { output: r.stdout, stderr: r.stderr, exitCode: r.code, complete: r.code === 0 }
  }
}
