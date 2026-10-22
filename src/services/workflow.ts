import { Context, Service } from '@deepseek-ai/cordis'
import { RunOptions } from './executor.js'
/** Compatibility names route to the native executor, never to node <host DSL>. */
export class WorkflowService extends Service {
  static inject = ['oss-contrib/executor']
  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/workflow')
  }
  async executeWorkflow(name: string, args: RunOptions = {}) {
    const modes: Record<string, RunOptions['mode']> = {
      'oss-hunt': 'hunt',
      'oss-ship': 'ship',
      'oss-followup': 'followup',
      'oss-round': 'all',
    }
    if (!modes[name]) throw new Error('Unknown workflow')
    return this.ctx['oss-contrib/executor'].run({ ...args, mode: modes[name] })
  }
  async listWorkflows() {
    return ['oss-hunt', 'oss-ship', 'oss-followup', 'oss-round']
  }
}
