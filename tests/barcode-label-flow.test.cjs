const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs'),{labelProduct}=require('./fixtures/barcodeLabelFixtures.cjs')
function mount(){
  const h=hookHarness(),requests=[],downloads=[];let release,rejecter,width=70,context={companyId:'companyA',userId:'userA',branchId:'33333333-3333-4333-8333-333333333333'},value
  const {createLabelTemplate,defaultPaper}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts')
  const api={fetchBarcodeLayout:async()=>({revision:0,design:{...createLabelTemplate(),widthMm:width},defaultPaper:defaultPaper(),capabilities:{canAssign:true,canSaveLayout:true}}),fetchBarcodeCandidates:async()=>({items:[],totalItems:0,totalPages:1,page:1}),saveBarcodeLayout:async input=>({revision:1,design:input.design,defaultPaper:input.defaultPaper}),prepareBarcodeLabels:input=>{requests.push(input);return new Promise((r,j)=>{release=r;rejecter=j})}}
  const {useBarcodePrint}=loadReportModule('../inventory/barcodeLabels/useBarcodePrint.ts',{react:h.hooks,'./barcodeLabelService':api,'./labelPdf':{generateBarcodeLabelPdf:async prepared=>({labels:new Blob(['pdf']),guide:null,plan:{ranges:[],totalPages:1}})},'@/modules/reports/documents/reportDownload':{downloadReportBlob:blob=>downloads.push(blob)}})
  const render=()=>{value=h.render(()=>useBarcodePrint(context));return value};render()
  return{get value(){return value},requests,downloads,render,setLayoutWidth:n=>width=n,reject:e=>rejecter(e),ready:async()=>{await new Promise(r=>setImmediate(r));render()},resolve:()=>release({...requests[0],id:'prepared',companyId:context.companyId,actorId:context.userId,companyName:'QA',currencyCode:'GTQ',locale:'es-GT',timezone:'America/Guatemala',products:[labelProduct()],assignedProductIds:[],createdAt:'2026-10-14'}),switchCompany:()=>{context={...context,companyId:'companyB'};render()},unmount:h.unmount}
}
test('opening/editing do not write; changed copies invalidate exact Blob and duplicate prepare is blocked',async()=>{
  const page=mount();await page.ready();page.value.selectProduct(labelProduct());page.render();page.value.setCopies(labelProduct().id,3);page.render();assert.equal(page.requests.length,0)
  const pending=page.value.prepare(false);await page.value.prepare(false);assert.equal(page.requests.length,1);page.resolve();await pending;page.render()
  assert.ok(page.value.pdf);page.value.downloadLabels();assert.equal(page.downloads[0],page.value.pdf.labels)
  page.value.setCopies(labelProduct().id,4);page.render();assert.equal(page.value.pdf,null);page.value.downloadLabels();assert.equal(page.downloads.length,1)
  page.unmount()
})
test('late preparation response from old company never becomes downloadable',async()=>{
  const page=mount();await page.ready();page.value.selectProduct(labelProduct());page.render();const pending=page.value.prepare(false);page.switchCompany();page.resolve();await pending;page.render();assert.equal(page.value.pdf,null);page.value.downloadLabels();assert.equal(page.downloads.length,0);page.unmount()
})
test('already prepared PDF is hidden synchronously on company change, before effects flush',async()=>{
  const page=mount();await page.ready();page.value.selectProduct(labelProduct());page.render();const pending=page.value.prepare(false);page.resolve();await pending;page.render();assert.ok(page.value.pdf)
  page.switchCompany();assert.equal(page.value.pdf,null);page.value.downloadLabels();assert.equal(page.downloads.length,0);page.unmount()
})
test('reloading company layout invalidates previous preparation and PDF',async()=>{
  const page=mount();await page.ready();page.value.selectProduct(labelProduct());page.render();const pending=page.value.prepare(false);page.resolve();await pending;page.render();assert.ok(page.value.pdf)
  page.setLayoutWidth(100);await page.value.reloadLayout();page.render();assert.equal(page.value.design.widthMm,100);assert.equal(page.value.pdf,null);assert.equal(page.value.prepared,null);page.value.downloadLabels();assert.equal(page.downloads.length,0);page.unmount()
})
test('server errors identify their selected product and field',async()=>{
  const page=mount();await page.ready();page.value.selectProduct(labelProduct());page.render();const pending=page.value.prepare(false)
  page.reject(Object.assign(Error('Dígito de control incorrecto'),{data:{productId:labelProduct().id,field:'barcode'}}));await pending;page.render()
  assert.match(page.value.error,/Producto QA/);assert.match(page.value.productErrors[labelProduct().id],/Dígito/);page.unmount()
})
