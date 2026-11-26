const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { hookHarness } = require('./helpers/reportHookHarness.cjs')
function fixture(canViewCosts = true) {
  const h = hookHarness(), nodes = []
  const { RegisterIncomingMerchandise } = loadReportModule('../merchandise/pages/RegisterIncomingMerchandise.tsx', {
    react: h.hooks, 'react-router-dom': { useLocation: () => ({pathname:'/inventario/registrar-ingreso',search:'',state:null}), useNavigate: () => () => {} },
    '@tanstack/react-query': { useQuery: () => ({ data: [] }), useQueryClient: () => ({ invalidateQueries() {} }) },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'A' }, branch: { id: 'B' }, registerTenantExitGuard() {} }) },
    '@/context/useAuth': { useAuth: () => ({ user: { id: 'U' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: p => p!=='products.view_costs'||canViewCosts }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ inventoryUnitsEnabled: false, currencyCode: 'GTQ', locale: 'es-GT' }) },
    '@/hooks/useToast': {}, '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: [{ id: 1, name: 'Efectivo', is_credit: false }] }) },
    '@/hooks/useSupplier': { useSupplier: () => ({ data: { id: 'SUP', name: 'Proveedor', paymentTermsList: [] } }) },
    '@/services/supplierService': { adaptApiSupplier: p => p },
    '@/modules/appointments/components/DraftGuard': { useDraftGuard: () => ({ dialog: null, request: fn => fn(), proceed: fn => fn() }) },
    '@/services/api': { apiFetch() { throw Error('No real network') } }, './api': { apiFetch() { throw Error('No real network') } },
    '@/components/shared/ScannerField': { ScannerField: () => null },
  }, nodes)
  const render = () => { nodes.length = 0; h.render(() => RegisterIncomingMerchandise()) }
  const field = id => nodes.findLast(n => n.props.id === id)
  return { h, nodes, render, field }
}
function containsId(node, id) {
  if (!node || typeof node !== 'object') return false
  if (node.props?.id === id) return true
  return [node.props?.children].flat(Infinity).some(child => containsId(child, id))
}
test('an operator without cost access must enter the invoice cost, not accept a fabricated zero',()=>{
 const f=fixture(false);f.render()
 f.nodes.find(n=>n.type?.name==='SupplierPicker').props.onSelect({id:'SUP',name:'Proveedor'});f.render()
 f.nodes.find(n=>n.type?.name==='ProductPicker').props.onPick({id:'P',name:'Producto',price:10,cost:0,stock:2});f.render()
 assert.equal(f.nodes.find(n=>n.props['aria-label']==='Costo de Producto').props.value,'')
 f.h.unmount()
})
test('purchase payment fields only occupy space for a paid receipt and preserve entered values when toggled', () => {
  const f = fixture()
  try {
    f.render(); assert.equal(f.field('receipt-method'), undefined); assert.equal(f.field('receipt-paid'), undefined)
    f.field('receipt-status').props.onChange({ target: { value: 'PAID' } }); f.render()
    assert.equal(f.field('receipt-method').props.required, true)
    assert.equal(f.field('receipt-paid').props.disabled, undefined)
    f.field('receipt-reference').props.onChange({ target: { value: 'Referencia local' } }); f.render()
    f.field('receipt-status').props.onChange({ target: { value: 'PENDING' } }); f.render()
    assert.equal(f.field('receipt-method'), undefined)
    f.field('receipt-status').props.onChange({ target: { value: 'PAID' } }); f.render()
    assert.equal(f.field('receipt-reference').props.value, 'Referencia local')
  } finally { f.h.unmount() }
})
test('optional purchase notes and editable due date are grouped without hiding required supplier or status', () => {
  const f = fixture()
  try {
    f.render()
    const extra = f.nodes.find(n => n.type === 'details' && containsId(n, 'receipt-notes'))
    assert.ok(extra); assert.ok(containsId(extra, 'receipt-due')); assert.ok(!extra.props.open)
    assert.ok(f.nodes.find(n => n.type?.name === 'SupplierPicker'))
    assert.ok(f.field('receipt-status'))
    const scan = f.nodes.find(n => n.type?.name === 'ScannerField')
    assert.equal(scan.props.compact, true)
    f.field('receipt-notes').props.onChange({ target: { value: 'Conservar nota' } }); f.render()
    assert.equal(f.field('receipt-notes').props.value, 'Conservar nota')
  } finally { f.h.unmount() }
})
