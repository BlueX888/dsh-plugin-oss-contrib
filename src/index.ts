import { Context, Service } from 'cordis'
import { Config } from './config.js'
import { PythonBridge } from './services/python-bridge.js'
import { StateService } from './services/state.js'
import { SchedulerService } from './services/scheduler.js'
import { WorkflowService } from './services/workflow.js'
import { HuntPhase } from './phases/hunt.js'
import { ShipPhase } from './phases/ship.js'
import { TrackPhase } from './phases/track.js'
import { HomepagePhase } from './phases/homepage.js'
import { registerTools } from './tools/index.js'

export { Config }

declare module 'cordis' {
  interface Context {
    'oss-contrib': OssContribPlugin
    'oss-contrib/state': StateService
    'oss-contrib/scheduler': SchedulerService
    'oss-contrib/workflow': WorkflowService
    'oss-contrib/hunt': HuntPhase
    'oss-contrib/ship': ShipPhase
    'oss-contrib/track': TrackPhase
    'oss-contrib/homepage': HomepagePhase
    tools: any
  }

  interface Events {
    'oss-cycle:prepare'(runId: string): void
    'oss-cycle:heartbeat'(runId: string, tasks: any[]): void
    'oss-cycle:finish'(runId: string, result: any): void
    'ready'(): void
  }
}

/**
 * OSS Contribution Pipeline Plugin for DeepSeek Harness
 *
 * Provides hunt/ship/track/homepage capabilities for managing
 * open source contributions across GitHub repositories.
 */
export class OssContribPlugin extends Service {
  static inject = ['tools']

  public bridge: PythonBridge
  public config: Config

  constructor(ctx: Context, config: Config) {
    super(ctx, 'oss-contrib')
    this.config = config

    // Initialize Python bridge
    this.bridge = new PythonBridge({
      ossBin: config.paths.root + '/bin',
      pythonBin: 'python', // Windows default
    })

    // Register services and phases
    ctx.plugin(StateService)
    ctx.plugin(SchedulerService)
    ctx.plugin(WorkflowService)
    ctx.plugin(HuntPhase)
    ctx.plugin(ShipPhase)
    ctx.plugin(TrackPhase)
    ctx.plugin(HomepagePhase)

    // Register all MCP tools
    registerTools(ctx)

    // Log plugin initialization
    ctx.on('ready', () => {
      ctx.logger('oss-contrib').info('OSS Contribution Pipeline loaded')
      ctx.logger('oss-contrib').info(`Root: ${config.paths.root}`)
      ctx.logger('oss-contrib').info(`State: ${config.paths.state}`)
      ctx.logger('oss-contrib').info('Registered 4 phases: hunt, ship, track, homepage')
      ctx.logger('oss-contrib').info('Workflow service ready')
    })
  }
}

export const name = 'oss-contrib'
export function apply(ctx: Context, config: Config) {
  ctx.plugin(OssContribPlugin, config)
}
