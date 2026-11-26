const test = require('node:test'), assert = require('node:assert/strict'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const caps = { available: true, canView: true, canManage: false, canOperateOwn: true, canOperateTeam: false, canReceive: true }
const custodies = [{ id: 'k', name: 'Caja fuerte', currency_code: 'GTQ', active: true, balance: '0.00', pending_in: 0 }]
const context = (extra = {}) => ({ session: { id: 's1', status: 'CLOSED', cash_register_id: 'r', register_name: 'Mostrador', responsible_name: 'Ana', opened_by_id: 'u', opened_at: '2026-10-30T14:00:00.000Z', closed_at: '2026-10-30T22:00:00.000Z', opening_float: '200.00', currency_code: 'GTQ', business_timezone: 'America/Guatemala' },
  eligible: true, handover: null, expectedCash: '200.00', registerHasOpenTurn: false, custodies, canHandover: true, ...extra })
const transfer = (extra = {}) => ({ id: 't', status: 'PENDING', amount: '150.00', received_amount: null, difference: null, currency_code: 'GTQ', origin_kind: 'SESSION', destination_kind: 'CUSTODY',
  origin_custody_name: null, origin_register_name: 'Mostrador', destination_custody_name: 'Caja fuerte', destination_register_name: null, sender_id: 'otro', sender_name: 'Luis', receiver_id: null, receiver_name: null,
  reason: 'Resguardo', reference: null, receipt_reason: null, returns_transfer_id: null, return_transfer_id: null, handover_id: null, created_at: '2026-10-30T15:00:00.000Z', received_at: null, ...extra })
function render(file, props, data) {
  const nodes = []
  const Page = loadReportModule(`../cash-closure/${file}.tsx`, {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b', name: 'Central' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'u' }, hasPermission: () => true }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala' }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} },
    '@/services/cashCustodyService': {},
    '@tanstack/react-query': { useQuery: ({ queryKey }) => ({ isLoading: false, data: queryKey[0] === 'cash-custody-capabilities' ? caps : data }), useQueryClient: () => ({ invalidateQueries() {} }) },
    './hooks/useCashCustodyAttempt': { useCustodyAttempt: () => ({ draft: {}, setDraft() {}, pending: false, busy: false, error: null, recoveryBlocked: false, submit: async () => null }) },
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page, props))), nodes }
}
test('handover is a compact dedicated page with the expected cash only as a reference', () => {
  const { html } = render('CashHandoverPage', { sessionId: 's1' }, context())
  for (const text of ['Entregar turno', 'Mostrador', 'Entregado a custodia', 'Fondo que queda en la caja', 'Efectivo esperado al corte', 'arqueo']) assert.ok(html.includes(text), text)
  assert.equal(html.includes('role="dialog"'), false); assert.match(html, /max-w-\[960px\]/)
})
test('a register that already opened another turn cannot keep a retained float', () => {
  const { html, nodes } = render('CashHandoverPage', { sessionId: 's1' }, context({ registerHasOpenTurn: true }))
  assert.equal(nodes.find(n => n.props?.id === 'handover-retained').props.disabled, true); assert.ok(html.includes('ya abrió otro turno'))
})
test('a turn already handed over is read-only', () => {
  const { html } = render('CashHandoverPage', { sessionId: 's1' }, context({ canHandover: false, handover: { id: 'h', delivered_amount: '150.00', retained_amount: '50.00', expected_cash: '200.00', difference: '0.00', destination_custody_name: 'Caja fuerte', actor_name: 'Ana', transfer_id: 't', transfer_status: 'PENDING', created_at: '2026-10-30T22:05:00.000Z' } }))
  assert.ok(html.includes('Turno entregado')); assert.equal(/type="submit"/.test(html), false)
})
test('only someone else can receive a transfer and a shortage is visible after receipt', () => {
  assert.ok(render('CashTransferPage', { mode: 'detail', transferId: 't' }, transfer()).html.includes('Confirmar recepción'))
  const mine = render('CashTransferPage', { mode: 'detail', transferId: 't' }, transfer({ sender_id: 'u' })).html
  assert.equal(mine.includes('Confirmar recepción'), false); assert.ok(mine.includes('otra persona'))
  const short = render('CashTransferPage', { mode: 'detail', transferId: 't' }, transfer({ status: 'RECEIVED', received_amount: '140.00', difference: '-10.00', receiver_id: 'u', receiver_name: 'Ana', receipt_reason: 'Faltó un billete' })).html
  assert.ok(short.includes('Faltante')); assert.ok(short.includes('10.00')); assert.ok(short.includes('Faltó un billete'))
})
test('opening a register shows the inherited float and asks for what was counted', () => {
  const nodes = []
  const { OpenCashRegisterPrompt } = loadReportModule('../sales/OpenCashRegisterPrompt.tsx', {
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ currencyCode: 'GTQ', locale: 'es-GT' }) },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'u' } }) },
    '@tanstack/react-query': { useQuery: () => ({ data: { available: true, amount: '50.00', lastActorName: 'Ana' }, isLoading: false }) },
    '@/services/cashCustodyService': {}, '@/services/cashSessionsService': {},
  }, nodes)
  const html = renderToStaticMarkup(React.createElement(OpenCashRegisterPrompt, { registerId: 'r', registerName: 'Mostrador', onOpened() {}, onBack() {} }))
  for (const text of ['Fondo heredado', '50.00', 'Ana', 'Efectivo contado']) assert.ok(html.includes(text), text)
})
test('the module launcher and tabs reach transfers with their own permissions', () => {
  const { appModules } = loadReportModule('../../config/appModules.ts')
  const entry = appModules.find(m => m.id === 'cash-closure')
  for (const code of ['cash.custody.view', 'cash.transfers.operate_own', 'cash.transfers.receive']) assert.ok(entry.permissions.includes(code), code)
  assert.equal(entry.permissions.includes('cash.registers.manage'), false)
})
