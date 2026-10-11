const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { fixture } = require('./fixtures/reportFixtures.cjs')
test('projection preserves all rows, server totals and rejects unknown/empty selections', () => {
  const { projectReport } = loadReportModule('reportModel.ts'), report = fixture()
  const projected = projectReport(report, { sections: ['detail'], columns: { detail: ['name', 'net'] } })
  assert.equal(projected.sections[0].rows.length, 26)
  assert.deepEqual(projected.sections[0].totals, { net: 26 })
  assert.deepEqual(projected.sections[0].rows[0], { name: report.sections[0].rows[0].name, net: 1 })
  for (const selection of [{ sections: [], columns: {} }, { sections: ['bad'], columns: {} }, { sections: ['detail'], columns: { detail: [] } }, { sections: ['detail'], columns: { detail: ['bad'] } }]) assert.throws(() => projectReport(report, selection))
})
test('cell formatting preserves null, zero, percentage points and local calendar dates', () => {
  const { formatReportCell: f } = loadReportModule('reportModel.ts'), meta = fixture()
  assert.equal(f(null, { type: 'money' }, meta), '—')
  assert.match(f(0, { type: 'money' }, meta), /0\.00/)
  assert.equal(f(28.5, { type: 'percent' }, meta), '28.5%')
  assert.match(f('2026-10-01T01:00:00Z', { type: 'datetime' }, meta), /30\/09\/2026/)
  assert.match(f('2026-10-01', { type: 'date' }, meta), /01\/10\/2026/)
})
test('fetch uses explicit tenant and only applicable validated filters', async () => {
  let request
  const { fetchPreparedReport } = loadReportModule('api/reportService.ts', { '@/services/api': { apiFetch: async (...args) => { request = args; return fixture() } } })
  const signal = new AbortController().signal
  await fetchPreparedReport('sales', 'qa-company', { branchId: 'all', period: 'month', year: 2026, month: 10, warehouseId: 'ignored', locationId: 'ignored' }, signal)
  const url = new URL(request[0], 'http://qa')
  assert.equal(url.pathname, '/reports/sales'); assert.equal(url.searchParams.get('format'), 'json')
  assert.equal(url.searchParams.get('warehouse_id'), null)
  assert.deepEqual(request[1].headers, { 'X-Company-Id': 'qa-company', 'X-Branch-Id': 'all' }); assert.equal(request[1].signal, signal)
  await assert.rejects(() => fetchPreparedReport('arbitrary', 'qa-company', { branchId: 'all', period: 'all' }))
})
test('untrusted report data must be typed and match the requested company', async () => {
  for (const invalid of [{ ...fixture(), scope: { ...fixture().scope, companyId: 'other' } }, { ...fixture(), sections: [{ ...fixture().sections[0], rows: [{ net: Infinity }] }] }]) {
    const { fetchPreparedReport } = loadReportModule('api/reportService.ts', { '@/services/api': { apiFetch: async () => invalid } })
    await assert.rejects(() => fetchPreparedReport('sales', 'qa-company', { branchId: 'qa-branch', period: 'all' }))
  }
})
