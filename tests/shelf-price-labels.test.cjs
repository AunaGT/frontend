const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const backend=require('../../deposito-backend/src/modules/inventory/barcodeLabels/validation'),front=loadReportModule('../inventory/barcodeLabels/labelDesign.ts')
test('shelf templates are independent, accept no barcode, require product and real price fields',()=>{
  for(const preset of ['essential','product','price']){
    const design=front.createShelfLabelTemplate(preset)
    assert.equal(design.purpose,'shelf');assert.equal(design.elements.some(e=>e.kind==='barcode'),false)
    assert.deepEqual(front.parseLabelDesign(design),backend.parseLabelDesign(design))
    assert.throws(()=>front.parseLabelDesign({...design,elements:design.elements.filter(e=>e.field!=='price')}))
  }
  assert.throws(()=>backend.parseLabelDesign({...backend.createLabelTemplate(),elements:[]}))
})
test('supermarket template places the three tariffs side by side at equal height',()=>{
  const design=front.createShelfLabelTemplate('price'),prices=['price','price_secondary','price_tertiary'].map(field=>design.elements.find(e=>e.field===field)),captions=['price_label','price_secondary_label','price_tertiary_label'].map(field=>design.elements.find(e=>e.field===field))
  assert.equal(new Set(prices.map(e=>e.y)).size,1);assert.equal(new Set(prices.map(e=>e.height)).size,1);assert.equal(new Set(captions.map(e=>e.y)).size,1)
  assert.ok(prices[0].x+prices[0].width<=prices[1].x);assert.ok(prices[1].x+prices[1].width<=prices[2].x)
  assert.deepEqual(design.priceTiers,['LIST','WHOLESALE','PROMOTION']);assert.equal(design.primaryTier,'LIST')
  assert.deepEqual(design,backend.createShelfLabelTemplate('price'))
})
test('price slots hide absent tariffs and display the chosen tariff as primary, with no fake barcode',()=>{
  const {prepareLabelScene}=loadReportModule('../inventory/barcodeLabels/labelScene.ts'),design=front.createShelfLabelTemplate('price'),measure=(text,s)=>text.length*s.fontSize*.5
  const product={id:'a',name:'Café',barcode:'',price:'10.00',brand:null,size:null,copies:1,shelfPrices:[{tier:'PROMOTION',label:'Promoción',amount:'7.50'}]}
  const scene=prepareLabelScene(product,design,measure,{companyName:'QA',currencyCode:'GTQ',locale:'es-GT'})
  const text=scene.nodes.filter(n=>n.kind==='text').flatMap(n=>n.lines).join(' ')
  assert.match(text,/Promoción/);assert.match(text,/7[.,]50/);assert.doesNotMatch(text,/10[.,]00|Mayoreo|AUNA/)
  assert.equal(scene.nodes.some(n=>n.kind==='barcode'),false)
})
test('shelf printing packs distinct products into one sheet and guide ranges can share that page',()=>{
  const {buildLabelPrintPlan}=loadReportModule('../inventory/barcodeLabels/labelLayout.ts'),base={name:'Café',barcode:'',price:'10',brand:null,size:null,shelfPrices:[{tier:'LIST',label:'Normal',amount:'10'}]},data={design:front.createShelfLabelTemplate('essential'),paper:{...front.defaultPaper(),format:'custom',widthMm:190,heightMm:140},products:[{...base,id:'a',copies:3},{...base,name:'Agua',id:'b',copies:2}],companyName:'QA',currencyCode:'GTQ',locale:'es-GT'}
  const plan=buildLabelPrintPlan(data,(t,s)=>t.length*s.fontSize*.5)
  assert.deepEqual(plan.labelPages.map(p=>p.products),[['a','a','a','b'],['b']]);assert.deepEqual(plan.ranges.map(r=>[r.firstPage,r.lastPage]),[[2,2],[2,3]])
})
test('shelf thermal pages do not display unused product headings',()=>{
  const {buildLabelPrintPlan}=loadReportModule('../inventory/barcodeLabels/labelLayout.ts'),design=front.createShelfLabelTemplate('essential'),product={id:'a',name:'Café',barcode:'A'.repeat(100),price:'10',brand:null,size:null,copies:1,shelfPrices:[{tier:'LIST',label:'Normal',amount:'10'}]},data={design,paper:{...front.defaultPaper(),format:'thermal',includeGuide:false},products:[product],companyName:'QA',currencyCode:'GTQ',locale:'es-GT'}
  const plan=buildLabelPrintPlan(data,(t,s)=>t.length*s.fontSize*.5);assert.deepEqual(plan.labelPages[0].headingLines,[])
})
test('narrow shelf paper validates and wraps its actual generic heading, not long barcode metadata',()=>{
  const {buildLabelPrintPlan}=loadReportModule('../inventory/barcodeLabels/labelLayout.ts'),design=front.createShelfLabelTemplate('essential');design.widthMm=30;design.heightMm=100
  design.elements.find(e=>e.field==='name').style.fontSize=6;design.elements.find(e=>e.field==='price').style.fontSize=10
  const product={id:'a',name:'Nombre largo de producto para estante de prueba',barcode:'A'.repeat(100),price:'10',brand:null,size:null,copies:1,shelfPrices:[{tier:'LIST',label:'Normal',amount:'10'}]},data={design,paper:{...front.defaultPaper(),format:'custom',widthMm:50,heightMm:150,margins:{top:5,right:5,bottom:5,left:5},includeGuide:false},products:[product],companyName:'QA',currencyCode:'GTQ',locale:'es-GT'}
  const plan=buildLabelPrintPlan(data,(t,s)=>t.length*s.fontSize*.5);assert.equal(plan.labelPages[0].headingLines.join(' '),'Precios de estante')
})
