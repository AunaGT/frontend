const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const load = () => loadReportModule('../config/customerPages/engine/EngineSync.ts')
const data = names => ({ root: { props: {} }, content: names.map(id => ({ type: 'Text', props: { id, auna: { props: { text: id } }, content: [] } })) })
test('external insertion waits for new engine indexes before resolving the new selection', () => {
  const { EngineSync } = load(), sync = new EngineSync(), old = data(['a']), next = data(['a','b']), initial = {}, revision = {}
  const input = { revision: initial, desired: old, actual: old, selection: 'a', engineSelection: 'a', selector: id => ({ index: 0, zone: 'root' }) }
  assert.equal(sync.reconcile(input), null)
  const pending = { ...input, revision, desired: next, selection: 'b', selector: () => assert.fail('old index lookup') }
  assert.equal(sync.reconcile(pending).type, 'data')
  const selected = sync.reconcile({ ...pending, actual: next, selector: id => ({ index: id === 'b' ? 1 : 0, zone: 'root' }) })
  assert.deepEqual(selected, { type: 'selection', selector: { index: 1, zone: 'root' } })
  assert.equal(sync.reconcile({ ...pending, actual: next, engineSelection: 'b', selector: () => ({ index: 1, zone: 'root' }) }), null)
})
test('external reordering keeps the same selected id instead of following its old index', () => {
  const { EngineSync } = load(), sync = new EngineSync(), before = data(['a','b']), after = data(['b','a'])
  const input = { revision: {}, desired: before, actual: before, selection: 'a', engineSelection: 'a', selector: () => ({ index: 0, zone: 'root' }) }
  sync.reconcile(input)
  const moved = { ...input, revision: {}, desired: after }
  assert.equal(sync.reconcile(moved).type, 'data')
  assert.deepEqual(sync.reconcile({ ...moved, actual: after, engineSelection: 'b', selector: () => ({ index: 1, zone: 'root' }) }), { type: 'selection', selector: { index: 1, zone: 'root' } })
})
test('native insertion retains its selected id and canonical object ordering does not cause reset loops', () => {
  const { EngineSync, engineSignature } = load(), sync = new EngineSync(), old = data(['a']), next = data(['a','b'])
  const first = { revision: {}, desired: old, actual: old, selection: 'a', engineSelection: 'a', selector: () => ({ index: 0, zone: 'root' }) }
  sync.reconcile(first); sync.emitted(engineSignature(next))
  const native = { ...first, revision: {}, desired: next, actual: next, engineSelection: 'b' }
  assert.deepEqual(sync.reconcile(native), { type: 'notify', id: 'b' })
  assert.equal(sync.reconcile({ ...native, revision: {}, selection: 'b' }), null)
  const reordered = { content: next.content, root: next.root }
  assert.equal(engineSignature(next), engineSignature(reordered))
})
test('undo of an insertion clears a missing selected id without a reconciliation loop', () => {
  const { EngineSync } = load(), sync = new EngineSync(), old = data(['a'])
  const input = { revision: {}, desired: old, actual: old, selection: 'removed', engineSelection: null, selector: () => undefined }
  assert.deepEqual(sync.reconcile(input), { type: 'notify', id: null })
  assert.equal(sync.reconcile({ ...input, revision: {}, selection: null }), null)
})
