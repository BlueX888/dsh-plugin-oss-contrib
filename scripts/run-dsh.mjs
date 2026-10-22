import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
const executable =
  process.env.DSH_EXECUTABLE || 'F:/CodingAgent/DeepSeekHarness/DeepSeek Harness.exe'
const entry =
  process.env.DSH_ENTRY ||
  'F:/CodingAgent/DeepSeekHarness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js'
if (!existsSync(executable)) throw new Error('Set DSH_EXECUTABLE and DSH_ENTRY for this machine')
const proc = spawn(executable, ['--expose-internals', entry, ...process.argv.slice(2)], {
  windowsHide: true,
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    DSH_HOME: process.env.DSH_HOME || 'F:/CodingAgent/DeepSeekHarness/data/dsh',
  },
})
proc.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
proc.on('exit', (code) => {
  process.exitCode = code ?? 1
})
process.on('SIGINT', () => proc.kill('SIGINT'))
process.on('SIGTERM', () => proc.kill('SIGTERM'))
