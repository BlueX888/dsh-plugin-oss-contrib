import Schema from 'schemastery'

export interface Config {
  paths: {
    root: string
    state: string
    tasks: string
    archive: string
  }
  github: {
    user: string
    token?: string
  }
  quota: {
    pauseThreshold: number
    dailyCap?: number
  }
  scheduler: {
    enabled: boolean
    interval?: string
  }
}

export const Config: Schema<Config> = Schema.object({
  paths: Schema.object({
    root: Schema.string().default('F:/PR').description('Root directory of PR project'),
    state: Schema.string().default('F:/PR/state').description('State directory (state.json location)'),
    tasks: Schema.string().default('F:/PR/tasks').description('Task artifacts directory'),
    archive: Schema.string().default('F:/PR/archive').description('Archive directory'),
  }).description('Path configuration'),

  github: Schema.object({
    user: Schema.string().default('BlueX888').description('GitHub username'),
    token: Schema.string().role('secret').description('GitHub API token (or use $GITHUB_TOKEN)'),
  }).description('GitHub configuration'),

  quota: Schema.object({
    pauseThreshold: Schema.number().default(24).description('Pause when unresponded open PRs exceed this'),
    dailyCap: Schema.number().description('Optional daily PR publish limit'),
  }).description('Rate limiting configuration'),

  scheduler: Schema.object({
    enabled: Schema.boolean().default(false).description('Enable automatic cycle runs'),
    interval: Schema.string().description('Cron expression for cycle scheduling'),
  }).description('Scheduler configuration'),
}).description('OSS contribution pipeline configuration')
