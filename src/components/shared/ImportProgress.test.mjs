import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('muestra filas procesadas sin declarar finalizado antes del commit', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try {
    const { ImportProgress } = await server.ssrLoadModule('/src/components/shared/ImportProgress.tsx')
    const html = renderToStaticMarkup(createElement(ImportProgress, { progress: { type: 'progress', phase: 'saving', processed: 40, total: 40 }, onCancel() {} }))
    assert.match(html, /40 de 40 filas procesadas/)
    assert.match(html, /Cancelar importación/)
    assert.doesNotMatch(html, /Importación completada/)
  } finally { await server.close() }
})
