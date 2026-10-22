import { test } from 'node:test'
import assert from 'node:assert'
import { spawn } from 'child_process'

// Integration test with real F:\PR\state\state.json
// Requires OSS_STATE=F:/PR/state

const OSS_STATE = process.env.OSS_STATE || 'F:/PR/state'
const OSS_BIN = process.env.OSS_BIN || 'F:/PR/bin'

function execPython(script, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [script, ...args], {
      env: { ...process.env, OSS_STATE, OSS_BIN },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code })
    })

    proc.on('error', reject)
  })
}

test('state.py brief returns valid output', async () => {
  const result = await execPython(`${OSS_BIN}/state.py`, ['brief'])

  assert.strictEqual(result.code, 0, `state.py brief failed: ${result.stderr}`)
  assert.ok(result.stdout.includes('META'), 'Output should contain META line')
  assert.ok(result.stdout.includes('today='), 'Output should contain today date')
})

test('state.py summary returns valid output', async () => {
  const result = await execPython(`${OSS_BIN}/state.py`, ['summary'])

  assert.strictEqual(result.code, 0, `state.py summary failed: ${result.stderr}`)
  assert.ok(result.stdout.length > 0, 'Summary should have output')
  assert.ok(result.stdout.includes('today=') || result.stdout.includes('open_prs'),
            'Summary should contain state information')
})

test('state.py worklist returns parseable output', async () => {
  const result = await execPython(`${OSS_BIN}/state.py`, ['worklist'])

  assert.strictEqual(result.code, 0, `state.py worklist failed: ${result.stderr}`)
  // Worklist returns "PRS=..." and "ISSUES=..." lines
  const lines = result.stdout.trim().split('\n')
  assert.ok(lines.length >= 1, 'Worklist should return at least one line')
})
