const test = require('node:test'), assert = require('node:assert/strict'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

test('opening a virtual register asks for no float and explains it only takes digital payments', () => {
  const nodes = []
  const { OpenCashRegisterPrompt } = loadReportModule('../sales/OpenCashRegisterPrompt.tsx', {
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ currencyCode: 'GTQ', locale: 'es-GT' }) },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'u' } }) },
    '@tanstack/react-query': { useQuery: ({ enabled }) => { assert.equal(enabled, false, 'no retained float lookup for a virtual register'); return { data: undefined, isLoading: false } } },
    '@/services/cashCustodyService': {}, '@/services/cashSessionsService': {},
  }, nodes)
  const html = renderToStaticMarkup(React.createElement(OpenCashRegisterPrompt, { registerId: 'r', registerName: 'Cobros web', registerKind: 'VIRTUAL', onOpened() {}, onBack() {} }))
  assert.equal(html.includes('Fondo inicial'), false); assert.equal(nodes.some(n => n.props?.id === 'open-cash-float'), false)
  assert.ok(html.includes('solo cobros digitales'))
})

test('a virtual register offers only bank payment methods', () => {
  const { allowedOnRegister } = loadReportModule('../../services/paymentMethodsService.ts')
  const cash = { id: 1, name: 'Efectivo', settlement_kind: 'CASH', is_credit: false }, card = { id: 2, name: 'Tarjeta', settlement_kind: 'BANK', is_credit: false }, credit = { id: 3, name: 'Crédito', settlement_kind: 'CREDIT', is_credit: true }
  assert.deepEqual([cash, card, credit].filter(m => allowedOnRegister(m, 'VIRTUAL')), [card])
  assert.deepEqual([cash, card, credit].filter(m => allowedOnRegister(m, 'PHYSICAL')), [cash, card, credit])
})

test('a virtual period count shows no cash in drawer line', () => {
  const { TheoreticalSummary } = loadReportModule('../cash-closure/components/TheoreticalSummary.tsx', { '@/hooks/useSystemSettings': { useSystemSettings: () => ({ currencyCode: 'GTQ', locale: 'es-GT' }) } })
  const data = { theoretical: { total_sales: 75, total_returns: 0, net_total: 75 }, metrics: {}, cash_session: { opening_float: 0, cash_sales_amount: 0, expected_cash_in_drawer: 0 }, payment_breakdown: [{ payment_method_id: 2, payment_method_name: 'Tarjeta', settlement_kind: 'BANK', theoretical_amount: 75 }] }
  const html = renderToStaticMarkup(React.createElement(TheoreticalSummary, { data, showAdvancedDetails: true }))
  assert.equal(html.includes('Esperado en caja'), false)
  const physical = renderToStaticMarkup(React.createElement(TheoreticalSummary, { data: { ...data, cash_session: { ...data.cash_session, opening_float: 200, expected_cash_in_drawer: 200 } }, showAdvancedDetails: true }))
  assert.ok(physical.includes('Esperado en caja'))
})

const { MemoryRouter } = require('react-router-dom')
const caps = (extra = {}) => ({ available: true, canView: true, canCreate: true, canConfirm: true, evidenceUpload: true, ...extra })
const notice = (extra = {}) => ({ id: 'n1', status: 'PENDING', amount: '75.00', currency_code: 'GTQ', customer_name: 'Ana López', payment_method_name: 'Transferencia', reported_paid_on: '2026-11-01', reported_reference: 'Depósito 123',
  created_by_name: 'Luis', created_at: '2026-11-01T15:00:00.000Z', confirmed_by_name: null, confirmed_at: null, rejected_by_name: null, rejection_reason: null, external_reference: null, verification_id: null, evidence_path: null, register_name: null, customer_payment_id: null, ...extra })
function page(file, props, data, extra = {}) {
  const nodes = []
  const Page = loadReportModule(`../cash-closure/${file}.tsx`, {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b', name: 'Central' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'u' }, hasPermission: () => true }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala' }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} }, '@/services/cashNoticesService': {},
    '@tanstack/react-query': { useQuery: ({ queryKey }) => ({ isLoading: false, data: queryKey[0] === 'cash-notice-capabilities' ? (extra.caps || caps()) : queryKey[0] === 'cash-notice-periods' ? (extra.periods ?? [{ id: 'p1', register_name: 'Cobros web', responsible_name: 'Luis', opened_at: '2026-11-01T13:00:00.000Z' }]) : data }), useQueryClient: () => ({ invalidateQueries() {} }) },
    ...extra.mocks,
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page, props))), nodes }
}
test('the digital payments list shows reported notices without calling them paid', () => {
  const { html } = page('CashNoticesPage', {}, { items: [notice()], totalItems: 1, page: 1, pageSize: 20, totalPages: 1, summary: { pending: 1 } })
  for (const text of ['Cobros digitales', 'Ana López', 'Por confirmar', 'Registrar aviso']) assert.ok(html.includes(text), text)
  assert.equal(/>Pagado</.test(html), false)
  assert.ok(page('CashNoticesPage', {}, null, { caps: caps({ available: false }) }).html.includes('aún no están disponibles'))
})
test('confirming asks for a virtual period, bank reference, evidence and an attestation', () => {
  const { html, nodes } = page('CashNoticePage', { noticeId: 'n1' }, notice())
  for (const text of ['Confirmar cobro', 'Período de caja virtual', 'Cobros web', 'Referencia del banco o proveedor', 'Identificador verificable', 'Revisé el depósito', 'Rechazar aviso']) assert.ok(html.includes(text), text)
  assert.ok(nodes.some(n => n.props?.id === 'notice-evidence' && n.props.type === 'file'))
  assert.equal(html.includes('role="dialog"'), false)
})
test('without an open virtual period the notice cannot be confirmed and says why', () => {
  const { html } = page('CashNoticePage', { noticeId: 'n1' }, notice(), { periods: [] })
  assert.ok(html.includes('Abre un período de caja virtual')); assert.equal(/type="submit"[^>]*>Confirmar cobro/.test(html), false)
})
test('a confirmed notice reads as manually confirmed, never as bank-verified', () => {
  const { html } = page('CashNoticePage', { noticeId: 'n1' }, notice({ status: 'CONFIRMED', confirmed_by_name: 'Marta', confirmed_at: '2026-11-01T16:00:00.000Z', external_reference: 'BI-778899', verification_id: 'AUT-55', register_name: 'Cobros web', customer_payment_id: 'cp1' }))
  assert.ok(html.includes('Confirmado manualmente por Marta')); assert.equal(/verificado por el banco/i.test(html), false); assert.equal(html.includes('Revisé el depósito'), false)
})
test('the cash tabs offer digital payments to whoever handles notices', () => {
  const nodes = []
  const { CashClosureTabs } = loadReportModule('../cash-closure/components/CashClosureTabs.tsx', {
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: (...codes) => codes.some(c => ['cashclosure.view', 'cash.notices.create'].includes(c)) }) },
    '@/components/shared/ModuleTabs': { ModuleTabBar: props => { nodes.push(props); return null } },
  })
  renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(CashClosureTabs, { value: 'closures' })))
  assert.ok(nodes[0].items.some(i => i.value === 'notices' && i.label === 'Cobros digitales'))
})
test('registering a notice states it changes no balance and asks only what the customer reported', () => {
  const { html } = page('CashNoticeFormPage', {}, null, { mocks: {
    '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: [{ id: 1, name: 'Efectivo', settlement_kind: 'CASH', is_credit: false }, { id: 2, name: 'Transferencia', settlement_kind: 'BANK', is_credit: false }] }) },
    '@/modules/sales/components/SavedCustomerMany2One': { SavedCustomerMany2One: () => React.createElement('span', null, 'Selector de cliente') },
    './hooks/useCashNoticeAttempt': { useNoticeAttempt: (_, blank) => ({ draft: blank, setDraft() {}, pending: false, busy: false, error: null, recoveryBlocked: false, submit: async () => null }) },
  } })
  for (const text of ['Registrar aviso de pago', 'no cambia su saldo', 'Selector de cliente', 'Importe informado', 'Fecha que informó']) assert.ok(html.includes(text), text)
  assert.equal(html.includes('role="dialog"'), false); assert.match(html, /max-w-\[960px\]/)
})
test('the launcher, routes and manifest reach digital payments with their own permissions', () => {
  const { appModules } = loadReportModule('../../config/appModules.ts')
  const entry = appModules.find(m => m.id === 'cash-closure')
  for (const code of ['cash.notices.create', 'cash.digital.confirm']) assert.ok(entry.permissions.includes(code), code)
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/App.tsx'), 'utf8')
  for (const route of ['paths.notices}', 'paths.noticeCreate}', 'paths.noticeDetail}']) assert.ok(app.includes(route), route)
})
