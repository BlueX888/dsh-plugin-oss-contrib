import { Context, Service } from '@deepseek-ai/cordis'
export class HomepagePhase extends Service {
  static inject = ['oss-contrib/native']
  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/homepage')
  }
  async syncStatus(options: { repo?: string; noFetch?: boolean; snapshot?: string } = {}) {
    return this.ctx['oss-contrib/native'].json('homepage_sync.py', [
      '--json',
      ...(options.repo ? ['--repo', options.repo] : []),
      ...(options.noFetch ? ['--no-fetch'] : []),
      ...(options.snapshot ? ['--snapshot', options.snapshot] : []),
    ])
  }
}
