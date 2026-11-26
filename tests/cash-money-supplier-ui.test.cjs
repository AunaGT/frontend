const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server'), { loadReportModule } = require('./helpers/loadReportModule.cjs')
function render(origin = 'OUTSIDE_CASH') {
  const nodes = [], changes = [], draft = { selected: [{ supplierName: 'Proveedor QA', branchName: 'Central', id: 'entry', reference: 'E-QA', balance: '50.00' }],
    cashOrigin: origin, cashSession: origin === 'CASH_SESSION' ? 's' : '', setCashOrigin: value => changes.push(value), setCashSession: value => changes.push(value),
    amount: '50.00', method: '1', applications: { entry: '50.00' }, paidAt: '2026-10-28T12:00:00Z', notes: '', reference: '', difference: '0.00', reviewing: true }
  const { SupplierPaymentForm } = loadReportModule('../receivables/pages/SupplierPaymentPage.tsx', {
    '@/services/cashSessionsService': { fetchCashSessionPaymentOptions() {} },
    '@/components/layout/PageNavigation': { usePageTrail() {} }, 'react-router-dom': { useNavigate: () => () => {} },
    '../hooks/useSupplierPaymentDraft': { useSupplierPaymentDraft: () => draft },
    '../hooks/usePayables': { useInvalidatePayables: () => () => {} },
    '../components/PayableEntries': { usePayableFormat: () => ({ money: value => `Q ${value}`, date: () => '28/10/2026' }) },
    '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: [{ id: 1, name: 'Efectivo', is_credit: false }] }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ currencyCode: 'GTQ' }) },
    '@/context/useAuth': { useAuth: () => ({ user: { id: 'u' } }) },
    '@tanstack/react-query': { useQuery: () => ({ data: { available: true, sessions: [{ id: 's', name: 'Caja central', currencyCode: 'GTQ' }] } }) },
    '@/services/api': {},
  }, nodes)
  return { html: renderToStaticMarkup(React.createElement(SupplierPaymentForm, { context: { companyId: 'c', branchId: 'b', userId: 'u', currencyCode: 'GTQ', timezone: 'America/Guatemala', entries: [] } })), nodes, changes }
}
if (require.main === module) test('cash origin remains a small labeled optional choice and reveals turn only when needed', () => {
  const outside = render()
  assert.match(outside.html, /Origen del pago/); assert.doesNotMatch(outside.html, /Tu turno abierto/)
  const inside = render('CASH_SESSION')
  assert.match(inside.html, /Tu turno abierto/); assert.match(inside.html, /Caja central/); assert.match(inside.html, /Se registrará un egreso/)
  const choose = inside.nodes.find(n => n.props?.onValueChange && n.props.value === 'CASH_SESSION')
  choose.props.onValueChange('OUTSIDE_CASH'); assert.deepEqual(inside.changes, ['OUTSIDE_CASH'])
})
module.exports = { render }
