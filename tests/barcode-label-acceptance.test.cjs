const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{preparedLabelFixture}=require('./helpers/barcodePdfHarness.cjs'),{labelProduct}=require('./fixtures/barcodeLabelFixtures.cjs')
const {buildLabelPrintPlan}=loadReportModule('../inventory/barcodeLabels/labelLayout.ts'),measure=(t,s)=>t.length*s.fontSize*.5;measure.supports=()=>true
test('one hundred products get complete guide ranges and exact page ownership',()=>{
  const products=Array.from({length:100},(_,i)=>labelProduct({id:String(i),name:`Producto número ${i+1}`,barcode:`AUNA${String(i).padStart(12,'0')}`,copies:i===0?35:1})),data=preparedLabelFixture({products});data.design.heightMm=35
  const plan=buildLabelPrintPlan(data,measure);assert.ok(plan.guidePages.length>1)
  assert.equal(plan.guidePages.flat().length,100);assert.equal(plan.ranges[0].firstPage,plan.guidePages.length+1)
  assert.equal(plan.labelPages.flatMap(p=>p.products).length,134)
  for(const range of plan.ranges){const pages=plan.labelPages.filter(p=>p.productId===range.productId);assert.equal(pages[0].absolutePage,range.firstPage);assert.equal(pages.at(-1).absolutePage,range.lastPage);assert.ok(pages.every(p=>p.products.every(id=>id===range.productId)))}
})
test('landscape custom paper does not rescale label geometry and no guide shifts ranges',()=>{
  const data=preparedLabelFixture({copies:7,guide:false,paperOverride:{format:'custom',widthMm:100,heightMm:170,orientation:'landscape'}});data.design.heightMm=35
  const plan=buildLabelPrintPlan(data,measure);assert.equal(plan.grid.widthMm,170);assert.equal(plan.grid.heightMm,100);assert.equal(plan.ranges[0].firstPage,1);assert.equal(plan.scenes.values().next().value.widthMm,70);assert.equal(plan.labelPages.flatMap(p=>p.products).length,7)
})
