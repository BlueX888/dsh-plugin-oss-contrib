import { randomUUID } from 'node:crypto'
import { Config } from '../config.js'
export interface WorkerResult {
  status: 'done' | 'waiting' | 'retry' | 'needs_user'
  reason: string
  evidence_paths?: string[]
  [key: string]: unknown
}
export function parseWorkerResult(text: string): WorkerResult {
  const clean = text
    .trim()
    .replace(/^\x60\x60\x60(?:json)?\s*\n?/, '')
    .replace(/\n?\x60\x60\x60$/, '')
  let value: any
  try {
    value = JSON.parse(clean)
  } catch {
    throw new Error('Agent must return one JSON result object')
  }
  if (
    !value ||
    !['done', 'waiting', 'retry', 'needs_user'].includes(value.status) ||
    typeof value.reason !== 'string' ||
    !value.reason.trim()
  )
    throw new Error('Invalid native worker result')
  if (
    value.evidence_paths !== undefined &&
    (!Array.isArray(value.evidence_paths) ||
      value.evidence_paths.some((x: any) => typeof x !== 'string'))
  )
    throw new Error('evidence_paths must be strings')
  return value
}
export class AgentRunner {
  constructor(
    private ctx: any,
    private config: Config,
  ) {}
  available() {
    return !!this.ctx.get('agents')
  }
  async execute(
    prompt: string,
    cwd: string,
    signal: AbortSignal,
    onSession: (id: string) => Promise<void>,
  ): Promise<WorkerResult> {
    const agents = this.ctx.get('agents')
    if (!agents)
      throw new Error('DSH agents service is unavailable; load dsh-agent and an agent driver')
    const defaults = this.ctx.get('agentDefaultModel')?.currentSelection() || {}
    const agentOptions = {
      ...defaults,
      ...(this.config.agent.provider ? { provider: this.config.agent.provider } : {}),
      ...(this.config.agent.model ? { model: this.config.agent.model } : {}),
    }
    const presets = this.ctx.get('agentPresets')
    const preset = presets ? (await presets.resolve(this.config.agent.preset)).id : undefined
    if (this.config.agent.preset && !presets)
      throw new Error('Configured agent preset service unavailable')
    const id = 'oss-' + randomUUID()
    let text = '',
      turnEnd: any,
      steps = 0,
      boundError: Error | undefined
    const handle = await agents.create({
      sessionId: id,
      agentOptions,
      signal,
      meta: { cwd, ...(preset ? { agentPreset: preset } : {}) },
      setup: async (agentCtx: any, agent: any) => {
        if (presets) await presets.mount(agentCtx, preset)
        if (this.config.agent.permissionPreset) {
          const permissions = this.ctx.get('permissionPresets')
          if (!permissions) throw new Error('Configured DSH permission preset service unavailable')
          permissions.set(agent.session, this.config.agent.permissionPreset)
        }
        agentCtx.on('session/event', (session: any, event: any) => {
          if (session.id !== id) return
          if (event.type === 'assistant/message')
            text = event.data.message.content
              .filter((b: any) => b.type === 'text')
              .map((b: any) => b.text)
              .join('\n')
          if (event.type === 'turn/end') turnEnd = event.data.reason
          if (event.type === 'step/start' && ++steps > this.config.agent.maxSteps) {
            boundError = new Error('Agent step budget exceeded')
            agent.cancel({ kind: 'user' })
          }
        })
        // A worker cannot recursively start or settle its owning native cycle.
        if (agentCtx.tools?.guard)
          agentCtx.tools.guard((exec: any) =>
            exec.name.startsWith('oss_run_')
              ? 'The coordinator owns cycle execution and settlement'
              : undefined,
          )
        // Surface an actionable denial to the worker instead of waiting forever for a human.
        agentCtx.on('tools/pre-execute', async (_exec: any, next: () => Promise<any>) => {
          const decision = await next()
          return decision.kind === 'ask'
            ? {
                kind: 'deny',
                reason:
                  'This unattended worker cannot request approval. Return needs_user with the required action.',
              }
            : decision
        })
      },
    })
    const abort = () => handle.agent.cancel({ kind: 'user' })
    signal.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => {
      boundError = new Error('Agent task deadline exceeded')
      abort()
    }, this.config.agent.taskTimeoutMs)
    try {
      await onSession(id)
      if (signal.aborted) throw new Error('Operation cancelled')
      // DSH 0.2.1 consumes an identified UserMessage, not bare prompt content.
      handle.agent.followup(
        Object.freeze({
          id: randomUUID(),
          role: 'user',
          content: Object.freeze([Object.freeze({ type: 'text', text: prompt })]),
          source: Object.freeze({ kind: 'oss-contrib' }),
        }),
      )
      await handle.agent.whenIdle()
      if (signal.aborted) throw new Error('Operation cancelled')
      if (boundError) throw boundError
      if (turnEnd?.kind !== 'completed')
        throw new Error(
          'Agent turn did not complete: ' + JSON.stringify(turnEnd || { kind: 'unknown' }),
        )
      return parseWorkerResult(text)
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      await handle.dispose()
    }
  }
}
