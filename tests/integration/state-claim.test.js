import { test } from 'node:test'
import assert from 'node:assert'
import { spawn } from 'child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Port of F:\PR\tests\test_state_claim.py
// Tests state.py claim operations in isolated temp directory

const OSS_BIN = process.env.OSS_BIN || 'F:/PR/bin'

function execState(tmpDir, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [`${OSS_BIN}/state.py`, ...args], {
      env: {
        ...process.env,
        OSS_STATE_DIR: tmpDir,
        OSS_INBOX: join(tmpDir, 'inbox'),
        OSS_RUN_ID: 'run-test',
        OSS_LEASE_OWNER: 'owner-test',
        OSS_LEASE_OWNER_PID: process.pid.toString(),
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('close', code => resolve({ stdout, stderr, code }))
    proc.on('error', reject)
  })
}

test('state.py ready-claim creates lease', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'oss-state-test-'))

  try {
    // Initialize empty state
    const statePath = join(tmpDir, 'state.json')
    writeFileSync(statePath, JSON.stringify({
      ready_queue: [
        {
          repo: 'test/repo',
          slug: 'fix-bug',
          score: 100
        }
      ]
    }))

    // Claim the item
    const result = await execState(tmpDir, [
      'ready-claim',
      'test/repo',
      'fix-bug'
    ])

    assert.strictEqual(result.code, 0, `Claim failed: ${result.stderr}`)

    // Verify lease was created
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    const item = state.ready_queue.find(i => i.slug === 'fix-bug')
    assert.ok(item, 'Item should still be in queue')
    assert.ok(item.lease, 'Item should have lease')
    assert.strictEqual(item.lease.owner, 'owner-test')

  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('state.py ready-done removes item from queue', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'oss-state-test-'))

  try {
    const statePath = join(tmpDir, 'state.json')
    writeFileSync(statePath, JSON.stringify({
      ready_queue: [
        {
          repo: 'test/repo',
          slug: 'fix-bug',
          score: 100,
          lease: { owner: 'owner-test', run_id: 'run-test' }
        }
      ]
    }))

    // Mark as done
    const result = await execState(tmpDir, [
      'ready-done',
      'test/repo',
      'fix-bug'
    ])

    assert.strictEqual(result.code, 0, `ready-done failed: ${result.stderr}`)

    // Verify item removed
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    const item = state.ready_queue.find(i => i.slug === 'fix-bug')
    assert.strictEqual(item, undefined, 'Item should be removed from queue')

  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('state.py ready-release clears lease but keeps item', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'oss-state-test-'))

  try {
    const statePath = join(tmpDir, 'state.json')
    writeFileSync(statePath, JSON.stringify({
      ready_queue: [
        {
          repo: 'test/repo',
          slug: 'fix-bug',
          score: 100,
          lease: { owner: 'owner-test', run_id: 'run-test' }
        }
      ]
    }))

    // Release lease
    const result = await execState(tmpDir, [
      'ready-release',
      'test/repo',
      'fix-bug'
    ])

    assert.strictEqual(result.code, 0, `ready-release failed: ${result.stderr}`)

    // Verify item still in queue but lease cleared
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    const item = state.ready_queue.find(i => i.slug === 'fix-bug')
    assert.ok(item, 'Item should still be in queue')
    assert.strictEqual(item.lease, undefined, 'Lease should be cleared')

  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})
