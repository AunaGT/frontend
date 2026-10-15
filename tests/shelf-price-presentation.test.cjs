const {test}=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('shelf product selection offers per-product tariffs but never offers barcode assignment',()=>{
  const {BarcodeProductsStep}=loadReportModule('../inventory/barcodeLabels/BarcodeProductsStep.tsx',{'@/services/api':{apiFetch(){throw Error('Unexpected SSR network')}}}),product={id:'a',name:'Café',barcode:null,price:'10',brand:null,size:null,shelfPrices:[{tier:'LIST',label:'Normal',amount:'10'}]}
  const html=renderToStaticMarkup(React.createElement(BarcodeProductsStep,{purpose:'shelf',scope:{},selected:new Map([['a',{product,copies:1,assignment:{mode:'keep'}}]]),defaultTiers:['LIST','WHOLESALE','PROMOTION'],onSelect(){},onRemove(){},onCopies(){},onAssignment(){},onPriceTiers(){},onRefresh:async()=>{},busy:false,canAssign:false}))
  assert.match(html,/Precios de este producto/);assert.match(html,/Sin tarifa de mayoreo/);assert.doesNotMatch(html,/Se guardará un código|permiso para editar productos/)
})
test('shelf editor can add an optional barcode without requiring one on default templates',()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],hooks={...h.hooks,useReducer:(r,initial)=>{const[s,set]=h.hooks.useState(initial);return[s,a=>set(old=>r(old,a))]}},design=loadReportModule('../inventory/barcodeLabels/labelDesign.ts').createShelfLabelTemplate()
  const {BarcodeLabelEditor}=loadReportModule('../inventory/barcodeLabels/BarcodeLabelEditor.tsx',{react:hooks,'@/modules/promotions/coupons/couponFonts':{createCouponMeasure:async()=>(t,s)=>t.length*s.fontSize*.5}},nodes)
  const props={design,product:{id:'p',name:'Café',barcode:'AUNA123456789ABC',price:'10',shelfPrices:[{tier:'LIST',label:'Normal',amount:'10'}]},branding:{companyName:'QA',currencyCode:'GTQ',locale:'es-GT'},onChange(){},onSave:async()=>{},onBack(){},canSave:true,saving:false}
  const render=()=>{nodes.length=0;h.render(()=>BarcodeLabelEditor(props))};render()
  const add=nodes.find(n=>n.props.children==='Añadir código de barras');assert.ok(add);add.props.onClick();render()
  const current=nodes.find(n=>n.type?.name==='BarcodeLabelCanvas').props.design;assert.ok(current.elements.some(e=>e.kind==='barcode'));assert.ok(current.heightMm>design.heightMm)
  nodes.find(n=>n.props.children==='Quitar código de barras').props.onClick();render();nodes.find(n=>n.props.children==='Añadir código de barras').props.onClick();render()
  assert.equal(nodes.find(n=>n.type?.name==='BarcodeLabelCanvas').props.design.heightMm,current.heightMm);h.unmount()
})
test('price page uses shelf scope and prepares without asking to assign missing barcodes',()=>{
  const {mountBarcodePrintPage}=require('./helpers/barcodePrintHarness.cjs'),page=mountBarcodePrintPage({purpose:'shelf',missing:true})
  assert.equal(page.scope.purpose,'shelf');assert.ok(page.nodes.find(n=>n.type?.name==='PriceTierPicker'))
  page.nodes.find(n=>n.props.onClick&&String(n.props.children).includes('Preparar PDF')).props.onClick()
  assert.deepEqual(page.calls,[{action:'prepare',confirmed:false}]);page.unmount()
})
