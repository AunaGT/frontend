const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { hookHarness } = require('./helpers/reportHookHarness.cjs')
const flush = () => new Promise(resolve => setImmediate(resolve))
test('settings endpoints pin captured headers and signal instead of following the current tenant', async () => {
  const calls = [], signal = new AbortController().signal, scope = { companyId: 'A', branchId: 'BA' }
  const s = loadReportModule('../../services/settingsService.ts', { './api': { apiFetch: async (...args) => { calls.push(args); return {} } } })
  await s.getSettings({ scope, signal }); await s.getPublicSettings({ scope, signal })
  await s.updateSettings({ order_validity_days: '12' }, { scope }); await s.removeCompanyLogo({ scope })
  assert.deepEqual(calls.map(([path]) => path), ['/settings', '/settings/public', '/settings', '/settings/logo'])
  for (const [, options] of calls) assert.deepEqual(options.headers, { 'X-Company-Id': 'A', 'X-Branch-Id': 'BA' })
  assert.equal(calls[0][1].signal, signal)
  assert.deepEqual(JSON.parse(calls[2][1].body), { settings: { order_validity_days: '12' } })
  await assert.rejects(s.updateSettings({}, { scope: { companyId: '', branchId: 'BA' } }))
  assert.equal(calls.length, 4)
})
test('logo upload preserves multipart cookies and the original tenant headers', async () => {
  const previous = global.fetch; let sent
  global.fetch = async (url, options) => { sent = { url, options }; return { ok: true, json: async () => ({ company_logo_url: 'https://logo.invalid/a.png' }) } }
  try {
    const s = loadReportModule('../../services/settingsService.ts', { './api': { getApiBaseUrl: () => 'https://api.invalid' } })
    const result = await s.uploadCompanyLogo(new Blob(['logo']), { scope: { companyId: 'A', branchId: 'BA' } })
    assert.equal(result.company_logo_url, 'https://logo.invalid/a.png')
    assert.equal(sent.options.credentials, 'include')
    assert.deepEqual(sent.options.headers, { 'X-Company-Id': 'A', 'X-Branch-Id': 'BA' })
    assert.ok(sent.options.body instanceof FormData)
  } finally { global.fetch = previous }
})
test('public refresh cannot publish an earlier company or user generation and reports failures', async () => {
  const h = hookHarness(), requests = []
  let companyId = 'A', userId = 'U'
  const { SystemSettingsProvider } = loadReportModule('../../context/SystemSettingsContext.tsx', {
    react: h.hooks,
    '@/context/useTenant': { useTenant: () => ({ company: { id: companyId }, branch: { id: 'B' + companyId } }) },
    './useTenant': { useTenant: () => ({ company: { id: companyId }, branch: { id: 'B' + companyId } }) },
    './useAuth': { useAuth: () => ({ user: { id: userId, permissions: [] }, isLoading: false }) },
    '@/services/settingsService': { getPublicSettings: options => new Promise((resolve, reject) => requests.push({ options, resolve, reject })) },
  })
  const render = () => h.render(() => SystemSettingsProvider({ children: null })).props.value
  render(); companyId = 'B'; render(); requests[1].resolve({ company_name: 'Empresa B', inventory_services_enabled: 'false' }); await flush()
  requests[0].resolve({ company_name: 'Empresa A', inventory_services_enabled: 'true' }); await flush()
  assert.equal(render().companyName, 'Empresa B')
  const pending = render().refetch(); userId = 'V'; render(); requests[2].resolve({ company_name: 'Viejo U' }); await flush()
  assert.equal(await pending, false); requests[3].resolve({ company_name: 'Usuario V', cash_closure_max_diff_pct: '0' }); await flush()
  assert.equal(render().companyName, 'Usuario V'); assert.equal(render().cashClosureMaxDiffPct, 0)
  const failed = render().refetch(); requests[4].reject(new Error('Offline')); assert.equal(await failed, false); assert.equal(render().error, true)
  assert.equal(requests[0].options.scope.companyId, 'A'); h.unmount()
})
