import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const readConfig = () => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  import { loadConfigFromFile } from 'vite';
  const { config } = await loadConfigFromFile({ command: 'serve', mode: 'development' });
  console.log(JSON.stringify({ cacheDir: config.cacheDir, strictPort: config.server.strictPort }));
`], { encoding: 'utf8', cwd: new URL('..', import.meta.url) }).trim())

const first = readConfig()
const second = readConfig()
assert.ok(first.cacheDir, 'La caché debe estar definida')
assert.notEqual(first.cacheDir, second.cacheDir, 'Dos servidores no deben sobrescribir la misma caché')
assert.equal(first.strictPort, true, 'No abrir silenciosamente otro servidor en un puerto alternativo')
console.log('Vite: caché aislada y puerto estricto verificados')
