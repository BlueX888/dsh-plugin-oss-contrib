import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PythonBridge } from '../../lib/services/python-bridge.js'
test('timeout kills the Python process tree and disposal rejects future calls', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'oss-process-')),
    bridge = new PythonBridge({})
  try {
    const script = join(dir, 'sleep.py'),
      pid = join(dir, 'pid')
    await writeFile(
      script,
      'import subprocess,sys,time\np=subprocess.Popen([sys.executable,"-c","import time; time.sleep(60)"])\nopen(sys.argv[1],"w").write(str(p.pid))\ntime.sleep(60)\n',
    )
    // Hosted Windows runners can spend several seconds cold-starting Python.
    // Leave startup headroom while still checking an actual timeout and dead child.
    await assert.rejects(() => bridge.exec(script, [pid], { timeout: 15000 }), /timed out/)
    const child = Number(await readFile(pid, 'utf8'))
    assert.throws(() => process.kill(child, 0))
    await bridge.dispose()
    await assert.rejects(() => bridge.exec(script), /disposed/)
  } finally {
    await bridge.dispose()
    await rm(dir, { recursive: true, force: true })
  }
})
test('stdout from imported Python helpers cannot corrupt JSON IPC', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'oss-json-'))
  const bridge = new PythonBridge({ ossBin: dir })
  try {
    await writeFile(
      join(dir, 'fixture.py'),
      'def run():\n    print("diagnostic noise")\n    return {"text":"中文"}\n',
    )
    assert.deepEqual(await bridge.call('fixture', 'run'), { text: '中文' })
  } finally {
    await bridge.dispose()
    await rm(dir, { recursive: true, force: true })
  }
})
