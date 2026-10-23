const test=require('node:test'),assert=require('node:assert/strict'),{manualPage}=require('./helpers/manualSaleHarness.cjs')
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const draft={id:'V',reference:'V-001',version:2,status:'DRAFT',customerId:'C',customerName:'Cliente',customerNit:'',total:'20.50',items:[{id:1,productId:'P',name:'Producto',kind:'STANDARD',qty:'2',unitPrice:'10.25',lineTotal:'20.50',unitLabel:'unidad',quantityDecimals:0}]}
test('scan adds or increments a manual draft without saving it and is unavailable for a quote agreement',async()=>{
 const h=manualPage();try{h.render();let view=h.render();const field=view.nodes.find(n=>n.type.name==='ScannerField');assert.ok(field)
  await field.props.onScan('001',new AbortController().signal);h.render();await field.props.onScan('001',new AbortController().signal);view=h.render()
  assert.equal(view.nodes.find(n=>n.props['aria-label']==='Cantidad de Producto').props.value,'2');assert.equal(h.writes.length,0)
 }finally{h.cleanup()}
 const locked=manualPage({draft:{...draft,originQuote:{id:'q',reference:'C-1'}}});try{locked.render();await flush();await flush();assert(!locked.render().nodes.some(n=>n.type.name==='ScannerField'))}finally{locked.cleanup()}
})
test('quote-origin draft displays its agreement without editable lines but can still be confirmed',async()=>{
 const h=manualPage({draft:{...draft,originQuote:{id:'Q',reference:'C-001'}}});try{
  h.render();await flush();await flush();const view=h.render()
  assert.match(view.html,/C-001/);assert.doesNotMatch(view.html,/Guardar borrador/)
  assert.equal(view.nodes.find(n=>n.props['aria-label']==='Cantidad de Producto')?.props.disabled??true,true)
  assert.equal(view.nodes.find(n=>n.props['aria-label']==='Confirmar venta').props.disabled,false)
  assert(!view.nodes.some(n=>n.type.name==='ProductPicker'))
 }finally{h.cleanup()}
})
test('manual creation has customer and line editor, not POS payment or cash session controls',async()=>{
 const h=manualPage();try{const {html}=h.render();assert.match(html,/Nueva venta/);assert.match(html,/Guardar borrador/);assert.doesNotMatch(html,/Monto recibido|Abrir caja|Método de pago|Elegir caja/)}finally{h.cleanup()}
})
test('product selection saves a server priced draft and opens its stable editor URL',async()=>{
 const h=manualPage();try{
  h.render();h.render().nodes.find(n=>n.type.name==='ProductPicker').props.onPick(h.product);h.render();await flush();h.render()
  const save=h.render().nodes.find(n=>n.props['aria-label']==='Guardar borrador');assert.equal(save.props.disabled,false);await save.props.onClick()
  assert.equal(h.writes.length,1);assert.equal(h.writes[0].kind,'save');assert.equal(h.writes[0].input.items[0].product_id,'P');assert.equal(h.writes[0].input.items[0].expected_unit_price,'10.25')
  assert.deepEqual(h.navigations,['/ventas/V/editar'])
 }finally{h.cleanup()}
})
test('saved draft confirms separately; unsaved quantity changes disable confirmation',async()=>{
 const h=manualPage({draft});try{
  h.render();await flush();await flush();let view=h.render()
  assert.equal(view.nodes.find(n=>n.props['aria-label']==='Confirmar venta').props.disabled,false)
  const quantity=view.nodes.find(n=>n.props['aria-label']==='Cantidad de Producto');quantity.props.onChange({target:{value:'3'}})
  view=h.render();assert.equal(view.nodes.find(n=>n.props['aria-label']==='Confirmar venta').props.disabled,true);assert.equal(h.writes.length,0)
 }finally{h.cleanup()}
})
test('consolidated scope does not offer a writable manual sale',()=>{
 const h=manualPage({scope:{companyId:'A',branchId:'all'}});try{assert.match(h.render().html,/Selecciona una sucursal/);assert.equal(h.writes.length,0)}finally{h.cleanup()}
})
test('explicit confirmation sends only version, due date and credit decision, never money received',async()=>{
 const h=manualPage({draft});try{
  h.render();await flush();await flush();let view=h.render()
  view.nodes.find(n=>n.props.id==='manual-due').props.onChange({target:{value:'2099-01-01'}});view=h.render()
  view.nodes.find(n=>n.props['aria-label']==='Confirmar venta').props.onClick();view=h.render()
  const dialog=view.nodes.find(n=>n.type.name==='ConfirmDialog'&&n.props.open);assert.ok(dialog);await dialog.props.onConfirm()
  assert.equal(h.writes[0].kind,'confirm');assert.equal(h.writes[0].input.expectedVersion,2);assert.equal(h.writes[0].input.dueDate,'2099-01-01');assert.equal(h.writes[0].input.amount_received,undefined);assert.deepEqual(h.navigations,['/ventas/V/factura'])
 }finally{h.cleanup()}
})
test('a lost save response reuses the same attempt key on retry',async()=>{
 let calls=0;const h=manualPage({save:async()=>{calls++;throw Error('network interrupted')}});try{
  h.render();h.render().nodes.find(n=>n.type.name==='ProductPicker').props.onPick(h.product);h.render();await flush();let view=h.render()
  await view.nodes.find(n=>n.props['aria-label']==='Guardar borrador').props.onClick();view=h.render()
  await view.nodes.find(n=>n.props['aria-label']==='Guardar borrador').props.onClick();assert.equal(calls,2);assert.equal(h.writes[0].input.idempotencyKey,h.writes[1].input.idempotencyKey);assert.equal(h.navigations.length,0)
 }finally{h.cleanup()}
})
