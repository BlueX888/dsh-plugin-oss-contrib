import { Context } from 'cordis'

/**
 * Register all MCP tools for the OSS contribution pipeline
 */
export function registerTools(ctx: Context) {
  const logger = ctx.logger('oss-contrib')
  const ossContrib = ctx['oss-contrib']
  const state = ctx['oss-contrib/state']

  // ========== State Management Tools ==========

  ctx.tools.register({
    name: 'oss_state_brief',
    description: 'Get OSS contribution pipeline status summary (open PRs, merged count, pause status)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async handler() {
      logger.info('Tool: oss_state_brief')
      return await state.brief()
    },
  })

  ctx.tools.register({
    name: 'oss_state_summary',
    description: 'Get detailed state summary including all tasks and queues',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async handler() {
      logger.info('Tool: oss_state_summary')
      return await state.summary()
    },
  })

  ctx.tools.register({
    name: 'oss_state_worklist',
    description: 'Get currently active tasks (in-flight work)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async handler() {
      logger.info('Tool: oss_state_worklist')
      return await state.worklist()
    },
  })

  ctx.tools.register({
    name: 'oss_state_ready_peek',
    description: 'View ready queue without claiming tasks',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async handler() {
      logger.info('Tool: oss_state_ready_peek')
      return await state.readyPeek()
    },
  })

  // ========== Hunt Phase Tools ==========

  ctx.tools.register({
    name: 'oss_hunt_discover',
    description: 'Discover issues from a GitHub repository using core API',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository in owner/repo format (e.g., microsoft/autogen)',
        },
      },
      required: ['repo'],
    },
    async handler(args: { repo: string }) {
      logger.info(`Tool: oss_hunt_discover(${args.repo})`)
      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/discover.py`,
        [args.repo],
        { timeout: 120000 }
      )

      if (result.code !== 0) {
        throw new Error(`discover.py failed: ${result.stderr}`)
      }

      return { output: result.stdout, issues_found: result.stdout.split('\n').filter(l => l.startsWith('#')).length }
    },
  })

  ctx.tools.register({
    name: 'oss_hunt_probe',
    description: 'Deep dive investigation of a specific issue',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Issue identifier (owner/repo#N)',
        },
      },
      required: ['target'],
    },
    async handler(args: { target: string }) {
      logger.info(`Tool: oss_hunt_probe(${args.target})`)
      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/probe.py`,
        [args.target],
        { timeout: 180000 }
      )

      return { stdout: result.stdout, stderr: result.stderr, exitCode: result.code }
    },
  })

  ctx.tools.register({
    name: 'oss_hunt_screen',
    description: 'Pre-screen repository for policy compliance and collision check',
    inputSchema: {
      type: 'object',
      properties: {
        issue: {
          type: 'string',
          description: 'Issue title or description to check for duplicates',
        },
        repo: {
          type: 'string',
          description: 'Repository to check (owner/repo)',
        },
      },
      required: [],
    },
    async handler(args: { issue?: string; repo?: string }) {
      logger.info(`Tool: oss_hunt_screen`)
      const cmdArgs = ['sweep']
      if (args.issue) cmdArgs.push('--issue', args.issue)
      if (args.repo) cmdArgs.push('--path', args.repo)

      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/screen.py`,
        cmdArgs,
        { timeout: 60000 }
      )

      return { stdout: result.stdout, passed: result.code === 0 }
    },
  })

  ctx.tools.register({
    name: 'oss_hunt_preflight',
    description: 'Check hunt round gate (circuit breaker, rotation cooldown)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async handler() {
      logger.info('Tool: oss_hunt_preflight')
      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/preflight.py`,
        ['--json'],
        { timeout: 30000 }
      )

      if (result.code !== 0 && result.code !== 3 && result.code !== 4) {
        throw new Error(`preflight.py failed: ${result.stderr}`)
      }

      return {
        passed: result.code === 0,
        exitCode: result.code,
        output: result.stdout,
      }
    },
  })

  // ========== Ship Phase Tools ==========

  ctx.tools.register({
    name: 'oss_ship_quota',
    description: 'Check publishing quota (pause gate, daily cap, unresponded PRs)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async handler() {
      logger.info('Tool: oss_ship_quota')
      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/quota.py`,
        ['--json'],
        { timeout: 30000 }
      )

      if (result.code !== 0) {
        throw new Error(`quota.py failed: ${result.stderr}`)
      }

      return JSON.parse(result.stdout)
    },
  })

  ctx.tools.register({
    name: 'oss_ship_publish',
    description: 'Publish a PR or issue (dry-run by default, requires --execute flag)',
    inputSchema: {
      type: 'object',
      properties: {
        manifest: {
          type: 'string',
          description: 'Absolute path to manifest.json',
        },
        kind: {
          type: 'string',
          enum: ['issue', 'pr', 'update'],
          description: 'Publication type',
        },
        execute: {
          type: 'boolean',
          description: 'Actually publish (default false = dry-run)',
          default: false,
        },
        runId: {
          type: 'string',
          description: 'Run ID for tracking',
        },
      },
      required: ['manifest', 'kind'],
    },
    async handler(args: { manifest: string; kind: string; execute?: boolean; runId?: string }) {
      logger.info(`Tool: oss_ship_publish(${args.kind}, execute=${args.execute})`)
      const cmdArgs = [
        '--manifest', args.manifest,
        'kind: ' + args.kind,
      ]
      if (args.execute) cmdArgs.push('--execute')
      if (args.runId) cmdArgs.push('--run-id', args.runId)

      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/publish.py`,
        cmdArgs,
        { timeout: 300000 }
      )

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.code,
        success: result.code === 0,
      }
    },
  })

  ctx.tools.register({
    name: 'oss_ship_evidence',
    description: 'Generate red (before fix) or green (after fix) evidence receipt',
    inputSchema: {
      type: 'object',
      properties: {
        color: {
          type: 'string',
          enum: ['red', 'green'],
          description: 'Evidence type',
        },
        worktree: {
          type: 'string',
          description: 'Worktree path',
        },
        outputPath: {
          type: 'string',
          description: 'Output receipt path',
        },
        command: {
          type: 'array',
          items: { type: 'string' },
          description: 'Command to execute for evidence',
        },
      },
      required: ['color', 'worktree', 'outputPath', 'command'],
    },
    async handler(args: { color: string; worktree: string; outputPath: string; command: string[] }) {
      logger.info(`Tool: oss_ship_evidence(${args.color})`)
      const cmdArgs = [
        args.color,
        '--worktree', args.worktree,
        '--out', args.outputPath,
        '--',
        ...args.command,
      ]

      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/evidence.py`,
        cmdArgs,
        { timeout: 600000 }
      )

      return {
        receiptPath: args.outputPath,
        success: result.code === 0,
        output: result.stdout,
      }
    },
  })

  // ========== Track Phase Tools ==========

  ctx.tools.register({
    name: 'oss_track_snapshot',
    description: 'Take a tracking snapshot of all open PRs and issues',
    inputSchema: {
      type: 'object',
      properties: {
        outputDir: {
          type: 'string',
          description: 'Output directory for snapshot',
        },
        incremental: {
          type: 'boolean',
          description: 'Incremental mode (reuse previous snapshot)',
          default: false,
        },
      },
      required: ['outputDir'],
    },
    async handler(args: { outputDir: string; incremental?: boolean }) {
      logger.info('Tool: oss_track_snapshot')
      const cmdArgs = ['--out-dir', args.outputDir]
      if (args.incremental) cmdArgs.push('--incremental')

      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/track.py`,
        cmdArgs,
        { timeout: 600000 }
      )

      return {
        snapshotDir: args.outputDir,
        success: result.code === 0,
        output: result.stdout,
      }
    },
  })

  ctx.tools.register({
    name: 'oss_track_cards',
    description: 'Generate change cards for each open PR/issue',
    inputSchema: {
      type: 'object',
      properties: {
        outputDir: {
          type: 'string',
          description: 'Output directory for cards',
        },
        since: {
          type: 'string',
          description: 'Time range (e.g., 7d, 2024-01-01)',
        },
      },
      required: ['outputDir'],
    },
    async handler(args: { outputDir: string; since?: string }) {
      logger.info('Tool: oss_track_cards')
      const cmdArgs = ['batch', '--out', args.outputDir]
      if (args.since) cmdArgs.push('--since', args.since)

      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/cards.py`,
        cmdArgs,
        { timeout: 300000 }
      )

      return {
        cardsDir: args.outputDir,
        success: result.code === 0,
        output: result.stdout,
      }
    },
  })

  // ========== Cycle/Run Tools ==========

  ctx.tools.register({
    name: 'oss_run_prepare',
    description: 'Prepare a new cycle run (generates task plan)',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'Run identifier',
        },
        mode: {
          type: 'string',
          enum: ['all', 'hunt', 'ship', 'followup'],
          description: 'Cycle mode',
          default: 'all',
        },
      },
      required: ['runId'],
    },
    async handler(args: { runId: string; mode?: string }) {
      logger.info(`Tool: oss_run_prepare(${args.runId})`)
      const cmdArgs = ['prepare', '--run-id', args.runId]
      if (args.mode) cmdArgs.push('--mode', args.mode)

      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/cycle.py`,
        cmdArgs,
        { timeout: 120000 }
      )

      return {
        success: result.code === 0,
        output: result.stdout,
        stderr: result.stderr,
      }
    },
  })

  ctx.tools.register({
    name: 'oss_run_finish_task',
    description: 'Mark a cycle task as finished and settle its status',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'Run identifier',
        },
        taskId: {
          type: 'string',
          description: 'Task identifier from cycle',
        },
        result: {
          type: 'string',
          description: 'Task result (JSON string)',
        },
      },
      required: ['runId', 'taskId', 'result'],
    },
    async handler(args: { runId: string; taskId: string; result: string }) {
      logger.info(`Tool: oss_run_finish_task(${args.taskId})`)
      const cmdArgs = [
        'finish-task',
        '--run-id', args.runId,
        '--result', args.result,
      ]

      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/cycle.py`,
        cmdArgs,
        { timeout: 60000 }
      )

      return {
        success: result.code === 0,
        output: result.stdout,
      }
    },
  })

  // ========== Utilities ==========

  ctx.tools.register({
    name: 'oss_doctor',
    description: 'Run health checks (orphan files, broken links, disk space, state integrity)',
    inputSchema: {
      type: 'object',
      properties: {
        selftest: {
          type: 'boolean',
          description: 'Run full selftest (smoke + unit + e2e)',
          default: false,
        },
      },
      required: [],
    },
    async handler(args: { selftest?: boolean }) {
      logger.info('Tool: oss_doctor')
      const cmdArgs = args.selftest ? ['--selftest'] : []

      const result = await ossContrib.bridge.exec(
        `${ossContrib.config.paths.root}/bin/doctor.py`,
        cmdArgs,
        { timeout: args.selftest ? 600000 : 120000 }
      )

      return {
        healthy: result.code === 0,
        output: result.stdout,
        issues: result.stderr,
      }
    },
  })

  logger.info('Registered 22 MCP tools across hunt/ship/track/run/state/doctor')
}
