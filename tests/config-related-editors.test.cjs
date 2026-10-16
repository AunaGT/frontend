const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { hookHarness } = require('./helpers/reportHookHarness.cjs'), { deferred, flush } = require('./helpers/configHarness.cjs')
function relatedHarness(kind, service = {}) {
  const h = hookHarness(), nodes = [], calls = [], activity = [], toasts = []
  let companyId = 'A', userId = 'U', active = true, disabled = false
  const props = () => ({ canManage: true, active, disabled, onActivityChange: value => activity.push(value), canStartOperation: () => true })
  const refetch = service.refetch || (async () => ({})), cache = { invalidateQueries: service.invalidate || (async () => {}) }
  const component = loadReportModule(`../config/pages/${kind}.tsx`, {
    react: h.hooks, '@/context/useTenant': { useTenant: () => ({ company: { id: companyId }, branch: { id: 'B' + companyId } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: userId }, permissionsReady: true, hasPermission: () => true }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: value => toasts.push(value) }) },
    '@/services/api': { getActiveCompanyId: () => companyId, getActiveBranchId: () => 'B' + companyId },
    '@/context/useModules': { useModules: () => ({ modules: [{ code: 'inventory', name: 'Inventario', status: 'DISABLED', effectiveEnabled: false, protected: false, dependencies: [], blockedBy: [] }], refetch }) },
    '@tanstack/react-query': { useQuery: () => ({ data: { items: [] }, isPending: false }), useQueryClient: () => cache,
      useMutation: options => ({ isPending: false, mutate: () => options.mutationFn().then(options.onSuccess, options.onError) }) },
    '@/services/moduleService': { updateCompanyModule: (...args) => { calls.push(args); return service.write ? service.write(...args) : Promise.resolve({}) } },
    '@/services/hrService': { fetchHrDocumentTypes: async () => ({ items: [] }), createHrDocumentType: (...args) => { calls.push(args); return service.write ? service.write(...args) : Promise.resolve({ id: 'T', ...args[0] }) }, updateHrDocumentType() {} },
  }, nodes)[kind]
  const render = () => { nodes.length = 0; return h.render(() => component(props())) }
  return { render, nodes, calls, activity, toasts, unmount: h.unmount, context: (company, user = 'U') => { companyId = company; userId = user }, active: value => { active = value }, disabled: value => { disabled = value } }
}
test('module toggle reports pending synchronously, suppresses duplicate writes and late company success', async () => {
  const done = deferred(), h = relatedHarness('ModulesSettings', { write: () => done.promise })
  h.render(); const toggle = h.nodes.find(n => n.props['aria-label'] === 'Activar Inventario').props.onCheckedChange
  const pending = toggle(true); assert.equal(h.activity.at(-1)?.pending, true)
  await toggle(true); assert.equal(h.calls.length, 1)
  assert.deepEqual(h.calls[0][2].headers, { 'X-Company-Id': 'A', 'X-Branch-Id': 'BA' })
  h.context('B'); h.render(); h.context('A'); h.render(); done.resolve({}); await pending
  assert.equal(h.toasts.length, 0); h.unmount()
})
test('module confirmation followed by failed refresh reports saved status instead of retrying the write', async () => {
  const h = relatedHarness('ModulesSettings', { refetch: async () => { throw new Error('Refresh failed') } })
  h.render(); await h.nodes.find(n => n.props['aria-label'] === 'Activar Inventario').props.onCheckedChange(true)
  assert.equal(h.calls.length, 1); assert.match(h.toasts[0].title, /guardad/i); h.unmount()
})
test('HR draft survives hidden section and requires discard confirmation to close', () => {
  const h = relatedHarness('HrDocumentsSettings'); h.render()
  h.nodes.find(n => React.Children.toArray(n.props.children).includes('Añadir requisito')).props.onClick(); h.render()
  h.nodes.find(n => n.props.id === 'hr-type-name').props.onChange({ target: { value: 'Identificación QA' } }); h.render()
  assert.equal(h.activity.at(-1).dirty, true)
  h.active(false); h.render(); assert.equal(h.nodes.find(n => 'open' in n.props && 'onOpenChange' in n.props).props.open, false)
  h.active(true); h.render(); assert.equal(h.nodes.find(n => n.props.id === 'hr-type-name').props.value, 'Identificación QA')
  const dialog = h.nodes.find(n => 'open' in n.props && 'onOpenChange' in n.props); dialog.props.onOpenChange(false); h.render()
  assert.equal(h.nodes.find(n => 'open' in n.props && 'onOpenChange' in n.props).props.open, true)
  h.unmount()
})
test('HR save uses captured form and context and never closes or toasts after user changes', async () => {
  const done = deferred(), h = relatedHarness('HrDocumentsSettings', { write: () => done.promise }); h.render()
  h.nodes.find(n => React.Children.toArray(n.props.children).includes('Añadir requisito')).props.onClick(); h.render()
  h.nodes.find(n => n.props.id === 'hr-type-name').props.onChange({ target: { value: 'Identificación QA' } }); h.render()
  const pending = h.nodes.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(h.activity.at(-1).pending, true); assert.equal(h.calls[0][0].name, 'Identificación QA')
  assert.deepEqual(h.calls[0][1].headers, { 'X-Company-Id': 'A', 'X-Branch-Id': 'BA' })
  h.context('A', 'V'); h.render(); done.resolve({ id: 'T', name: 'Identificación QA' }); await pending; await flush()
  assert.equal(h.toasts.length, 0); h.unmount()
})
test('HR save distinguishes persisted data from failed refetch using real QueryClient semantics', async () => {
  const { QueryClient, QueryObserver } = require('@tanstack/react-query')
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const queryKey = ['hr-document-types', 'A', 'administrative', 'U']
  cache.setQueryData(queryKey, { items: [] })
  const observer = new QueryObserver(cache, { queryKey, staleTime: Infinity, queryFn: async () => { throw new Error('List refresh failed') } })
  const unsubscribe = observer.subscribe(() => {})
  const h = relatedHarness('HrDocumentsSettings', { invalidate: (...args) => cache.invalidateQueries(...args) })
  try {
    h.render(); h.nodes.find(n => React.Children.toArray(n.props.children).includes('Añadir requisito')).props.onClick(); h.render()
    h.nodes.find(n => n.props.id === 'hr-type-name').props.onChange({ target: { value: 'Identificación QA' } }); h.render()
    await h.nodes.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
    assert.equal(h.calls.length, 1); assert.equal(cache.getQueryState(queryKey).status, 'error')
    assert.match(h.toasts[0].title, /guardado; no se pudo actualizar la lista/i)
  } finally { h.unmount(); unsubscribe(); cache.clear() }
})
test('settings permission cannot grant access to other modules or their disabled routes', () => {
  const nodes = []
  const { SettingsRelatedLinks } = loadReportModule('../config/components/SettingsRelatedLinks.tsx', {
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: (...codes) => codes.includes('settings.manage') }) },
    '@/context/useModules': { useModules: () => ({ isLoading: false, isError: false, enabledModuleCodes: new Set(['appointments', 'inventory', 'accounting', 'catalogs', 'users']) }) },
  }, nodes)
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(SettingsRelatedLinks, { confirmLeave() {} })))
  assert.doesNotMatch(html, /href="\/(agenda|inventario|contabilidad|datos-maestros|usuarios)/)
})
