import { test } from 'node:test'
import assert from 'node:assert'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pythonBridgePath = join(__dirname, '../../python/bridge.py')

test('Python bridge returns valid JSON for simple module call', async () => {
  const command = JSON.stringify({
    module: 'json',
    method: 'dumps',
    args: [{ test: 'data' }],
    kwargs: {},
  })

  const proc = spawn('python', [pythonBridgePath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stdout = ''
  proc.stdout.on('data', (data) => {
    stdout += data.toString()
  })

  proc.stdin.write(command)
  proc.stdin.end()

  await new Promise((resolve) => {
    proc.on('close', resolve)
  })

  const response = JSON.parse(stdout)
  assert.strictEqual(response.status, 'ok')
  assert.ok(response.result.includes('test'))
})

test('Python bridge handles module import errors', async () => {
  const command = JSON.stringify({
    module: 'nonexistent_module_12345',
    method: 'some_method',
    args: [],
    kwargs: {},
  })

  const proc = spawn('python', [pythonBridgePath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stdout = ''
  proc.stdout.on('data', (data) => {
    stdout += data.toString()
  })

  proc.stdin.write(command)
  proc.stdin.end()

  await new Promise((resolve) => {
    proc.on('close', resolve)
  })

  const response = JSON.parse(stdout)
  assert.strictEqual(response.status, 'error')
  assert.ok(response.error.includes('module') || response.error.includes('import'))
})
