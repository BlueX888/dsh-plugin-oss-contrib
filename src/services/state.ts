import { Context, Service } from '@deepseek-ai/cordis'
export interface TaskModel {
  id: string
  repo: string
  stage: string
  [key: string]: unknown
}
export class StateService extends Service {
  static inject = ['oss-contrib', 'oss-contrib/native']
  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/state')
  }
  private get native() {
    return this.ctx['oss-contrib/native']
  }
  async brief() {
    return { output: (await this.native.exec('state.py', ['brief'])).stdout }
  }
  async summary() {
    return { output: (await this.native.exec('state.py', ['summary'])).stdout }
  }
  async worklist() {
    return { output: (await this.native.exec('state.py', ['worklist'])).stdout }
  }
  async readyPeek() {
    return this.lines((await this.native.exec('state.py', ['ready-peek'])).stdout)
  }
  private lines(output: string) {
    return output
      .split(/\r?\n/)
      .filter((x) => x.trim())
      .map((x) => JSON.parse(x))
  }
  async readyTake(runId: string, owner: string, ownerPid: number, count = 1) {
    return this.lines(
      (
        await this.native.exec('state.py', [
          'ready-take',
          String(count),
          '--run-id',
          runId,
          '--owner',
          owner,
          '--owner-pid',
          String(ownerPid),
        ])
      ).stdout,
    )
  }
  async readyRelease(repo: string, slug: string, runId: string, owner = 'native:' + runId) {
    return this.native.exec('state.py', [
      'ready-release',
      repo,
      slug,
      '--run-id',
      runId,
      '--owner',
      owner,
    ])
  }
  async readyDone(repo: string, slug: string, runId: string, owner = 'native:' + runId) {
    return this.native.exec('state.py', [
      'ready-done',
      repo,
      slug,
      '--run-id',
      runId,
      '--owner',
      owner,
    ])
  }
  get(key?: string) {
    return this.ctx['oss-contrib'].bridge.call('plugin_api', 'read_state', [key ?? null])
  }
  set(key: string, value: unknown, apply = false) {
    return this.ctx['oss-contrib'].bridge.call('plugin_api', 'set_state', [key, value, apply])
  }
  update(updates: Record<string, unknown>, apply = false) {
    return this.ctx['oss-contrib'].bridge.call('plugin_api', 'update_state', [updates, apply])
  }
}
