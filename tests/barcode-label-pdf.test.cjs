const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{labelProduct}=require('./fixtures/barcodeLabelFixtures.cjs')
const {createLabelTemplate,defaultPaper}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts'),{buildLabelPrintPlan}=loadReportModule('../inventory/barcodeLabels/labelLayout.ts')
const measure=(text,s)=>text.length*s.fontSize*.5;measure.supports=()=>true
const prepared=paper=>({id:'qa',companyId:'qa',actorId:'qa',companyName:'QA Empresa',currencyCode:'GTQ',locale:'es-GT',timezone:'America/Guatemala',createdAt:'2026-10-14T18:00:00Z',scope:{branchId:'qa',inBranch:false},products:[labelProduct({id:'A',copies:3}),labelProduct({id:'B',copies:1,name:'Otro producto',barcode:'96385074'})],design:createLabelTemplate(),paper,assignedProductIds:[]})
test('guide ranges match grouped pages without filling remaining slots with another product',()=>{
  const plan=buildLabelPrintPlan(prepared({...defaultPaper(),format:'custom',widthMm:170,heightMm:100}),measure)
  assert.deepEqual(plan.ranges.map(r=>[r.productId,r.firstPage,r.lastPage]),[['A',2,3],['B',4,4]])
  assert.deepEqual(plan.labelPages.map(p=>p.products),[['A','A'],['A'],['B']])
})
test('thermal guide stays separate and every label is one real-size page',()=>{
  const plan=buildLabelPrintPlan(prepared({...defaultPaper(),format:'thermal'}),measure)
  assert.deepEqual(plan.ranges.map(r=>[r.firstPage,r.lastPage]),[[1,3],[4,4]])
  assert.equal(plan.labelPages.length,4);assert.equal(plan.grid.widthMm,70);assert.equal(plan.grid.heightMm,35);assert.equal(plan.inlineGuidePages,0)
})
test('disabled guide does not impose guide width on small custom sheets',()=>{
  const data=prepared({...defaultPaper(),format:'custom',widthMm:75,heightMm:100,margins:{top:0,bottom:0,left:0,right:0},includeGuide:false})
  assert.equal(buildLabelPrintPlan(data,measure).guidePages.length,0)
})
test('narrow-sheet guide stacks complete counts and ranges under product identity',()=>{
  const data=prepared({...defaultPaper(),format:'custom',widthMm:80,heightMm:100,margins:{top:0,left:0,right:0,bottom:0}});data.products=[labelProduct({name:'Producto con nombre más largo de prueba',copies:999})]
  const plan=buildLabelPrintPlan(data,measure),row=plan.guidePages[0][0]
  assert.equal(row.stackMetadata,true);assert.match(row.metadataLines.join(' '),/999 copias.*2–501/);assert.ok([...row.lines,...row.metadataLines].every(line=>measure(line,{fontSize:8})*25.4/72<=60));assert.ok(row.height>=(row.lines.length+row.metadataLines.length)*8*1.15*25.4/72);assert.equal(row.productId,data.products[0].id)
})
