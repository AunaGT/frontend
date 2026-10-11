const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

const common = {
  '@/services/api': { apiFetch() { throw Error('Unexpected network request') } },
  './api': { apiFetch() { throw Error('Unexpected network request') } },
  '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
  '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => true }) },
  '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala' }) },
  '@/context/useAuth': { useAuth: () => ({ user: { id: 'reviewer' }, refreshUser() {} }) },
  '@/context/useTenant': { useTenant: () => ({ branch: { id: 'branch-a', name: 'Centro' }, company: { id: 'company', name: 'Empresa' }, companies: [], branches: [], setCompany() {} }) },
  '@/components/layout/PageNavigation': { usePageTrail() {} },
}
function render(file, mocks = {}, exported = 'default') {
  const nodes = []
  const Page = loadReportModule(file, { ...common, ...mocks }, nodes)[exported]
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
  return { html, nodes }
}
const idle = { isLoading: false, isFetching: false, isError: false, refetch() {} }
const queryMock = query => ({ useQuery: query, useMutation: () => ({ isPending: false }), useQueryClient: () => ({ invalidateQueries() {} }) })

test('branch and warehouse pages keep pagination bounded and detail controls named for their row', () => {
  const branches = Array.from({ length: 180 }, (_, i) => ({ id: `branch-${i}`, company_id: 'company', name: `Sucursal ${String(i).padStart(3, '0')}`, code: `S${i}`, active: true, operational_status: 'OPERATING', manager: null }))
  const warehouses = Array.from({ length: 180 }, (_, i) => ({ id: `warehouse-${i}`, name: `Almacén ${String(i).padStart(3, '0')}`, code: `A${i}`, branch_id: 'branch-a', branch: { name: 'Centro', active: true }, active: true, kind: 'BODEGA', locations: [], dispatch_priority: 100 }))
  const mocks = { '@tanstack/react-query': queryMock(config => ({ ...idle, data: config.queryKey[0] === 'branches' ? branches : config.queryKey[0] === 'warehouses' ? warehouses : [] })) }
  for (const [file, exported, props, name, total] of [
    ['../branches/pages/BranchesManagement.tsx', 'default', null, 'Sucursal 000', 180],
    ['../branches/pages/WarehousesCard.tsx', 'WarehousesCard', { canManage: true, branches }, 'Almacén 000', 180],
  ]) {
    const nodes = []
    const Page = loadReportModule(file, { ...common, ...mocks }, nodes)[exported]
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page, props)))
    assert.match(html, new RegExp(`aria-label="Ver detalles de ${name}"`))
    const nav = html.match(/<nav[^>]*aria-label="Paginación de [^"]+"[\s\S]*?<\/nav>/)?.[0]
    assert.ok(nav, 'pagination must expose its navigation name')
    assert.ok((nav.match(/<button/g) || []).length <= 7, 'large lists render at most five pages plus previous and next')
    assert.match(html, new RegExp(`de ${total} (sucursales|almacenes)`))
    if (!props) assert.match(html, /role="tablist" aria-label="Secciones del módulo"/)
  }
})

test('count session presents totals before filters while keeping count fields and approval actions available', () => {
  const session = { id: 'session-a', name: 'Conteo QA', status: 'IN_PROGRESS', createdBy: { id: 'creator', name: 'Encargado', email: 'qa@example.test' }, warehouse: { id: 'warehouse-a', name: 'Bodega', code: 'BOD' }, created_at: '2026-10-01T12:00:00Z', started_at: null, submitted_at: null, approved_at: null, cancelled_at: null, notes: null, cancel_reason: null, submit_reason: null, first_approved_at: null, first_approval_reason: null, final_approval_reason: null, scope_json: { doubleCount: true }, dual_approval: true, progress: { totalLines: 31, countedLines: 30, pct: 97 }, totals: { sumStockSnapshot: 100, valueDeltaApprox: 5, unchangedLines: 20, differenceLines: 10, notFoundLines: 0, mismatchLines: 0 }, _count: { lines: 31 } }
  const line = { id: 'line-a', session_id: 'session-a', product_id: 'product-a', stock_snapshot: 3, qty_counted: 3, qty_counted_secondary: null, counted_at: null, counted_secondary_at: null, counted_by_id: null, counted_secondary_by_id: null, note: null, product: { id: 'product-a', name: 'Agua', barcode: '740', stock: 3, cost: 1, category: { id: 1, name: 'Bebidas' } }, location: { id: 'location-a', code: 'GENERAL', name: null, warehouse: { id: 'warehouse-a', name: 'Bodega', code: 'BOD' } }, difference: 0, valueDifference: 0, countMismatch: false }
  const mocks = { '@tanstack/react-query': queryMock(config => ({ ...idle, data: config.queryKey[0] === 'inventory-session' ? session : config.queryKey[0] === 'inventory-lines' ? { data: [line], total: 31 } : [] })) }
  const { html, nodes } = render('../inventory-count/pages/InventoryCountSessionPage.tsx', mocks)
  const strip = html.match(/<section[^>]*aria-label="Resumen del conteo"[\s\S]*?<\/section>/)?.[0]
  assert.ok(strip, 'session metrics use the shared accessible summary')
  for (const value of ['30', '20', '10', '0']) assert.match(strip, new RegExp(`>${value}<\/strong>`))
  assert.ok(html.indexOf(strip) < html.indexOf('aria-label="Escanear o buscar producto"'))
  assert.match(html, /aria-label="Cantidad contada de Agua"/)
  assert.match(html, /aria-label="Comprobación de Agua"/)
  const submit = nodes.find(node => React.Children.toArray(node.props?.children).some(child => child === 'Enviar a revisión'))
  assert.equal(submit.props.disabled, true, 'an incomplete second count must still prevent submission')
  session.status = 'IN_REVIEW'
  assert.match(render('../inventory-count/pages/InventoryCountSessionPage.tsx', mocks).html, /Revisar conteo \(paso 1 de 2\)/)
})

test('transfer search and per-product quantity and remove controls have accessible names', () => {
  let index = 0
  const transfer = { id: 'transfer-a', reference: 'TR-001', status: 'EN_TRANSITO', from_branch_id: 'branch-b', to_branch_id: 'branch-a', sent_at: '2026-10-01T12:00:00Z', received_at: null, notes: null, fromBranch: { id: 'branch-b', name: 'Norte', code: 'NOR' }, toBranch: { id: 'branch-a', name: 'Centro', code: 'CTR' }, lines: [{ id: 'line-a', product_id: 'product-a', product: { id: 'product-a', name: 'Agua', barcode: '740' }, qty_sent: 3, qty_received: null }] }
  const { html, nodes } = render('../transfers/pages/TransfersManagement.tsx', {
    react: { ...React, useState: initial => { const position = index++; return React.useState(position === 8 ? transfer : position === 12 ? [{ product_id: 'product-a', name: 'Agua', qty: 3 }] : initial) } },
    '@tanstack/react-query': queryMock(config => ({ ...idle, data: config.queryKey[0] === 'transfers' ? { items: [], totalItems: 0, totalPages: 1, summary: { total: 0, inTransit: 0, received: 0, cancelled: 0 } } : [] })),
  }, 'TransfersManagement')
  assert.match(html, /aria-label="Buscar traslados"/)
  assert.match(html, /role="tab"[^>]*aria-label="Tabla"/)
  assert.match(html, /role="tab"[^>]*aria-label="Tarjetas"/)
  for (const label of ['Cantidad a enviar de Agua', 'Cantidad recibida de Agua', 'Quitar Agua del traslado']) {
    assert.ok(nodes.some(node => node.props?.['aria-label'] === label), `missing ${label}`)
  }
})
