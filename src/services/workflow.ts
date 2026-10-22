import { Context, Service } from 'cordis'
import { PythonBridge } from './python-bridge.js'
import { spawn } from 'child_process'

/**
 * Workflow Service - Bridge to workflows/*.mjs
 *
 * Note: Deep Harness workflow runtime may differ from Claude Code.
 * This provides a basic execution bridge for the original workflows.
 */
export class WorkflowService extends Service {
  static inject = ['oss-contrib']

  constructor(ctx: Context) {
    super(ctx, 'oss-contrib/workflow')
  }

  private get bridge(): PythonBridge {
    return this.ctx['oss-contrib'].bridge
  }

  private get rootPath(): string {
    return this.ctx['oss-contrib'].config.paths.root
  }

  /**
   * Execute a workflow script
   *
   * @param workflowName - Name of workflow (e.g., 'oss-hunt')
   * @param args - Workflow arguments
   */
  async executeWorkflow(workflowName: string, args: Record<string, any>): Promise<any> {
    const logger = this.ctx.logger('oss-contrib')
    logger.info(`Executing workflow: ${workflowName}`)

    // Workflow scripts are in F:\PR\workflows\
    const workflowPath = `${this.rootPath}/workflows/${workflowName}.mjs`

    // Pass required paths as arguments
    const workflowArgs = {
      ...args,
      bin_dir: `${this.rootPath}/bin`,
      state_dir: this.ctx['oss-contrib'].config.paths.state,
      root: this.rootPath,
      tasks_root: this.ctx['oss-contrib'].config.paths.tasks,
      run_dir: `${this.ctx['oss-contrib'].config.paths.state}/runs/${args.run_id || 'default'}`,
    }

    return new Promise((resolve, reject) => {
      const proc = spawn('node', [workflowPath, JSON.stringify(workflowArgs)], {
        cwd: this.rootPath,
        env: {
          ...process.env,
          OSS_ROOT: this.rootPath,
          OSS_STATE: this.ctx['oss-contrib'].config.paths.state,
        },
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', d => { stdout += d.toString() })
      proc.stderr.on('data', d => { stderr += d.toString() })

      proc.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code })
        } else {
          reject(new Error(`Workflow ${workflowName} failed with code ${code}: ${stderr}`))
        }
      })

      proc.on('error', reject)
    })
  }

  /**
   * List available workflows
   */
  async listWorkflows(): Promise<string[]> {
    // Return known workflows
    return ['oss-hunt', 'oss-ship', 'oss-followup', 'oss-round']
  }

  /**
   * Get workflow path
   */
  getWorkflowPath(name: string): string {
    return `${this.rootPath}/workflows/${name}.mjs`
  }

  /**
   * Get workflow default arguments structure
   */
  getWorkflowArgs(name: string): Record<string, any> {
    const common = {
      bin_dir: `${this.rootPath}/bin`,
      state_dir: this.ctx['oss-contrib'].config.paths.state,
      root: this.rootPath,
      tasks_root: this.ctx['oss-contrib'].config.paths.tasks,
    }

    switch (name) {
      case 'oss-hunt':
        return {
          ...common,
          run_id: '',
          repos: [],
          today: new Date().toISOString().split('T')[0],
          slices: 10,
          perRepoSuspects: 5,
          verifyVotes: 2,
          perRepoIssues: 3,
          budget: 300,
          concurrency: 2,
        }

      case 'oss-ship':
        return {
          ...common,
          run_id: '',
          targets: [],
          quota: 24,
          publish: false,
          today: new Date().toISOString().split('T')[0],
        }

      case 'oss-followup':
        return {
          ...common,
          run_id: '',
          since: '7d',
          act: true,
        }

      case 'oss-round':
        return {
          ...common,
          run_id: '',
          today: new Date().toISOString().split('T')[0],
          targetPrs: [],
          repos: [],
          blockedRepos: [],
          exclude: [],
          huntIssueBudget: 3,
          huntConc: 2,
          claimCount: 3,
          slices: 10,
        }

      default:
        return common
    }
  }
}
