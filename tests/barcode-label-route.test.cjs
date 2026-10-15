const {test}=require('node:test'),assert=require('node:assert/strict'),{mountBarcodePrintPage,OTHER}=require('./helpers/barcodePrintHarness.cjs')
test('print view inherits authorized Inventory branch and filters rather than global branch',()=>{
  const page=mountBarcodePrintPage({filters:{branchId:OTHER,inBranch:true,warehouseId:'55555555-5555-4555-8555-555555555555'}})
  assert.equal(page.scope.branchId,OTHER);assert.equal(page.scope.initialFilters.inBranch,true);page.unmount()
})
test('assignment needs confirmation and denied export disables prepare',()=>{
  const page=mountBarcodePrintPage({missing:true})
  const prepare=page.nodes.find(n=>n.props.onClick&&String(n.props.children).includes('Preparar PDF'))
  assert.ok(prepare);prepare.props.onClick();page.render();assert.equal(page.calls.length,0)
  const confirm=page.nodes.find(n=>n.props.title==='Asignar códigos antes de imprimir');assert.equal(confirm.props.open,true);confirm.props.onConfirm();assert.deepEqual(page.calls,[{action:'prepare',confirmed:true}]);page.unmount()
  const denied=mountBarcodePrintPage({allowed:false});assert.ok(denied.nodes.find(n=>n.props.onClick&&String(n.props.children).includes('Preparar PDF')).props.disabled);denied.unmount()
})
