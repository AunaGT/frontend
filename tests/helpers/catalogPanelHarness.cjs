const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./loadReportModule.cjs'), { hookHarness } = require('./reportHookHarness.cjs')
function textOf(value) {
  return React.Children.toArray(value).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : React.isValidElement(child) ? textOf(child.props.children) : '').join('')
}
function containsId(value, id) {
  return React.Children.toArray(value).some(child => React.isValidElement(child) && (child.props.id === id || containsId(child.props.children, id)))
}
function catalogPanelHarness(kind, { legacy = false, manage = true, items, failWrite = false } = {}) {
  const h = hookHarness(), nodes = [], queries = [], writes = [], navigations = [], toasts = []
  const rows = items || (kind === 'categories' ? [{ id: 4, name: 'Bebidas', image_url: 'https://example.invalid/category.png', deleted: false, _count: { products: 9, suppliers: 3 } }] : [{ id: 6, name: 'Contado', net_days: 0, deleted: false, _count: { supplier_payment_terms: 5 } }, { id: 7, name: 'Sin plazo', net_days: null, deleted: true, _count: { suppliers: 2 } }])
  const response = { items: rows, page: 1, pageSize: 10, totalItems: 21, totalPages: 3, nextPage: 2, prevPage: null, summary: { total: 21, active: 20, deleted: 1, immediate: 4, credit: 10, unspecified: 7 } }
  const mutation = operation => ({ isPending: false, mutateAsync: async payload => { writes.push([operation, payload]); if (failWrite) throw Error('Error de prueba'); return { id: 15, ...payload } } })
  const hooks = prefix => ({
    [`use${prefix}s`]: query => { queries.push(query); return { data: response, isLoading: false, isFetching: false } },
    [`useCreate${prefix}`]: () => mutation('create'), [`useUpdate${prefix}`]: () => mutation('update'),
    [`useDelete${prefix}`]: () => mutation('delete'), [`useRestore${prefix}`]: () => mutation('restore'),
  })
  const mocks = { react: h.hooks,
    'react-router-dom': { ...require('react-router-dom'), useNavigate: () => target => navigations.push(target) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'U' }, permissionsReady: true, hasPermission: () => manage }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: value => toasts.push(value) }) },
    '@/hooks/usePaymentTerms': hooks('PaymentTerm'), '@/hooks/useProductCategories': hooks('ProductCategory'),
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 10, setPage() {} }), useResetPageOnFilterChange() {} },
    '@/services/api': { getApiBaseUrl: () => 'https://api.invalid' },
  }
  mocks['./api'] = mocks['../services/api'] = mocks['@/services/api']
  const searchMock = { useCatalogSearch: () => { const [search, setSearch] = h.hooks.useState(''); return { search, setSearch, query: search.trim() } } }
  mocks['../components/useCatalogSearch'] = mocks['./useCatalogSearch'] = searchMock
  // The category hook has an irregular English plural.
  mocks['@/hooks/useProductCategories'].useProductCategories = mocks['@/hooks/useProductCategories'].useProductCategorys
  const file = legacy ? '../catalogs/pages/CatalogsManagement.tsx' : `../catalogs/components/${kind === 'categories' ? 'ProductCategoriesPanel' : 'PaymentTermsPanel'}.tsx`
  const exports = loadReportModule(file, mocks, nodes), Component = legacy ? exports.CatalogsManagement : exports[kind === 'categories' ? 'ProductCategoriesPanel' : 'PaymentTermsPanel']
  const render = () => h.render(() => { nodes.length = 0; return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [`/datos-maestros?tab=${kind}`] }, React.createElement(Component))) })
  const button = name => nodes.find(node => typeof node.props.onClick === 'function' && textOf(node.props.children) === name)
  const input = id => nodes.find(node => node.props.id === id && typeof node.props.onChange === 'function')
  const submit = id => nodes.find(node => node.type === 'form' && containsId(node.props.children, id)).props.onSubmit({ preventDefault() {} })
  return { render, nodes, queries, writes, navigations, toasts, button, input, submit, unmount: h.unmount }
}
module.exports = { catalogPanelHarness, textOf }
