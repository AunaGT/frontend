const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { fixture } = require('./fixtures/reportFixtures.cjs')
function harness() {
  const slots = [], effects = [], pendingEffects = [], requests = []; let cursor = 0, params = ['qa-company', 'sales', { branchId: 'qa-branch', period: 'all' }], value
  const changed = (a, b) => !a || a.some((x, i) => x !== b[i])
  const hooks = { ...React,
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial } },
    useMemo: (fn, deps) => { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value },
    useCallback: (fn, deps) => hooks.useMemo(() => fn, deps),
    useEffect: (fn, deps) => { const i = cursor++; if (changed(effects[i]?.deps, deps)) pendingEffects.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() } }) },
  }
  const { usePreparedReport } = loadReportModule('hooks/usePreparedReport.ts', { react: hooks, '../api/reportService': { fetchPreparedReport: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })) } })
  const render = (...next) => { if (next.length) params = next; cursor = 0; value = usePreparedReport(...params); pendingEffects.splice(0).forEach(fn => fn()); return value }
  return { render, requests, unmount: () => effects.forEach(e => e?.cleanup?.()) }
}
test('manual preparation deduplicates clicks and discards stale tenant responses even without abort support', async () => {
  const h = harness(), a = h.render(); const p = a.prepare(); a.prepare(); assert.equal(h.requests.length, 1)
  assert.equal(h.render('other-company', 'sales', { branchId: 'other-branch', period: 'all' }).report, null)
  h.requests[0].resolve(fixture()); await p
  assert.equal(h.render().report, null); assert.equal(h.requests[0].args[3].aborted, true)
  h.unmount()
})
test('changing filters blocks old exports immediately; failed retry removes prior result', async () => {
  const h = harness(); const p = h.render().prepare(); h.requests[0].resolve(fixture()); await p
  assert.ok(h.render().report)
  const changed = h.render('qa-company', 'sales', { branchId: 'qa-branch', period: 'month', year: 2026, month: 10 })
  assert.equal(changed.report, null); assert.equal(changed.dirty, true); assert.equal(h.requests.length, 1)
  const retry = changed.prepare(); h.requests[1].reject(new Error('Sin conexión')); await retry
  assert.equal(h.render().report, null); assert.equal(h.render().error.message, 'Sin conexión')
})
