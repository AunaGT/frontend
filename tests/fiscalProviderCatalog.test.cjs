const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { hookHarness } = require('./helpers/reportHookHarness.cjs')
const scope = { companyId: 'company', branchId: 'branch', userId: 'user', sessionId: 'session' }
const catalog = { selectedProvider: null, revision: 0, providers: [{ id: 'INFILE', name: 'Infile', mode: 'OFFLINE', externalSendingAllowed: false }], externalSendingAllowed: false }
const tick = () => new Promise(resolve => setImmediate(resolve))
test('provider choice uses the saved revision, ignores double clicks and never enables emission', async () => {
  const harness = hookHarness(), writes = []; let finish
  const { useProviderCatalog } = loadReportModule('../config/connectors/useProviderCatalog.ts', { react: harness.hooks, './api': {
    readProviderCatalog: async () => catalog,
    selectProvider: (...args) => { writes.push(args); return new Promise(resolve => { finish = resolve }) },
  } })
  const render = () => harness.render(() => useProviderCatalog(scope))
  render(); await tick(); let state = render()
  const pending = state.choose('INFILE'); assert.equal(await state.choose('INFILE'), false)
  assert.equal(render().data.selectedProvider, null)
  assert.deepEqual(writes[0][1], { provider: 'INFILE', expectedRevision: 0 })
  finish({ ...catalog, selectedProvider: 'INFILE', revision: 1 }); assert.equal(await pending, true)
  state = render(); assert.equal(state.data.selectedProvider, 'INFILE'); assert.equal(state.data.externalSendingAllowed, false)
  harness.unmount()
})
test('scope changes abort both reads and writes and discard obsolete results', async () => {
  const harness = hookHarness(), loads = [], writes = []
  const { useProviderCatalog } = loadReportModule('../config/connectors/useProviderCatalog.ts', { react: harness.hooks, './api': {
    readProviderCatalog: (...args) => new Promise(resolve => loads.push({ args, resolve })),
    selectProvider: (...args) => new Promise(resolve => writes.push({ args, resolve })),
  } })
  const render = value => harness.render(() => useProviderCatalog(value))
  render(scope); loads[0].resolve(catalog); await tick()
  const pending = render(scope).choose('INFILE')
  const other = { ...scope, sessionId: 'new-session' }; render(other)
  assert.equal(writes[0].args[2].aborted, true)
  writes[0].resolve({ ...catalog, selectedProvider: 'INFILE', revision: 1 }); assert.equal(await pending, false)
  assert.equal(render(other).data, null)
  loads[1].resolve(catalog); await tick(); assert.equal(render(other).data.selectedProvider, null)
  harness.unmount()
})
test('failed selection is not optimistic and arbitrary server text is never rendered', async () => {
  const harness = hookHarness()
  const { useProviderCatalog } = loadReportModule('../config/connectors/useProviderCatalog.ts', { react: harness.hooks, './api': {
    readProviderCatalog: async () => catalog,
    selectProvider: async () => { throw Object.assign(new Error('secret must not render'), { data: { code: 'FISCAL_PROVIDER_STALE' } }) },
  } })
  const render = () => harness.render(() => useProviderCatalog(scope))
  render(); await tick(); assert.equal(await render().choose('INFILE'), false)
  assert.equal(render().data.selectedProvider, null); assert.match(render().error, /Recarga/); assert.doesNotMatch(render().error, /secret/)
  harness.unmount()
})
test('company-wide catalog API checks scope before and after and uses private local routes', async () => {
  let company = scope.companyId; const calls = []
  const { readProviderCatalog, selectProvider } = loadReportModule('../config/connectors/api.ts', {
    '@/services/api': { getActiveCompanyId: () => company, getActiveBranchId: () => scope.branchId, apiFetch: async (url, options) => { calls.push({ url, options }); return catalog } },
    '@/services/authSession': { authSessionIdentity: () => scope.sessionId, authSessionMatches: () => true },
  })
  await readProviderCatalog(scope)
  await selectProvider(scope, { provider: 'INFILE', expectedRevision: 0 })
  assert.deepEqual(calls.map(x => x.url), ['/settings/connectors', '/settings/connectors/selection'])
  assert.equal(calls[1].options.method, 'PUT'); assert.equal(calls[0].options.cache, 'no-store')
  assert.equal(calls[1].options.headers['X-Company-Id'], scope.companyId)
  company = 'other'; await assert.rejects(readProviderCatalog(scope), { name: 'AbortError' }); assert.equal(calls.length, 2)
})
function view({ selected = null, canManage = true, branchId = 'branch', accepted = true } = {}) {
  const harness = hookHarness(), nodes = [], writes = [], prompts = []
  const { ConnectorCatalog } = loadReportModule('../config/pages/ConnectorCatalog.tsx', {
    react: harness.hooks,
    '../connectors/useProviderCatalog': { useProviderCatalog: () => ({ data: { ...catalog, selectedProvider: selected }, loading: false, pending: false, error: '', choose: async value => { writes.push(value); return true }, reload() {} }) },
    '../documentTemplates/TemplateSettingsLayout': { TemplateSettingsLayout: () => null },
    '../documentTemplates/useTemplateConfirmation': { useTemplateConfirmation: () => ({ dialog: null, confirm: async prompt => { prompts.push(prompt); return accepted } }) },
    './InfileConnection': { InfileConnection: () => null },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
  }, nodes)
  const render=()=>{nodes.length=0;harness.render(() => ConnectorCatalog({ scope: { ...scope, branchId }, canManage, canTest: true, registerGuard() {}, companyName: 'Empresa', environment: 'TEST', onEnvironment() {} }))}
  render()
  const button = label => nodes.findLast(node => node.props.children === label)
  return { harness, nodes, writes, prompts, button, render }
}
test('catalog has one official-logo card, no custom provider and configuration behind selection', async () => {
  const v = view()
  assert.ok(v.nodes.some(node => node.type === 'img' && node.props.src === '/connectors/infile.svg' && node.props.alt === 'Infile'))
  assert.equal(v.button('Configurar'), undefined)
  assert.ok(!v.nodes.some(node => /Personalizado|Próximamente/.test(String(node.props.children))))
  await v.button('Activar Infile').props.onClick(); assert.deepEqual(v.writes, ['INFILE'])
  v.harness.unmount()
})
test('deactivating asks the system confirmation and cancellation leaves data untouched', async () => {
  const v = view({ selected: 'INFILE', accepted: false })
  assert.ok(v.button('Configurar'))
  await v.button('Desactivar').props.onClick()
  assert.deepEqual(v.writes, []); assert.match(v.prompts[0].description, /conservarán/)
  v.harness.unmount()
  const active = view({ selected: 'INFILE' }); await active.button('Desactivar').props.onClick(); assert.deepEqual(active.writes, [null]); active.harness.unmount()
})
test('selected provider configuration opens its form without activating or sending anything',()=>{
  const v=view({selected:'INFILE'})
  try{
    v.button('Configurar').props.onClick();v.render()
    assert.ok(v.nodes.some(n=>n.type?.name==='InfileConnection'))
    assert.deepEqual(v.writes,[]);assert.deepEqual(v.prompts,[])
  }finally{v.harness.unmount()}
})
test('activation is confirmed as provider selection only and cancellation makes no write', async () => {
  const v = view({ accepted: false })
  await v.button('Activar Infile').props.onClick()
  assert.deepEqual(v.writes, [])
  assert.match(v.prompts[0].description, /no habilita la emisión FEL/)
  v.harness.unmount()
})
test('read-only, consolidated and other-selected-provider states cannot activate Infile', () => {
  for (const options of [{ canManage: false }, { branchId: 'all' }, { selected: 'OTHER' }]) {
    const v = view(options); assert.equal(v.button('Activar Infile').props.disabled, true); v.harness.unmount()
  }
})
