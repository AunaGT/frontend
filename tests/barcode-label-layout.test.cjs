const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const {createLabelTemplate,defaultPaper}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts'),{computeLabelGrid}=loadReportModule('../inventory/barcodeLabels/labelLayout.ts')
test('custom sheet has calculated two slots without changing label geometry',()=>{
  const design=createLabelTemplate('product'),before=structuredClone(design)
  const grid=computeLabelGrid(design,{...defaultPaper(),format:'custom',widthMm:170,heightMm:100})
  assert.equal(grid.columns,2);assert.equal(grid.rows,1);assert.equal(grid.capacity,2)
  assert.deepEqual(design,before)
  assert.throws(()=>computeLabelGrid(design,{...defaultPaper(),format:'custom',widthMm:20,heightMm:20}))
})
test('thermal pages equal label size, no header or stretching',()=>{
  const design=createLabelTemplate('essential'),grid=computeLabelGrid(design,{...defaultPaper(),format:'thermal'})
  assert.equal(grid.capacity,1);assert.equal(grid.widthMm,70);assert.equal(grid.heightMm,35);assert.equal(grid.headerHeightMm,0)
})
