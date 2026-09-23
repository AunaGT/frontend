import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modulesRoot = path.join(root, 'src', 'modules')
const moduleNames = fs.readdirSync(modulesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(modulesRoot, entry.name, 'manifest.ts')))
  .map((entry) => entry.name)

assert.equal(moduleNames.length, 22, 'Deben existir exactamente 22 manifiestos de módulos')

for (const moduleName of moduleNames) {
  const manifestPath = path.join(modulesRoot, moduleName, 'manifest.ts')
  const source = fs.readFileSync(manifestPath, 'utf8')
  const pageTargets = [...source.matchAll(/lazy\(\(\) => import\(['"]([^'"]+)['"]\)/g)]
    .map((match) => match[1])

  assert.ok(pageTargets.length > 0, `${moduleName} no publica páginas lazy`)
  assert.equal(
    pageTargets.every((target) => target.startsWith('./')),
    true,
    `${moduleName} todavía carga una página fuera de su carpeta`
  )
}

console.log(`✓ ${moduleNames.length} módulos cargan páginas desde fronteras físicas locales`)
