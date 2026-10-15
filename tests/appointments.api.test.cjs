const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
test('peticiones capturan tenant, abortan respuestas tardías y calendario lee más de cien sesiones', async () => {
  let active = { companyId: 'A', branchId: 'B' }, calls = []
  const api = loadReportModule('../appointments/api.ts', { '@/services/api': {
    getActiveCompanyId: () => active.companyId, getActiveBranchId: () => active.branchId,
    apiFetch: async (path, options) => { calls.push({ path, options }); const page = Number(new URL(path, 'http://qa').searchParams.get('page')); return { items: Array.from({ length: page === 1 ? 100 : 1 }, (_, i) => ({ id: `${page}-${i}` })), totalItems: 101, page, pageSize: 100 } },
  } })
  assert.notDeepEqual(api.appointmentQueryKey(active, 'bookings', {}), api.appointmentQueryKey({ ...active, companyId: 'C' }, 'bookings', {}))
  assert.equal((await api.fetchAllSessions(active, {})).length, 101)
  assert.equal(calls.length, 2); assert.deepEqual(calls[0].options.headers, { 'X-Company-Id': 'A', 'X-Branch-Id': 'B' })
  const old = active; active = { companyId: 'C', branchId: 'B' }
  await assert.rejects(() => api.getAgenda('/directory', old), { name: 'AbortError' })
})
