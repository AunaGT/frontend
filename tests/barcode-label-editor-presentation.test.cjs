const {test}=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{labelProduct}=require('./fixtures/barcodeLabelFixtures.cjs')
test('preset previews draw bars and code, never generic placeholder pictures',()=>{
  const {BarcodeLabelCanvas}=loadReportModule('../inventory/barcodeLabels/BarcodeLabelCanvas.tsx'),{createLabelTemplate}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts'),{prepareLabelScene}=loadReportModule('../inventory/barcodeLabels/labelScene.ts')
  const design=createLabelTemplate('price'),scene=prepareLabelScene(labelProduct(),design,(t,s)=>t.length*s.fontSize*.5,{companyName:'QA',locale:'es-GT',currencyCode:'GTQ'})
  const html=renderToStaticMarkup(React.createElement(BarcodeLabelCanvas,{design,scene,zoom:.5}))
  assert.match(html,/012345000058/);assert.match(html,/Producto QA/);assert.match(html,/Etiqueta de código de barras/);assert.ok(!html.includes('<image'));assert.ok(!html.includes('Redimensionar capa'))
})
