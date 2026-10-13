const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { assertPaginationOutside } = require('./pagination-assertions.cjs')

const statement = {
  history: { page: 1, pageSize: 100, total_sales: 1, total_payments: 1, hasNextPage: false },
  customer: { id: 'qa-customer', name: 'Cliente de prueba', contact: 'Responsable', phone: '55555555', email: 'qa@example.test', address: 'Dirección de prueba', tax_id: 'CF', credit_limit: 500, payment_term: { name: 'Crédito 30 días', net_days: 30 } },
  resumen: { saldo: 75, vencido: 25, vencido_30_mas: 10, facturas_abiertas: 1, facturas_vencidas: 1, credito_disponible: 0, saldo_neto: 75, disponible: 425 },
  ventas: [{ id: 'qa-sale', reference: 'FAC-QA', date: '2026-09-01T12:00:00Z', due_date: '2026-09-30T12:00:00Z', total: 100, abonado: 25, saldo: 75, payment_status: 'PARTIAL', vencida: true, dias_vencida: 9 }],
  cobros: [{ id: 'qa-payment', reference: 'REC-QA', paid_at: '2026-09-02T12:00:00Z', amount: 25, notes: 'Abono de prueba', kind: 'PAYMENT', payment_method: { id: 1, name: 'Efectivo' }, registered_by: { id: 'qa-user', name: 'Responsable' }, aplicado: 25, no_aplicado: 0, aplicaciones: [{ sale_id: 'qa-sale', reference: 'FAC-QA', amount: 25 }] }],
}

function renderStatement({ tab = 'MOVEMENTS', allowed = true, consolidated = false, loading = false, error = false, partial = false, data = statement } = {}) {
  let stateIndex = 0
  const nodes = [], changes = [], navigations = [], requests = []
  const Page = loadReportModule('../receivables/pages/CustomerStatementPage.tsx', {
    react: { ...React, useEffect() {}, useState: initial => {
      const i = stateIndex++
      const [value, setValue] = React.useState(i === 12 ? tab : initial)
      return [value, next => { changes.push({ index: i, value: typeof next === 'function' ? next(value) : next }); setValue(next) }]
    } },
    'react-router-dom': { useParams: () => ({ id: 'qa-customer' }), useNavigate: () => target => navigations.push(target), useSearchParams: () => [new URLSearchParams(), () => {}] },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa-company' }, branch: { id: 'qa-branch' }, isConsolidated: consolidated }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => allowed }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ companyName: 'Empresa de prueba', companyLogoUrl: null, currencyCode: 'GTQ', locale: 'es-GT', timezone: 'America/Guatemala' }) },
    '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: [{ id: 1, name: 'Efectivo', is_credit: false }] }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/services/api': { apiFetch() { throw new Error('No live statement requests') } },
    '@/services/supplierService': { fetchSuppliers() { throw new Error('No live customer reads') } },
    '@/services/cashSessionsService': { fetchCashSessionCurrent() { throw new Error('No live session reads') } },
    '@tanstack/react-query': {
      useQueryClient: () => ({ invalidateQueries: async () => {} }),
      useInfiniteQuery: options => options.queryKey[0] === 'receivables'
        ? { data: data ? { pages: [partial ? { ...data, history: { ...data.history, total_sales: 11, total_payments: 9, hasNextPage: true } } : data] } : undefined, isLoading: loading, isError: error, isFetching: false, hasNextPage: partial, isFetchingNextPage: false, isFetchNextPageError: false, refetch: async () => requests.push('retry'), fetchNextPage: async () => requests.push('next-history') }
        : { data: { pages: [] }, isFetching: false, hasNextPage: false },
      useQuery: () => ({ data: { ok: false } }),
      useMutation: () => ({ isPending: false, mutate() { throw new Error('No real payments or adjustments') } }),
    },
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(Page)), nodes, changes, navigations, requests }
}

test('statement puts metrics before filters and keeps the toolbar outside customer and table frames', () => {
  const { html } = renderStatement()
  assert.ok(html.indexOf('Resumen de cartera') < html.indexOf('compact-filter-toolbar'), 'Metrics must precede filters')
  assert.ok(html.indexOf('compact-filter-toolbar') < html.indexOf('auna-surface'), 'Toolbar must not be inside the customer panel')
  assert.match(html, /max-w-\[1560px\]/)
  assertPaginationOutside(html)
})

test('statement tabs, export and page size stay outside the table frame', () => {
  const { html } = renderStatement()
  const frame = html.slice(html.indexOf('auna-data-table-shell'), html.indexOf('</table>'))
  assert.doesNotMatch(frame, /role="tablist"|>Exportar|Filas por página/)
  assert.ok(html.indexOf('Filas por página') < html.indexOf('auna-data-table-shell'))
  assert.match(html, /aria-label="Estado de cuenta"/)
})

test('all statement tabs retain their data and expose mobile field labels', () => {
  for (const tab of ['MOVEMENTS', 'DUE', 'DOCS']) {
    const { html } = renderStatement({ tab })
    assert.match(html, /FAC-QA/)
    assert.match(html, /data-label="Saldo"/)
    assert.match(html, /data-label="Estado"/)
    if (tab === 'MOVEMENTS') {
      assert.match(html, /REC-QA/)
      assert.match(html, /Abono de prueba/)
      assert.match(html, /data-label="Cargo"/)
    } else assert.match(html, /data-label="Vencimiento"/)
  }
})

test('read-only and consolidated statements hide monetary actions but preserve export and receipts', () => {
  for (const options of [{ allowed: false }, { consolidated: true }]) {
    const { html } = renderStatement(options)
    assert.doesNotMatch(html, /Registrar cobro|Ajustar deuda|Eliminar movimiento|Prorrogar vencimiento/)
    assert.match(html, /Estado de cuenta PDF/)
    assert.match(html, /Descargar recibo/)
  }
})

test('partial history remains explicit and does not invent running balances', async () => {
  const { html, nodes, requests } = renderStatement({ partial: true })
  assert.match(html, /Historial parcial: 2 de 20 movimientos/)
  assert.match(html, /data-label="Saldo"[^>]*>—</)
  nodes.find(n => n.props?.children?.includes?.('Cargar más movimientos')).props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requests, ['next-history'])
})

test('moved export and tabs preserve their callbacks and reset pagination', () => {
  const { nodes, changes } = renderStatement()
  nodes.find(n => n.props?.children?.includes?.('Exportar')).props.onClick()
  assert.deepEqual(changes.at(-1), { index: 20, value: true })
  nodes.find(n => n.props?.ariaLabel === 'Estado de cuenta').props.onValueChange('DUE')
  assert.deepEqual(changes.slice(-2), [{ index: 12, value: 'DUE' }, { index: 13, value: 1 }])
})

test('loading and failed statements preserve page gutters and allow retry without showing an empty ledger', async () => {
  const loading = renderStatement({ loading: true, data: null })
  assert.match(loading.html, /p-4 sm:p-8/)
  assert.match(loading.html, /Cargando estado de cuenta/)
  const failed = renderStatement({ error: true, data: null })
  assert.match(failed.html, /p-4 sm:p-8/)
  assert.match(failed.html, /No se pudo cargar el estado de cuenta/)
  assert.doesNotMatch(failed.html, /No hay movimientos/)
  await failed.nodes.find(n => n.props?.children === 'Reintentar').props.onClick()
  assert.deepEqual(failed.requests, ['retry'])
})

test('statement scroll is local and mobile rows have no separate card border', async () => {
  const fs = require('node:fs'), path = require('node:path')
  const file = path.join(__dirname, '../src/modules/receivables/pages/customerStatement.css')
  assert.ok(fs.existsSync(file), 'The statement must have its scoped responsive layout')
  const { root } = await require('postcss')().process(fs.readFileSync(file, 'utf8'), { from: undefined })
  const declarations = selector => {
    const values = new Map()
    root.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(d => values.set(d.prop, d.value)) })
    return values
  }
  assert.equal(declarations('.statement-table-scroll').get('overflow'), 'auto')
  assert.equal(declarations('.statement-table thead').get('position'), 'sticky')
  assert.equal(declarations('.receivables-statement .statement-table tbody > tr').get('border-radius'), '0')
})
