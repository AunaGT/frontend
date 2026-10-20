const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const runtime = require('react/jsx-runtime')
const { renderToStaticMarkup } = require('react-dom/server')
const { assertPaginationOutside } = require('./pagination-assertions.cjs')
const root = path.resolve(__dirname, '../src')
test('public mixed order shows billing units and counts lines instead of summing hours and goods',()=>{
  const data={...order,lines:[{product_name:'Servicio histórico',item_kind:'SERVICE',unit_label:'Hora',quantity_decimals:3,qty:'0.125',qty_fulfilled:'0',unit_price:100,line_total:12.5},order.lines[0]]}
  const view=render({data})
  assert.match(view.html,/Hora/);assert.match(view.html,/0.125/);assert.doesNotMatch(view.html,/10.125/)
})
const order = {
  reference: 'P-QA-001', status: 'PARTIALLY_FULFILLED', created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-08T12:00:00Z',
  customer: 'Cliente QA', customer_nit: '123456-7', is_final_consumer: false,
  customer_contact: { name: 'Cliente actual', contact: 'Ana QA', email: 'qa@example.test', phone: '5555-0101', address: 'Zona QA' },
  payment_condition: 'CREDIT', credit_days: 30, sales_channel: 'DIRECT', branch: { name: 'Principal QA', code: 'QA' },
  subtotal: '100.00', discount_total: '10.00', total: '90.00', notes: 'Entregar en recepción',
  company_name: 'Empresa QA', company_logo_url: '/logo-qa.svg',
  lines: [{ product_name: 'Producto QA', barcode: '740001', qty: 10, qty_fulfilled: 4, unit_price: '10.00', line_total: '90.00' }],
  sales: [{ reference: 'V-QA-001', total: '36.00', date: '2026-10-08T12:00:00Z', status: 'Completada' }],
}

// Keep the real presentation and controls; isolate only remote query/branding effects.
function render({ data = order, token = 'public-qa-token', page = 1, ...queryState } = {}) {
  const target = path.join(root, 'modules/orders/pages/PublicOrderPage.tsx')
  const cache = new Map(), nodes = [], queries = [], pages = []
  let retries = 0
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = new Module(file, module)
    cache.set(file, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(file))
    const native = mod.require.bind(mod)
    mod.require = dependency => {
      if (dependency.endsWith('.css')) return {}
      if (dependency === '@/services/api') return { apiFetch() { throw Error('Unexpected private request') } }
      if (dependency === 'react' && file === target) return { ...React, useState: () => [page, value => pages.push(value)] }
      if (dependency === 'react-router-dom') return { useParams: () => ({ token }) }
      if (dependency === '@tanstack/react-query') return { useQuery: options => { queries.push(options); return { data, refetch: () => retries++, ...queryState } } }
      if (dependency === '@/services/orderService') return { num: value => Number(value) || 0, fetchPublicOrder: async value => { assert.equal(value, token); return data } }
      if (dependency === '@/utils/documentBranding') return { applyDocumentBranding() { throw Error('Unexpected remote branding effect') } }
      if (dependency === 'react/jsx-runtime' && file === target) {
        const capture = fn => (type, props, key) => { nodes.push({ type, props }); return fn(type, props, key) }
        return { ...runtime, jsx: capture(runtime.jsx), jsxs: capture(runtime.jsxs) }
      }
      const local = dependency.startsWith('@/') ? path.join(root, dependency.slice(2)) : dependency.startsWith('.') ? path.resolve(path.dirname(file), dependency) : null
      if (!local) return native(dependency)
      return load(['', '.tsx', '.ts', '.js', '.mjs', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()))
    }
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file.replace(/\.mjs$/, '.ts'), compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
    return mod.exports
  }
  const Page = load(target).default
  const html = renderToStaticMarkup(React.createElement(Page))
  return { html, nodes, queries, pages, get retries() { return retries } }
}

test('public order preserves the public query and renders contact, credit, delivery quantities and document totals', async () => {
  const { html, queries } = render()
  assert.deepEqual(queries[0].queryKey, ['public-order', 'public-qa-token'])
  assert.equal(await queries[0].queryFn(), order)
  for (const value of ['Cliente QA', '123456-7', 'Ana QA', 'qa@example.test', '5555-0101', 'Zona QA', 'Principal QA', '30 días desde la venta', '90.00', 'V-QA-001', 'Completada', 'Entregar en recepción']) assert.ok(html.includes(value), value)
  for (const action of ['Registrar entrega', 'Facturar entregas', 'Ver cartera', 'Saldo pendiente', 'Monto pagado']) assert.ok(!html.includes(action), action)
  assert.ok(html.includes('aria-label="Productos del pedido"'))
  assert.match(html, /tabindex="0" role="region" aria-label="Lista de productos"/)
  assert.match(html, /tabindex="0" aria-label="Partidas del pedido"/)
})

test('long public orders paginate the same rows in both layouts with navigation outside the result frame', () => {
  const data = { ...order, lines: Array.from({ length: 12 }, (_, i) => ({ ...order.lines[0], product_name: `Artículo QA ${i + 1}`, barcode: `CODE-${i + 1}` })) }
  const first = render({ data })
  assert.ok(first.html.includes('CODE-10'))
  assert.ok(!first.html.includes('CODE-11'))
  assertPaginationOutside(first.html)
  first.nodes.find(node => node.type.name === 'Pagination').props.onPageChange(2)
  assert.deepEqual(first.pages, [2])
  const second = render({ data, page: 2 })
  assert.ok(second.html.includes('CODE-11'))
  assert.ok(second.html.includes('CODE-12'))
  assert.ok(!second.html.includes('CODE-10'))
  assert.ok(second.html.includes('Mostrando 11 a 12 de 12'))
})

test('a draft, cancelled or expired order never claims it is being prepared or has an active delivery step', () => {
  for (const [status, message] of [['DRAFT', 'Pendiente de confirmación'], ['CANCELLED', 'Este pedido fue cancelado'], ['EXPIRED', 'La vigencia de este pedido terminó']]) {
    const { html } = render({ data: { ...order, status } })
    assert.ok(html.includes(message), status)
    assert.ok(!html.includes('Estamos preparando tu pedido'), status)
    if (status !== 'DRAFT') assert.ok(!html.includes('aria-current="step"'), status)
  }
})

test('confirmed, partial and complete orders expose one current progress step', () => {
  for (const status of ['CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED']) {
    const { html } = render({ data: { ...order, status } })
    assert.equal((html.match(/aria-current="step"/g) || []).length, 1, status)
  }
})

test('missing optional contact and totals do not produce a false zero subtotal or a null credit term', () => {
  const { html } = render({ data: { ...order, customer_contact: null, customer_nit: null, is_final_consumer: true, branch: null, subtotal: null, discount_total: null, credit_days: null, sales: [], notes: null } })
  assert.ok(html.includes('NIT: CF'))
  assert.ok(html.includes('Plazo según lo acordado'))
  assert.ok(!html.includes('null días'))
  assert.ok(/Subtotal<\/dt>\s*<dd[^>]*>[^<]*90\.00<\/dd>/.test(html))
})

test('loading, unavailable and stale-error states never display a successful or private order', () => {
  const loading = render({ data: undefined, isLoading: true })
  assert.ok(loading.html.includes('Cargando seguimiento del pedido'))
  assert.ok(!loading.html.includes('Cliente QA'))
  for (const query of [{ data: null }, { isError: true }, { token: null, isLoading: true }]) {
    const view = render(query)
    assert.ok(view.html.includes('Pedido no disponible'))
    assert.ok(!view.html.includes('Cliente QA'))
    if (query.isError) {
      view.nodes.find(node => node.type.name === 'PublicState').props.onRetry()
      assert.equal(view.retries, 1)
    }
  }
  assert.equal(render({ token: null }).queries[0].enabled, false)
})

test('an empty order shows a clear product empty state and a background refresh keeps the document visible', () => {
  assert.ok(render({ data: { ...order, lines: [] } }).html.includes('Tu pedido espera sus partidas'))
  const { html } = render({ isFetching: true })
  assert.ok(html.includes('Actualizando pedido'))
  assert.ok(html.includes('Producto QA'))
})
