const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const { assertPaginationOutside } = require('./pagination-assertions.cjs')
const root = path.resolve(__dirname, '../src')

function loader(overrides = {}) {
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = new Module(file, module)
    cache.set(file, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(file))
    const native = mod.require.bind(mod)
    mod.require = dependency => {
      if (dependency.endsWith('.css')) return {}
      if (dependency in overrides) return typeof overrides[dependency] === 'function' ? overrides[dependency](file) : overrides[dependency]
      const local = dependency.startsWith('@/') ? path.join(root, dependency.slice(2)) : dependency.startsWith('.') ? path.resolve(path.dirname(file), dependency) : null
      if (!local) return native(dependency)
      const alias = '@/' + path.relative(root, local)
      if (alias in overrides) return overrides[alias]
      return load(['', '.tsx', '.ts', '.js', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()))
    }
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
    return mod.exports
  }
  return relative => load(path.join(root, relative))
}

const product = { id: 'archived', name: 'Agua de prueba', category: { id: 1, name: 'Bebidas' }, supplier: { id: 'supplier', name: 'Proveedor QA' }, status: { id: 1, name: 'Activo' }, brand: 'QA', size: '1 L', price: 5, cost: 2, stock: 3, min_stock: 0, barcode: '740000000001', image_url: '/product-test.png', deleted: true, deleted_at: '2026-10-01T12:00:00Z', kind: 'STANDARD', tracks_expiry: false, available_for_sale: true }
const response = { items: [product], page: 2, pageSize: 20, totalItems: 45, totalPages: 3, nextPage: 3, prevPage: 1, summary: { total: 45, forSale: 10, kits: 3, tracksExpiry: 7 } }

test('product adaptation tolerates missing optional catalog relations', () => {
  const load = loader({ '@/services/api': {} })
  const adapted = load('services/productService.ts').adaptApiProduct({ ...product, category: null, supplier: null, status: null })
  assert.equal(adapted.category, 'Sin categoría')
  assert.equal(adapted.supplier, '')
  assert.equal(adapted.supplierId, undefined)
  assert.equal(adapted.status, 'active')
})

test('archive query sends server pagination and deleted-only search without discarding the total', async () => {
  let query, url
  const load = loader({
    '@tanstack/react-query': { useQuery: options => { query = options; return options } },
    '@/services/api': { apiFetch: async value => { url = value; return response } },
  })
  load('hooks/useProducts.ts').useDeletedProducts({ page: 2, pageSize: 20, search: 'agua', category: 'Bebidas', includeSummary: true })
  const result = await query.queryFn()
  const params = new URL(url, 'http://test').searchParams
  assert.equal(params.get('deletedOnly'), 'true')
  assert.equal(params.get('includeDeleted'), null)
  assert.equal(params.get('page'), '2')
  assert.equal(params.get('pageSize'), '20')
  assert.equal(params.get('search'), 'agua')
  assert.equal(params.get('category'), 'Bebidas')
  assert.equal(params.get('includeSummary'), 'true')
  assert.equal(result.totalItems, 45)
  assert.equal(result.items[0].id, 'archived')
})

test('archive category options include deleted categories beyond the first hundred', async () => {
  let query
  const requests = []
  const load = loader({
    '@tanstack/react-query': { useQuery: options => { query = options; return options } },
    '@/services/api': { apiFetch: async url => {
      const params = new URL(url, 'http://test').searchParams
      requests.push(Object.fromEntries(params))
      return params.get('page') === '1'
        ? { items: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Categoría ${i + 1}`, deleted: false })), page: 1, pageSize: 100, totalItems: 101, totalPages: 2, nextPage: 2, prevPage: null }
        : { items: [{ id: 101, name: 'Categoría archivada', deleted: true }], page: 2, pageSize: 100, totalItems: 101, totalPages: 2, nextPage: null, prevPage: 1 }
    } },
  })
  load('hooks/useCategories.ts').useCategories({ includeDeleted: true, allPages: true })
  const categories = await query.queryFn()
  assert.equal(categories.length, 101)
  assert.equal(categories[100].name, 'Categoría archivada')
  assert.deepEqual(requests.map(params => [params.page, params.pageSize, params.includeDeleted]), [['1', '100', 'true'], ['2', '100', 'true']])
})

test('archive category options use a separate cache without changing existing catalog requests', async () => {
  let query, url
  const load = loader({
    '@tanstack/react-query': { useQuery: options => { query = options; return options } },
    '@/services/api': { apiFetch: async value => { url = value; return [{ id: 1, name: 'Activa' }] } },
  })
  const hook = load('hooks/useCategories.ts').useCategories
  hook()
  const defaultKey = query.queryKey
  assert.deepEqual(await query.queryFn(), [{ id: 1, name: 'Activa' }])
  assert.equal(url, '/api/catalogs/product-categories?page=1&pageSize=1000')
  hook({ includeDeleted: true, allPages: true })
  assert.notDeepEqual(query.queryKey, defaultKey)
})

function render({ data = response, isError = false, isLoading = false, permissions = ['products.edit'], selected = null, pending = false, failRestore = false } = {}) {
  let state = 0, dialog
  const writes = [], notifications = [], effects = [], pages = [], selections = []
  const load = loader({
    react: file => file.endsWith('DeletedProductsPage.tsx') ? { ...React, useState: initial => { const index = ++state; const pair = React.useState(index === 4 ? selected : initial); return index === 4 ? [pair[0], value => selections.push(value)] : pair }, useEffect: effect => effects.push(effect) } : React,
    '@/hooks/useProducts': { useDeletedProducts: () => ({ data, isError, isLoading, isFetching: pending, refetch() {} }), useRestoreProduct: () => ({ isPending: pending, mutateAsync: async id => { writes.push(id); if (failRestore) throw Error('Sin acceso a restaurar') } }) },
    '@/hooks/useCategories': { useCategories: () => ({ data: [{ id: 1, name: 'Bebidas' }] }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: (...codes) => codes.some(code => permissions.includes(code)) }) },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 2, pageSize: 20, setPage: value => pages.push(value), setPageSize() {} }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: value => notifications.push(value) }) },
    '@/components/shared/ConfirmDialog': { ConfirmDialog: props => { dialog = props; return null } },
    '@/services/api': { apiFetch() { throw Error('Unexpected network request') } },
  })
  const Page = load('modules/inventory/pages/DeletedProductsPage.tsx').default
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
  return { html, get dialog() { return dialog }, writes, notifications, effects, pages, selections }
}

test('returning to the archive preserves the persisted page until the search actually changes', async () => {
  const view = render()
  const cleanup = view.effects.map(effect => effect())
  await new Promise(resolve => setTimeout(resolve, 350))
  for (const fn of cleanup) if (typeof fn === 'function') fn()
  assert.deepEqual(view.pages, [])
})

test('archive presents complete filtered totals before compact filters and pages outside its sole table', () => {
  const { html } = render()
  assert.ok(html.indexOf('metric-strip') >= 0 && html.indexOf('metric-strip') < html.indexOf('compact-filter-toolbar'))
  assert.match(html, />45<\/strong>/)
  assert.match(html, />42<\/strong>/)
  assert.match(html, /Agua de prueba/)
  assert.match(html, /src="\/product-test.png"/)
  assert.match(html, /740000000001/)
  assert.match(html, /Mostrando 21 a 21 de 45/)
  assert.equal((html.match(/auna-data-table-shell/g) || []).length, 1)
  assertPaginationOutside(html)
})

test('archive restore action respects each backend permission, not the delete permission alone', () => {
  for (const code of ['products.edit', 'products.register_incoming']) assert.match(render({ permissions: [code] }).html, />Restaurar</)
  assert.doesNotMatch(render({ permissions: ['products.delete'] }).html, />Restaurar</)
})

test('archive errors offer retry without claiming zero results; an empty archive stays usable', () => {
  const error = render({ data: undefined, isError: true }).html
  assert.match(error, /Reintentar/)
  assert.doesNotMatch(error, /metric-strip|auna-data-table-pagination/)
  const empty = render({ data: { ...response, items: [], totalItems: 0, page: 1, totalPages: 1, summary: { total: 0, kits: 0, tracksExpiry: 0 } } }).html
  assert.match(empty, /No hay productos eliminados/)
  assert.match(empty, /compact-filter-toolbar/)
})

test('archive confirmation restores the selected id, preserves server error feedback and blocks pending closes', async () => {
  const success = render({ selected: { id: 'archived', name: 'Agua de prueba' } })
  await success.dialog.onConfirm()
  assert.deepEqual(success.writes, ['archived'])
  assert.equal(success.notifications[0].title, 'Producto restaurado')
  assert.deepEqual(success.selections, [null])
  const error = render({ selected: { id: 'archived', name: 'Agua de prueba' }, failRestore: true })
  await error.dialog.onConfirm()
  assert.equal(error.notifications[0].description, 'Sin acceso a restaurar')
  assert.equal(error.notifications[0].variant, 'destructive')
  assert.deepEqual(error.selections, [], 'An error keeps the selected product for retry')
  const pending = render({ selected: { id: 'archived', name: 'Agua de prueba' }, pending: true })
  assert.equal(pending.dialog.loading, true)
  assert.equal(pending.dialog.appearance, 'auna')
  pending.dialog.onOpenChange(false)
  assert.deepEqual(pending.selections, [], 'Closing cannot discard a pending restoration')
  await pending.dialog.onConfirm()
  assert.deepEqual(pending.writes, [])
})
