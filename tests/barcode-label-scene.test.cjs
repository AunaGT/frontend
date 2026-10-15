const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{labelProduct}=require('./fixtures/barcodeLabelFixtures.cjs')
const {createLabelTemplate}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts'),{prepareLabelScene}=loadReportModule('../inventory/barcodeLabels/labelScene.ts')
const measure=(text,s)=>text.length*s.fontSize*.5;measure.supports=()=>true
test('scene renders actual bars and complete data, rejects text that does not fit',()=>{
  const scene=prepareLabelScene(labelProduct(),createLabelTemplate(),measure,{companyName:'QA',currencyCode:'GTQ',locale:'es-GT'})
  assert.ok(scene.nodes.some(n=>n.kind==='barcode'&&n.bars.length>0))
  assert.ok(scene.nodes.some(n=>n.kind==='text'&&n.lines.includes('Producto QA')))
  assert.throws(()=>prepareLabelScene(labelProduct({name:'Nombre '.repeat(100)}),createLabelTemplate(),measure,{companyName:'QA',currencyCode:'GTQ',locale:'es-GT'}),/texto|cabe/i)
  const unsupported=()=>1;unsupported.supports=()=>false
  assert.throws(()=>prepareLabelScene(labelProduct(),createLabelTemplate(),unsupported,{companyName:'QA',currencyCode:'GTQ',locale:'es-GT'}),/fuente/i)
})
test('all built-in templates fit their data including a two-line name and price',()=>{
  for(const preset of ['essential','product','price'])assert.ok(prepareLabelScene(labelProduct({name:'Nombre completo de producto con dos líneas'}),createLabelTemplate(preset),measure,{companyName:'QA',currencyCode:'GTQ',locale:'es-GT'}).nodes.length>=2)
})
