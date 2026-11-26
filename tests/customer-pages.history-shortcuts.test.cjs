const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
test('the same history binding handles host and frame targets, redo and cleanup', () => {
  const { bindPortalHistoryKeys } = loadReportModule('../config/customerPages/historyShortcuts.ts')
  const host = new EventTarget(), frame = new EventTarget(), changes = []
  const removeHost = bindPortalHistoryKeys(host, redo => changes.push(redo))
  const removeFrame = bindPortalHistoryKeys(frame, redo => changes.push(redo))
  const key = (target, props) => { const e = new Event('keydown', { cancelable: true }); Object.assign(e, props); target.dispatchEvent(e); return e }
  assert.equal(key(host, { key: 'z', ctrlKey: true }).defaultPrevented, true)
  assert.equal(key(frame, { key: 'z', metaKey: true, shiftKey: true }).defaultPrevented, true)
  assert.equal(key(frame, { key: 'y', ctrlKey: true }).defaultPrevented, true)
  assert.deepEqual(changes, [false, true, true])
  removeHost(); removeFrame()
  key(frame, { key: 'z', ctrlKey: true }); assert.equal(changes.length, 3)
})
test('typing fields and composed input keep their own text undo instead of changing the page', () => {
  const { handlePortalHistoryKey } = loadReportModule('../config/customerPages/historyShortcuts.ts')
  for (const input of [{ tagName: 'TEXTAREA' }, { isContentEditable: true }]) {
    const e = { key: 'z', ctrlKey: true, target: input, composedPath: () => [input], preventDefault: () => assert.fail('text undo'), stopImmediatePropagation: () => assert.fail('text undo') }
    handlePortalHistoryKey(e, () => assert.fail('page history'))
  }
})
