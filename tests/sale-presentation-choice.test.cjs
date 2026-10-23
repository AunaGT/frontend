const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {manualPage}=require('./helpers/manualSaleHarness.cjs')
const {renderPos}=require('./helpers/posPageHarness.cjs')
const p={id:'P',name:'Harina',kind:'STANDARD',price:12.5,stock:100,unitValues:{price:'12.5',priceWholesale:'11',pricePromotion:null,cost:'5',stock:'100',minStock:'0'},unitConfiguration:{base_unit_id:'kg',base_unit:{id:'kg',code:'KG',name:'Kilogramo',label:'kg',quantity_decimals:6},quantity_decimals:6,unit_revision:3,default_sale_presentation_id:'box',default_purchase_presentation_id:null,presentations:[{id:'box',version:1,name:'Caja de 10 kg',label:'caja de 10 kg',factor:'10',quantity_decimals:0,active:true,sale_enabled:true,purchase_enabled:true,prices:{LIST:'120',WHOLESALE:'105'},barcode:'BOX10'}]}}
const apiProduct={id:'P',name:'Harina',kind:'STANDARD',price:'12.5',price_wholesale:'11',cost:'5',stock:'100',min_stock:'0',unit_metadata_version:2,...p.unitConfiguration}
const flush=()=>new Promise(setImmediate)
const picker=view=>view.nodes.find(n=>n.type?.name==='SalePresentationDialog'&&n.props.product)

test('manual pick waits for an explicit presentation and gives quantity its own column',async()=>{
 const h=manualPage();try{
  h.render();h.render().nodes.find(n=>n.type?.name==='ProductPicker').props.onPick(p)
  let view=h.render();assert.equal(view.nodes.some(n=>n.props['aria-label']==='Cantidad de Harina'),false)
  assert.ok(picker(view));picker(view).props.onSelect('box');picker(view).props.onSelect('box');view=h.render()
  assert.equal(view.nodes.filter(n=>n.type?.name==='UnitLineFields').length,1)
  assert.equal(view.nodes.find(n=>n.props['aria-label']==='Cantidad de Harina').props.value,'1')
  assert.equal(view.nodes.find(n=>n.type?.name==='UnitLineFields').props.selection.presentationId,'box')
  assert.match(view.html,/>Cantidad<\/th>/);assert.match(view.html,/>Presentación<\/th>/)
  assert.equal(h.writes.length,0)
 }finally{h.cleanup()}
})
test('canceling a manual presentation choice adds nothing and stale tenant choices cannot add',()=>{
 const h=manualPage();try{
  h.render();h.render().nodes.find(n=>n.type?.name==='ProductPicker').props.onPick(p)
  const pending=picker(h.render());assert.ok(pending);pending.props.onCancel()
  assert.equal(picker(h.render()),undefined)
  h.render().nodes.find(n=>n.type?.name==='ProductPicker').props.onPick(p)
  const stale=picker(h.render());h.setTenant({companyId:'OTHER',branchId:'B2'});h.render();stale.props.onSelect('box')
  assert.equal(h.render().nodes.some(n=>n.props['aria-label']==='Cantidad de Harina'),false)
 }finally{h.cleanup()}
})
test('manual barcode adds the named presentation directly and keeps base quantities separate',async()=>{
 const h=manualPage({scan:async code=>({product:p,presentationId:code==='BOX'?'box':null,unitRevision:3})})
 try{
  h.render()
  for(const code of ['BOX','BOX','BASE']){await h.render().nodes.find(n=>n.type?.name==='ScannerField').props.onScan(code,new AbortController().signal);h.render()}
  const view=h.render(),fields=view.nodes.filter(n=>n.type?.name==='UnitLineFields')
  assert.deepEqual(fields.map(n=>[n.props.selection.presentationId,n.props.quantity]),[['box','2'],[null,'1']])
  assert.equal(picker(view),undefined);assert.equal(h.writes.length,0)
 }finally{h.cleanup()}
})

function pos(options={}){
 const additions=[]
 const config={state:{saleStep:'products'},items:[],products:[p],warehouses:[{locations:[{id:'L',is_sales:true}]}],cartOverrides:{addToCart:(product,selection)=>additions.push({product,selection}),getBaseQuantity:()=> '0'},posAvailability:{availability:{P:{available:100,stock:100,location_stock:100}},ensureCurrent:async()=>({availability:{P:{available:100,stock:100,location_stock:100}}})},...options}
 return{...renderPos(config),additions,config}
}
test('POS tile asks before adding; choosing a box keeps its explicit identity',async()=>{
 const first=pos();first.nodes.find(n=>n.type?.name==='ProductCard').props.onAdd();await flush()
 assert.equal(first.additions.length,0);assert.ok(first.stateUpdates.pendingPresentation)
 const next=pos({state:{saleStep:'products',pendingPresentation:first.stateUpdates.pendingPresentation}})
 const dialog=picker(next);assert.ok(dialog);dialog.props.onSelect('box');dialog.props.onSelect('box');await flush()
 assert.equal(next.additions.length,1);assert.equal(next.additions[0].selection.presentationId,'box')
 assert.equal(next.writes.length,0)
})
test('POS barcode bypasses manual choice and base codes never select the default box',async()=>{
 for(const presentationId of ['box',null]){
  const view=pos({scanProduct:async()=>({product:apiProduct,presentationId,unitRevision:3})})
  await view.nodes.find(n=>n.type?.name==='ScannerField').props.onScan('CODE',new AbortController().signal)
  assert.equal(view.additions.length,1);assert.equal(view.additions[0].selection.presentationId,presentationId)
  assert.equal(view.stateUpdates.pendingPresentation,undefined);assert.equal(view.writes.length,0)
 }
})
test('POS clearly labels the existing-line presentation action',()=>{
 const units=loadReportModule('../inventory/units/selection.ts'),selection=units.selectProductUnit(p,'box')
 const view=pos({items:[{...p,qty:'2',lineKey:'box-line',unitSelection:selection}]})
 assert.ok(view.nodes.find(n=>n.props['aria-label']==='Cambiar presentación de Harina'))
 assert.match(view.html,/Caja de 10 kg/);assert.match(view.html,/20 kg/)
})
test('line choices do not repeat the presentation name and still show the base conversion',()=>{
 const nodes=[],units=loadReportModule('../inventory/units/selection.ts')
 const {UnitLineFields}=loadReportModule('../../components/shared/UnitLineFields.tsx',{'@/services/api':{}},nodes)
 const html=renderToStaticMarkup(React.createElement(UnitLineFields,{product:p,selection:units.selectProductUnit(p,'box'),quantity:'2',onSelect(){},onAcceptRounding(){}}))
 assert.match(html,/20 kg/)
 const option=nodes.find(n=>n.props.value==='box');assert.ok(option)
 const text=children=>Array.isArray(children)?children.map(text).join(''):typeof children==='object'?text(children?.props?.children):String(children??'')
 assert.equal(text(option.props.children),'Caja de 10 kg')
})
test('presentation options show exact tier prices and exclude inactive or purchase-only choices',()=>{
 const nodes=[],calls=[],product=structuredClone(p)
 product.unitConfiguration.presentations.push({...p.unitConfiguration.presentations[0],id:'hidden',active:false},{...p.unitConfiguration.presentations[0],id:'purchase-only',sale_enabled:false})
 const {SalePresentationOptions}=loadReportModule('../sales/components/SalePresentationDialog.tsx',{'@/services/api':{}},nodes)
 let html=renderToStaticMarkup(React.createElement(SalePresentationOptions,{product,priceContext:'LIST',locale:'es-GT',currencyCode:'GTQ',onSelect:id=>calls.push(id)}))
 assert.match(html,/12\.50/);assert.match(html,/120\.00/);assert.match(html,/10 kg/)
 assert.equal(nodes.filter(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Agregar Harina en ')).length,2)
 nodes.find(n=>n.props['aria-label']==='Agregar Harina en Caja de 10 kg').props.onClick();assert.deepEqual(calls,['box'])
 nodes.length=0;html=renderToStaticMarkup(React.createElement(SalePresentationOptions,{product,priceContext:'WHOLESALE',locale:'es-GT',currencyCode:'GTQ',disabled:true,onSelect:id=>calls.push(id)}))
 assert.match(html,/105\.00/);nodes.find(n=>n.props['aria-label']==='Agregar Harina en Caja de 10 kg').props.onClick();assert.deepEqual(calls,['box'])
})
test('a fractional-cent presentation advertises its exact rate rather than a rounded total',()=>{
 const product=structuredClone(p),nodes=[]
 product.unitValues.price='1';product.unitConfiguration.presentations[0].factor='0.125';product.unitConfiguration.presentations[0].prices={}
 const {SalePresentationOptions}=loadReportModule('../sales/components/SalePresentationDialog.tsx',{'@/services/api':{}},nodes)
 const html=renderToStaticMarkup(React.createElement(SalePresentationOptions,{product,priceContext:'LIST',locale:'es-GT',currencyCode:'GTQ',onSelect(){}}))
 assert.match(html,/GTQ 0\.125/);assert.doesNotMatch(html,/0\.13/)
})
test('a stale POS choice cannot add into a different cart or tenant',async()=>{
 const first=pos();first.nodes.find(n=>n.type?.name==='ProductCard').props.onAdd()
 for(const stale of ['scope','generation','session']){
  let generation=0,current=true,additions=0
  const view=pos({state:{saleStep:'products',pendingPresentation:first.stateUpdates.pendingPresentation},checkoutOverrides:{isCurrent:()=>current},cartOverrides:{addToCart:()=>{additions++},getBaseQuantity:()=> '0',getGeneration:()=>generation}})
  const dialog=picker(view);assert.ok(dialog)
  if(stale==='scope')view.pageRefs.currentScope.current='OTHER';else if(stale==='generation')generation++;else current=false
  dialog.props.onSelect('box');await flush();assert.equal(additions,0,stale);assert.equal(view.writes.length,0)
 }
})
test('two box scans and one base scan retain separate real cart lines and consume 21 kg',async()=>{
 const h=require('./helpers/reportHookHarness.cjs').hookHarness()
 const {useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}})
 const read=()=>h.render(()=>useCart({availableProducts:[p]}))
 try{
  const cart=read(),view=pos({realCart:cart,scanProduct:async code=>({product:apiProduct,presentationId:code==='BOX'?'box':null,unitRevision:3})})
  const scan=view.nodes.find(n=>n.type?.name==='ScannerField').props.onScan
  for(const code of ['BOX','BOX','BASE'])await scan(code,new AbortController().signal)
  const lines=read().cartItems;assert.equal(lines.length,2)
  assert.equal(lines.find(l=>l.unitSelection.presentationId==='box').qty,'2')
  assert.equal(lines.find(l=>l.unitSelection.presentationId===null).qty,'1')
  assert.equal(cart.getBaseQuantity('P'),'21');assert.equal(view.writes.length,0)
 }finally{h.unmount()}
})
