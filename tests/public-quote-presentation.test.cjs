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
const quote = {
  reference: 'COT-QA-001', status: 'SENT', created_at: '2026-10-01T12:00:00Z', valid_until: '2099-11-01T12:00:00Z',
  locale: 'es-GT', currency_code: 'GTQ', timezone: 'America/Guatemala',
  customer: 'Cliente QA', customer_nit: '123456-7', is_final_consumer: false,
  payment_condition: 'CREDIT', credit_days: 30, subtotal: '100.00', discount_total: '10.00', total: '90.00',
  notes: 'Entrega en recepción', company_name: 'Empresa QA', company_logo_url: '/logo-qa.svg',
  lines: [{ product_name: 'Producto QA', barcode: 'CODE-1', image_url: '/qa-product.svg', qty: 10, unit_price: '10.00', line_total: '90.00' }],
}
test('public and private quotation rows retain the service unit with all quantity digits', () => {
  const data={...quote,lines:[{...quote.lines[0],product_name:'Asesoría original',qty:'0.125',unit_label:'Hora'}]}
  for(const privateLines of [false,true]) {
    const view=render({data,privateLines})
    assert.match(view.html,/Hora/);assert.match(view.html,/0.125/)
  }
})

// Keep actual page, rules and controls. Only network, query lifecycle and PDF output stay offline.
function render({ data = quote, token = 'public-qa-token', decision = null, pdfBusy = false, pdfError = null, page = 1, mutation = {}, logoFailure = false, pdfFailure = false, privateLines = false, ...queryState } = {}) {
  const target = path.join(root, 'modules/quotes/PublicQuotePage.tsx')
  const presentation = path.join(root, 'modules/quotes/QuotePresentation.tsx')
  const cache = new Map(), nodes = [], queries = [], mutations = [], sent = [], states = [], pdfs = [], invalidated = [], requests = [], pages = []
  let state = 0, retries = 0
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = new Module(file, module)
    cache.set(file, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(file))
    const native = mod.require.bind(mod)
    mod.injectedFetch = async (url, options) => { requests.push({ url, options }); return new Response(JSON.stringify(options?.method === 'POST' ? { status: JSON.parse(options.body).status } : data)) }
    mod.require = dependency => {
      if (dependency.endsWith('.css')) return {}
      if (dependency === '@/services/api' || (dependency === './api' && file.endsWith('/services/quoteService.ts'))) return { apiFetch() { throw Error('Unexpected private request') } }
      if (dependency === 'react' && file === target) return { ...React, useState: () => { const index = state++; return [[decision, pdfBusy, pdfError][index], value => states.push({ index, value })] } }
      if (dependency === 'react' && file === presentation) return { ...React, useState: initial => typeof initial === 'number' ? [page, value => pages.push(value)] : React.useState(initial) }
      if (dependency === 'react-router-dom') return { useParams: () => ({ token }) }
      if (dependency === '@tanstack/react-query') return {
        useQuery: options => { queries.push(options); return { data, refetch: () => retries++, ...queryState } },
        useQueryClient: () => ({ invalidateQueries: value => invalidated.push(value) }),
        useMutation: options => { mutations.push(options); return { mutate: value => sent.push(value), ...mutation } },
      }
      if (dependency === '@/utils/pdfBranding') return { resolvePdfLogoDataUrl: async () => { if (logoFailure) throw Error('Offline logo'); return 'data:image/png;base64,QA' } }
      if (dependency === './documents/generateQuotePDF') return { generateQuotePDF: (record, options) => { if (pdfFailure) throw Error('PDF failure'); pdfs.push({ record, options }) } }
      if (dependency === 'react/jsx-runtime' && [target, presentation].includes(file)) {
        const capture = factory => (type, props, key) => { nodes.push({ type, props }); return factory(type, props, key) }
        return { ...runtime, jsx: capture(runtime.jsx), jsxs: capture(runtime.jsxs) }
      }
      const local = dependency.startsWith('@/') ? path.join(root, dependency.slice(2)) : dependency.startsWith('.') ? path.resolve(path.dirname(file), dependency) : null
      if (!local) return native(dependency)
      return load(['', '.tsx', '.ts', '.js', '.mjs', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()))
    }
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})')
    mod._compile('const fetch = module.injectedFetch;\n' + ts.transpileModule(source, { fileName: file.replace(/\.mjs$/, '.ts'), compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
    return mod.exports
  }
  const Page = privateLines ? load(presentation).QuoteLines : load(target).default
  const html = renderToStaticMarkup(React.createElement(Page, privateLines ? { lines: data.lines.map(line => ({ ...line, name: line.product_name, code: line.barcode })), money: value => String(value) } : {}))
  const button = label => nodes.find(node => node.props.onClick && renderToStaticMarkup(React.createElement(React.Fragment, null, node.props.children)).includes(label))
  return { html, nodes, queries, mutations, sent, states, pdfs, invalidated, requests, pages, button, get retries() { return retries } }
}

test('public quote keeps its public query, customer, credit conditions and full document totals', async () => {
  const view = render()
  assert.deepEqual(view.queries[0].queryKey, ['public-quote', 'public-qa-token'])
  assert.equal((await view.queries[0].queryFn()).reference, 'COT-QA-001')
  assert.equal(view.requests[0].url, '/quotes/public/public-qa-token')
  for (const text of ['COT-QA-001', 'Cliente QA', '123456-7', '30 días desde la venta', '100.00', '90.00', 'Entrega en recepción', '/qa-product.svg']) assert.ok(view.html.includes(text), text)
  assert.ok(view.html.includes('aria-label="Información de la cotización"'))
  assert.ok(!view.html.includes('Registrar venta'))
})

test('public quote uses the same paginated rows in desktop and mobile with pagination outside the surface', () => {
  const data = { ...quote, lines: Array.from({ length: 12 }, (_, i) => ({ ...quote.lines[0], barcode: 'CODE-' + (i + 1), product_name: 'Artículo ' + (i + 1) })) }
  const first = render({ data })
  assert.ok(first.html.includes('CODE-10'))
  assert.ok(!first.html.includes('CODE-11'))
  assert.ok(first.html.includes('aria-label="Partidas de la cotización"'))
  assert.ok(first.html.includes('tabindex="0"'))
  assertPaginationOutside(first.html)
  first.nodes.find(node => node.type.name === 'Pagination').props.onPageChange(2)
  assert.deepEqual(first.pages, [2])
  const second = render({ data, page: 2 })
  assert.ok(second.html.includes('CODE-11'))
  assert.ok(!second.html.includes('CODE-10'))
  assert.ok(second.html.includes('Mostrando 11 a 12 de 12'))
  assert.ok(second.html.includes('90.00'), 'totals must not depend on the visible page')
})

test('responding requires a decision then confirmation and keeps the existing token/status POST contract', async () => {
  for (const [label, status] of [['Aceptar cotización', 'ACCEPTED'], ['Rechazar cotización', 'REJECTED']]) {
    const view = render()
    view.button(label).props.onClick()
    assert.deepEqual(view.states[0], { index: 0, value: status })
    assert.deepEqual(view.sent, [])
    const confirmed = render({ decision: status })
    let prevented = false
    confirmed.button('Confirmar respuesta').props.onClick({ preventDefault() { prevented = true } })
    assert.equal(prevented, true)
    assert.deepEqual(confirmed.sent, [status])
    await confirmed.mutations[0].mutationFn(status)
    assert.equal(confirmed.requests[0].url, '/quotes/public/public-qa-token/respond')
    assert.deepEqual(JSON.parse(confirmed.requests[0].options.body), { status })
    confirmed.mutations[0].onSuccess()
    assert.deepEqual(confirmed.invalidated, [{ queryKey: ['public-quote', 'public-qa-token'] }])
  }
})

test('private QuoteLines consumers retain their default table and exterior pagination', () => {
  const view = render({ privateLines: true })
  assert.ok(view.html.includes('<table'))
  assert.ok(view.html.includes('Partidas (1)'))
  assert.ok(view.html.includes('Paginación de partidas'))
  assert.ok(!view.html.includes('public-quote-mobile-products'))
  assertPaginationOutside(view.html)
})

test('expired, responded, draft and cancelled quotes do not offer or confirm a new response', () => {
  for (const data of [
    { ...quote, status: 'EXPIRED' }, { ...quote, valid_until: '2000-01-01T00:00:00Z' },
    ...['ACCEPTED', 'REJECTED', 'DRAFT', 'CANCELLED'].map(status => ({ ...quote, status })),
  ]) {
    const view = render({ data, decision: 'ACCEPTED' })
    assert.ok(!view.button('Aceptar cotización'))
    view.button('Confirmar respuesta').props.onClick({ preventDefault() {} })
    assert.deepEqual(view.sent, [])
  }
  const pending = render({ decision: 'REJECTED', mutation: { isPending: true } })
  assert.equal(pending.button('Aceptar cotización').props.disabled, true)
  assert.equal(pending.button('Confirmar respuesta').props.disabled, true)
  pending.button('Confirmar respuesta').props.onClick({ preventDefault() {} })
  assert.deepEqual(pending.sent, [])
})

test('a failed response remains visible in the open confirmation dialog', () => {
  const view = render({ decision: 'ACCEPTED', mutation: { isError: true, error: new Error('La cotización cambió') } })
  const dialog = view.nodes.find(node => node.props.variant === 'auna')
  const descendants = children => React.Children.toArray(children).flatMap(child => React.isValidElement(child) ? [child, ...descendants(child.props.children)] : [])
  const alert = descendants(dialog.props.children).find(child => child.props.role === 'alert')
  assert.ok(alert, 'response error must be inside the open confirmation')
  assert.ok(renderToStaticMarkup(alert).includes('La cotización cambió'))
})

test('PDF export includes all rows and monetary metadata even on the second product page', async () => {
  const data = { ...quote, lines: Array.from({ length: 12 }, (_, i) => ({ ...quote.lines[0], product_name: 'PDF-' + (i + 1) })) }
  for (const logoFailure of [false, true]) {
    const view = render({ data, page: 2, logoFailure })
    await view.button('Descargar PDF').props.onClick()
    assert.equal(view.pdfs.length, 1)
    assert.equal(view.pdfs[0].record.lines.length, 12)
    assert.equal(view.pdfs[0].record.lines[11].product.name, 'PDF-12')
    assert.equal(view.pdfs[0].record.total, '90.00')
    assert.equal(view.pdfs[0].options.currencyCode, 'GTQ')
    assert.equal(view.pdfs[0].options.logoDataUrl, logoFailure ? undefined : 'data:image/png;base64,QA')
  }
})

test('PDF failure is handled and leaves export available for retry', async () => {
  const view = render({ pdfFailure: true })
  await view.button('Descargar PDF').props.onClick()
  assert.ok(view.states.some(state => state.index === 2 && typeof state.value === 'string' && state.value.length))
  assert.deepEqual(view.states.at(-1), { index: 1, value: false })
  assert.ok(render({ pdfError: 'No se pudo generar el PDF. Intenta de nuevo.' }).html.includes('role="alert"'))
})

test('loading, failed or missing-token queries do not expose the document or response buttons', () => {
  const loading = render({ isLoading: true })
  assert.ok(loading.html.includes('Cargando cotización'))
  assert.ok(!loading.button('Aceptar cotización'))
  for (const query of [{ data: null }, { isError: true }, { token: null, isLoading: true }]) {
    const view = render(query)
    assert.ok(view.html.includes('Cotización no disponible'))
    assert.ok(!view.html.includes('Cliente QA'))
    assert.ok(!view.button('Aceptar cotización'))
    if (query.isError) {
      view.button('Reintentar').props.onClick()
      assert.equal(view.retries, 1)
    }
  }
  assert.equal(render({ token: null }).queries[0].enabled, false)
})

test('empty products and missing optional credit/subtotal data have truthful visible fallbacks', () => {
  const view = render({ data: { ...quote, lines: [], subtotal: null, credit_days: null, is_final_consumer: true } })
  for (const text of ['No hay partidas registradas', 'Plazo según lo acordado', 'NIT: CF', '100.00']) assert.ok(view.html.includes(text), text)
  assert.ok(!view.html.includes('null días'))
})
