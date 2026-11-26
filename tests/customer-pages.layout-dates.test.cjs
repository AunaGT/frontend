const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { resolveBase } = require('../../deposito-backend/src/modules/config/customerPages/bases')
const context = {
  documentType: 'QUOTE', reference: 'C-001', status: 'SENT', companyName: 'Empresa',
  subtotal: '50.00', discount: '0', total: '50.00', currency: 'GTQ', locale: 'es-GT',
  timezone: 'America/Guatemala', canRespond: true, lines: [],
}
function render(theme = {}, changes = {}, mode = 'public', breakpoint = 'desktop') {
  const nodes = []
  const { PortalRenderer } = loadReportModule('../../components/customer-pages/PortalRenderer.tsx', {}, nodes)
  const ctx = { ...context, ...changes }, design = resolveBase(ctx.documentType)
  design.theme = { ...design.theme, ...theme }
  const html = renderToStaticMarkup(React.createElement(PortalRenderer, {
    portal: { versionId: 'v1', rendererVersion: 1, design, customArtifacts: {}, customCodeEnabled: false },
    context: ctx, actions: {}, mode, breakpoint,
  }))
  return { html, main: nodes.find(n => n.type === 'main')?.props, nodes }
}
test('the published background fills its container independently of the centered document', () => {
  const { main, nodes } = render({ background: '#08090b', color: '#f1efe9' })
  assert.equal(main.style.backgroundColor, '#08090b')
  assert.equal(main.style.width, '100%')
  assert.equal(main.style.maxWidth, 'none')
  assert.equal(main.style['--portal-content-width'], '1200px')
  assert.ok(nodes.some(n => n.type === 'div' && n.props.className === 'portal-page-content'))
})
test('edge-to-edge content keeps zero gutters on every viewport in preview and publication', () => {
  for (const mode of ['public', 'preview']) for (const point of ['desktop', 'tablet', 'mobile']) {
    const { main } = render({ contentWidth: 'full', padding: 0 }, {}, mode, point)
    assert.equal(main.style['--portal-content-width'], 'none')
    assert.equal(main.style.padding, 0)
  }
  assert.equal(render({}, {}, 'preview', 'mobile').main.style.padding, 16)
  assert.equal(render({ padding: 48 }, {}, 'preview', 'mobile').main.style.padding, 48)
})
test('quote validity renders a readable local date and time instead of an ISO string', () => {
  const { html } = render({}, { validUntil: '2026-11-20T17:19:20.042Z' })
  assert.match(html, /20 de noviembre de 2026.*11:19/)
  assert.doesNotMatch(html, /2026-11-20T17:19:20/)
  assert.match(render({}, { validUntil: '2026-11-20T02:19:00Z' }).html, /19 de noviembre de 2026.*20:19/)
  assert.match(render({}, { validUntil: '2026-11-20T17:19:20.042Z', timezone: 'Europe/Madrid', locale: 'en-GB' }).html, /20 November 2026.*18:19/)
})
test('calendar dates never shift to the previous day or invent a time', () => {
  const { html } = render({}, { validUntil: '2026-12-31' })
  assert.match(html, /31 de diciembre de 2026/)
  assert.doesNotMatch(html, /30 de diciembre|00:00|18:00/)
  assert.match(render().html, /Sin fecha límite/)
  assert.match(render({}, { validUntil: 'invalid' }).html, /Fecha no disponible/)
  assert.match(render({}, { validUntil: '2026-02-30' }).html, /Fecha no disponible/)
})
test('linked order sales use the same readable timezone-aware dates', () => {
  const { html } = render({}, { documentType: 'ORDER', sales: [{ reference: 'V-001', total: '50.00', date: '2026-11-20T02:19:00Z' }] })
  assert.match(html, /19 de noviembre de 2026.*20:19/)
  assert.doesNotMatch(html, /2026-11-20T02:19/)
})
test('the engine canvas uses the same full-width page styles as the published renderer', () => {
  const nodes = [], design = resolveBase('QUOTE')
  design.theme = { ...design.theme, background: '#08090b', color: '#f1efe9', contentWidth: 'full', padding: 0 }
  const { PuckAdapter } = loadReportModule('../config/customerPages/engine/PuckAdapter.tsx', {}, nodes)
  renderToStaticMarkup(React.createElement(PuckAdapter, { design, viewportWidth: 375, registry: [], renderOfficial: () => null, renderCustomPlaceholder: () => null, onChange() {} }))
  const puck = nodes.find(n => n.props.config?.root?.render)
  assert.ok(puck)
  const root = puck.props.config.root.render({ children: React.createElement('span', null, 'Contenido') })
  assert.equal(root.props.style.backgroundColor, '#08090b')
  assert.equal(root.props.style['--portal-content-width'], 'none')
  assert.equal(root.props.style.padding, 0)
  assert.match(renderToStaticMarkup(root), /portal-page-content/)
})
