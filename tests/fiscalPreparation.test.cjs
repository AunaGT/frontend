const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { hookHarness } = require('./helpers/reportHookHarness.cjs')
const scope = { companyId: 'company', branchId: 'branch', userId: 'user', sessionId: 'session' }
const blank = { documentType: '', taxRules: [], unitMap: [], productTaxMap: [], categoryTaxMap: [], establishments: [] }
const loaded = { revision: 0, profile: null, currentIssuer: { emitter: { legalName: 'Empresa ficticia' }, currency: 'GTQ', settingsFingerprint: 'issuer-version-1', taxConfiguration: { source: 'COMPANY_SETTINGS', regime: 'GENERAL', ivaPercent: '12', pequenoPercent: '5', ivaRate: '0.12', pequenoRate: '0.05', issues: {} } }, labels: {}, readiness: { valid: false, productionReady: false, fieldErrors: { documentType: 'Completa el tipo' } } }
const tick = () => new Promise(resolve => setImmediate(resolve))
test('preparation saves only draft fields and retries one command without requiring Infile credentials', async () => {
  const harness = hookHarness(), writes = []; let fail = true
  const { useFiscalProfile } = loadReportModule('../config/connectors/useFiscalProfile.ts', { react: harness.hooks, './api': {
    readFiscalProfile: async () => loaded, readConnection: async () => ({ capabilities: { encryptionReady: true } }),
    saveFiscalProfile: async (...args) => { writes.push(args); if (fail) throw new Error('Sin respuesta'); return { revision: 1 } },
  } })
  let state = harness.render(() => useFiscalProfile(scope, 'TEST')); await tick(); state = harness.render(() => useFiscalProfile(scope, 'TEST'))
  assert.deepEqual(state.draft, blank); assert.equal(state.encryptionReady, true)
  state.update(draft => ({ ...draft, documentType: 'FACT' })); state = harness.render(() => useFiscalProfile(scope, 'TEST'))
  const pending = state.save(); assert.equal(await state.save(), false); await pending
  fail = false; state = harness.render(() => useFiscalProfile(scope, 'TEST')); await state.save()
  assert.equal(writes.length, 2); assert.equal(writes[0][2].idempotencyKey, writes[1][2].idempotencyKey)
  assert.equal(writes[0][2].profile.documentType, 'FACT'); assert.equal(writes[0][2].expectedVersion, 0)
  assert.deepEqual(Object.keys(writes[0][2]).sort(), ['expectedIssuerFingerprint', 'expectedVersion', 'idempotencyKey', 'profile'])
  assert.equal(writes[0][2].expectedIssuerFingerprint, 'issuer-version-1')
  assert.equal(Object.hasOwn(writes[0][2].profile, 'emitter'), false)
  state = harness.render(() => useFiscalProfile(scope, 'TEST')); assert.equal(state.dirty, false)
  harness.unmount()
})
test('a saved profile can refresh changed issuer data without editing an unrelated mapping', async () => {
  const harness = hookHarness(), writes = []
  const { useFiscalProfile } = loadReportModule('../config/connectors/useFiscalProfile.ts', { react: harness.hooks, './api': {
    readFiscalProfile: async () => ({ ...loaded, profile: blank, revision: 2, readiness: { ...loaded.readiness, fieldErrors: { 'emitter.changed': 'Revisa el emisor' } } }),
    readConnection: async () => ({ capabilities: { encryptionReady: true } }), saveFiscalProfile: async (...args) => { writes.push(args); return { revision: 3 } },
  } })
  harness.render(() => useFiscalProfile(scope, 'TEST')); await tick()
  const state = harness.render(() => useFiscalProfile(scope, 'TEST'))
  assert.equal(state.dirty, false); assert.equal(await state.save(), true); assert.equal(writes.length, 1)
  harness.unmount()
})
test('stale preparation loads cannot populate another company or environment', async () => {
  const harness = hookHarness(), pending = []
  const { useFiscalProfile } = loadReportModule('../config/connectors/useFiscalProfile.ts', { react: harness.hooks, './api': { readFiscalProfile: (...args) => new Promise(resolve => pending.push({ args, resolve })), readConnection: async () => ({ capabilities: { encryptionReady: true } }) } })
  harness.render(() => useFiscalProfile(scope, 'TEST'))
  const other = { ...scope, companyId: 'other' }
  harness.render(() => useFiscalProfile(other, 'PRODUCTION'))
  pending[0].resolve(loaded); await tick()
  let state = harness.render(() => useFiscalProfile(other, 'PRODUCTION')); assert.equal(state.data, null); assert.equal(pending[0].args[2].aborted, true)
  pending[1].resolve({ ...loaded, revision: 7 }); await tick()
  state = harness.render(() => useFiscalProfile(other, 'PRODUCTION')); assert.equal(state.data.revision, 7)
  harness.unmount()
})
test('preparation form uses explicit mappings and labels the result as local and pending', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const { FiscalPreparationForm } = loadReportModule('../config/pages/FiscalPreparationPage.tsx', {
    '../documentTemplates/TemplateSettingsLayout': { TemplateSettingsLayout: ({ children }) => React.createElement('main', {}, children) },
    '../connectors/api': { fiscalProfileOptions() { throw new Error('No requests in SSR') } },
    './api': { fiscalProfileOptions() { throw new Error('No requests in SSR') } },
    '../connectors/useConnectorScope': {},
    '../connectors/useFiscalProfile': { useFiscalProfile: () => ({ draft: blank, data: loaded, loading: false, pending: false, dirty: false, error: '', fieldErrors: {}, encryptionReady: true, activity: { current: { dirty: false, pending: false } }, update() {} }) },
    '../documentTemplates/useTemplateLeaveGuard': { useTemplateLeaveGuard: () => () => true },
    '../documentTemplates/useTemplateConfirmation': { useTemplateConfirmation: () => ({ dialog: null, confirm: async () => true }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} }, '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    'react-router-dom': { useNavigate: () => () => {}, useSearchParams: () => [new URLSearchParams()] },
  })
  const html = renderToStaticMarkup(React.createElement(FiscalPreparationForm, { scope, environment: 'TEST', canManage: true, companyName: 'Empresa ficticia', registerGuard: () => () => {} }))
  for (const label of ['Preparación fiscal', 'Borrador local', 'Establecimientos', 'Reglas de impuestos', 'Unidades y presentaciones', 'Reglas por categoría o producto', 'Guardar perfil']) assert.match(html, new RegExp(label))
  assert.match(html, /No certifica documentos/); assert.doesNotMatch(html, /Activar producción/)
  assert.match(html, /Tasas compartidas con Contabilidad/)
  assert.match(html, /12 %/)
  assert.doesNotMatch(html, /Tasa decimal \(mayor que 0/)
  assert.equal((html.match(/type="password"/g) || []).length, 0)
})
test('catalog search can retry the same query after a failed request', async () => {
  const harness = hookHarness(), nodes = []; let fail = true
  const { CatalogPicker } = loadReportModule('../config/connectors/CatalogPicker.tsx', { react: { ...harness.hooks, useId: () => 'catalog-id' }, './api': { fiscalProfileOptions: async () => { if (fail) throw new Error('offline'); return { rows: [{ id: 'a', label: 'Sucursal de prueba' }], total: 1, page: 1, pageSize: 25 } } } }, nodes)
  const props = { scope, environment: 'TEST', kind: 'branch', label: 'Sucursal', disabled: false, onChoose() {} }
  harness.render(() => CatalogPicker(props)); await tick(); nodes.length = 0; harness.render(() => CatalogPicker(props))
  assert.ok(nodes.some(n => n.props.role === 'alert'))
  fail = false
  nodes.find(n => n.props.children === 'Buscar').props.onClick()
  nodes.length = 0; harness.render(() => CatalogPicker(props)); await tick(); nodes.length = 0; harness.render(() => CatalogPicker(props))
  assert.ok(nodes.some(n => n.type === 'option' && n.props.children === 'Sucursal de prueba'))
  harness.unmount()
})
