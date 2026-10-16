const { hookHarness } = require('./reportHookHarness.cjs')
const { loadReportModule } = require('./loadReportModule.cjs')
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const flush = () => new Promise(resolve => setImmediate(resolve))
function configHarness(service, initial) {
  const h = hookHarness(); let context = initial, last
  const { useSettingsDraft } = loadReportModule('../config/useSettingsDraft.ts', {
    react: h.hooks, '@/services/settingsService': service,
    '@/services/api': { getActiveCompanyId: () => context.companyId, getActiveBranchId: () => context.branchId },
  })
  return { render: () => (last = h.render(() => useSettingsDraft({ context, refresh: service.refresh || (async () => true) }))),
    context: next => { context = next }, value: () => last, unmount: h.unmount }
}
module.exports = { deferred, flush, configHarness }
