const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const postcss = require('postcss')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const root = path.resolve(__dirname, '../src')
const mutation = { isPending: false, mutate() {}, mutateAsync() {} }
const settings = { locale: 'es-GT', currencyCode: 'GTQ', companyName: 'Empresa QA' }
const api = { apiFetch() { throw new Error('No external operations in presentation checks') }, getApiBaseUrl: () => 'https://qa.example.test' }
const base = {
  '@/services/api': api,
  './api': api,
  '../services/api': api,
  '@/hooks/useRealtimeSales': { useRealtimeSales() {} },
  'react-router-dom': { useNavigate: () => () => {}, useParams: () => ({ id: 'qa' }), useSearchParams: () => [new URLSearchParams()], useLocation: () => ({ pathname: '/promociones/qa/editar', state: null }) },
  '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
  '@/hooks/useSystemSettings': { useSystemSettings: () => settings },
  '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => true }) },
  '@/context/useTenant': { useTenant: () => ({ branch: { id: 'qa', name: 'Principal' }, branches: [] }) },
  '@tanstack/react-query': { useQuery: () => ({ data: [], isLoading: false }), useMutation: () => mutation, useQueryClient: () => ({ invalidateQueries() {} }) },
  '@/components/shared/ProductPicker': { ProductPicker: () => null },
  '@/components/shared/ProductCombobox': { ProductCombobox: () => null },
  '@/modules/sales/components/SavedCustomerMany2One': { SavedCustomerMany2One: () => null },
  '@/modules/sales': { SavedCustomerMany2One: () => null },
  '@/components/shared/CommercialPaymentFields': { CommercialPaymentFields: () => null },
}
function renderPage(file, mocks = {}, state = {}) {
  let index = 0
  const nodes = [], changes = []
  const Page = loadReportModule(file, { ...base, ...mocks, react: { ...React, useState(initial) {
    const i = index++, [value, setValue] = React.useState(Object.hasOwn(state, i) ? state[i] : initial)
    return [value, next => { changes.push({ index: i, value: typeof next === 'function' ? next(value) : next }); setValue(next) }]
  } } }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(Page)), nodes, changes }
}
function region(result, className) {
  const node = result.nodes.find(n => n.props?.className?.split(' ').includes(className))
  assert.ok(node, 'Partidas deben tener desplazamiento local')
  assert.equal(node.props.tabIndex, 0)
  assert.equal(node.props.role, 'region')
  assert.ok(node.props['aria-label'])
  const file = { 'order-lines-scroll': 'orders/pages/newOrder.css', 'quote-lines-scroll': 'quotes/quoteLines.css', 'return-lines-scroll': 'returns/pages/returnLines.css' }[className]
  const css = postcss.parse(fs.readFileSync(path.join(root, 'modules', file), 'utf8'))
  const style = {}, header = {}, inner = {}
  css.walkRules(rule => {
    const target = rule.selector === `.${className}.${className}` || (node.props.className.includes(`${className}-detail`) && rule.selector === `.${className}.${className}-detail`) ? style
      : rule.selector === `.${className} th` ? header : rule.selector === `.${className} > div` ? inner : null
    if (target) rule.walkDecls(d => { target[d.prop] = d.value })
  })
  assert.equal(style['max-height'], node.props.className.includes(`${className}-detail`) ? '480px' : '420px')
  assert.equal(style.overflow, 'auto')
  assert.equal(inner.overflow, 'visible', 'El wrapper interno de Table no debe capturar el encabezado sticky')
  assert.equal(header.position, 'sticky')
  assert.equal(header.top, '0')
  assert.equal(header.background, 'hsl(var(--auna-table-header))')
  return node
}

test('promotion background refresh keeps the editor and preview as the two grid children', () => {
  const result = renderPage('../promotions/pages/PromotionEditPage.tsx', {
    '@tanstack/react-query': { ...base['@tanstack/react-query'], useQuery: ({ queryKey }) => queryKey[0] === 'promotion'
      ? { data: { id: 'qa', active: true, name: 'Promoción QA', type_id: 1, type: { id: 1, name: 'PERCENTAGE' }, codes: [], applies_to_all: true, start_date: '2026-10-09' }, isLoading: false, isFetching: true }
      : { data: [], isLoading: false } },
  })
  const grid = result.nodes.find(n => n.type === 'div' && n.props.className?.includes('xl:grid-cols-'))
  const children = React.Children.toArray(grid.props.children)
  assert.equal(children.length, 2, 'El estado de actualización no debe desplazar formulario ni vista previa')
  assert.equal(children[0].type, 'form')
  assert.match(result.html, /Actualizando promoción/)
})

test('promotion cards inherit surface tokens in both themes without an editor paint override', () => {
  const rules = []
  for (const file of ['index.css', 'components/shared/surfaces.css']) postcss.parse(fs.readFileSync(path.join(root, file), 'utf8')).walkRules(rule => rules.push(rule))
  // Evaluate the competing selectors for a rounded Card inside the editor.
  for (const dark of [false, true]) {
    const paint = {}, priority = {}
    for (const rule of rules) {
      const editor = rule.selector.includes('.promotions-editor'), surface = rule.selector === '.auna-surface'
      if ((!editor && !surface) || (rule.selector.includes('.dark') && !dark)) continue
      const specificity = surface ? 1 : rule.selector.includes('.dark') ? 3 : 2
      rule.walkDecls(d => { if (specificity >= (priority[d.prop] ?? 0)) { paint[d.prop] = d.value; priority[d.prop] = specificity } })
    }
    assert.equal(paint.background, 'hsl(var(--auna-surface-card))')
    assert.equal(paint['border-color'], 'hsl(var(--auna-surface-border))')
    assert.equal(paint['box-shadow'], 'var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000)')
    assert.equal(paint.border, undefined, 'El borde del Card no debe recibir un color paralelo al token')
  }
})

const lines = Array.from({ length: 15 }, (_, i) => ({ product_id: `p${i}`, name: `Producto ${i}`, barcode: `SKU${i}`, unitPrice: 10, stock: 20, qty: 2 }))
test('new order keeps all draft lines and editable quantities inside an accessible scroller', () => {
  const result = renderPage('../orders/pages/NewOrderPage.tsx', {}, { 3: lines })
  region(result, 'order-lines-scroll')
  assert.match(result.html, /SKU14/)
  assert.equal((result.html.match(/aria-label="Cantidad de Producto/g) || []).length, 15)
  const input = result.nodes.find(n => n.props['aria-label'] === 'Cantidad de Producto 14')
  input.props.onChange({ target: { value: '3' } })
  assert.equal(result.changes.at(-1).value[14].qty, '3')
  assert.match(result.html, /Total estimado/)
})
test('new order displays server-resolved wholesale prices and never allows saving fallback prices',()=>{
  const query={...base['@tanstack/react-query'],useQuery:()=>({data:{unit_prices:{p0:9}},isPlaceholderData:false})}
  const data=[{product_id:'p0',name:'Servicio QA',barcode:'QA',unitPrice:100,qty:'1.25',kind:'SERVICE',quantityDecimals:2,serviceUnitLabel:'Hora'}]
  const loaded=renderPage('../orders/pages/NewOrderPage.tsx',{'@tanstack/react-query':query},{3:data})
  assert.match(loaded.html,/11.25/)
  const pending=renderPage('../orders/pages/NewOrderPage.tsx',{'@tanstack/react-query':{...query,useQuery:()=>({data:undefined,isFetching:true})}},{3:data})
  const save=pending.nodes.find(n=>n.props.onClick && n.props.children?.includes?.('Crear pedido'))
  assert.ok(save);assert.equal(save.props.disabled,true)
})

test('new quote keeps all draft lines in a bounded scroller and preserves quantity edits', () => {
  const cart = lines.map(line => ({ id: line.product_id, name: line.name, qty: line.qty, price: 10, product: { id: line.product_id, name: line.name, barcode: line.barcode, stock: 20 } }))
  const result = renderPage('../quotes/NewQuotePage.tsx', {}, { 7: cart })
  region(result, 'quote-lines-scroll')
  assert.match(result.html, /SKU14/)
  result.nodes.find(n => n.props['aria-label'] === 'Cantidad de Producto 14').props.onChange({ target: { value: '3' } })
  assert.equal(result.changes.at(-1).value[14].qty, '3')
})

test('private quote lines keep existing pagination outside their accessible scroller', () => {
  const nodes = []
  const { QuoteLines } = loadReportModule('../quotes/QuotePresentation.tsx', base, nodes)
  const html = renderToStaticMarkup(React.createElement(QuoteLines, { lines: lines.map(line => ({ ...line, code: line.barcode, unit_price: 10, line_total: 20 })), money: value => `Q ${value}` }))
  region({ nodes }, 'quote-lines-scroll')
  assert.match(html, /SKU9/)
  assert.doesNotMatch(html, /SKU10/)
  assert.ok(html.indexOf('</section>') < html.indexOf('auna-pagination-outside'))
})

const sale = { id: 'qa-sale', reference: 'V-QA', customer: 'Cliente QA', return_policy: { enabledResolutions: ['REFUND_ORIGINAL'] }, sale_items: lines.map((line, i) => ({ id: i + 1, product_id: line.product_id, available_to_return: 5, estimated_unit_refund: 10, product: { name: line.name, barcode: line.barcode } })) }
test('return creation keeps selectable products in the scroller and preserves invalid drafts for validation', () => {
  const result = renderPage('../returns/pages/NewReturn.tsx', {
    '../hooks/useReturns': { useCreateReturn: () => mutation },
    '@tanstack/react-query': { ...base['@tanstack/react-query'], useQuery: () => ({ data: { items: [], totalPages: 1, totalItems: 0 } }) },
  }, { 2: sale })
  region(result, 'return-lines-scroll')
  assert.match(result.html, /SKU14/)
  result.nodes.find(n => n.props['aria-label'] === 'Cantidad para Producto 14').props.onChange({ target: { value: '99' } })
  assert.equal(result.changes.at(-1).value[15], '99')
})

test('return detail preserves returned products in a bounded accessible region', () => {
  const record = { id: 'qa-return', sale_id: 'qa-sale', reference: 'D-QA', return_date: '2026-10-09', status: { name: 'Pendiente' }, total_refund: 300, sale, return_items: sale.sale_items.map(item => ({ ...item, qty_returned: 2, unit_price: 10, subtotal: 20 })) }
  const result = renderPage('../returns/pages/ReturnDetailPage.tsx', {
    '../hooks/useReturns': { useReturnById: () => ({ data: record }), useUpdateReturnStatus: () => mutation, useApproveReturn: () => mutation, useCompleteReturn: () => mutation },
    '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: [] }) },
  })
  region(result, 'return-lines-scroll')
  assert.match(result.html, /Producto 14/)
  assert.match(result.html, /Revisar y aprobar/)
})

test('contact listing uses shared tabs and a semantic table without losing data or keyboard actions', () => {
  const navigations = []
  const result = renderPage('../contacts/pages/SuppliersManagement.tsx', {
    'react-router-dom': { ...base['react-router-dom'], useNavigate: () => url => navigations.push(url) },
    '@/hooks/useSuppliers': { useSuppliers: () => ({ data: { items: [{ id: 'qa-contact', name: 'Contacto QA', party_type: 'SUPPLIER', status: 'active', phone: '5555', email: 'qa@example.test', address: 'Dirección QA', contact: 'Responsable', category: 'Bebidas' }], totalItems: 1, totalPages: 1 } }) },
    '@/hooks/useCategories': { useCategories: () => ({ data: [] }) },
    '@/hooks/usePaymentTerms': { usePaymentTerms: () => ({ data: [] }) },
    '@/hooks/useSupplier': { useSupplier: () => ({ data: null }) },
    '@/hooks/useUpdateSupplier': { useUpdateSupplier: () => mutation },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 20, viewMode: 'table' }), useResetPageOnFilterChange() {} },
  })
  assert.match(result.html, /max-w-\[1560px\]/)
  assert.match(result.html, /role="tablist"/)
  assert.match(result.html, /auna-data-table/)
  assert.match(result.html, /Contacto QA/)
  assert.match(result.html, /contact-no-image.svg/)
  assert.ok(!result.nodes.some(n => n.type === 'tr' && n.props.role === 'button'), 'Table rows retain table semantics; actions are keyboard-accessible buttons')
  const detail = result.nodes.find(n => n.props['aria-label'] === 'Ver Contacto QA')
  detail.props.onClick()
  assert.deepEqual(navigations, ['/contactos/qa-contact'])
})
