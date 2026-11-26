const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

const settings = { currencyCode: 'GTQ', locale: 'es-GT', cashClosureMaxDiffPct: 5, timezone: 'America/Guatemala' }
const payments = [{ payment_method_id: 1, payment_method_name: 'Efectivo', theoretical_amount: 100, actual_amount: 90, theoretical_count: 2, difference: -10, notes: 'Recuento' }]
const denominations = [{ denomination: 10, type: 'Billete', quantity: 9, subtotal: 90 }]
const theory = { theoretical: { net_total: 100, total_sales: 80, total_returns: 0 }, metrics: { total_transactions: 2, total_customers: 2, average_ticket: 40 }, cash_session: { opening_float: 20, cash_sales_amount: 80, expected_cash_in_drawer: 100 } }

function render(relative, props = {}, extraMocks = {}) {
  const nodes = []
  const mod = loadReportModule('../cash-closure/' + relative, {
    '@/hooks/useSystemSettings': { useSystemSettings: () => settings },
    '@/services/cashClosureReadService': { CASH_CLOSURE_READ_PERMISSIONS: ['cashclosure.view','cashclosure.view_team','cashclosure.approve','cashclosure.validate'] },
    ...extraMocks,
  }, nodes)
  const Component = mod.default || Object.values(mod).find(value => typeof value === 'function')
  return { html: renderToStaticMarkup(React.createElement(Component, props)), nodes }
}

test('cash count is an accessible compact table and uses the configured currency', () => {
  let changed
  const { html, nodes } = render('components/DenominationsCounter.tsx', { denominations, cashTotal: 90, onUpdateQuantity: (...args) => { changed = args } })
  assert.match(html, /<table/)
  assert.match(html, /aria-label="Cantidad de Billete/)
  const input = nodes.find(n => n.props?.type === 'number')
  input.props.onChange({ target: { value: '3' } })
  assert.deepEqual(changed, [0, 3])
  assert.match(html, /90\.00/)
})

test('verified zero stays visible and payment editing keeps its original callback', () => {
  let changed
  const { html, nodes } = render('components/PaymentMethodsForm.tsx', { paymentBreakdown: [{ ...payments[0], actual_amount: 0 }], countedPaymentMethodIds: new Set([1]), cashSession: theory.cash_session, onUpdateAmount: (...args) => { changed = args } })
  assert.match(html, /id="actual-0"[^>]*value="0"/)
  const input = nodes.find(n => n.props?.id === 'actual-0')
  input.props.onChange({ target: { value: '12.5' } })
  assert.deepEqual(changed, [0, 'actual_amount', '12.5'])
  assert.match(html, /Fondo/)
})
test('cash and bank slices of the same method keep independent verified-zero state', () => {
  const { html } = render('components/PaymentMethodsForm.tsx', { paymentBreakdown: [{ ...payments[0], breakdown_key: '1:CASH', settlement_kind: 'CASH', actual_amount: 0 }, { ...payments[0], breakdown_key: '1:BANK', settlement_kind: 'BANK', actual_amount: 0 }], countedPaymentMethodIds: new Set(['1:CASH']), onUpdateAmount() {} })
  assert.match(html, /id="actual-0"[^>]*value="0"/)
  assert.match(html, /id="actual-1"[^>]*value=""/)
})
test('bank net outflows accept a signed verified amount and explain it without allowing negative cash', () => {
  let changed
  const { html, nodes } = render('components/PaymentMethodsForm.tsx', { paymentBreakdown: [
    { ...payments[0], breakdown_key: '1:CASH', settlement_kind: 'CASH' },
    { ...payments[0], breakdown_key: '1:BANK', settlement_kind: 'BANK', theoretical_amount: -30, actual_amount: -30, difference: 0 }],
    countedPaymentMethodIds: new Set(['1:CASH', '1:BANK']), onUpdateAmount: (...args) => { changed = args } })
  assert.equal(nodes.find(n => n.props?.id === 'actual-0').props.min, '0')
  const bank = nodes.find(n => n.props?.id === 'actual-1')
  assert.equal(bank.props.min, undefined); assert.equal(bank.props.value, -30)
  assert.match(html, /Movimiento neto verificado/); assert.match(html, /Ingresos menos egresos/)
  bank.props.onChange({ target: { value: '-30.00' } }); assert.deepEqual(changed, [1, 'actual_amount', '-30.00'])
})
test('theoretical summary explains calculation basis and shows collections and supplier outflows using frozen currency', () => {
  const { html } = render('components/TheoreticalSummary.tsx', { data: { ...theory, currency_code: 'USD', calculation_basis_label: 'Consulta mixta, no cierre diario', theoretical: { ...theory.theoretical, total_collections: 50, total_supplier_payments: 30 } } })
  assert.match(html, /Consulta mixta, no cierre diario/); assert.match(html, /Cobros y anticipos/); assert.match(html, /Pagos a proveedores/)
  assert.match(html, /USD/); assert.doesNotMatch(html, /GTQ|Q\s/)
})
test('denominations honor the turn currency and do not claim automatic allocation across multiple cash methods', () => {
  const { html } = render('components/DenominationsCounter.tsx', { denominations, cashTotal: 90, currencyCode: 'USD', autoAllocate: false, onUpdateQuantity() {} })
  assert.match(html, /USD/); assert.match(html, /distribúyelo/); assert.doesNotMatch(html, /actualiza automáticamente/)
})

test('difference includes a meaningful label, not only a color', () => {
  const { html } = render('components/ClosureSummaryCard.tsx', { theoreticalTotal: 100, actualTotal: 90, difference: -10, differencePercentage: -10, ...settings })
  assert.match(html, /Faltante/)
  assert.match(html, /Total esperado/)
  assert.match(html, /Total contado/)
})

test('a verified discrepancy exposes its own required reason without advanced mode', () => {
  const { html } = render('components/PaymentMethodsForm.tsx', { paymentBreakdown: payments, countedPaymentMethodIds: new Set([1]), onUpdateAmount() {} })
  assert.match(html, /id="notes-0"/)
  assert.match(html, /Motivo de la diferencia/)
})

function createPage({ counted = new Set([1]), notes = 'Recuento', paymentNotes = 'Recuento', advanced = true, difference = -10, differencePct = -10, scope = 'day', canCalculate = true, data = theory, recount = false } = {}) {
  let stateIndex = 0
  const toasts = [], saves = [], updates = [], navigations = []
  const form = { paymentBreakdown: payments.map(p => ({ ...p, notes: paymentNotes })), denominations, cashierName: 'Cajero QA', startDate: '2026-10-09T08:00:00', endDate: '2026-10-09T17:00:00', notes,
    setStartDate() {}, setEndDate() {}, setNotes() {}, getCashTotal: () => 90, getActualTotal: () => 90, getTotalDifference: () => difference, getDifferencePercentage: () => differencePct, resetForm() {}, updateActualAmount() {}, updateDenomination() {}, initializeFromTheoretical() {} }
  const states = [scope, false, advanced, false, counted]
  const mocks = {
    react: { ...React, useState: initial => { const i = stateIndex++; const [value, setValue] = React.useState(i < states.length ? states[i] : initial); return [value, next => { updates.push({ index: i, value: typeof next === 'function' ? next(value) : next }); setValue(next) }] }, useEffect() {} },
    'react-router-dom': { useNavigate: () => path => navigations.push(path), useSearchParams: () => [new URLSearchParams()], Link: 'a' },
    '@/context/useAuth': { useAuth: () => ({ user: { id: 'qa', name: 'Cajero QA' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => true }) },
    '@/hooks/useExperienceProfile': { useExperienceProfile: () => ({ showAdvancedByDefault: advanced }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: data => toasts.push(data) }) },
    '@/services/cashSessionsService': { fetchCashSessionCurrent() { throw new Error('Unexpected session request') } },
    './hooks': { useCashClosureForm: () => form, useCashClosureAPI: () => ({ theoreticalData: data, isSaving: false, isCalculating: false, saveClosure: async payload => { saves.push(payload); return 'C1' } }), useMineClosureGate: () => ({ gate: { loading: false, canCalculate, closableSessionId: canCalculate ? 'session-qa' : null, closableSession: canCalculate ? { id: 'session-qa', recount } : null, reason: canCalculate ? 'ok' : 'no-pending' }, refresh() {} }), mineClosureBlockedHint() {} },
  }
  const result = render('CashClosureCreatePage.tsx', {}, mocks)
  return { ...result, toasts, saves, updates, navigations }
}

test('creation places count, methods and summary in independent sibling surfaces', () => {
  const { html } = createPage()
  assert.match(html, /cash-closure-count-grid/)
  assert.match(html, /cash-closure-panel/)
  assert.match(html, /Cancelar/)
  assert.match(html, /Motivo de la diferencia/)
  assert.doesNotMatch(html, /bg-liquor-amber/)
})

test('creation uses the bounded module width and shows the reference count layout without advanced tools', () => {
  const { html } = createPage({ advanced: false })
  assert.match(html, /^<div class="[^"]*mx-auto[^"]*max-w-\[1560px\]/)
  assert.match(html, /Arqueo por denominaciones/)
  assert.match(html, /Resumen teórico/)
  assert.match(html, /Resumen contado/)
  assert.match(html, /cash-closure-summary-stack/)
  assert.match(html, /id="notes-0"/)
})

test('history follows the reference table with an accessible detail action and outside pagination', () => {
  let viewed, page
  const { html, nodes } = render('components/ClosuresHistoryList.tsx', { closures: [{ id: 'qa-closure', closure_number: 12, start_date: '2026-10-09T08:00:00', end_date: '2026-10-09T17:00:00', cashier_name: 'Cajero QA', status: 'Aprobado', theoretical_total: 100, actual_total: 90, difference: -10 }], isLoading: false, isSeller: false, currentPage: 1, totalPages: 2, onViewClosure: id => { viewed = id }, onPageChange: value => { page = value } })
  assert.match(html, /<table/)
  assert.match(html, /Total esperado/)
  assert.match(html, /Total contado/)
  assert.match(html, /<th[^>]*scope="col"[^>]*>Cajero/)
  nodes.find(n => n.props?.['aria-label'] === 'Ver arqueo #12').props.onClick()
  assert.equal(viewed, 'qa-closure')
  nodes.find(n => n.props?.['aria-label'] === 'Página siguiente').props.onClick()
  assert.equal(page, 2)
  require('./pagination-assertions.cjs').assertPaginationOutside(html)
})

test('session-check error offers retry without enabling creation or claiming the shift is open', () => {
  let retried = 0
  const { html, nodes } = render('CashClosureHistory.tsx', {}, {
    'react-router-dom': { useSearchParams:()=>[new URLSearchParams(),()=>{}], useNavigate: () => () => {}, Link: ({ children, to }) => React.createElement('a', { href: to }, children) },
    '@/context/useAuth': { useAuth: () => ({ user: { id: 'qa' } }) },
    '@/context/useTenant': { useTenant: () => ({ company:{id:'c'},branch:{id:'b'} }) },
    '@tanstack/react-query': { useQuery: ({queryKey}) => ({ data:queryKey[0]==='cash-closure-read-capabilities'?{viewOwn:true,viewTeam:true}:{items:[],page:1,totalPages:1},isPending:false }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => true }) },
    './CashClosureCreatePage': { CASH_CLOSURE_CREATE_PATH: '/cierre-caja/nuevo' },
    './hooks': { useCashClosureForm: () => ({ isSeller: false }), useCashClosureAPI: () => ({ closures: [], isLoadingClosures: false, currentPage: 1, totalPages: 1, pageSize: 10, fetchClosures() {}, setPageSize() {} }), useMineClosureGate: () => ({ gate: { loading: false, reason: 'error', canCalculate: false, closableSessionId: null, errorMessage: 'Servicio temporalmente no disponible' }, refresh: () => { retried++ } }), canRegisterMineClosure: () => false, mineClosureBlockedHint: () => 'No se pudo verificar el turno' },
  })
  const retry = nodes.find(n => n.props?.children?.includes?.('Reintentar'))
  assert.ok(retry, 'The failed check must have an explicit retry')
  retry.props.onClick()
  assert.equal(retried, 1)
  assert.equal(nodes.find(n => n.props?.children?.props?.children?.includes?.('Registrar arqueo'))?.props.disabled ?? nodes.find(n => n.props?.disabled === true)?.props.disabled, true)
  assert.match(html, /No se pudo verificar/)
  assert.doesNotMatch(html, /finaliza primero el turno/)
})

test('a closed shift becomes available only after a successful session lookup, not on stale data or errors', () => {
  const session = { id: 'closed-shift', status: 'CLOSED', opened_by_id: 'qa', cash_closure_id: null, opened_at: '2026-10-09T08:00:00Z', closed_at: '2026-10-09T17:00:00Z' }
  const data = { ok: true, register: { id: 'register' }, session: null, closableSession: session }
  let state, result
  const { useMineClosureGate, canRegisterMineClosure } = loadReportModule('../cash-closure/hooks/useMineClosureGate.ts', {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b' } }) },
    '@tanstack/react-query': { useQuery: () => state },
    '@/services/cashSessionsService': { fetchCashSessionCurrent() { throw new Error('No real requests allowed') }, sessionOpenedAtToLocalInput: value => value },
  })
  function Probe() { result = useMineClosureGate({ enabled: true, userId: 'qa', timezone: 'America/Guatemala' }); return null }
  const check = query => { state = { isLoading: false, isPending: false, isFetching: false, refetch() {}, ...query }; renderToStaticMarkup(React.createElement(Probe)); return result }
  let checked = check({ data, error: new Error('Unavailable database'), isFetching: true })
  assert.equal(checked.gate.reason, 'error')
  assert.equal(canRegisterMineClosure(checked.gate), false)
  assert.equal(checked.isRefreshing, true)
  checked = check({ data, error: null })
  assert.equal(checked.gate.closableSessionId, 'closed-shift')
  assert.equal(canRegisterMineClosure(checked.gate), true)
  assert.equal(checked.isRefreshing, false)
  checked = check({ data: { ...data, closableSession: null }, error: null })
  assert.equal(checked.gate.reason, 'no-pending')
  assert.equal(canRegisterMineClosure(checked.gate), false)
})

test('save still requires explicit verification of every payment method', async () => {
  const { nodes, toasts, saves } = createPage({ counted: new Set() })
  const button = nodes.find(n => n.props?.children?.includes?.('Guardar cierre de caja'))
  assert.ok(button)
  await button.props.onClick()
  assert.equal(saves.length, 0)
  assert.ok(toasts.some(t => /verifica|método/i.test(t.description)))
})

test('save still requires a reason for differences', async () => {
  const { nodes, toasts, saves } = createPage({ notes: '', paymentNotes: '' })
  await nodes.find(n => n.props?.children?.includes?.('Guardar cierre de caja')).props.onClick()
  assert.equal(saves.length, 0)
  assert.ok(toasts.some(t => /motivo|explica|diferencia/i.test(t.description)))
})

test('clearing a verified amount removes verification instead of silently confirming zero', () => {
  const { nodes, updates } = createPage()
  nodes.find(n => n.props?.id === 'actual-0').props.onChange({ target: { value: '' } })
  const verification = updates.find(u => u.index === 4)
  assert.ok(verification)
  assert.equal(verification.value.has(1), false)
})

test('typing zero explicitly verifies that method', () => {
  const { nodes, updates } = createPage({ counted: new Set() })
  nodes.find(n => n.props?.id === 'actual-0').props.onChange({ target: { value: '0' } })
  assert.equal(updates.find(u => u.index === 4).value.has(1), true)
})

test('a significant difference asks for confirmation before any save', async () => {
  const { nodes, updates, saves } = createPage()
  await nodes.find(n => n.props?.children?.includes?.('Guardar cierre de caja')).props.onClick()
  assert.equal(saves.length, 0)
  assert.ok(updates.some(u => u.index === 1 && u.value === true))
})

test('regular save keeps the complete closure payload and navigates back', async () => {
  const { nodes, saves, navigations } = createPage({ difference: 0, differencePct: 0 })
  await nodes.find(n => n.props?.children?.includes?.('Guardar cierre de caja')).props.onClick()
  assert.equal(saves.length, 1)
  assert.deepEqual(saves[0], { startDate: '2026-10-09T08:00:00', endDate: '2026-10-09T17:00:00', cashierName: 'Cajero QA', cashierId: undefined, cashRegisterSessionId: undefined, theoreticalData: theory, actualTotal: 90, notes: 'Recuento', paymentBreakdown: payments, denominations })
  assert.deepEqual(navigations, ['/cierre-caja'])
})

test('own closure with no pending session keeps calculation and saving disabled', () => {
  const { nodes } = createPage({ scope: 'mine', canCalculate: false })
  assert.equal(nodes.find(n => n.props?.children?.includes?.('Calcular mi cierre')).props.disabled, true)
  assert.equal(nodes.find(n => n.props?.children?.includes?.('Guardar cierre de caja')).props.disabled, true)
})

test('an unverified zero remains blank until consciously entered', () => {
  const { html } = render('components/PaymentMethodsForm.tsx', { paymentBreakdown: [{ ...payments[0], actual_amount: 0 }], countedPaymentMethodIds: new Set(), onUpdateAmount() {} })
  assert.match(html, /id="actual-0"[^>]*value=""/)
})

test('denomination labels respect a different configured currency', () => {
  const { html } = render('components/DenominationsCounter.tsx', { denominations, cashTotal: 90, onUpdateQuantity() {} }, { '@/hooks/useSystemSettings': { useSystemSettings: () => ({ currencyCode: 'USD', locale: 'en-US' }) } })
  assert.match(html, /\$10\.00/)
  assert.doesNotMatch(html, /Q 10\.00/)
})

test('detail shows compact sibling surfaces and real payment and denomination tables', () => {
  let stateIndex = 0
  const closure = { id: 1, closure_number: 12, status: 'Aprobado', start_date: '2026-10-09T08:00:00', end_date: '2026-10-09T17:00:00', cashier_name: 'Cajero QA', supervisor_name: 'Supervisor QA', theoretical_total: 100, actual_total: 90, difference: -10, difference_percentage: -10, opening_float: 20, payment_breakdowns: payments, denominations, notes: 'Recuento' }
  const { html } = render('ClosureDetailPage.tsx', {}, {
    react: { ...React, useState: initial => React.useState(stateIndex++ === 0 ? closure : initial === true ? false : initial), useEffect() {} },
    'react-router-dom': { useParams: () => ({ id: '1' }), useNavigate: () => () => {}, Link: 'a' },
    '@tanstack/react-query': { useQuery: ({queryKey}) => ({ data: queryKey[0] === 'cash-closure-detail' ? closure : null, isLoading: false, isPending:false }), useQueryClient: () => ({ invalidateQueries() {},setQueryData() {} }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user:{id:'qa'},hasPermission:()=>true }) },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b' } }) }, '@/services/cashReviewService': {}, '@/services/cashCorrectionService': {},
    '@/context/useAuth': { useAuth: () => ({ user: { name: 'QA' } }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    './hooks': { useCashClosureAPI: () => ({}), useCashClosureForm: () => ({ isSeller: false }) },
    './generatePDF': { generateClosurePDF() {} },
    '@/utils/pdfBranding': { resolvePdfLogoDataUrl() {} },
  })
  assert.match(html, /cash-closure-detail-grid/)
  assert.match(html, /^<div class="[^"]*mx-auto[^"]*max-w-\[1560px\]/)
  assert.equal((html.match(/<table/g) || []).length, 2)
  assert.match(html, /Cajero QA/)
  assert.match(html, /Supervisor QA/)
  assert.match(html, /Faltante/)
  assert.doesNotMatch(html, /bg-card|bg-background\/80|border rounded p-3/)
})

test('a blind count hides expected totals and saves without asking reasons the cashier cannot know', async () => {
  const blindData = { blind: true, calculation_key: 'k', period: { start: '2026-10-09T08:00:00Z', end: '2026-10-09T17:00:00Z' }, cash_session: { id: 'session-qa' }, payment_breakdown: [] }
  const { html, nodes, saves, toasts } = createPage({ data: blindData, paymentNotes: '', notes: '', difference: -50, differencePct: -50 })
  assert.ok(html.includes('Conteo ciego')); assert.equal(html.includes('Total esperado'), false)
  await nodes.find(n => n.props?.children?.includes?.('Guardar cierre de caja')).props.onClick()
  assert.equal(saves.length, 1, JSON.stringify(toasts)); assert.equal(toasts.some(t => /motivo|diferencia/i.test(t.title + t.description)), false)
})

test('a turn in recount tells the cashier their earlier count stays saved', () => {
  assert.ok(createPage({ scope: 'mine', recount: true }).html.includes('Reconteo solicitado'))
  assert.equal(createPage({ scope: 'mine' }).html.includes('Reconteo solicitado'), false)
})
