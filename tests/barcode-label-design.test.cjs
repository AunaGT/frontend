const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const f=loadReportModule('../inventory/barcodeLabels/labelDesign.ts'),b=require('../../deposito-backend/src/modules/inventory/barcodeLabels/validation')
test('all templates validate identically in browser and server, protected layers cannot disappear',()=>{
  for(const name of ['essential','product','price']){
    const design=f.createLabelTemplate(name)
    assert.deepEqual(f.parseLabelDesign(design),b.parseLabelDesign(design))
    for(const parse of [f.parseLabelDesign,b.parseLabelDesign]){
      assert.throws(()=>parse({...design,elements:design.elements.filter(e=>e.kind!=='barcode')}))
      assert.throws(()=>parse({...design,widthMm:NaN}))
    }
  }
})
test('readable value cannot be painted black on black',()=>{
  for(const parse of [f.parseLabelDesign,b.parseLabelDesign]){
    const dark=f.createLabelTemplate();dark.elements.find(e=>e.id==='value').style.background='#111111';assert.throws(()=>parse(dark),/legible|fondo/i)
  }
})
test('stroke cannot invade protected bars or extend outside the physical label',()=>{
  for(const parse of [f.parseLabelDesign,b.parseLabelDesign]){
    const stroke=f.createLabelTemplate(),bar=stroke.elements.find(e=>e.kind==='barcode');stroke.elements.push({id:'edge',kind:'shape',x:.03,y:bar.y+bar.height+.005,width:.4,height:.01,visible:true,locked:false,shape:'rect',color:'#ffffff',borderColor:'#000000',borderWidth:3});assert.throws(()=>parse(stroke),/código|zona/i)
    stroke.elements.at(-1).x=0;stroke.elements.at(-1).y=.1;assert.throws(()=>parse(stroke),/sale|etiqueta/i)
    stroke.elements.at(-1).x=.03;stroke.elements.at(-1).y=bar.y+bar.height+.0001;stroke.elements.at(-1).shape='line';stroke.elements.at(-1).borderWidth=0;assert.throws(()=>parse(stroke),/código|zona/i)
  }
})
