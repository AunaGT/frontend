import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

test('resume los resultados finales y vuelve al listado al cerrar', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try {
    const { ImportSummary } = await server.ssrLoadModule('/src/components/shared/ImportSummary.tsx')
    const html = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(ImportSummary, { result: { created: 8, skipped: 2, adopted: 1, errors: [{ rowIndex: 7, error: 'Código duplicado' }] }, back: '/inventario', backLabel: 'Inventario' })))
    assert.match(html, /metric-strip/)
    assert.match(html, />creados<\/span><strong[^>]*>8/)
    assert.match(html, />omitidos<\/span><strong[^>]*>2/)
    assert.match(html, /1 incorporado/)
    assert.match(html, /Fila 7/)
    assert.match(html, /Código duplicado/)
    assert.match(html, /href="\/inventario"/)
    assert.match(html, />Cerrar y volver a Inventario</)
  } finally { await server.close() }
})
