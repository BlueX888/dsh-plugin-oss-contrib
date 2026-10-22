import { Context, Service } from '@deepseek-ai/cordis'
import { pathsOf } from '../config.js'
import { PythonCallOptions } from './python-bridge.js'
import type { OssContribPlugin } from '../index.js'
export function parseJSON(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Native command returned invalid JSON: ' + text.slice(-1000))
  }
}
export class NativeService extends Service {
  static inject = ['oss-contrib']
  private readonly owner: Pick<OssContribPlugin, 'bridge' | 'config'>
  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/native')
    this.owner = { bridge: ctx['oss-contrib'].bridge, config: ctx['oss-contrib'].config }
  }
  get plugin() {
    return this.owner
  }
  get paths() {
    return pathsOf(this.plugin.config)
  }
  async exec(script: string, args: string[], options: PythonCallOptions = {}, allowed = [0]) {
    const result = await this.plugin.bridge.exec(this.paths.root + '/bin/' + script, args, {
      cwd: this.paths.root,
      ...options,
    })
    if (!allowed.includes(result.code ?? -1))
      throw new Error(
        script + ' exited ' + result.code + ': ' + (result.stderr || result.stdout).slice(-6000),
      )
    return result
  }
  async json(script: string, args: string[], options: PythonCallOptions = {}) {
    return parseJSON((await this.exec(script, args, options)).stdout)
  }
  async adapter(args: string[], options: PythonCallOptions = {}, session?: string) {
    return this.json(
      'workflow_adapter.py',
      [
        '--root',
        this.paths.root,
        '--state-dir',
        this.paths.state,
        '--tasks-root',
        this.paths.tasks,
        ...(session ? ['--session', session] : []),
        ...args,
      ],
      options,
    )
  }
  async diagnostics() {
    const { github, quota } = this.plugin.config
    return this.plugin.bridge.call('plugin_api', 'diagnostics', [
      github.user ?? null,
      quota.pauseThreshold ?? null,
      quota.dailyCap ?? null,
    ])
  }
  async assertCompatible() {
    const result = await this.diagnostics()
    if (!result.compatible) throw new Error(result.errors.join('; '))
    return result
  }
}
