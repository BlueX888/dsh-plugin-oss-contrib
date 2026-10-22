import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { parse } from 'yaml'
import { harness } from '../helpers.js'
test('bundle mounts package with scheduling opt-in', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')),
    patch = parse(readFileSync(pkg.dsh.bundle.patch, 'utf8'))
  const row = patch.flatMap((p) => p.insert || []).find((r) => r.id === 'oss-contrib')
  assert.equal(row.name, pkg.name)
  assert.equal(row.config.scheduler.enabled, false)
  assert.ok(existsSync(pkg.main))
})
test('Cordis registers executable tools and removes them on unload', async () => {
  const h = await harness()
  try {
    assert.equal(h.definitions.size, 23)
    for (const d of h.definitions.values()) {
      assert.equal(typeof d.execute, 'function')
      assert.equal(d.parameters.type, 'object')
      assert.equal(typeof d.output.render, 'function')
    }
    const value = await h.definitions.get('oss_state_ready_peek').execute({})
    assert.deepEqual(value, [])
    await h.ctx.fiber.dispose()
    assert.equal(h.definitions.size, 0)
  } finally {
    await h.close()
  }
})
