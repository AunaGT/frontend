const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const hash = 'a'.repeat(64)
function fixture() {
  const rows = new Map(), storage = { getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v), removeItem: k => rows.delete(k) }
  return { ...loadReportModule('../cash-closure/hooks/useCashCustodyAttempt.ts', { '@/services/cashCustodyService': {} }), storage, scope: { companyId: 'c', branchId: 'b', actorId: 'u' } }
}
const send = { origin: { kind: 'SESSION', sessionId: 's' }, destination: { kind: 'CUSTODY', custodyId: 'k' }, amount: '150.00', reason: 'Resguardo' }
const transfer = (extra = {}) => ({ replayed: false, transfer: { id: 't', status: 'PENDING', amount: '150.00', ...extra } })

test('a transfer is persisted before sending, sent once, and only a complete receipt releases it', async () => {
  const { createCustodyAttempt, custodyIdentity, scope, storage } = fixture(), attempt = createCustodyAttempt(custodyIdentity(scope, 'send'), storage)
  let calls = 0, finish
  const a = attempt.save(send, () => { calls++; return new Promise(r => { finish = () => r(transfer()) }) }), b = attempt.save(send, async () => { calls++ })
  assert.equal(calls, 1); assert.ok(attempt.pending().input.requestKey)
  finish(); assert.deepEqual(await a, await b); assert.equal(attempt.pending(), null)
})

test('a lost answer followed by 403 keeps the same attempt; a malformed answer never releases it', async () => {
  const { createCustodyAttempt, custodyIdentity, scope, storage } = fixture(), identity = custodyIdentity(scope, 'handover', 'turno-1')
  let original
  await assert.rejects(createCustodyAttempt(identity, storage).save({ deliveredAmount: '150.00', retainedAmount: '50.00', destinationCustodyId: 'k' }, async c => { original = c; throw new Error('Respuesta perdida') }))
  const reopened = createCustodyAttempt(identity, storage)
  await assert.rejects(reopened.save({ deliveredAmount: '1.00', retainedAmount: '0.00' }, async c => { assert.deepEqual(c, original); throw Object.assign(new Error('Sin permiso'), { status: 403 }) }))
  await assert.rejects(reopened.save({}, async () => ({ replayed: false })))
  assert.deepEqual(reopened.pending().input, original)
  assert.equal(createCustodyAttempt(custodyIdentity(scope, 'handover', 'turno-2'), storage).pending(), null, 'another turn never sees it')
  await reopened.save({}, async () => ({ replayed: true, handover: { id: 'h', delivered_amount: '150.00', retained_amount: '50.00' } }))
  assert.equal(reopened.pending(), null)
})

test('the transport sends only the declared fields with the scope in headers and no cache', async () => {
  const requests = [], original = global.fetch
  global.fetch = async (url, options) => { requests.push({ url, options }); return { ok: true, status: 201, json: async () => ({}) } }
  try {
    const service = loadReportModule('../../services/cashCustodyService.ts', { '@/services/api': { getApiBaseUrl: () => '/api', getAuthToken: () => 't' } })
    const scope = { companyId: 'c', branchId: 'b', actorId: 'u' }
    await service.sendTransfer({ requestKey: 'k', ...send, actor: 'otro', receivedAmount: '1' }, scope)
    await service.handoverTurn('s1', { requestKey: 'k', deliveredAmount: '0.00', retainedAmount: '10.00', expected: '999' }, scope)
    assert.deepEqual(Object.keys(JSON.parse(requests[0].options.body)).sort(), ['amount', 'destination', 'origin', 'reason', 'requestKey'])
    assert.deepEqual(Object.keys(JSON.parse(requests[1].options.body)).sort(), ['deliveredAmount', 'requestKey', 'retainedAmount'])
    assert.equal(requests[0].options.headers['X-Branch-Id'], 'b'); assert.equal(requests[0].options.cache, 'no-store')
    assert.match(requests[1].url, /\/cash-closures\/custody\/sessions\/s1\/handover$/)
  } finally { global.fetch = original }
})
