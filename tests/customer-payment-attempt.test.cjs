const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { hookHarness } = require('./helpers/reportHookHarness.cjs')
const storage = new Map()
global.sessionStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
function mount(send, context = { companyId: crypto.randomUUID(), branchId: 'b', userId: 'u', customerId: 'c' }) {
  const h = hookHarness(), posts = []; let state, ctx = context
  const { useCustomerPaymentAttempt } = loadReportModule('../receivables/hooks/useCustomerPaymentAttempt.ts', { react: h.hooks, '../api/receivablesService': { createCustomerPayment: async payload => { posts.push(payload); return send(payload) } } })
  const render = () => state = h.render(() => useCustomerPaymentAttempt(ctx))
  render(); render()
  return { get state() { return state }, posts, render, context, unmount: h.unmount, change: value => { ctx = { ...ctx, ...value }; render(); render() } }
}
const payload = { customer_id: 'c', amount: 50, payment_method_id: 1, cash_register_session_id: 's', allow_advance: true }
test('double click shares the same in-flight receipt and has a stable intent key', async () => {
  let resolve
  const m = mount(() => new Promise(r => resolve = r)), first = m.state.send(payload), second = m.state.send(payload)
  assert.equal(m.posts.length, 1); assert.match(m.posts[0].request_key, /^[\da-f-]{36}$/i)
  resolve({ id: 'receipt' }); assert.equal((await first).id, 'receipt'); assert.equal((await second).id, 'receipt')
})
test('uncertain receipt survives unmount and resends original payload even when draft/session changes', async () => {
  const m = mount(() => { throw Error('Respuesta perdida') })
  await assert.rejects(m.state.send(payload)); m.render(); assert.equal(m.state.pendingPayload.amount, 50)
  m.unmount()
  const recovered = mount(() => ({ id: 'original' }), m.context)
  assert.equal(recovered.state.pendingPayload.amount, 50)
  await recovered.state.send({ ...payload, amount: 99, cash_register_session_id: 'closed-now' })
  assert.deepEqual(recovered.posts[0], m.posts[0]); recovered.render(); assert.equal(recovered.state.pendingPayload, null)
})
test('definite validation error keeps form editable but context change never reuses another scope request', async () => {
  const m = mount(() => { throw Object.assign(Error('Importe inválido'), { status: 400 }) })
  await assert.rejects(m.state.send(payload)); m.render(); assert.equal(m.state.pendingPayload, null)
  m.change({ branchId: 'other' }); await assert.rejects(m.state.send(payload)); assert.notEqual(m.posts[0].request_key, m.posts[1].request_key)
})
test('changing tenant during response does not report success into the new customer view', async () => {
  let resolve
  const m = mount(() => new Promise(r => resolve = r)), pending = m.state.send(payload)
  m.change({ companyId: 'another' }); resolve({ id: 'old-scope' })
  await assert.rejects(pending, /alcance/)
  assert.equal(m.state.pendingPayload, null)
})
test('corrupt saved intent blocks new collection instead of silently replacing it', async () => {
  const context = { companyId: crypto.randomUUID(), branchId: 'b', userId: 'u', customerId: 'c' }
  storage.set('auna:customer-payment-pending:' + JSON.stringify(Object.values(context)), '{broken')
  const m = mount(() => ({ id: 'unsafe-new' }), context)
  await assert.rejects(m.state.send(payload), /historial/); assert.equal(m.posts.length, 0)
})
test('malformed success cannot clear an uncertain receipt intent', async () => {
  const m = mount(() => ({}))
  await assert.rejects(m.state.send(payload), /comprobante/); m.render()
  assert.equal(m.state.pendingPayload.amount, 50)
})
test('unreadable successful HTTP response preserves the original key until the receipt is recovered', async () => {
  let fail = true
  const m = mount(() => { if (fail) throw Object.assign(Error('JSON inválido'), { status: 201 }); return { id: 'committed' } })
  await assert.rejects(m.state.send(payload)); m.render(); assert.equal(m.state.pendingPayload.amount, 50)
  fail = false; await m.state.send({ ...payload, amount: 99 })
  assert.deepEqual(m.posts[1], m.posts[0]); m.render(); assert.equal(m.state.pendingPayload, null)
})
test('a forbidden recovery does not prove that the earlier uncertain receipt was never committed', async () => {
  let calls = 0
  const first = mount(() => { calls++; throw calls === 1 ? Error('Respuesta perdida') : Object.assign(Error('Permiso retirado'), { status: 403 }) })
  await assert.rejects(first.state.send(payload)); first.render()
  await assert.rejects(first.state.send(payload)); first.render(); assert.ok(first.state.pendingPayload)
  first.unmount()
  const recovered = mount(() => ({ id: 'original' }), first.context)
  await recovered.state.send({ ...payload, amount: 99 }); recovered.render()
  assert.deepEqual(first.posts[1], first.posts[0]); assert.deepEqual(recovered.posts[0], first.posts[0]); assert.equal(recovered.state.pendingPayload, null)
})
