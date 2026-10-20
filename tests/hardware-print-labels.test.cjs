const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{labelProduct}=require('./fixtures/barcodeLabelFixtures.cjs')
test('whole-document label jobs keep guide separate and do not multiply copies',()=>{
 const {createLabelTemplate,defaultPaper}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts'),{buildLabelPrintPlan}=loadReportModule('../inventory/barcodeLabels/labelLayout.ts')
 const data={companyName:'Auna',currencyCode:'GTQ',locale:'es-GT',design:createLabelTemplate(),paper:{...defaultPaper(),format:'custom',widthMm:170,heightMm:100},products:[labelProduct({id:'P',copies:10})]}
 const plan=buildLabelPrintPlan(data,(t,s)=>t.length*s.fontSize*.5,true)
 assert.equal(plan.inlineGuidePages,0);assert.equal(plan.labelPages.reduce((n,p)=>n+p.products.length,0),10);assert.equal(plan.ranges[0].firstPage,1);assert.equal(plan.totalPages,5)
})
