const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
function api() {
  let result; const notifications = []
  const { useCashClosureAPI } = loadReportModule('../cash-closure/hooks/useCashClosureAPI.ts', {
    '@/services/api': { getApiBaseUrl: () => '/api', getAuthToken: () => 'test-only' },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ timezone: 'America/Guatemala' }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: n => notifications.push(n) }) },
    '@/hooks/usePersistedListUiState': { readListUiPersisted: () => ({}), writeListUiPersisted() {} },
  })
  function Probe() { result = useCashClosureAPI(); return null }
  renderToStaticMarkup(React.createElement(Probe))
  return { hook: result, notifications }
}
const theory = { calculation_key: 'server-calculation', theoretical: { net_total: 0.3, total_sales: 0.3, total_returns: 0 }, metrics: { total_transactions: 1, total_customers: 1, average_ticket: 0.3 } }
test('denomination auto-allocation is safe only when there is exactly one cash slice', () => {
  const { singleCashPaymentIndex } = loadReportModule('../cash-closure/types.ts', { '@/services/api': { getApiBaseUrl: () => '/api' } })
  const cash = { payment_method_id: 1, payment_method_name: 'Caja', settlement_kind: 'CASH' }, bank = { payment_method_id: 2, settlement_kind: 'BANK' }
  assert.equal(singleCashPaymentIndex([bank, cash]), 1)
  assert.equal(singleCashPaymentIndex([cash, { ...cash, payment_method_id: 3 }, bank]), -1)
  assert.equal(singleCashPaymentIndex([bank]), -1)
})
test('save submits the calculation key and rounded declarations, not browser financial totals', async t => {
  let body
  t.mock.method(global, 'fetch', async (_url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ id: 'C1', closure_number: 1 }) } })
  const { hook } = api()
  assert.equal(await hook.saveClosure({ startDate: '2026-10-28T08:00', endDate: '2026-10-28T12:00', cashierName: 'QA', theoreticalData: theory, actualTotal: 0.1 + 0.2, notes: '', paymentBreakdown: [{ payment_method_id: 1, actual_amount: 0.3, actual_count: 1, theoretical_amount: 999, theoretical_count: 1 }], denominations: [] }), 'C1', 'resolves to the created closure id')
  assert.equal(body.calculationKey, 'server-calculation')
  assert.equal(body.actualTotal, 0.3)
  assert.equal('theoreticalTotal' in body, false)
  assert.equal('theoretical_amount' in body.paymentBreakdowns[0], false)
})
test('review sends the displayed version and never a claimed supervisor identity', async t => {
  const requests = []
  t.mock.method(global, 'fetch', async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ id: 'C' }) } })
  const { hook } = api(), version = '2026-10-28T18:00:00.000Z'
  await hook.approveClosure('C', version)
  await hook.rejectClosure('C', 'Recontar', version)
  assert.deepEqual(requests, [{ status: 'Aprobado', expectedUpdatedAt: version }, { status: 'Rechazado', rejection_reason: 'Recontar', expectedUpdatedAt: version }])
})
test('save transports classification slice identity without flattening same-method cash and bank', async t => {
  let body
  t.mock.method(global, 'fetch', async (_url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ closure_number: 1 }) } })
  await api().hook.saveClosure({ startDate: '2026-10-28T08:00', endDate: '2026-10-28T12:00', cashierName: 'QA', theoreticalData: theory, actualTotal: 30, notes: '', paymentBreakdown: [{ payment_method_id: 1, breakdown_key: '1:CASH', actual_amount: 10 }, { payment_method_id: 1, breakdown_key: '1:BANK', actual_amount: 20 }], denominations: [] })
  assert.deepEqual(body.paymentBreakdowns.map(row => row.breakdown_key), ['1:CASH', '1:BANK'])
})
test('negative inventory warns but does not block counting real money', async t => {
  const requests = []
  t.mock.method(global, 'fetch', async url => {
    requests.push(url)
    return { ok: true, json: async () => url.includes('validate-stocks') ? { valid: false, negative_stock_count: 1, products: [{ id: 'P' }] } : theory }
  })
  const { hook, notifications } = api()
  assert.deepEqual(await hook.calculateTheoretical('2026-10-28T08:00', '2026-10-28T12:00'), theory)
  assert.ok(requests.some(url => url.includes('calculate-theoretical')))
  assert.ok(notifications.some(n => /inventario|stock/i.test(n.title)))
})
test('an unavailable inventory warning endpoint does not prevent a cash calculation', async t => {
  t.mock.method(global, 'fetch', async url => {
    if (url.includes('validate-stocks')) throw new Error('Inventory temporarily unavailable')
    return { ok: true, json: async () => theory }
  })
  assert.deepEqual(await api().hook.calculateTheoretical('2026-10-28T08:00', '2026-10-28T12:00'), theory)
})
test('a stale review displays the server conflict instead of claiming approval', async t => {
  t.mock.method(global, 'fetch', async () => ({ ok: false, json: async () => ({ message: 'Otro encargado ya revisó este arqueo. Recarga.' }) }))
  const { hook, notifications } = api()
  assert.equal(await hook.approveClosure('C', '2026-10-28T18:00:00.000Z'), null)
  assert.ok(notifications.some(n => /Otro encargado/.test(n.description)))
})
test('three ten-cent coins produce exact cash and serialized declarations', async t => {
  const slots = []; let cursor = 0
  const { useCashClosureForm } = loadReportModule('../cash-closure/hooks/useCashClosureForm.ts', {
    react: { ...React, useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] }, useCallback: fn => fn, useEffect() {} },
    '@/context/useAuth': { useAuth: () => ({ user: { name: 'QA' } }) },
    '@/services/settingsService': { getDenominations: async () => [] },
  })
  let form = useCashClosureForm(), index = form.denominations.findIndex(d => Number(d.denomination) === 0.1)
  form.updateDenomination(index, 3); cursor = 0; form = useCashClosureForm()
  assert.equal(form.getCashTotal(), 0.3)
  let sent
  t.mock.method(global, 'fetch', async (_url, options) => { sent = JSON.parse(options.body); return { ok: true, json: async () => ({ closure_number: 1 }) } })
  await api().hook.saveClosure({ startDate: '2026-10-28T08:00', endDate: '2026-10-28T12:00', cashierName: 'QA', theoreticalData: theory, actualTotal: form.getCashTotal(), notes: '', paymentBreakdown: [{ payment_method_id: 1, actual_amount: 0.1 + 0.1 + 0.1, actual_count: 0 }], denominations: form.denominations })
  assert.equal(sent.paymentBreakdowns[0].actual_amount, 0.3)
  assert.deepEqual(sent.denominations, [{ denomination: 0.1, type: 'Moneda', quantity: 3 }])
})
