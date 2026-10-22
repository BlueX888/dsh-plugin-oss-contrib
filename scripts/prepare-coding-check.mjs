import { cp, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { stringify } from 'yaml'
const core = resolve(process.env.OSS_TEST_ROOT || '..')
const root = resolve('.runtime-check', 'coding-' + Date.now())
await mkdir(root, { recursive: true })
await cp(core + '/bin', root + '/bin', { recursive: true })
await cp(core + '/skill/oss-contrib', root + '/skill/oss-contrib', { recursive: true })
const patch = [
  {
    id: 'oss-contrib',
    config: {
      paths: { root, state: root + '/state', tasks: root + '/tasks', archive: root + '/archive' },
      agent: { permissionPreset: 'danger-full-access', taskTimeoutMs: 300000, maxSteps: 35 },
      scheduler: { enabled: false },
    },
  },
  { insert: [{ id: 'oss-coding-check', name: resolve('scripts/runtime-coding-check.mjs') }] },
]
await writeFile('.runtime-check/coding.patch.yml', stringify(patch))
console.log(root)
