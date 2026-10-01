import assert from 'node:assert/strict'
import { canRespondToQuote } from './quoteViewModel.mjs'
assert.equal(canRespondToQuote({ status: 'SENT', valid_until: '2026-10-01T06:00:00Z' }, new Date('2026-09-30T06:00:00Z')), true)
assert.equal(canRespondToQuote({ status: 'SENT', valid_until: '2026-09-30T06:00:00Z' }, new Date('2026-09-30T06:00:00Z')), false)
assert.equal(canRespondToQuote({ status: 'DRAFT' }), false)
assert.equal(canRespondToQuote({ status: 'ACCEPTED' }), false)
assert.equal(canRespondToQuote({ status: 'SENT', valid_until: null }), true)
assert.equal(canRespondToQuote({ status: 'SENT', valid_until: 'invalid' }), false)
console.log('quoteViewModel: respuestas y vigencia verificadas')
