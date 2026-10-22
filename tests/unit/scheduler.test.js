import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextScheduledAt } from '../../lib/services/scheduler.js'
import { parseWorkerResult } from '../../lib/services/agent-runner.js'
test('standard cron uses explicit Shanghai timezone', () => {
  assert.equal(
    nextScheduledAt('0 */6 * * *', 'Asia/Shanghai', new Date('2026-10-22T01:01:00Z')).toISOString(),
    '2026-10-22T04:00:00.000Z',
  )
})
test('invalid schedules and worker results fail closed', () => {
  assert.throws(() => nextScheduledAt('nonsense', 'Asia/Shanghai'))
  for (const value of [
    'done',
    '{}',
    '{"status":"done","reason":""}',
    '{"status":"done","reason":"x","evidence_paths":[4]}',
  ])
    assert.throws(() => parseWorkerResult(value))
  assert.equal(
    parseWorkerResult('{"status":"retry","reason":"network unavailable"}').status,
    'retry',
  )
})
