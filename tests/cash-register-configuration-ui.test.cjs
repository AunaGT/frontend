const test = require('node:test'), assert = require('node:assert/strict'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
function render(readOnly = false) {
  const nodes = [], draft = { name: 'Mostrador', code: 'CAJA-1', currencyCode: 'GTQ', active: true, isDefault: false, authorizedUserIds: ['u'], enableExplicitAccess: false }
  const page = loadReportModule('../catalogs/pages/CashRegisterFormPage.tsx', {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b', name: 'Principal' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'u' }, hasPermission: () => !readOnly }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} },
    '../components/CatalogAccess': { CatalogAccess: ({ children }) => children },
    '@tanstack/react-query': { useQuery: () => ({ data: { register_configuration_available: true }, isLoading: false }), useQueryClient: () => ({ invalidateQueries() {} }) },
    '@/services/cashSessionsService': {},
    '../hooks/useCashRegisterConfiguration': { useCashRegisterConfiguration: () => ({ draft, setDraft() {}, record: { id: 'r', revision: 3, kind: 'PHYSICAL', operation_mode: 'INDIVIDUAL', access_control_version: 0, money_event_version: 0, authorized_users: [{ id: 'u', name: 'Ana', active: true }], legacy_suggested_users: [{ id: 'v', name: 'Luis' }] }, loading: false, busy: false, uncertain: false, error: null, conflict: false, save: async () => null, loadCurrent() {}, setError() {}, dirty: false }) },
    '../components/CashRegisterAccessFields': { CashRegisterAccessFields: () => React.createElement('div', null, 'Personas autorizadas') },
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(page, { mode: readOnly ? 'view' : 'edit', registerId: 'r' }))), nodes }
}
test('dedicated compact form explains access versus individual turn and separates the legacy preference', () => {
  const { html } = render()
  for (const text of ['Personas autorizadas', 'Una persona · individual', 'Equipo · compartida', 'Caja sugerida', 'Guardar cambios', 'Nombre', 'Código']) assert.ok(html.includes(text), text)
  assert.equal(html.includes('role="dialog"'), false)
  assert.match(html, /max-w-/); assert.match(html, /md:grid-cols-/)
})
test('read-only detail does not offer save or pretend to adopt money handling', () => {
  const { html } = render(true)
  assert.equal(html.includes('Guardar cambios'), false); assert.equal(html.includes('Habilitar registro de movimientos'), false)
  assert.ok(html.includes('Consulta'))
})
