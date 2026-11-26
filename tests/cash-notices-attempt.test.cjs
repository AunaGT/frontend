const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
test('a notice is persisted before sending and a lost answer retries with the same key', async () => {
  const rows = new Map(), storage = { getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v), removeItem: k => rows.delete(k) }
  const { createNoticeAttempt, noticeIdentity } = loadReportModule('../cash-closure/hooks/useCashNoticeAttempt.ts', { '@/services/cashNoticesService': {} })
  const scope = { companyId: 'c', branchId: 'b', actorId: 'u' }, input = { customerId: 'k', amount: '75.00', paymentMethodId: 2, reportedPaidOn: '2026-11-01' }
  let first
  await assert.rejects(createNoticeAttempt(noticeIdentity(scope), storage).save(input, async c => { first = c; throw new Error('Sin respuesta') }))
  const again = createNoticeAttempt(noticeIdentity(scope), storage)
  await assert.rejects(again.save(input, async () => ({ replayed: false })), 'a malformed receipt never releases it')
  const receipt = await again.save(input, async c => { assert.equal(c.requestKey, first.requestKey); return { replayed: true, notice: { id: 'n', amount: '75.00' } } })
  assert.equal(receipt.notice.id, 'n'); assert.equal(again.pending(), null)
  assert.equal(createNoticeAttempt(noticeIdentity({ ...scope, branchId: 'otra' }), storage).pending(), null)
})
