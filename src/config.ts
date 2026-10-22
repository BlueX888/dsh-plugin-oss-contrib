import Schema from '@deepseek-ai/schemastery'
import { resolve } from 'node:path'
export interface Config {
  paths: { root: string; state?: string; tasks?: string; archive?: string }
  github: { user?: string; token?: string }
  quota: { pauseThreshold?: number; dailyCap?: number }
  runtime: { python: string; timeoutMs: number }
  agent: {
    preset?: string
    permissionPreset?: string
    provider?: string
    model?: string
    taskTimeoutMs: number
    maxSteps: number
  }
  scheduler: {
    enabled: boolean
    interval: string
    timezone: string
    runOnStart: boolean
    mode: 'all' | 'hunt' | 'ship' | 'followup'
    targets: string[]
    batchSize: number
  }
}
export const Config = Schema.object({
  paths: Schema.object({
    root: Schema.string().default('F:/PR'),
    state: Schema.string(),
    tasks: Schema.string(),
    archive: Schema.string(),
  }).default({}),
  github: Schema.object({
    user: Schema.string().description('Expected native publisher identity'),
    token: Schema.string().role('secret'),
  }).default({}),
  quota: Schema.object({
    pauseThreshold: Schema.number()
      .min(0)
      .description('Expected native ledger threshold; mismatch blocks execution'),
    dailyCap: Schema.number()
      .min(0)
      .description('Expected native daily PR cap; mismatch blocks execution'),
  }).default({}),
  runtime: Schema.object({
    python: Schema.string().default('python'),
    timeoutMs: Schema.number().min(100).default(120000),
  }).default({}),
  agent: Schema.object({
    preset: Schema.string(),
    permissionPreset: Schema.string().description(
      'Optional existing DSH permission preset for worker sessions only; otherwise inherit host default',
    ),
    provider: Schema.string(),
    model: Schema.string(),
    taskTimeoutMs: Schema.number().min(100).default(3600000),
    maxSteps: Schema.number().min(1).default(160),
  }).default({}),
  scheduler: Schema.object({
    enabled: Schema.boolean().default(false),
    interval: Schema.string().default('0 */6 * * *'),
    timezone: Schema.string().default('Asia/Shanghai'),
    runOnStart: Schema.boolean().default(false),
    mode: Schema.union(['all', 'hunt', 'ship', 'followup']).default('all'),
    targets: Schema.array(String).default([]),
    batchSize: Schema.number().min(1).max(100).default(3),
  }).default({}),
}) as Schema<Config>
export function pathsOf(config: Config) {
  const root = resolve(config.paths.root)
  return {
    root,
    state: resolve(config.paths.state || root + '/state'),
    tasks: resolve(config.paths.tasks || root + '/tasks'),
    archive: resolve(config.paths.archive || root + '/archive'),
  }
}
