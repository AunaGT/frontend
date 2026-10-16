const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { hookHarness } = require('./helpers/reportHookHarness.cjs')
function tenantHarness() {
  const h = hookHarness(), calls = [], previous = global.window
  global.window = { location: { reload: () => calls.push('reload') } }
  const user = { id: 'U', permissions: [], companies: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }], branches: [{ id: 'BA', company_id: 'A', is_default: true }, { id: 'BA2', company_id: 'A' }, { id: 'BB', company_id: 'B', is_default: true }] }
  const { TenantProvider } = loadReportModule('../../context/TenantProvider.tsx', {
    react: h.hooks, './useAuth': { useAuth: () => ({ user }) },
    '@tanstack/react-query': { useQueryClient: () => ({ clear: () => calls.push('clear') }) },
    '@/services/api': { getActiveCompanyId: () => 'A', getActiveBranchId: () => 'BA', setActiveTenant: (...args) => calls.push(args) },
  })
  return { render: () => h.render(() => TenantProvider({ children: null })).props.value, calls, close: () => { h.unmount(); global.window = previous } }
}
test('cancelled company or branch switch leaves context, storage and queries intact', () => {
  const h = tenantHarness()
  try {
    const v = h.render(); let asked = 0
    v.registerTenantExitGuard(() => { asked++; return false })
    v.setCompany('B'); v.setBranch('BA2')
    assert.equal(asked, 2); assert.deepEqual(h.calls, []); assert.equal(h.render().company.id, 'A'); assert.equal(h.render().branch.id, 'BA')
    v.setCompany('A'); v.setBranch('BA'); assert.equal(asked, 2)
  } finally { h.close() }
})
test('accepted switch checks guard before the first side effect and preserves legacy reload', () => {
  const h = tenantHarness()
  try {
    const v = h.render(); v.registerTenantExitGuard(() => { h.calls.push('guard'); return true }); v.setCompany('B')
    assert.deepEqual(h.calls, ['guard', ['B', 'BB'], 'clear', 'reload']); assert.equal(h.render().company.id, 'B')
  } finally { h.close() }
})
test('old owner cleanup cannot remove a newer guard; final cleanup restores unguarded switching', () => {
  const h = tenantHarness()
  try {
    const v = h.render(), cleanupOld = v.registerTenantExitGuard(() => true), cleanupNew = v.registerTenantExitGuard(() => false)
    cleanupOld(); v.setBranch('BA2'); assert.deepEqual(h.calls, [])
    cleanupNew(); v.setBranch('BA2'); assert.deepEqual(h.calls, [['A', 'BA2'], 'clear', 'reload'])
  } finally { h.close() }
})
