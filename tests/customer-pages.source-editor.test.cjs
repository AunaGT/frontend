const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { definitions } = require('../../deposito-backend/src/modules/config/customerPages/schema')
test('whole page code exposes apply/discard, component help and no executable preview', () => {
  const { PortalPageSourceEditor } = loadReportModule('../config/customerPages/PortalPageSourceEditor.tsx')
  const html = renderToStaticMarkup(React.createElement(PortalPageSourceEditor, {
    source: { html: '<script>never()</script>', css: '' }, blocks: definitions,
    diagnostics: [], dirty: true, busy: false, readOnly: false, onChange() {}, onApply() {}, onDiscard() {},
  }))
  assert.match(html, /Código de toda la página/)
  assert.match(html, /Aplicar al diseño/)
  assert.match(html, /Descartar cambios/)
  assert.match(html, /auna-items/)
  assert.doesNotMatch(html, /<script|<iframe|never\(\)/)
})
test('help inserts an editable component into the complete source only after an explicit click', async () => {
  const nodes = [], changes = [], { resolveBase } = require('../../deposito-backend/src/modules/config/customerPages/bases')
  const { serializePageSource } = loadReportModule('../config/customerPages/pageSource.ts')
  const { PortalPageSourceEditor } = loadReportModule('../config/customerPages/PortalPageSourceEditor.tsx', {
    react: { ...React, useState: initial => [typeof initial === 'boolean' ? true : initial, () => {}] },
  }, nodes)
  const design = resolveBase('QUOTE'), source = serializePageSource(design)
  renderToStaticMarkup(React.createElement(PortalPageSourceEditor, { source, blocks: definitions, documentType: 'QUOTE', diagnostics: [], dirty: false, busy: false, readOnly: false, onChange: next => changes.push(next), onApply() {}, onDiscard() {} }))
  assert.equal(changes.length, 0)
  const heading = nodes.find(n => n.type === 'details' && n.props.children.some(c => c?.type === 'code' && c.props.children.includes('<auna-heading ')))
  heading.props.children.find(c => c?.type === 'button').props.onClick()
  assert.equal(changes.length, 1)
  const parsed = await require('../../deposito-backend/src/modules/config/customerPages/pageSource').compilePageSource({ ...changes[0], baseDesign: design })
  assert.equal(parsed.nodes.at(-1).type, 'Heading')
  assert.equal(parsed.nodes.at(-1).props.text, 'Tu próximo gran proyecto')
})
