import { Context, Service } from '@deepseek-ai/cordis'
import { Config, pathsOf } from './config.js'
import { PythonBridge } from './services/python-bridge.js'
import { NativeService } from './services/native.js'
import { StateService } from './services/state.js'
import { SchedulerService } from './services/scheduler.js'
import { ExecutorService } from './services/executor.js'
import { WorkflowService } from './services/workflow.js'
import { HuntPhase } from './phases/hunt.js'
import { ShipPhase } from './phases/ship.js'
import { TrackPhase } from './phases/track.js'
import { HomepagePhase } from './phases/homepage.js'
import { registerTools } from './tools/index.js'
export { Config }
declare module '@deepseek-ai/cordis' {
  interface Context {
    'oss-contrib': OssContribPlugin
    'oss-contrib/native': NativeService
    'oss-contrib/state': StateService
    'oss-contrib/scheduler': SchedulerService
    'oss-contrib/executor': ExecutorService
    'oss-contrib/workflow': WorkflowService
    'oss-contrib/hunt': HuntPhase
    'oss-contrib/ship': ShipPhase
    'oss-contrib/track': TrackPhase
    'oss-contrib/homepage': HomepagePhase
    tools: any
    agents: any
    agentLoop: any
  }
}
export class OssContribPlugin extends Service {
  static inject = ['tools']
  bridge: PythonBridge
  private drain?: () => Promise<any>
  constructor(
    ctx: Context,
    public config: Config,
  ) {
    super(ctx, 'oss-contrib')
    const paths = pathsOf(config)
    this.bridge = new PythonBridge({
      ossBin: paths.root + '/bin',
      pythonBin: config.runtime.python,
      timeout: config.runtime.timeoutMs,
      env: {
        OSS_ROOT: paths.root,
        OSS_BIN: paths.root + '/bin',
        OSS_STATE: paths.state,
        OSS_STATE_DIR: paths.state,
        OSS_INBOX: paths.state + '/inbox',
        OSS_TASKS: paths.tasks,
        OSS_ARCHIVE: paths.archive,
        ...(config.github.token
          ? { GH_TOKEN: config.github.token, GITHUB_TOKEN: config.github.token }
          : {}),
      },
    })
    ctx.effect(() => async () => {
      await this.drain?.()
      await this.bridge.dispose()
    })
    for (const service of [
      NativeService,
      StateService,
      HuntPhase,
      ShipPhase,
      TrackPhase,
      HomepagePhase,
      ExecutorService,
      SchedulerService,
      WorkflowService,
    ])
      ctx.plugin(service)
    ctx.inject(['oss-contrib/executor'], (child) => {
      const executor = child['oss-contrib/executor']
      this.drain = () => executor.cancel()
    })
    ctx.inject(
      [
        'tools',
        'oss-contrib/native',
        'oss-contrib/state',
        'oss-contrib/hunt',
        'oss-contrib/ship',
        'oss-contrib/track',
        'oss-contrib/homepage',
        'oss-contrib/scheduler',
        'oss-contrib/executor',
      ],
      registerTools,
    )
  }
}
export const name = 'oss-contrib'
export const inject = ['tools']
export function apply(ctx: Context, config: Config) {
  ctx.plugin(OssContribPlugin, config)
}
