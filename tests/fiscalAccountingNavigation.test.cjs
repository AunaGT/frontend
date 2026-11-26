const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
test('the fiscal link opens accounting directly in configuration, not the journal', () => {
  const { default: Page } = loadReportModule('../accounting/components/AccountingManagement.tsx', {
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) }, '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => true }) },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'A' }, branch: { id: 'B' }, branches: [] }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} }, '@/services/api': { apiFetch() { throw new Error('No network during SSR') } },
    [require('node:path').resolve(__dirname, '../src/services/api.ts')]: { apiFetch() { throw new Error('No network during SSR') } },
  })
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/contabilidad?vista=configuracion'] }, React.createElement(Page)))
  assert.match(html, /data-state="active"[^>]*>[^<]*(?:<[^>]*>)*Configuración/)
  assert.match(html, /Impuestos \(SAT\)/)
  assert.match(html, /compartidas con la preparación FEL/)
})
test('fiscal company settings can manage the same rates without requiring the accounting module', () => {
  const model = loadReportModule('../config/settingsModel.ts')
  const values = model.sectionValues('fiscal', { vat_affiliation: 'general', iva_rate: '10', pequeno_rate: '3' })
  assert.equal(values.iva_rate, '10'); assert.equal(values.pequeno_rate, '3')
  assert.equal(model.sectionPayload('fiscal', values).iva_rate, '10')
  assert.ok(model.validateSection('fiscal', { ...values, iva_rate: '1e1' }).iva_rate)
  assert.equal(model.validateSection('fiscal', values).iva_rate, undefined)
})
test('opening tax configuration never posts pending accounting operations; entering the journal retains the normal one-time posting', async () => {
  const { hookHarness } = require('./helpers/reportHookHarness.cjs')
  const harness = hookHarness(), postings = []; let view = 'configuracion'
  const Page = loadReportModule('../accounting/components/AccountingManagement.tsx', {
    react: harness.hooks,
    'react-router-dom': { useSearchParams: () => [new URLSearchParams({ vista: view }), () => {}] },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => true }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} },
    '@/services/accountingService': { getAccounts: async () => ({ items: [] }), postPending: async () => { postings.push('post-pending'); return { posted: 0 } } },
    [require('node:path').resolve(__dirname, '../src/services/api.ts')]: { apiFetch() { throw new Error('No real network') } },
  }).default
  const flush = () => new Promise(resolve => setImmediate(resolve))
  try {
    harness.render(() => Page()); await flush()
    assert.deepEqual(postings, [])
    view = 'diario'; harness.render(() => Page()); await flush()
    assert.deepEqual(postings, ['post-pending'])
    view = 'configuracion'; harness.render(() => Page()); await flush()
    view = 'diario'; harness.render(() => Page()); await flush()
    assert.equal(postings.length, 1)
  } finally { harness.unmount() }
})
