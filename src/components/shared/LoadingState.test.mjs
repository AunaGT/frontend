import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react-swc'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': path.join(root, 'src') } }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
test.after(() => server.close())
const load = () => server.ssrLoadModule('/src/components/shared/LoadingState.tsx')
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props))

test('initial table loading keeps real headings and reserves five rows without fake totals', async () => {
  const { LoadingState } = await load()
  const html = render(LoadingState, { message: 'Cargando pedidos…', columns: ['Pedido', 'Cliente', 'Total'] })
  assert.match(html, /role="status"/)
  assert.match(html, /aria-busy="true"/)
  for (const heading of ['Pedido', 'Cliente', 'Total']) assert.match(html, new RegExp(`<th[^>]*>${heading}</th>`))
  assert.equal((html.match(/data-loading-row="true"/g) || []).length, 5)
  assert.equal((html.match(/data-loading-cell="true"/g) || []).length, 15)
  assert.doesNotMatch(html, /<input|<button|Q 0|animate-spin/)
})

test('table body loading never introduces a nested table or div directly under tbody', async () => {
  const { TableLoadingRows } = await load()
  const html = renderToStaticMarkup(createElement('table', null, createElement('tbody', null, createElement(TableLoadingRows, { columns: 7, rows: 3, message: 'Cargando ventas…' }))))
  assert.match(html, /<tbody><tr/)
  assert.match(html, /colSpan="7"/)
  assert.equal((html.match(/data-loading-cell="true"/g) || []).length, 21)
  assert.equal((html.match(/<table/g) || []).length, 1)
})

test('refresh feedback adds a small status without replacing existing records', async () => {
  const { LoadingIndicator } = await load()
  const html = renderToStaticMarkup(createElement('section', null, createElement(LoadingIndicator, { message: 'Actualizando…' }), createElement('p', null, 'P-000021 · Q 540.00')))
  assert.match(html, /role="status"/)
  assert.match(html, /Actualizando…/)
  assert.match(html, /P-000021 · Q 540.00/)
  assert.doesNotMatch(html, /data-loading-row|animate-spin/)
})

test('detail and card placeholders are noninteractive and announce one contextual status', async () => {
  const { LoadingState } = await load()
  for (const variant of ['detail', 'page', 'cards', 'inline']) {
    const html = render(LoadingState, { variant, message: 'Cargando expediente…', rows: 3 })
    assert.equal((html.match(/role="status"/g) || []).length, 1)
    assert.match(html, /Cargando expediente…/)
    assert.doesNotMatch(html, /<input|<button|animate-spin/)
  }
})

test('unknown summary metrics reserve their value area instead of reporting a false zero', async () => {
  const { MetricStrip } = await server.ssrLoadModule('/src/components/shared/MetricStrip.tsx')
  const props = { label: 'Resumen', items: [{ label: 'Total', value: 'Q 0.00', onClick: () => {} }] }
  const pending = render(MetricStrip, { ...props, loading: true })
  assert.match(pending, /Total/)
  assert.match(pending, /aria-busy="true"/)
  assert.match(pending, /disabled=""/)
  assert.doesNotMatch(pending, /Q 0.00/)
  assert.match(render(MetricStrip, props), /Q 0.00/)
})

test('chart loading fills the existing plot area without stacking cards or table rows', async () => {
  const { LoadingState } = await load()
  const html = render(LoadingState, { variant: 'chart', message: 'Cargando gráfico…' })
  assert.match(html, /auna-loading-chart/)
  assert.match(html, /Cargando gráfico…/)
  assert.doesNotMatch(html, /<table|data-loading-row|auna-loading-panel/)
})
