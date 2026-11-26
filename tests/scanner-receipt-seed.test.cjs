const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { hookHarness } = require('./helpers/reportHookHarness.cjs')
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture({ supplier = true, read, identity: initialIdentity = 'same', permission = true, paymentTerms = [] } = {}) {
  const h = hookHarness(), nodes = [], requests = [], destinations = [], writes = [], notices = []
  let identity = initialIdentity, company = 'A'
  const location = { pathname: '/inventario/registrar-ingreso', search: '?codigo=00123&empresa=A&sucursal=B', state: { receiptScan: { code: '00123', productId: 'P', identity: 'same' } } }
  const product = { id: 'P', name: 'Agua', barcode: '00123', kind: 'STANDARD', cost: '2', price: '5', supplier: supplier ? { id: 'SUP', name: 'Proveedor habitual' } : null }
  const { RegisterIncomingMerchandise: Page } = loadReportModule('../merchandise/pages/RegisterIncomingMerchandise.tsx', {
    react: h.hooks, 'react-router-dom': { useLocation: () => location, useNavigate: () => (path, options) => destinations.push({ path, options }) },
    '@tanstack/react-query': { useQuery: () => ({ data: [] }), useQueryClient: () => ({ invalidateQueries() {} }) },
    '@/context/useTenant': { useTenant: () => ({ company: { id: company }, branch: { id: 'B' }, registerTenantExitGuard() {} }) },
    '@/context/useAuth': { useAuth: () => ({ user: { id: 'U' } }) }, '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => permission }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ inventoryUnitsEnabled: false, currencyCode: 'GTQ', locale: 'es-GT' }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: value => notices.push(value) }) }, '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: [] }) },
    '@/hooks/useSupplier': { useSupplier: id => ({ data: id ? { id, name: 'Proveedor habitual', paymentTermsList: paymentTerms } : null }) },
    '@/services/supplierService': { adaptApiSupplier: value => value }, '@/components/shared/ScannerField': { ScannerField: () => null },
    '@/modules/appointments/components/DraftGuard': { useDraftGuard: () => ({ dialog: null, request: fn => fn(), proceed: fn => fn() }) },
    '@/services/contextScannerService': { scannerIdentity: () => identity, resolveContextScan: async (...args) => { requests.push(args); return read ? read(...args) : { product: args[0] === '002' ? { ...product, id: 'P2', name: 'Otra agua' } : product, presentationId: null } } },
    '@/services/api': { apiFetch: async (...args) => { writes.push(args); throw Error('No writes expected') } }, './api': { apiFetch: async () => [] },
  }, nodes)
  const render = () => { nodes.length = 0; h.render(() => Page()) }
  return { h, nodes, product, location, requests, destinations, writes, notices, render, setIdentity: value => { identity = value }, setCompany: value => { company = value } }
}
const quantity = (f, name = 'Agua') => f.nodes.find(n => n.props['aria-label'] === `Cantidad de ${name}`)
const settle = async f => { await tick(); f.render(); await tick(); f.render() }
test('dashboard receipt seed preselects supplier and stages exactly one product, with further scans and no writes', async () => {
  const f = fixture()
  try {
    f.render(); await settle(f)
    assert.equal(f.requests[0][1], 'PURCHASE')
    assert.equal(f.nodes.find(n => n.type?.name === 'SupplierPicker').props.label, 'Proveedor habitual')
    assert.ok(quantity(f)); assert.equal(quantity(f).props.value, '1')
    assert.equal(f.nodes.find(n => n.props.id === 'receipt-notes').props.value, '')
    assert.equal(f.nodes.find(n => n.props.id === 'receipt-status').props.value, 'PENDING')
    await f.nodes.find(n => n.type?.name === 'ScannerField').props.onScan('002', new AbortController().signal); f.render()
    assert.ok(quantity(f, 'Otra agua')); assert.equal(f.writes.length, 0)
    assert.ok(f.destinations.some(d => d.options.replace && !String(d.path).includes('codigo=')))
    assert.equal(f.nodes.filter(n => n.props['aria-label'] === 'Cantidad de Agua').length, 1)
  } finally { f.h.unmount() }
})
test('product without supplier stays prepared until the user selects one, instead of guessing a supplier', async () => {
  const f = fixture({ supplier: false })
  try {
    f.render(); await settle(f); assert.equal(quantity(f), undefined)
    f.nodes.find(n => n.type?.name === 'SupplierPicker').props.onSelect({ id: 'MANUAL', name: 'Elegido por usuario' }); f.render(); f.render()
    assert.ok(quantity(f)); assert.equal(f.writes.length, 0)
  } finally { f.h.unmount() }
})
test('foreign company, old session and missing permission seeds never resolve or preselect', async () => {
  for (const options of [{ identity: 'old' }, { permission: false }, { foreign: true }]) {
    const f = fixture(options)
    try { if (options.foreign) f.setCompany('OTHER'); f.render(); await settle(f); assert.equal(f.requests.length, 0); assert.equal(quantity(f), undefined) }
    finally { f.h.unmount() }
  }
})
test('a reassigned code cannot prepare the wrong product and a failed read has an explicit retry', async () => {
  let attempt = 0
  const f = fixture({ read: async () => { if (!attempt++) throw Error('Unavailable'); return { product: { id: 'OTHER', name: 'Otro', supplier: { id: 'SUP', name: 'Proveedor' } }, presentationId: null } } })
  try {
    f.render(); await settle(f)
    const retry = f.nodes.find(n => n.props.children === 'Reintentar preparación'); assert.ok(retry)
    retry.props.onClick(); f.render(); await settle(f)
    assert.equal(quantity(f), undefined); assert.equal(f.writes.length, 0); assert.equal(f.requests.length, 2)
    assert.ok(f.nodes.some(n => n.props.role === 'alert'))
  } finally { f.h.unmount() }
})
test('late seed result cannot populate another company form', async () => {
  let finish; const f = fixture({ read: () => new Promise(resolve => { finish = resolve }) })
  try {
    f.render(); f.setCompany('OTHER'); f.render()
    assert.equal(f.requests[0][2].aborted, true)
    finish({ product: f.product, presentationId: null }); await settle(f)
    assert.equal(quantity(f), undefined); assert.equal(f.destinations.length, 0)
  } finally { f.h.unmount() }
})
test('a new session during preparation discards the result and releases the loading state', async () => {
  let finish; const f = fixture({ read: () => new Promise(resolve => { finish = resolve }) })
  try {
    f.render(); f.setIdentity('new-session')
    finish({ product: f.product, presentationId: null }); await settle(f)
    assert.equal(quantity(f), undefined)
    assert.equal(f.nodes.find(n => n.type?.name === 'ScannerField').props.enabled, true)
    assert.ok(f.nodes.some(n => n.props.role === 'alert'))
  } finally { f.h.unmount() }
})
test('receipt handoff leaves the payment condition to the user even when the supplier has a default', async () => {
  const f = fixture({ paymentTerms: [{ id: 8, name: 'Treinta días', isDefault: true, netDays: 30 }] })
  try {
    f.render(); await settle(f)
    assert.ok(quantity(f))
    assert.equal(f.nodes.find(n => n.props.id === 'receipt-term').props.value, '')
    assert.equal(f.nodes.find(n => n.props.id === 'receipt-due').props.value, '')
  } finally { f.h.unmount() }
})
test('prepared and newly scanned products leave focus on the receipt scanner for consecutive reads', async () => {
  const previous = global.document, focuses = [], f = fixture()
  global.document = { querySelector: selector => ({ focus: () => focuses.push(selector) }), getElementById: () => { throw Error('New products must not steal focus for quantity editing') } }
  try {
    f.render(); await settle(f)
    assert.deepEqual(focuses, ['#receipt-scanner [data-scanner-trigger][aria-expanded="false"]'])
    await f.nodes.find(n => n.type?.name === 'ScannerField').props.onScan('002', new AbortController().signal); f.render()
    assert.deepEqual(focuses, ['#receipt-scanner [data-scanner-trigger][aria-expanded="false"]', '#receipt-scanner [data-scanner-trigger][aria-expanded="false"]'])
  } finally { f.h.unmount(); global.document = previous }
})
test('a later dashboard seed preserves manual receipt fields and pending scans', async () => {
  for (const pendingScan of [false, true]) {
    const f = fixture()
    try {
      const search = f.location.search, state = f.location.state
      f.location.search = ''; f.location.state = null; f.render()
      if (pendingScan) await f.nodes.find(n => n.type?.name === 'ScannerField').props.onScan('002', new AbortController().signal)
      else f.nodes.find(n => n.props.id === 'receipt-due').props.onChange({ target: { value: '2027-01-15' } })
      f.render()
      f.location.search = search; f.location.state = state; f.render(); await settle(f)
      assert.equal(quantity(f), undefined)
      assert.equal(f.nodes.find(n => n.type?.name === 'SupplierPicker').props.label, 'Seleccionar proveedor…')
      assert.ok(f.nodes.some(n => n.props.role === 'alert'))
      if (!pendingScan) assert.equal(f.nodes.find(n => n.props.id === 'receipt-due').props.value, '2027-01-15')
      else {
        f.nodes.find(n => n.type?.name === 'SupplierPicker').props.onSelect({ id: 'MANUAL', name: 'Elegido' }); f.render(); f.render()
        assert.ok(quantity(f, 'Otra agua')); assert.equal(quantity(f), undefined)
      }
      assert.equal(f.writes.length, 0)
    } finally { f.h.unmount() }
  }
})
test('removing a pending dashboard seed releases the form and ignores its late result', async () => {
  let finish; const f = fixture({ read: () => new Promise(resolve => { finish = resolve }) })
  try {
    f.render(); f.location.search = ''; f.location.state = null; f.render(); f.render()
    assert.equal(f.requests[0][2].aborted, true)
    assert.equal(f.nodes.find(n => n.type?.name === 'ScannerField').props.enabled, true)
    assert.equal(f.nodes.some(n => n.props.role === 'status'), false)
    finish({ product: f.product, presentationId: null }); await settle(f)
    assert.equal(quantity(f), undefined); assert.equal(f.destinations.length, 0)
  } finally { f.h.unmount() }
})
test('an aborted seed cannot release the loading state of its replacement', async () => {
  const finish = [], f = fixture({ read: () => new Promise(resolve => finish.push(resolve)) })
  try {
    f.render()
    f.location.search = '?codigo=002&empresa=A&sucursal=B'
    f.location.state = { receiptScan: { code: '002', productId: 'P2', identity: 'same' } }; f.render()
    finish[0]({ product: f.product, presentationId: null }); await settle(f)
    assert.equal(f.nodes.find(n => n.type?.name === 'ScannerField').props.enabled, false)
    finish[1]({ product: { ...f.product, id: 'P2', name: 'Otra agua' }, presentationId: null }); await settle(f)
    assert.ok(quantity(f, 'Otra agua')); assert.equal(quantity(f), undefined)
    assert.equal(f.nodes.find(n => n.type?.name === 'ScannerField').props.enabled, true)
  } finally { f.h.unmount() }
})
