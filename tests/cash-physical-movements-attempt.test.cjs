const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const hash = 'a'.repeat(64)
const movement = (id, direction = 'IN') => ({ id, direction, amount: '40.00', payment_method_name: 'Efectivo', reason: 'Fondo', counterparty_label: 'Caja fuerte' })
const receipt = (command, extra = {}) => ({ id: 'm1', requestKey: command.requestKey, requestHash: hash, replayed: false, movement: movement('m1'), ...extra })
function fixture() {
  const rows = new Map(), storage = { getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v), removeItem: k => rows.delete(k) }
  const mod = loadReportModule('../cash-closure/hooks/useCashMovementAttempt.ts', { '@/services/cashMovementsService': {} })
  const scope = { companyId: 'c', branchId: 'b', actorId: 'u' }
  return { ...mod, scope, storage, rows }
}
const create = { cashRegisterSessionId: 's', direction: 'IN', amount: '40.00', paymentMethodId: 1, reason: 'Fondo de cambio', counterpartyLabel: 'Caja fuerte' }

test('double click sends one persisted command and only a complete receipt releases it', async () => {
  const { createCashMovementAttempt, cashMovementIdentity, scope, storage } = fixture()
  const attempt = createCashMovementAttempt(cashMovementIdentity(scope, 'create'), storage)
  let calls = 0, finish
  const send = command => { calls++; return new Promise(resolve => { finish = () => resolve(receipt(command)) }) }
  const a = attempt.save(create, send), b = attempt.save(create, send)
  assert.equal(calls, 1); assert.ok(attempt.pending()?.input.requestKey, 'saved before sending')
  finish(); assert.deepEqual(await a, await b); assert.equal(attempt.pending(), null)
})

test('a lost response followed by 403 keeps the exact attempt; malformed receipts never erase it', async () => {
  const { createCashMovementAttempt, cashMovementIdentity, scope, storage } = fixture(), identity = cashMovementIdentity(scope, 'create')
  let original
  await assert.rejects(createCashMovementAttempt(identity, storage).save(create, async command => { original = command; throw new Error('Respuesta perdida') }))
  const reopened = createCashMovementAttempt(identity, storage)
  await assert.rejects(reopened.save({ ...create, amount: '999.00' }, async command => { assert.deepEqual(command, original); throw Object.assign(new Error('Sin permiso'), { status: 403 }) }))
  assert.deepEqual(reopened.pending().input, original)
  await assert.rejects(reopened.save(create, async command => ({ id: 'm1', requestKey: command.requestKey })))
  await assert.rejects(reopened.save(create, async command => receipt(command, { requestKey: 'otro' })), /confirmar/)
  assert.deepEqual(reopened.pending().input, original)
  assert.equal(createCashMovementAttempt(cashMovementIdentity({ ...scope, branchId: 'otra' }, 'create'), storage).pending(), null, 'another branch never sees it')
  await reopened.save(create, async command => receipt(command, { replayed: true }))
  assert.equal(reopened.pending(), null)
})

test('unreadable storage blocks saving instead of pretending success, and a first definitive rejection releases', async () => {
  const { createCashMovementAttempt, cashMovementIdentity, scope, storage, rows } = fixture(), identity = cashMovementIdentity(scope, 'create')
  const attempt = createCashMovementAttempt(identity, storage)
  await assert.rejects(attempt.save(create, async () => { throw Object.assign(new Error('Supera el efectivo'), { status: 409 }) }))
  assert.equal(attempt.pending(), null)
  for (const key of rows.keys()) rows.set(key, '{roto')
  rows.set('auna:cash-movement:attempt:' + identity, '{roto')
  assert.throws(() => createCashMovementAttempt(identity, storage).pending(), /no se pudo leer/i)
  let sent = false
  await assert.rejects(createCashMovementAttempt(identity, storage).save(create, async () => { sent = true }))
  assert.equal(sent, false)
})

test('identity separates action and original, and compensation transport never carries amount or direction', async () => {
  const { cashMovementIdentity, scope } = fixture()
  assert.notEqual(cashMovementIdentity(scope, 'create'), cashMovementIdentity(scope, 'correct', 'm1'))
  assert.notEqual(cashMovementIdentity(scope, 'correct', 'm1'), cashMovementIdentity(scope, 'correct', 'm2'))
  assert.notEqual(cashMovementIdentity(scope, 'create'), cashMovementIdentity({ ...scope, actorId: 'otro' }, 'create'))
  const requests = [], original = global.fetch
  global.fetch = async (url, options) => { requests.push({ url, options }); return { ok: true, status: 201, json: async () => ({}) } }
  try {
    const service = loadReportModule('../../services/cashMovementsService.ts', { '@/services/api': { getApiBaseUrl: () => '/api', getAuthToken: () => 't' } })
    await service.correctCashMovement('m1', { requestKey: 'k', cashRegisterSessionId: 's', reason: 'Devuelto', amount: '1.00', direction: 'IN' }, scope)
    const body = JSON.parse(requests[0].options.body)
    assert.deepEqual(Object.keys(body).sort(), ['cashRegisterSessionId', 'reason', 'requestKey'])
    assert.equal(requests[0].options.headers['X-Branch-Id'], 'b'); assert.equal(requests[0].options.cache, 'no-store')
    assert.match(requests[0].url, /\/cash-closures\/physical-movements\/m1\/correct$/)
  } finally { global.fetch = original }
})
