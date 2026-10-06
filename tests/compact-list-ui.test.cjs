const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const cache = new Map()
const overrides = new Map()
test('native selectors used across modules are styled on direct entry without loading Merchandise', async () => {
  // Compile the always-loaded stylesheet, not a lazy module's CSS.
  const css = fs.readFileSync(path.join(__dirname, '../src/index.css'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '../src/components/ui/form-controls.css'), 'utf8')
  const config = load(path.join(__dirname, '../tailwind.config.ts')).default
  const result = await require('postcss')([require('tailwindcss')({ ...config, content: [{ raw: '<select class="auna-receipt-select h-10"></select>', extension: 'html' }] })]).process(css, { from: undefined })
  const declarations = new Map()
  result.root.walkRules(rule => {
    const selectors = require('postcss-selector-parser')().astSync(rule.selector).nodes.map(selector => selector.toString().trim())
    if (selectors.includes('.auna-receipt-select') || rule.selector.startsWith(':where(.auna-control')) rule.walkDecls(d => declarations.set(d.prop, d.value))
  })
  assert.equal(declarations.get('height'), 'var(--auna-control-height)', 'The selector must have the same control height as Input')
  assert.equal(declarations.get('width'), '100%', 'Modal selectors must fill their field column')
  assert.equal(declarations.get('display'), 'block', 'The selector must sit below its field label')
  assert.ok(declarations.get('border'), 'The selector must have a visible themed border')
  assert.ok(declarations.get('background')?.includes('--auna-control-bg'), 'The selector must follow the shared control theme')
  assert.ok(declarations.get('color')?.includes('--auna-control-fg'), 'The selector must follow the shared control text color')
  assert.ok(declarations.get('border-radius'), 'The selector must use the shared rounded control style')
})
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file, module)
  cache.set(file, mod)
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  const nativeRequire = mod.require.bind(mod)
  mod.require = name => {
    if (overrides.has(name)) return overrides.get(name)
    if (name.endsWith('.css')) return {}
    const local = name.startsWith('@/') ? path.join(__dirname, '../src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    if (!local) return nativeRequire(name)
    const resolved = ['', '.tsx', '.ts', '.js', '/index.tsx', '/index.ts', '/index.js'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile())
    return load(resolved)
  }
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } })
  assert.equal(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `Syntax error in ${file}`)
  mod._compile(compiled.outputText, file)
  return mod.exports
}
test('stock movements opens with the history table and compact filters, not operation forms', () => {
  overrides.set('@/services/api', { apiFetch: () => { throw new Error('No remote calls in layout tests') } })
  overrides.set('./api', { apiFetch: () => { throw new Error('No remote calls in layout tests') } })
  overrides.set('@/hooks/useExperienceProfile', { useExperienceProfile: () => ({ showAdvancedByDefault: false }) })
  overrides.set('@tanstack/react-query', {
    useQuery: options => ({ data: options.queryKey[0] === 'stock-moves' ? { items: [{ id: 'm1', created_at: '2026-10-06T12:00:00Z', qty: -2, balance: 7, reason: 'SALE', product: { id: 'p1', name: 'Botella', barcode: '123' }, location: { id: 'l1', code: 'GENERAL', warehouse: { id: 'w1', name: 'Bodega' } }, createdBy: { name: 'Ana' } }], page: 1, totalPages: 14, totalItems: 105 } : [], isLoading: false, isFetching: false }),
    useMutation: () => ({ isPending: false }), useQueryClient: () => ({}),
  })
  overrides.set('@/context/useTenant', { useTenant: () => ({ branch: { id: 'b1', name: 'Central' } }) })
  overrides.set('@/hooks/useAuthPermissions', { useAuthPermissions: () => ({ hasPermission: () => true }) })
  overrides.set('@/hooks/use-toast', { useToast: () => ({ toast: () => {} }) })
  overrides.set('@/hooks/useSystemSettings', { useSystemSettings: () => ({ locale: 'es-GT', timezone: 'America/Guatemala' }) })
  const { default: StockMovesPage } = load(path.join(__dirname, '../src/modules/inventory/stock/StockMovesPage.tsx'))
  const html = renderToStaticMarkup(React.createElement(StockMovesPage))
  assert.match(html, /aria-label="Buscar movimientos"/)
  assert.match(html, /aria-label="Filtros de movimientos"/)
  assert.match(html, /<table/)
  assert.match(html, /Botella/)
  assert.match(html, /105 movimientos/)
  assert.match(html, /aria-label="Paginación de movimientos"/)
  assert.doesNotMatch(html, /id="move-notes"|id="adjust-notes"|Ver historial/)
})
test('the shared product picker scopes inventory searches to the selected origin without sale-only filtering', async () => {
  let options, request
  cache.delete(path.join(__dirname, '../src/components/shared/ProductPicker.tsx'))
  overrides.set('@tanstack/react-query', { useInfiniteQuery: value => { options = value; return { data: undefined } } })
  overrides.set('@/services/productService', { fetchProducts: async value => { request = value; return { items: [] } }, adaptApiProduct: value => value })
  const { ProductPicker } = load(path.join(__dirname, '../src/components/shared/ProductPicker.tsx'))
  renderToStaticMarkup(React.createElement(ProductPicker, { branchId: 'b1', inventory: true, locationId: 'origin-a', money: String, onPick: () => {} }))
  await options.queryFn({ pageParam: 2 })
  assert.equal(request.forSaleOnly, false)
  assert.equal(request.locationId, 'origin-a')
  assert.equal(request.inBranchOnly, true)
  assert.equal(request.page, 2)
  assert.ok(options.queryKey.includes('origin-a'))
  renderToStaticMarkup(React.createElement(ProductPicker, { branchId: 'b1', money: String, onPick: () => {} }))
  await options.queryFn({ pageParam: 1 })
  assert.equal(request.forSaleOnly, true)
  assert.equal(request.locationId, undefined)
  overrides.delete('@/services/productService')
  cache.delete(path.join(__dirname, '../src/components/shared/ProductPicker.tsx'))
})
test('stock operation forms preserve quantity signs and discard drafts when origin changes', async () => {
  const file = path.join(__dirname, '../src/modules/inventory/stock/StockOperationDialog.tsx')
  const names = ['react', '@tanstack/react-query', '@/services/stockMoveService']
  const previous = names.map(name => overrides.get(name))
  let states, index, job, request
  overrides.set('react', { ...React, useState: initial => {
    const slot = index++
    if (states[slot] === undefined) states[slot] = initial
    return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }]
  } })
  overrides.set('@tanstack/react-query', { useMutation: options => ({ isPending: false, mutate: () => { job = options.mutationFn() } }), useQueryClient: () => ({ invalidateQueries: () => {} }) })
  overrides.set('@/services/stockMoveService', { createStockMove: async payload => { request = ['move', payload] }, createAdjustment: async payload => { request = ['adjust', payload] } })
  cache.delete(file)
  try {
    const { StockOperationDialog } = load(file)
    const render = task => { index = 0; return StockOperationDialog({ task, branchId: 'b1', locations: [{ id: 'l1', label: 'Origen' }, { id: 'l2', label: 'Destino' }], onClose: () => {} }) }
    for (const [task, kind, qty] of [['move', 'LOSS', 2], ['adjust', 'LOSS', -2], ['adjust', 'SURPLUS', 2]]) {
      states = ['l1', 'l2', kind, ' motivo ', [{ product_id: 'p1', name: 'Botella', qty: 2, stock: 7 }], '']
      request = undefined; job = undefined
      const form = render(task)
      form.props.onSubmit()
      await job
      assert.deepEqual(request, task === 'move' ? ['move', { from_location_id: 'l1', to_location_id: 'l2', lines: [{ product_id: 'p1', qty }], notes: 'motivo' }] : ['adjust', { location_id: 'l1', lines: [{ product_id: 'p1', qty }], notes: 'motivo' }])
    }
    for (const [qty, stock, note] of [[0, 7, 'motivo'], [1.5, 7, 'motivo'], [8, 7, 'motivo'], [2, 7, ' ']]) {
      states = ['l1', '', 'LOSS', note, [{ product_id: 'p1', name: 'Botella', qty, stock }], '']
      request = undefined; job = undefined
      render('adjust').props.onSubmit()
      assert.equal(job, undefined)
      assert.equal(request, undefined)
      assert.ok(states[5], 'Invalid operation must explain why it was not sent')
    }
    states = ['l1', 'l2', 'LOSS', '', [{ product_id: 'p1', name: 'Botella', qty: 2 }], '']
    const form = render('move')
    function find(node, id) {
      if (!node || typeof node !== 'object') return undefined
      if (node.props?.id === id) return node
      for (const child of React.Children.toArray(node.props?.children)) { const found = find(child, id); if (found) return found }
    }
    find(form, 'operation-origin').props.onChange({ target: { value: 'l2' } })
    assert.deepEqual(states[4], [])
    assert.equal(states[1], '')
  } finally {
    names.forEach((name, i) => previous[i] === undefined ? overrides.delete(name) : overrides.set(name, previous[i]))
    cache.delete(file)
  }
})
test('the shared detail-tab styling applies the active underline to the selected button, not the tablist', async () => {
  const { Tabs, TabsList, TabsTrigger } = load(path.join(__dirname, '../src/components/ui/tabs.tsx'))
  const html = renderToStaticMarkup(React.createElement(Tabs, { defaultValue: 'lots' },
    React.createElement(TabsList, { variant: 'detail' }, React.createElement(TabsTrigger, { value: 'lots' }, 'Lotes'))))
  const raw = html.replaceAll('&amp;', '&').replaceAll('&gt;', '>').replaceAll('&lt;', '<')
  const result = await require('postcss')([require('tailwindcss')({ content: [{ raw, extension: 'html' }], corePlugins: { preflight: false } })]).process('@tailwind utilities;', { from: undefined })
  const properties = new Set()
  result.root.walkRules(rule => {
    if (/>\s*button\[data-state=["']?active["']?\]$/.test(rule.selector)) rule.walkDecls(declaration => properties.add(declaration.prop))
  })
  assert.ok(properties.has('border-color'), 'The underline must target the active tab button')
  assert.ok(properties.has('color'), 'The label color must target the active tab button')
  assert.ok(properties.has('background-color'), 'The active tab must keep its transparent surface')
})
test('filters stay compact with active conditions and keep search visible', () => {
  const { CompactFilterPanel } = load(path.join(__dirname, '../src/components/shared/CompactFilterPanel.tsx'))
  const html = renderToStaticMarkup(React.createElement(CompactFilterPanel, {
    title: 'Filtros de usuarios', activeCount: 3,
    appliedFilters: [{ label: 'Estado: Bloqueado', onRemove: () => {} }],
    onApply: () => {}, applyDisabled: true,
    search: React.createElement('input', { 'aria-label': 'Buscar usuarios' }),
  }, React.createElement('input', { 'aria-label': 'Filtro avanzado de prueba' })))
  assert.match(html, /aria-label="Buscar usuarios"/)
  assert.match(html, /aria-haspopup="dialog"/)
  assert.match(html, /aria-label="Quitar Estado: Bloqueado"/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Aplicar<\/button>/)
  assert.doesNotMatch(html, /aria-label="Filtro avanzado de prueba"/)
})
test('metric strip preserves values and real filter actions without decorative icons', () => {
  const { MetricStrip } = load(path.join(__dirname, '../src/components/shared/MetricStrip.tsx'))
  const html = renderToStaticMarkup(React.createElement(MetricStrip, { label: 'Resumen de cartera', items: [
    { label: 'Por cobrar', value: 'Q 830.50' },
    { label: 'Vencido', value: 'Q 0.00', onClick: () => {}, active: true },
  ] }))
  assert.match(html, /Q 830.50/)
  assert.match(html, /Q 0.00/)
  assert.match(html, /aria-pressed="true"/)
  assert.match(html, /<button/)
  assert.doesNotMatch(html, /<svg/)
})

test('Sucursales and Almacenes keep only search and the filter trigger visible initially', () => {
  // Isolate remote data/auth hooks, not the rendered page or shared controls.
  overrides.set('@tanstack/react-query', { useQuery: options => ({ data: ['hr-employees', 'hr-advances'].includes(options.queryKey[0]) ? { items: [], page: 1, totalPages: 1, totalItems: 0 } : [], isLoading: false }), useInfiniteQuery: () => ({}), useMutation: () => ({ isPending: false }), useQueryClient: () => ({}) })
  overrides.set('@/context/useTenant', { useTenant: () => ({ company: { id: 'company', name: 'Empresa de prueba' }, companies: [{ id: 'company', name: 'Empresa de prueba' }], branches: [], branch: { company_id: 'company' }, setCompany: () => {} }) })
  overrides.set('@/context/useAuth', { useAuth: () => ({ refreshUser: () => {} }) })
  overrides.set('@/hooks/useAuthPermissions', { useAuthPermissions: () => ({ hasPermission: () => false }) })
  overrides.set('@/hooks/use-toast', { useToast: () => ({ toast: () => {} }) })
  overrides.set('@/services/tenantService', {})
  overrides.set('@/services/warehouseService', {})
  const { default: BranchesManagement } = load(path.join(__dirname, '../src/modules/branches/pages/BranchesManagement.tsx'))
  const { WarehousesCard } = load(path.join(__dirname, '../src/modules/branches/pages/WarehousesCard.tsx'))
  for (const [Component, props, search, hidden] of [
    [BranchesManagement, {}, 'Buscar sucursales', 'Estado de sucursal'],
    [WarehousesCard, { canManage: false, branches: [] }, 'Buscar almacenes', 'Filtrar por sucursal'],
  ]) {
    const html = renderToStaticMarkup(React.createElement(Component, props))
    assert.match(html, new RegExp(`aria-label="${search}"`))
    assert.match(html, /aria-haspopup="dialog"/)
    assert.doesNotMatch(html, new RegExp(`<select[^>]*aria-label="${hidden}"`))
  }
})

test('Mercancía and Empleados keep advanced filters out of the initial layout', () => {
  overrides.set('react-router-dom', { ...require('react-router-dom'), useNavigate: () => () => {} })
  overrides.set('@/hooks/useAuthPermissions', { useAuthPermissions: () => ({ hasPermission: permission => permission === 'merchandise.view' }) })
  overrides.set('@/hooks/useSystemSettings', { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala' }) })
  overrides.set('@/hooks/usePersistedListUiState', { usePersistedListUiState: () => ({ page: 1, pageSize: 10, viewMode: 'table', setPage: () => {}, setPageSize: () => {}, setViewMode: () => {} }), useResetPageOnFilterChange: () => {} })
  overrides.set('../hooks/useIncomingMerchandise', { useIncomingMerchandise: () => ({ data: { items: [], totalItems: 0, totalPages: 1 } }) })
  overrides.set('../api/incomingMerchandiseService', {})
  overrides.set('@/services/hrService', { EMPLOYEE_STATUS_LABELS: { ACTIVO: 'Activo', SUSPENDIDO: 'Suspendido', BAJA: 'Baja' }, ADVANCE_STATUS_LABELS: { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', CANCELADO: 'Cancelado' } })
  overrides.set('@/services/contactsService', {})
  overrides.set('@/services/supplierService', {})
  const { default: Merchandise } = load(path.join(__dirname, '../src/modules/merchandise/pages/IncomingMerchandiseManagement.tsx'))
  const { default: Employees } = load(path.join(__dirname, '../src/modules/hr/pages/EmployeesManagement.tsx'))
  for (const [Component, search, hidden] of [[Merchandise, 'merch-search', 'merch-state'], [Employees, 'hr-search', 'hr-position-filter']]) {
    const html = renderToStaticMarkup(React.createElement(Component))
    assert.match(html, new RegExp(`id="${search}"`))
    assert.match(html, /aria-haspopup="dialog"/)
    assert.doesNotMatch(html, new RegExp(`id="${hidden}"`))
  }
})

test('Nómina and Anticipos use the same closed floating filter pattern', () => {
  overrides.set('../api/payrollService', { PAYROLL_STATUS_LABELS: { BORRADOR: 'Borrador' }, PAYROLL_TYPE_LABELS: { ORDINARIA: 'Ordinaria' } })
  const { default: Payroll } = load(path.join(__dirname, '../src/modules/payroll/pages/PayrollRunsManagement.tsx'))
  const { AdvancesManagement } = load(path.join(__dirname, '../src/modules/hr/pages/AdvancesManagement.tsx'))
  for (const [Component, title] of [[Payroll, 'Filtros de nómina'], [AdvancesManagement, 'Filtros de anticipos']]) {
    const html = renderToStaticMarkup(React.createElement(Component))
    assert.match(html, new RegExp(`aria-label="${title}"`))
    assert.match(html, /aria-haspopup="dialog"/)
  }
})

test('Ventas and Datos maestros do not expose advanced controls until requested', () => {
  const { SalesFilters } = load(path.join(__dirname, '../src/modules/sales/components/SalesFilters.tsx'))
  const { CatalogFilters } = load(path.join(__dirname, '../src/modules/catalogs/components/CatalogFilters.tsx'))
  const sales = renderToStaticMarkup(React.createElement(SalesFilters, { searchTerm: '', onSearchChange: () => {}, statusFilter: 'all', onStatusChange: () => {}, paymentFilter: 'all', onPaymentChange: () => {} }))
  assert.match(sales, /aria-haspopup="dialog"/)
  assert.doesNotMatch(sales, /role="combobox"/)
  const shortSearch = renderToStaticMarkup(React.createElement(SalesFilters, { searchTerm: 'ab', onSearchChange: () => {}, statusFilter: 'all', onStatusChange: () => {}, paymentFilter: 'all', onPaymentChange: () => {}, isGlobalSearch: false, searchHint: 'Escribe al menos 3 caracteres' }))
  assert.match(shortSearch, /Escribe al menos 3 caracteres/)
  assert.doesNotMatch(shortSearch, /aria-label="Quitar Búsqueda: ab"/)
  const catalog = renderToStaticMarkup(React.createElement(CatalogFilters, { search: '', onSearch: () => {}, order: 'asc', onOrder: () => {} }))
  assert.match(catalog, /aria-label="Buscar en el catálogo"/)
  assert.match(catalog, /aria-haspopup="dialog"/)
  assert.doesNotMatch(catalog, /<select/)
  const boxes = renderToStaticMarkup(React.createElement(CatalogFilters, { search: '', onSearch: () => {}, order: 'asc', onOrder: () => {}, extraFilters: [{ label: 'Estado: Activas', onRemove: () => {} }] }, React.createElement('select', { 'aria-label': 'Estado de caja' })))
  assert.match(boxes, /aria-label="Quitar Estado: Activas"/)
  assert.doesNotMatch(boxes, /<select/)
})

test('Promociones and Diario also start with their advanced filters closed', () => {
  overrides.set('@/services/api', { apiFetch: () => { throw new Error('No remote calls in layout tests') } })
  overrides.set('./PromotionsManagement', { CodesDialog: () => null })
  overrides.set('@/services/accountingService', {})
  const { default: Promotions } = load(path.join(__dirname, '../src/modules/promotions/pages/PromotionsListPage.tsx'))
  const { JournalTab } = load(path.join(__dirname, '../src/modules/accounting/components/JournalTab.tsx'))
  for (const [Component, props] of [[Promotions, {}], [JournalTab, { accounts: [], canCreate: false, canManage: false, onRefreshAccounts: () => {} }]]) {
    const html = renderToStaticMarkup(React.createElement(Component, props))
    assert.match(html, /aria-haspopup="dialog"/)
    assert.doesNotMatch(html, /role="combobox"/)
  }
})

test('accounting keeps the queried period and primary account visible with filters closed', () => {
  const { LedgerTab } = load(path.join(__dirname, '../src/modules/accounting/components/LedgerTab.tsx'))
  const { TrialBalanceTab } = load(path.join(__dirname, '../src/modules/accounting/components/TrialBalanceTab.tsx'))
  const { StatementsTab } = load(path.join(__dirname, '../src/modules/accounting/components/StatementsTab.tsx'))
  for (const [Component, props, visibleDates] of [[LedgerTab, { accounts: [] }, 0], [TrialBalanceTab, {}, 0], [StatementsTab, {}, 1]]) {
    const html = renderToStaticMarkup(React.createElement(Component, props))
    assert.match(html, /Período:/)
    assert.match(html, /aria-haspopup="dialog"/)
    assert.equal((html.match(/type="date"/g) || []).length, visibleDates)
    if (Component === LedgerTab) assert.match(html, /aria-label="Cuenta del mayor"/)
  }
})

test('cash history keeps page size visible but no advanced filter row for sellers', () => {
  let isSeller = false
  overrides.set('./hooks', { useCashClosureForm: () => ({ isSeller }), useCashClosureAPI: () => ({ closures: [], isLoadingClosures: false, currentPage: 1, totalPages: 1, pageSize: 10, fetchClosures: () => {}, setPageSize: () => {} }), useMineClosureGate: () => ({ gate: { loading: false } }), canRegisterMineClosure: () => false, mineClosureBlockedHint: () => '' })
  overrides.set('./CashClosureCreatePage', { CASH_CLOSURE_CREATE_PATH: '/cierre-caja/nuevo' })
  overrides.set('@/hooks/useAuthPermissions', { useAuthPermissions: () => ({ hasPermission: permission => permission === 'cashclosure.view' }) })
  const { default: CashClosure } = load(path.join(__dirname, '../src/modules/cash-closure/CashClosureManagement.tsx'))
  const html = renderToStaticMarkup(React.createElement(CashClosure))
  assert.match(html, /aria-label="Filtros de cierres"/)
  assert.equal((html.match(/role="combobox"/g) || []).length, 1)
  assert.doesNotMatch(html, /type="date"/)
  isSeller = true
  const seller = renderToStaticMarkup(React.createElement(CashClosure))
  assert.match(seller, /Último cierre de caja/)
  assert.doesNotMatch(seller, /aria-label="Filtros de cierres"/)
})

let lotQueryResult
let lotPage = 1
let canWriteOffLots = false
let lotMutation
let lotRequest
const invalidatedLotQueries = []
test('lot expiry starts compact and paginates real rows with product images', () => {
  const lots = Array.from({ length: 12 }, (_, i) => ({
    id: `lot-${i}`, lot_code: `LOTE-${i}`, expiry_date: '2026-10-10',
    qty_remaining: 5, days_to_expiry: i === 0 ? -2 : i === 1 ? 0 : i, received_at: '2026-10-01',
    branch: { id: 'branch', name: 'Sucursal de prueba', code: 'QA' },
    location: { id: 'location', code: 'A-01', name: 'Anaquel' },
    product: { id: `product-${i}`, name: `Producto ${i}`, image_url: i === 0 ? '/producto.png' : null, brand: 'Marca', size: '500 ml', barcode: `QA-${i}`, stock: 20, lotted: 5, unlotted: 15 },
  }))
  lotQueryResult = { data: { days: 30, status: 'all', lots }, isLoading: false, isFetching: false, isError: false }
  overrides.set('@tanstack/react-query', { useQuery: () => lotQueryResult, useMutation: options => { lotMutation = options; return { isPending: false } }, useQueryClient: () => ({ invalidateQueries: options => invalidatedLotQueries.push(options.queryKey) }) })
  overrides.set('@/services/api', { apiFetch: async (url, options) => { lotRequest = { url, options }; return { lots: 1, units: 5 } } })
  overrides.set('@/hooks/useAuthPermissions', { useAuthPermissions: () => ({ hasPermission: permission => canWriteOffLots && permission === 'stock_moves.adjust' }) })
  overrides.set('@/hooks/usePersistedListUiState', { usePersistedListUiState: () => ({ page: lotPage, pageSize: 10, setPage: () => {}, setPageSize: () => {} }) })
  const { default: Lots } = load(path.join(__dirname, '../src/modules/inventory/pages/LotsExpiryPage.tsx'))
  const { MemoryRouter } = require('react-router-dom')
  const renderLots = () => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Lots)))
  const first = renderLots()
  assert.match(first, /aria-label="Buscar productos o lotes"/)
  assert.match(first, /aria-label="Filtros de lotes"/)
  assert.doesNotMatch(first, /id="lots-status"/)
  assert.match(first, /src="\/producto.png"/)
  assert.match(first, /Ventana de 30 días/)
  assert.match(first, /Mostrando 1 a 10 de 12 lotes/)
  assert.doesNotMatch(first, /LOTE-10</)
  assert.doesNotMatch(first, /Dar de baja/)
  assert.match(first, /Vence hoy/)

  lotPage = 2
  const second = renderLots()
  assert.match(second, /Mostrando 11 a 12 de 12 lotes/)
  assert.match(second, /LOTE-10</)
  assert.doesNotMatch(second, /LOTE-0</)
  lotPage = 99
  const clamped = renderLots()
  assert.match(clamped, /Mostrando 11 a 12 de 12 lotes/)
  assert.match(clamped, /LOTE-11</)
  canWriteOffLots = true
  lotPage = 1
  const allowed = renderLots()
  assert.match(allowed, /Dar de baja 1 vencido/)
  assert.match(allowed, /aria-label="Dar de baja lote LOTE-0"/)
  assert.doesNotMatch(allowed, /aria-label="Dar de baja lote LOTE-1"/)
})

test('lot expiry reports a failed query instead of claiming no lots exist', () => {
  lotQueryResult = { data: undefined, isLoading: false, isFetching: false, isError: true, refetch: () => {} }
  const { default: Lots } = load(path.join(__dirname, '../src/modules/inventory/pages/LotsExpiryPage.tsx'))
  const { MemoryRouter } = require('react-router-dom')
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Lots)))
  assert.match(html, /role="alert"/)
  assert.match(html, /Reintentar/)
  assert.doesNotMatch(html, /No hay lotes/)
})

test('lot write-off preserves its request and refreshes dependent inventory queries', async () => {
  const result = await lotMutation.mutationFn(['lot-0'])
  assert.equal(lotRequest.url, '/api/products/lots/write-off')
  assert.equal(lotRequest.options.method, 'POST')
  assert.deepEqual(JSON.parse(lotRequest.options.body), { lot_ids: ['lot-0'], reason: 'Lote vencido' })
  lotMutation.onSuccess(result)
  assert.deepEqual(invalidatedLotQueries, [['lots-expiring'], ['products'], ['stock-by-location']])
})

let productLotsQuery
let canManageProductLots = false
let productLotsPage = 1
test('product lot details reuse closed filters and pagination without exposing unauthorized corrections', () => {
  const lots = Array.from({ length: 12 }, (_, i) => ({ id: `detail-${i}`, lot_code: `DETALLE-${i}`, expiry_date: i === 1 ? null : '2030-10-05T00:00:00.000Z', qty_received: 10, qty_remaining: 8, received_at: '2026-10-01', location: { id: 'anaquel', code: 'A-01', warehouse: { id: 'warehouse', name: 'Bodega' } } }))
  productLotsQuery = { data: { lots, reconciliation: { physical: 100, lotted: 96, unlotted: 4, tracks_expiry: true, balanced: false } }, isLoading: false, isFetching: false, isError: false, refetch: () => {} }
  overrides.set('@tanstack/react-query', { useQuery: () => productLotsQuery, useQueryClient: () => ({ invalidateQueries: () => {} }) })
  overrides.set('@/hooks/useAuthPermissions', { useAuthPermissions: () => ({ hasPermission: permission => canManageProductLots && permission === 'products.register_incoming' }) })
  overrides.set('@/hooks/usePersistedListUiState', { usePersistedListUiState: (_key, options) => ({ page: productLotsPage, pageSize: options.defaultPageSize, setPage: () => {} }) })
  const { ProductLotsSection } = load(path.join(__dirname, '../src/modules/inventory/products/ProductLotsSection.tsx'))
  const renderDetails = () => renderToStaticMarkup(React.createElement(ProductLotsSection, { productId: 'product', tracksExpiry: true }))
  const html = renderDetails()
  assert.match(html, /aria-label="Buscar lotes del producto"/)
  assert.match(html, /aria-label="Filtros de lotes del producto"/)
  assert.match(html, /Mostrando 1 a 5 de 12 lotes/)
  assert.doesNotMatch(html, /DETALLE-5</)
  assert.match(html, /Sin caducidad/)
  assert.doesNotMatch(html, /aria-label="Editar lote/)
  assert.doesNotMatch(html, /scripts\/backfill-lots/)
  productLotsPage = 99
  const last = renderDetails()
  assert.match(last, /Mostrando 11 a 12 de 12 lotes/)
  assert.doesNotMatch(last, /DETALLE-0</)
  canManageProductLots = true
  assert.match(renderDetails(), /aria-label="Editar lote DETALLE-10"/)
})

test('product lot details distinguish a query error from empty inventory', () => {
  productLotsQuery = { data: undefined, isLoading: false, isFetching: false, isError: true, refetch: () => {} }
  const { ProductLotsSection } = load(path.join(__dirname, '../src/modules/inventory/products/ProductLotsSection.tsx'))
  const html = renderToStaticMarkup(React.createElement(ProductLotsSection, { productId: 'product', tracksExpiry: false }))
  assert.match(html, /role="alert"/)
  assert.match(html, /Reintentar/)
})

test('a product lot expiring today is not marked expired before the business day ends', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-05T23:30:00Z') })
  productLotsPage = 1
  productLotsQuery = { data: { lots: [{ id: 'today', lot_code: 'HOY', expiry_date: '2026-10-05T00:00:00Z', qty_received: 5, qty_remaining: 5, received_at: '2026-10-01', location: null }], reconciliation: null }, isLoading: false, isFetching: false, isError: false }
  const { ProductLotsSection } = load(path.join(__dirname, '../src/modules/inventory/products/ProductLotsSection.tsx'))
  const html = renderToStaticMarkup(React.createElement(ProductLotsSection, { productId: 'product', tracksExpiry: true }))
  assert.match(html, /Vence hoy/)
  assert.doesNotMatch(html, />Vencido</)
  t.mock.timers.setTime(new Date('2026-10-06T06:01:00Z').getTime())
  const nextDay = renderToStaticMarkup(React.createElement(ProductLotsSection, { productId: 'product', tracksExpiry: true }))
  assert.match(nextDay, />Vencido</)
  assert.doesNotMatch(nextDay, /Vence hoy/)
})

test('product locations show five rows without hiding the remaining records', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ product_id: 'product', stock: 10, min_stock: 2, location: { id: `location-${i}`, code: `ANAQUEL-${i}`, pickable: true, warehouse: { id: 'warehouse', name: 'Bodega' } } }))
  overrides.set('@tanstack/react-query', { useQuery: () => ({ data: rows, isLoading: false, isFetching: false, isError: false }), useMutation: () => ({ isPending: false }), useQueryClient: () => ({}) })
  overrides.set('@/services/stockMoveService', {})
  overrides.set('@/hooks/useAuthPermissions', { useAuthPermissions: () => ({ hasPermission: () => false }) })
  const { ProductLocationsSection } = load(path.join(__dirname, '../src/modules/inventory/products/ProductLocationsSection.tsx'))
  const html = renderToStaticMarkup(React.createElement(ProductLocationsSection, { productId: 'product' }))
  assert.match(html, /Mostrando 1 a 5 de 7 ubicaciones/)
  assert.match(html, /ANAQUEL-4</)
  assert.doesNotMatch(html, /ANAQUEL-5</)
  assert.match(html, /aria-label="Página siguiente"/)
})

test('the product identity presents its name and image without becoming another technical sheet', () => {
  const { ProductDetailSummary } = load(path.join(__dirname, '../src/modules/inventory/products/ProductDetailSummary.tsx'))
  const product = { id: 'product', name: 'Producto de prueba', brand: 'Marca de prueba', size: '500 ml', barcode: 'TEST-123', imageUrl: '/foto-producto.png', tracksExpiry: true, availableForSale: false }
  const html = renderToStaticMarkup(React.createElement(ProductDetailSummary, { product, category: 'Categoría de prueba', supplier: 'Proveedor de prueba', status: 'Disponible' }))
  assert.match(html, /src="\/foto-producto.png"/)
  assert.match(html, /Marca de prueba/)
  assert.match(html, /500 ml/)
  assert.match(html, /<h1[^>]*>Producto de prueba<\/h1>/)
  assert.doesNotMatch(html, /TEST-123|Proveedor de prueba/)
  assert.doesNotMatch(html, /<input/)
})

test('product details separate tasks into tabs and keep the initial view free of unrelated tables', () => {
  const apiProduct = { id: 'product', name: 'Producto UX', brand: 'Marca UX', size: '500 ml', category: 'Bebidas', supplier: 'Proveedor UX', stock: 10, min_stock: 2, price: 25, cost: 12, price_wholesale: 20, price_promotion: 18, promotion_valid_until: null, barcode: 'UX-123', description: 'Descripción UX', image_url: '/ux.png', available_for_sale: true, tracks_expiry: true, kind: 'STANDARD' }
  let stateIndex = 0
  let editing = false
  let tab
  let allowEdit = true
  let allowCost = true
  overrides.set('react', { ...React, useState: initial => {
    const index = stateIndex++
    return React.useState(index === 0 ? apiProduct : index === 4 ? editing : index === 5 ? tab ?? initial : initial)
  } })
  overrides.set('react-router-dom', { ...require('react-router-dom'), useParams: () => ({ id: 'product' }), useNavigate: () => () => {} })
  overrides.set('@/hooks/useAuthPermissions', { useAuthPermissions: () => ({ hasPermission: permission => permission === 'products.create' ? allowCost : allowEdit && ['products.edit', 'products.delete'].includes(permission) }) })
  overrides.set('@/hooks/useSuppliers', { useSuppliers: () => ({ data: { items: [] } }) })
  overrides.set('@/hooks/useCategories', { useCategories: () => ({ data: [] }) })
  overrides.set('@/hooks/useUpdateProduct', { __esModule: true, default: () => ({ mutateAsync: () => {}, isPending: false }) })
  overrides.set('@/hooks/useDeleteProduct', { useDeleteProduct: () => ({ mutateAsync: () => {}, isPending: false }), useRemoveProductFromBranch: () => ({ mutateAsync: () => {}, isPending: false }) })
  overrides.set('@/context/useTenant', { useTenant: () => ({ branch: { id: 'branch', name: 'Sucursal UX' }, branches: [{ id: 'branch' }, { id: 'other' }] }) })
  overrides.set('./api', overrides.get('@/services/api'))
  // The page and shared UI are real; only remote data and initial hook state are supplied.
  productLotsQuery = { data: { lots: [{ id: 'lot', lot_code: 'LOTE-UX', expiry_date: '2030-01-01', qty_received: 10, qty_remaining: 10, received_at: '2026-10-01', location: null }], reconciliation: null }, isLoading: false, isFetching: false, isError: false }
  productLotsPage = 1
  const { default: Page } = load(path.join(__dirname, '../src/modules/inventory/products/ProductDetailPage.tsx'))
  const renderPage = () => { stateIndex = 0; return renderToStaticMarkup(React.createElement(Page)) }
  const activePanel = html => {
    const panels = [...html.matchAll(/<div\b[^>]*role="tabpanel"[^>]*>/g)]
    const index = panels.findIndex(panel => /data-state="active"/.test(panel[0]))
    assert.ok(index >= 0, 'An active task panel must be present')
    return html.slice(panels[index].index, panels[index + 1]?.index)
  }
  const initial = renderPage()
  assert.doesNotMatch(initial, /class="record-edit\b/)
  assert.equal((initial.match(/<h1\b/g) || []).length, 1)
  assert.match(initial, /role="tablist"/)
  assert.match(initial.match(/<button(?=[^>]*role="tab")[^>]*>[\s\S]*?<\/button>/)?.[0] || '', /Información y precios/)
  assert.match(initial.match(/<button(?=[^>]*role="tab")(?=[^>]*data-state="active")[^>]*>[\s\S]*?<\/button>/)?.[0] || '', /Información y precios/)
  assert.match(initial, /LOTE-UX/)
  assert.match(activePanel(initial), /UX-123/)
  assert.doesNotMatch(activePanel(initial), /Mínimo interno|LOTE-UX/)
  assert.match(initial, /Más acciones/)
  assert.doesNotMatch(initial, /Quitar de esta sucursal|Eliminar de la empresa/)

  tab = 'lots'
  const lots = renderPage()
  assert.match(activePanel(lots), /LOTE-UX/)
  assert.doesNotMatch(activePanel(lots), /Mínimo interno|UX-123|Precio mayoreo/)

  tab = 'information'
  allowEdit = false
  allowCost = false
  const info = renderPage()
  assert.match(info, /UX-123/)
  assert.match(info, /Descripción UX/)
  assert.match(info, /Precio mayoreo/)
  assert.doesNotMatch(activePanel(info), /LOTE-UX/)
  assert.doesNotMatch(info, /Margen de ganancia|Valor de inventario|Más acciones|>Costo</)

  allowEdit = true
  allowCost = true
  editing = true
  const form = renderPage()
  assert.match(form, /class="record-edit\b/)
  assert.match(form, /class="record-edit-columns"/)
  assert.equal((form.match(/<fieldset[^>]*class="record-edit-panel"/g) || []).length, 3)
  for (const label of ['Identificación', 'Precios', 'Control de inventario']) assert.match(form, new RegExp(`<legend[^>]*>${label}</legend>`))
  for (const label of ['Nombre', 'Marca', 'Presentación', 'Precio mayoreo', 'Precio promoción', 'Promoción hasta', 'Costo', 'Stock actual', 'Stock mínimo', 'Categoría', 'Proveedor', 'Código de barras', 'Descripción']) assert.match(form, new RegExp(`>${label}<`))
  assert.match(form, /Guardar cambios/)
  assert.doesNotMatch(form, /role="tablist"|LOTE-UX/)

  editing = false
  tab = undefined
  allowEdit = false
  apiProduct.kind = 'KIT'
  apiProduct.kit_components = []
  const kit = renderPage()
  assert.match(kit.match(/<button(?=[^>]*role="tab")(?=[^>]*data-state="active")[^>]*>[\s\S]*?<\/button>/)?.[0] || '', /Información y precios/)
  assert.match(activePanel(kit), /UX-123/)
  assert.doesNotMatch(kit, /LOTE-UX|>Lotes y caducidades<|Convertir a kit/)
  tab = 'kit'
  assert.match(activePanel(renderPage()), /Disponible según componentes/)
  overrides.delete('react')
})

test('locations explain a failed load rather than disappearing from their task panel', () => {
  const result = { data: undefined, isLoading: false, isError: true, refetch: () => {} }
  overrides.set('@tanstack/react-query', { useQuery: () => result, useMutation: () => ({ isPending: false }), useQueryClient: () => ({}) })
  const file = path.join(__dirname, '../src/modules/inventory/products/ProductLocationsSection.tsx')
  cache.delete(file)
  const { ProductLocationsSection } = load(file)
  const html = renderToStaticMarkup(React.createElement(ProductLocationsSection, { productId: 'product' }))
  assert.match(html, /role="alert"/)
  assert.match(html, /Reintentar/)
  assert.doesNotMatch(html, /Sin existencias por ubicación/)
})

test('employee edit layout preserves all fields and leaves the create layout unchanged', () => {
  overrides.delete('@/services/hrService')
  const { EmployeeForm } = load(path.join(__dirname, '../src/modules/hr/pages/EmployeeForm.tsx'))
  const value = { first_name: 'Ana', last_name: 'López', hire_date: '2026-01-01', base_salary: 4000, bonificacion_incentivo: 250, contract_type: 'INDEFINIDO', pay_frequency: 'MENSUAL', payment_method: 'TRANSFERENCIA', bank_name: 'Banco', bank_account: '123', dpi: '1234567890123', email: 'test@example.test', supervisor_id: null }
  const render = props => renderToStaticMarkup(React.createElement(EmployeeForm, { value, onChange: () => {}, disabled: true, ...props }))
  const create = render({}), edit = render({ className: 'record-edit-columns' })
  assert.match(edit, /^<div class="record-edit-columns">/)
  assert.match(create, /^<div class="space-y-4">/)
  const fields = html => [...html.matchAll(/<(?:input|select)\b[^>]*>/g)].map(match => match[0])
  assert.deepEqual(fields(edit), fields(create), 'Reorganizing the panels must not change fields or their attributes')
  assert.match(edit, /id="hr-bank_account"/)
})
