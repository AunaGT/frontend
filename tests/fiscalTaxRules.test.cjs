const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const config = { source: 'COMPANY_SETTINGS', regime: 'GENERAL', ivaPercent: '12', pequenoPercent: '5', ivaRate: '0.12', pequenoRate: '0.05', issues: {} }
const draft = { taxRules: [{ id: 'old', name: 'Venta', mode: 'INCLUDED', rate: '0.1', exemptionCode: '' }], categoryTaxMap: [{ categoryId: 10, taxRuleId: 'old' }], productTaxMap: [] }
function render(taxConfiguration = config) {
  const nodes = []; let updated, destination
  const { FiscalTaxRules } = loadReportModule('../config/connectors/FiscalTaxRules.tsx', {}, nodes)
  const html = renderToStaticMarkup(React.createElement(FiscalTaxRules, { draft, taxConfiguration, fields: {}, disabled: false,
    update: fn => { updated = fn(structuredClone(draft)) }, onFiscalSettings: () => { destination = 'fiscal-settings' } }))
  return { html, nodes, updated: () => updated, destination: () => destination }
}
test('a legacy rule is explicitly aligned with company rates without losing its ID or mappings', () => {
  const result = render()
  assert.match(result.html, /12 %/)
  assert.match(result.html, /Guardada: 10 %/)
  assert.doesNotMatch(result.html, /inputMode="decimal"|inputmode="decimal"/)
  result.nodes.find(node => node.props.children === 'Usar configuración actual').props.onClick()
  assert.deepEqual(result.updated().taxRules, [{ ...draft.taxRules[0], rate: '0.12' }])
  assert.deepEqual(result.updated().categoryTaxMap, draft.categoryTaxMap)
  result.nodes.find(node => node.props.children === 'Editar datos fiscales').props.onClick()
  assert.equal(result.destination(), 'fiscal-settings')
})
test('small-business configuration explains the accounting obligation without charging it as line IVA', () => {
  const result = render({ ...config, regime: 'PEQUENO' })
  assert.match(result.html, /5 %/)
  assert.match(result.html, /no se suma al total/)
  result.nodes.find(node => node.props.children === 'Usar configuración actual').props.onClick()
  assert.equal(result.updated().taxRules[0].mode, 'NO_BREAKDOWN')
  assert.equal(result.updated().taxRules[0].rate, '0')
})
test('missing company rates cannot create a normal rule or pretend the configuration is ready', () => {
  const result = render({ ...config, ivaRate: null, ivaPercent: null, issues: { iva_rate: 'Completa la tasa en Contabilidad' } })
  assert.match(result.html, /Completa la tasa en Contabilidad/)
  const add = result.nodes.find(node => node.props.children === 'Agregar regla')
  assert.equal(add.props.disabled, true)
})
test('exemption drafting makes its missing accounting integration visible', () => {
  const nodes = [], { FiscalTaxRules } = loadReportModule('../config/connectors/FiscalTaxRules.tsx', {}, nodes)
  const html = renderToStaticMarkup(React.createElement(FiscalTaxRules, { draft: { ...draft, taxRules: [{ ...draft.taxRules[0], mode: 'EXEMPT', rate: '0', exemptionCode: 'draft' }] }, taxConfiguration: config, fields: {}, disabled: false, update() {}, onFiscalSettings() {} }))
  assert.match(html, /todavía no modifican los asientos/)
})
