const test = require('node:test'), assert = require('node:assert/strict'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const caps = (extra = {}) => ({ available: true, canManage: true, canApprove: false, canSettle: true, ...extra })
const version = (extra = {}) => ({ id: 'v1', version: 1, mode: 'DEFERRED', destination_label: 'Visanet · BI 0012', status: 'APPROVED', bank_account_label: '1102 · Banco Industrial', clearing_account_label: '1105 · Cobros por liquidar', fee_account_label: '6105 · Comisiones', proposed_by_name: 'Luis', proposed_at: '2026-11-01T15:00:00.000Z', decided_by_name: 'Admin', decided_at: '2026-11-01T16:00:00.000Z', decision_reason: null, ...extra })
function page(file, props, data, extra = {}) {
  const nodes = []
  const Page = loadReportModule(`../cash-closure/${file}.tsx`, {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b', name: 'Central' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'u' }, hasPermission: () => true }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala' }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} }, '@/services/cashSettlementsService': {}, '@/services/api': {},
    '@tanstack/react-query': { useQuery: ({ queryKey }) => ({ isLoading: false, data: queryKey[0] === 'cash-settlement-capabilities' ? (extra.caps || caps()) : queryKey[0] === 'cash-bank-accounts' ? { assets: [{ id: 1, code: '1102', name: 'Banco' }], expenses: [{ id: 3, code: '6105', name: 'Comisiones' }] } : (extra.data?.[queryKey[0]] ?? data) }), useQueryClient: () => ({ invalidateQueries() {} }) },
    ...extra.mocks,
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page, props))), nodes }
}
test('bank methods show what is in force; a manager proposes but only the admin approves', () => {
  const methods = [{ payment_method_id: 2, name: 'Tarjeta', suggested_mode: 'DEFERRED', accounting: true, active: version(), proposal: version({ id: 'v2', version: 2, mode: 'DIRECT', status: 'PROPOSED', destination_label: 'BI directo', decided_by_name: null, decided_at: null }) },
    { payment_method_id: 3, name: 'Transferencia', suggested_mode: 'DIRECT', accounting: true, active: null, proposal: null }]
  const manager = page('CashBankMethodsPage', {}, methods).html
  for (const text of ['Medios bancarios', 'Tarjeta', 'Lo liquida un proveedor', 'Visanet · BI 0012', '1105 · Cobros por liquidar', 'Propuesta pendiente', 'Directo al banco', 'Sin configurar', 'Sugerido']) assert.ok(manager.includes(text), text)
  assert.equal(manager.includes('>Aprobar<'), false, 'a manager never sees approve')
  const admin = page('CashBankMethodsPage', {}, methods, { caps: caps({ canApprove: true }) }).html
  assert.ok(admin.includes('>Aprobar<')); assert.ok(admin.includes('Rechazar'))
})
test('the settlement balance reads in sign and words and only an exact balance can be saved', () => {
  const { settlementBalance } = loadReportModule('../cash-closure/components/settlementParts.ts')
  const ok = settlementBalance({ allocations: [{ direction: 'IN', amount: '100.00' }], deductions: [{ amount: '3.50' }], net: '96.50' })
  assert.deepEqual(ok, { gross: '100.00', refunds: '0.00', deductions: '3.50', recoveries: '0.00', expected: '96.50', difference: '0.00', balanced: true })
  const off = settlementBalance({ allocations: [{ direction: 'IN', amount: '100.00' }, { direction: 'OUT', amount: '10.00' }], deductions: [], net: '91.00' })
  assert.equal(off.balanced, false); assert.equal(off.difference, '1.00'); assert.equal(off.refunds, '10.00')
  assert.equal(settlementBalance({ allocations: [], deductions: [], net: '' }).balanced, false)
})
test('the settlements tab shows what is pending per method and the registered settlements', () => {
  const { html } = page('CashSettlementsPage', {}, null, { data: {
    'cash-settlements-pending': { items: [{ event_id: 'e1', direction: 'IN', payment_method_id: 2, payment_method_name: 'Tarjeta', remaining: '100.00', amount: '100.00', economic_at: '2026-10-30T15:00:00.000Z', source_type: 'SALE', reference: null }], totals: { 2: '100.00' } },
    'cash-settlements': { items: [{ id: 's1', status: 'POSTED', net: '96.50', gross: '100.00', deductions: '3.50', deposit_reference: 'VN-778', deposited_on: '2026-11-01', payment_method_name: 'Tarjeta', created_at: '2026-11-01T17:00:00.000Z' }], totalItems: 1, page: 1, pageSize: 20, totalPages: 1 } } })
  for (const text of ['Liquidaciones', 'Pendiente de liquidar', 'Tarjeta', 'VN-778', 'Registrar liquidación', 'Medios bancarios']) assert.ok(html.includes(text), text)
})
test('a settlement detail shows its entry and deductions, and a voided one reads as voided', () => {
  const s = { id: 's1', status: 'POSTED', deposit_id: 'd1', deposit_reference: 'VN-778', deposited_on: '2026-11-01', deposit_total: '1000.00', payment_method_name: 'Tarjeta', gross: '100.00', refunds: '0.00', deductions_total: '3.50', net: '96.50',
    entry_number: 'A-000042', void_entry_number: null, created_by_name: 'Luis', created_at: '2026-11-01T17:00:00.000Z', void_reason: null, voided_by_name: null, voided_at: null,
    allocations: [{ event_id: 'e1', amount: '100.00', source_type: 'SALE', economic_at: '2026-10-30T15:00:00.000Z', reference: null }], deductions: [{ kind: 'FEE', amount: '3.50', description: 'Comisión Visanet', account_label: '6105 · Comisiones', event_id: null }] }
  const posted = page('CashSettlementPage', { settlementId: 's1' }, s).html
  for (const text of ['VN-778', 'A-000042', 'Comisión Visanet', '6105 · Comisiones', 'Anular liquidación']) assert.ok(posted.includes(text), text)
  const voided = page('CashSettlementPage', { settlementId: 's1' }, { ...s, status: 'VOIDED', void_reason: 'Referencia equivocada', voided_by_name: 'Marta', voided_at: '2026-11-02T10:00:00.000Z', void_entry_number: 'A-000050' }).html
  assert.ok(voided.includes('Anulada')); assert.ok(voided.includes('A-000050')); assert.equal(voided.includes('Anular liquidación'), false)
})
test('the cash tabs offer settlements to whoever settles or configures methods', () => {
  const nodes = []
  const { CashClosureTabs } = loadReportModule('../cash-closure/components/CashClosureTabs.tsx', {
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: (...codes) => codes.some(c => ['cashclosure.view', 'cash.settlements.manage'].includes(c)) }) },
    '@/components/shared/ModuleTabs': { ModuleTabBar: props => { nodes.push(props); return null } },
  })
  renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(CashClosureTabs, { value: 'closures' })))
  assert.ok(nodes[0].items.some(i => i.value === 'settlements' && i.label === 'Liquidaciones'))
})
test('registering a settlement shows the live balance and only offers saving when it balances', () => {
  const pending = { items: [{ event_id: 'e1', direction: 'IN', payment_method_id: 2, payment_method_name: 'Tarjeta', remaining: '100.00', amount: '100.00', economic_at: '2026-10-30T15:00:00.000Z', source_type: 'SALE', reference: null }], totals: { 2: '100.00' } }
  const methods = [{ payment_method_id: 2, name: 'Tarjeta', suggested_mode: 'DEFERRED', accounting: true, active: { id: 'v1', mode: 'DEFERRED', fee_account_id: 3 }, proposal: null }]
  const render = draft => page('CashSettlementFormPage', {}, null, { data: { 'cash-bank-methods': methods, 'cash-settlements-pending': pending }, mocks: {
    './hooks/useCashSettlementAttempt': { useSettlementAttempt: (_, blank) => ({ draft: { ...blank, ...draft }, setDraft() {}, pending: false, busy: false, error: null, recoveryBlocked: false, submit: async () => null }) } } })
  const base = { methodId: '2', reference: 'VN-778', depositedOn: '2026-11-01', total: '96.50', net: '96.50', selected: { e1: '100.00' }, deductions: [{ kind: 'FEE', amount: '3.50', description: 'Comisión', accountId: '3' }] }
  const ok = render(base)
  for (const text of ['Registrar liquidación', 'Cobros', 'Reembolsos', 'Deducciones', 'Cuadra', 'Pendiente de liquidar']) assert.ok(ok.html.includes(text), text)
  assert.equal(ok.nodes.find(n => n.props?.type === 'submit').props.disabled, false)
  const off = render({ ...base, net: '97.50' })
  assert.match(off.html, /No cuadra/); assert.match(off.html, /sobran Q\s?1\.00/); assert.equal(off.nodes.find(n => n.props?.type === 'submit').props.disabled, true)
})
test('with disputes released a chargeback must name its case and a recovery raises what must be deposited', () => {
  const pending = { items: [{ event_id: 'e1', direction: 'IN', payment_method_id: 2, payment_method_name: 'Tarjeta', remaining: '100.00', amount: '100.00', economic_at: '2026-10-30T15:00:00.000Z', source_type: 'SALE', reference: null }], totals: { 2: '100.00' } }
  const methods = [{ payment_method_id: 2, name: 'Tarjeta', suggested_mode: 'DEFERRED', accounting: true, active: { id: 'v1', mode: 'DEFERRED', fee_account_id: 3 }, proposal: null }]
  const disputes = { items: [{ id: 'd1', event_id: 'e9', provider_reference: 'VISA-CB-1', claimed: '20.00', status: 'LOST' }, { id: 'd2', event_id: 'e8', provider_reference: 'VISA-CB-2', claimed: '5.00', status: 'CANCELLED' }] }
  const render = (draft, released = true) => page('CashSettlementFormPage', {}, null, { data: { 'cash-bank-methods': methods, 'cash-settlements-pending': pending, 'cash-settlement-disputes': disputes,
    'cash-dispute-capabilities': { available: true, commandsAvailable: released, reason: '', can: { movements: true } } }, mocks: {
    './hooks/useCashSettlementAttempt': { useSettlementAttempt: (_, blank) => ({ draft: { ...blank, ...draft }, setDraft() {}, pending: false, busy: false, error: null, recoveryBlocked: false, submit: async () => null }) } } })
  const base = { methodId: '2', reference: 'VN-779', depositedOn: '2026-11-01', total: '95.00', net: '95.00', selected: { e1: '100.00' }, deductions: [{ kind: 'CHARGEBACK', amount: '20.00', description: 'Contracargo', accountId: '' }], recoveries: [{ disputeId: 'd1', amount: '15.00' }] }
  const missing = render(base)
  assert.match(missing.html, /Recuperaciones de disputas/); assert.ok(missing.html.includes('VISA-CB-1')); assert.equal(missing.html.includes('VISA-CB-2'), false, 'cancelled cases are not offered')
  assert.match(missing.html, /Cuadra/); assert.match(missing.html, /necesita su expediente/)
  assert.equal(missing.nodes.find(n => n.props?.type === 'submit').props.disabled, true)
  const named = render({ ...base, deductions: [{ ...base.deductions[0], disputeId: 'd1', eventId: 'e9' }] })
  assert.equal(named.nodes.find(n => n.props?.type === 'submit').props.disabled, false)
  const closed = render({ ...base, deductions: [], recoveries: [], net: '100.00' }, false)
  assert.equal(closed.html.includes('Recuperaciones de disputas'), false, 'closed disputes offer neither recoveries nor chargebacks')
})
test('the launcher and routes reach settlements and bank methods with their own permissions', () => {
  const { appModules } = loadReportModule('../../config/appModules.ts')
  const entry = appModules.find(m => m.id === 'cash-closure')
  for (const code of ['cash.settlements.manage', 'cash.bank_methods.manage']) assert.ok(entry.permissions.includes(code), code)
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/App.tsx'), 'utf8')
  for (const route of ['paths.settlements}', 'paths.settlementCreate}', 'paths.settlementDetail}', 'paths.bankMethods}']) assert.ok(app.includes(route), route)
})
