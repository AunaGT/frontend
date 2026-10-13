import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
function loader(overrides) {
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = new Module(file)
    cache.set(file, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(file))
    mod.require = name => {
      if (name in overrides) return overrides[name]
      const local = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
      if (!local) return require(name)
      return load(['', '.tsx', '.ts', '/index.ts'].map(ext => local + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()))
    }
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
    return mod.exports
  }
  return file => load(path.join(root, file))
}

test('sales transport sends server-side payment and optional full-summary parameters', async () => {
  let url
  const response = { items: [], summary: { totalSales: 0 } }
  const { fetchSales } = loader({ './api': { apiFetch: async value => { url = value; return response } } })('src/services/salesService.ts')
  assert.equal(await fetchSales({ payment: 'Crédito 30 días', includeSummary: true, page: 2, pageSize: 20 }), response)
  const params = new URL(url, 'https://example.test').searchParams
  assert.equal(params.get('payment'), 'Crédito 30 días')
  assert.equal(params.get('includeSummary'), 'true')
  assert.equal(params.get('page'), '2')
  await fetchSales({ includeSummary: false })
  assert.equal(new URL(url, 'https://example.test').searchParams.has('includeSummary'), false)
})

test('sale normalization retains product image/barcode from the detail API without changing price or quantity', () => {
  const { normalizeRawSale } = loader({ '@/hooks/useSales': {} })('src/modules/sales/hooks/useSalesData.ts')
  const output = normalizeRawSale({ id: 'sale-1', total: '20.00', sale_items: [{ id: 1, product_id: 'p-1', price: '10.00', qty: 2, product: { id: 'p-1', name: 'Producto QA', barcode: '740001', image_url: '/qa-product.png' } }] })
  assert.equal(output.products[0].imageUrl, '/qa-product.png')
  assert.equal(output.products[0].barcode, '740001')
  assert.equal(output.products[0].price, 10)
  assert.equal(output.products[0].qty, 2)
  assert.equal(normalizeRawSale({ sale_items: [{ product_id: 'p-2', product: { name: 'Sin imagen', image_url: null } }] }).products[0].imageUrl, undefined)
  const service = normalizeRawSale({items:0,line_count:1,sale_items:[{product_id:'s',item_name:'Servicio original',item_kind:'SERVICE',unit_label:'Hora',quantity_decimals:3,qty:'0.125',price:'100',net_total:'12.50',product:{name:'Editado'}}]})
  assert.equal(service.products[0].name,'Servicio original')
  assert.equal(service.products[0].unitLabel,'Hora')
  assert.equal(service.products[0].qty,'0.125')
  assert.equal(service.lineCount,1)
})

test('completed refunds retain original service identity and canonical quantity', () => {
  const { normalizeRawSale } = loader({ '@/hooks/useSales': {} })('src/modules/sales/hooks/useSalesData.ts')
  const output = normalizeRawSale({ returns: [{ status: { name: 'Completada' }, return_items: [{ product: { name: 'Nombre actual' }, sale_item: { item_name: 'Asesoría original', unit_label: 'Hora' }, qty_returned: '0.125', refund_amount: '12.50' }] }] })
  assert.deepEqual(output.returnDetails[0].items[0], { productName: 'Asesoría original', qty: '0.125', unitLabel: 'Hora', refund: 12.5 })
})

test('sale normalization retains linked contact presentation without replacing the historical customer identity', () => {
  const { normalizeRawSale } = loader({ '@/hooks/useSales': {} })('src/modules/sales/hooks/useSalesData.ts')
  const output = normalizeRawSale({ customer: 'Nombre vendido', customer_nit: '123', customerContact: { id: 'contact-1', name: 'Nombre actual', image_url: '/contact.webp', address: 'Zona QA', phone: '5555', email: 'qa@example.test' }, branch: { name: 'Sucursal QA' } })
  assert.equal(output.customer, 'Nombre vendido')
  assert.equal(output.customerNit, '123')
  assert.deepEqual(output.customerContact, { id: 'contact-1', name: 'Nombre actual', imageUrl: '/contact.webp', address: 'Zona QA', phone: '5555', email: 'qa@example.test', taxId: undefined })
  assert.equal(output.branchName, 'Sucursal QA')
  assert.equal(normalizeRawSale({ customerContact: null }).customerContact, undefined)
})

test('sale normalization preserves discounted and zero-valued item totals', () => {
  const { normalizeRawSale } = loader({ '@/hooks/useSales': {} })('src/modules/sales/hooks/useSalesData.ts')
  const output = normalizeRawSale({ sale_items: [
    { product_id: 'discount', price: '10.00', qty: 2, net_total: '15.00' },
    { product_id: 'free', price: '10.00', qty: 1, net_total: '0.00' },
    { product_id: 'historical', price: '10.00', qty: 1 },
  ] })
  assert.deepEqual(output.products.map(product => product.lineTotal), [15, 0, undefined])
})

test('contact photo upload sends bounded multipart metadata with tenant and session headers', async () => {
  const originalFetch = globalThis.fetch
  let request
  try {
    globalThis.fetch = async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ id: 'contact-1', image_url: '/signed-photo.webp' }) } }
    const { uploadSupplierImage } = loader({
      './api': { getApiBaseUrl: () => '/api', getAuthToken: () => 'test-token', tenantHeaders: () => ({ 'X-Company-Id': 'company-1' }) },
      './productService': {},
    })('src/services/supplierService.ts')
    const file = new File(['synthetic photo'], 'qa.png', { type: 'image/png' })
    assert.deepEqual(await uploadSupplierImage('contact-1', file), { id: 'contact-1', image_url: '/signed-photo.webp' })
    assert.equal(request.url, '/api/suppliers/contact-1/image')
    assert.equal(request.options.body.get('file').name, 'qa.png')
    assert.deepEqual(request.options.headers, { 'X-Company-Id': 'company-1', Authorization: 'Bearer test-token' })
    assert.equal(request.options.credentials, 'include')
    globalThis.fetch = async () => ({ ok: false, json: async () => ({ message: 'Sin permiso' }) })
    await assert.rejects(uploadSupplierImage('contact-1', file), /Sin permiso/)
  } finally { globalThis.fetch = originalFetch }
})

test('contact save does not hide a failed photo upload or discard the saved fields', async () => {
  let options
  const saved = { id: 'contact-1', name: 'QA' }, invalidations = [], calls = []
  let photoFailed = false
  const { useUpdateSupplier } = loader({
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries: async args => invalidations.push(args) }), useMutation: value => { options = value; return value } },
    '@/hooks/useSuppliers': { SUPPLIERS_QUERY_KEY: ['suppliers'] },
    '@/services/supplierService': {
      updateSupplier: async () => { calls.push('fields'); return saved },
      uploadSupplierImage: async () => { calls.push('image'); if (photoFailed) throw new Error('Storage offline'); return { id: 'contact-1', image_url: '/qa.webp' } },
    },
  })('src/hooks/useUpdateSupplier.ts')
  useUpdateSupplier()
  const input = { id: 'contact-1', payload: { name: 'QA' }, image: new File(['QA'], 'qa.png') }
  assert.deepEqual(await options.mutationFn(input), { ...saved, image_url: '/qa.webp' })
  assert.deepEqual(calls, ['fields', 'image'])
  photoFailed = true
  await assert.rejects(options.mutationFn(input), error => error.imageUploadFailed === true && error.message.includes('Los datos se guardaron'))
  assert.deepEqual(invalidations, [{ queryKey: ['suppliers'] }])
})

function hookProbe(change, failed = false) {
  const calls = []
  let output
  const query = params => {
    calls.push(params)
    return { data: failed ? undefined : params.includeSummary ? {
      items: [], summary: { totalSales: 5010, transactionCount: 502, averageTicket: 5010 / 502, preferredPaymentMethod: 'Crédito 30 días' },
    } : { items: [{ id: 'credit-sale', total: 25, adjusted_total: 0, payment_method: { name: 'Crédito 30 días', is_credit: true } }], page: 1, pageSize: 10, totalItems: 23, totalPages: 3, hasMore: true },
    isLoading: false, isFetching: false, isError: failed, error: failed ? new Error('Servicio no disponible') : null, refetch() {} }
  }
  const { useSalesData } = loader({ '@/hooks/useSales': { useSales: query, useSalesByStatus: (status, params) => query({ ...params, status }) } })('src/modules/sales/hooks/useSalesData.ts')
  let changed = false
  function Probe() {
    output = useSalesData()
    if (change && !changed) { changed = true; change(output) }
    return null
  }
  renderToStaticMarkup(React.createElement(Probe))
  return { calls, output }
}

test('sales sends measured card size, preserves aggregate summary and keeps table preference separate', () => {
  const reads = [], sizes = [], tableSizes = []
  let output
  const { useSalesData } = loader({
    '@/hooks/useSales': { useSales: params => { reads.push(params); return { data: { items: [] }, isLoading: false } } },
    '@/hooks/use-mobile': { useIsMobile: () => false },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 25, viewMode: 'cards', setPage() {}, setPageSize: value => tableSizes.push(value) }) },
    '@/hooks/useCardPagination': { useCardPagination: () => ({ pageSize: 12, pageSizeOptions: [12, 24, 36, 48], containerRef() {}, setCardPageSize: value => sizes.push(value) }) },
  })('src/modules/sales/hooks/useSalesData.ts')
  function Probe() { output = useSalesData(); return null }
  renderToStaticMarkup(React.createElement(Probe))
  assert.equal(reads[0].pageSize, 12)
  assert.equal(reads[1].pageSize, 1)
  assert.deepEqual(output.pageSizeOptions, [12, 24, 36, 48])
  output.setPageSize(24)
  assert.deepEqual(sizes, [24])
  assert.deepEqual(tableSizes, [])
})

test('one paginated list and one aggregate summary replace split lists and 500-row KPIs', () => {
  const { calls, output } = hookProbe()
  assert.equal(calls.length, 2)
  assert.equal(calls[0].status, undefined)
  assert.equal(calls[0].pageSize, 10)
  assert.deepEqual(calls[1], { status: 'Completada', period: 'today', page: 1, pageSize: 1, includeSummary: true })
  assert.equal(output.sales.length, 1)
  assert.equal(output.sales[0].adjustedTotal, 0)
  assert.equal(output.totalSalesToday, 5010)
  assert.equal(output.transactionCountToday, 502)
  assert.equal(output.pageInfo.totalItems, 23)
})

test('status and payment changes are sent to the server rather than filtering a page locally', () => {
  const { calls, output } = hookProbe(data => { data.setStatusFilter('cancelled'); data.setPaymentFilter('Efectivo'); data.setPageSize(20) })
  const list = calls.at(-2)
  assert.equal(list.status, 'Cancelada')
  assert.equal(list.payment, 'Efectivo')
  assert.equal(list.page, 1)
  assert.equal(list.pageSize, 20)
  assert.equal(output.sales.length, 1)
  assert.equal(calls.at(-1).status, 'Completada')
  assert.equal(calls.at(-1).payment, undefined)
})

test('list and summary failures are explicit, not a successful empty result', () => {
  const { output } = hookProbe(null, true)
  assert.equal(output.error, 'Servicio no disponible')
  assert.equal(output.summaryError, true)
})

test('short or debouncing searches do not show cached rows or unrelated page totals', () => {
  for (const value of ['ab', 'Cliente']) {
    const { output } = hookProbe(data => data.setSearchTerm(value))
    assert.deepEqual(output.sales, [])
    assert.equal(output.pageInfo.totalItems, null)
    assert.equal(output.pageInfo.hasMore, false)
    assert.equal(output.isLoading, value === 'Cliente')
  }
})
