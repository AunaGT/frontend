import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('dashboard queda como alias legacy del módulo de análisis', async () => {
  const [app, catalog, modules] = await Promise.all([
    read('../src/App.tsx'),
    read('../src/modules/catalog.ts'),
    read('../src/config/appModules.ts'),
  ])

  assert.match(app, /path="\/dashboard"[^]*Navigate to=\{analyticsModule\.paths\.list\}/)
  assert.doesNotMatch(catalog, /dashboardModule/)
  assert.doesNotMatch(modules, /dashboardModule/)
})
