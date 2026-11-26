const test = require('node:test'), assert = require('node:assert/strict'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const caps = { available: true, canViewOwn: true, canViewTeam: false, canCreateOwn: true, canCreateTeam: false, canCorrect: true }
const session = (id, register, responsible) => ({ id, register_name: register, register_code: 'C1', opened_by_id: 'u', responsible_name: responsible, currency_code: 'GTQ', opened_at: '2026-10-30T14:00:00.000Z', business_timezone: 'America/Guatemala' })
const original = { id: 'm1', direction: 'OUT', amount: '30.00', payment_method_id: 1, payment_method_name: 'Efectivo', currency_code: 'GTQ', reason: 'Retiro a caja fuerte', counterparty_label: 'Caja fuerte', reference: null, corrects_movement_id: null, correction_id: null, actor_id: 'u', actor_name: 'Ana', register_name: 'Mostrador', responsible_name: 'Ana', cash_register_session_id: 's0', business_timezone: 'America/Guatemala', created_at: '2026-10-29T20:15:00.000Z', economic_at: '2026-10-29T20:15:00.000Z' }
function render(mode, { sessions = [session('s1', 'Mostrador', 'Ana')], capabilities = caps, entry = '/cierre-caja/movimientos/nuevo' } = {}) {
  const nodes = [], hookCalls = []
  const Page = loadReportModule('../cash-closure/CashMovementFormPage.tsx', {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b', name: 'Central' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'u' }, hasPermission: () => true }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala' }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} },
    '@/services/cashMovementsService': {},
    '@tanstack/react-query': { useQuery: ({ queryKey }) => ({ isLoading: false, data: queryKey[0] === 'cash-movement-capabilities' ? capabilities : queryKey[0] === 'cash-movement-options' ? { available: true, sessions, methods: [{ id: 1, name: 'Efectivo' }] } : original }) },
    './hooks/useCashMovementAttempt': { useCashMovementAttempt: args => { hookCalls.push(args); return { draft: { direction: mode === 'correct' ? '' : 'IN', sessionId: '', amount: '', methodId: '', counterparty: '', reason: '', reference: '', confirmed: false }, setDraft() {}, pending: false, busy: false, error: null, recoveryBlocked: false, submit: async () => null } } },
  }, nodes).default
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [entry] }, React.createElement(Page, { mode, movementId: mode === 'create' ? undefined : 'm1' })))
  return { html, nodes, hookCalls }
}
test('creating from the own open turn is prefilled, compact and explains what the movement is not', () => {
  const { html } = render('create')
  for (const text of ['Ingresar fondo', 'Retirar efectivo', 'Mostrador', 'Importe', 'Medio', 'Motivo', 'Registrar ingreso', 'No es una venta ni un cobro']) assert.ok(html.includes(text), text)
  assert.equal(html.includes('Selecciona el turno'), false, 'the only own turn is already selected')
  assert.equal(html.includes('role="dialog"'), false); assert.match(html, /max-w-\[960px\]/); assert.match(html, /md:grid-cols-2/)
})
test('a supervisor with several open turns must pick one explicitly', () => {
  const { html } = render('create', { sessions: [session('s1', 'Mostrador', 'Ana'), session('s2', 'Bodega', 'Luis')], capabilities: { ...caps, canCreateTeam: true } })
  assert.ok(html.includes('Selecciona el turno'))
})
test('without an open turn the page explains the requirement and offers no misleading action', () => {
  const { html } = render('create', { sessions: [] })
  assert.ok(html.includes('turno abierto')); assert.equal(html.includes('Registrar ingreso'), false); assert.equal(html.includes('Abrir caja'), false)
})
test('detail is immutable, never restores a draft and links to compensation instead of editing', () => {
  const { html, hookCalls } = render('detail')
  assert.equal(hookCalls.length, 0, 'detail does not touch drafts or attempts')
  assert.ok(html.includes('Q30.00') || html.includes('30.00')); assert.ok(html.includes('Compensar'))
  assert.equal(/Editar/.test(html), false); assert.ok(html.includes('No registra un gasto'))
})
test('compensation shows the original read-only and records only in the current turn', () => {
  const { html, nodes } = render('correct')
  for (const text of ['Retiro a caja fuerte', 'Registrar compensación', 'el anterior no cambia', 'Confirmo que el dinero']) assert.ok(html.includes(text), text)
  assert.equal(nodes.some(n => n.props?.id === 'movement-amount'), false, 'amount cannot be edited')
})
test('the launcher reaches movements with their own read permission without granting closures to configuration managers', () => {
  const { appModules } = loadReportModule('../../config/appModules.ts')
  const entry = (Array.isArray(appModules) ? appModules : Object.values(appModules)).flat().find(m => m?.id === 'cash-closure')
  assert.ok(entry.permissions.includes('cash.movements.view_own')); assert.ok(entry.permissions.includes('cash.movements.view_team'))
  assert.equal(entry.permissions.includes('cash.registers.manage'), false)
})
