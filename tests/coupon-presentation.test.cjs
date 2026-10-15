const {test}=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const model=loadReportModule('../promotions/coupons/couponPresentation.ts'),design=loadReportModule('../promotions/coupons/couponDesign.ts')
const branding={companyName:'Empresa QA',locale:'es-GT',currencyCode:'GTQ',timezone:'America/Guatemala'}
const measure=(text,style)=>text.length*style.fontSize*.5
test('image crop retains proportions and responds continuously to user focal point',()=>{
  assert.deepEqual(model.couponImagePlacement({x:0,y:0,width:100,height:100},{width:200,height:100},'cover',.25,.5),{x:-25,y:0,width:200,height:100})
  assert.deepEqual(model.couponImagePlacement({x:0,y:0,width:100,height:100},{width:200,height:100},'contain',.5,.25),{x:0,y:12.5,width:100,height:50})
})
test('coupon benefits reflect actual quantities/discounts and restrictions, never another code',()=>{
  for(const[type,fields,want]of [['PERCENTAGE',{discount_percentage:15},'15% de descuento'],['BUY_X_GET_Y',{buy_quantity:3,get_quantity:1},'Lleva 3, paga 2'],['MIN_QTY_DISCOUNT',{min_quantity:4,discount_percentage:10},'10% de descuento desde 4 unidades'],['COMBO_DISCOUNT',{discount_percentage:20},'20% en el segundo producto del combo'],['FREE_GIFT',{},'Regalo al comprar el producto participante']]){
    assert.equal(model.couponData({type:{name:type},...fields},{code:'A'},branding).benefit,want)
  }
  const d=model.couponData({name:'QA',start_date:'2026-10-12T02:00:00Z',min_purchase_amount:100,max_uses:2,max_uses_per_customer:1,applies_to_all_branches:false,branches:[{branch:{name:'Principal'}}]},{code:'REAL',active:false},branding)
  assert.equal(d.code,'REAL');assert.match(d.validity,/11/);assert.equal(d.branches,'Principal')
  assert.ok(d.requiredFields.includes('limits')&&d.requiredFields.includes('minimumPurchase')&&d.requiredFields.includes('state'))
})
test('one scene preserves every line and blocks clipped, too-small, hidden or covered mandatory fields',()=>{
  const good=design.createDefaultCouponDesign(),data=model.couponData({name:'QA',type:{name:'PERCENTAGE'},discount_percentage:15},{code:'REAL'},branding)
  assert.equal(model.prepareCouponScene(good,data,measure).nodes.find(n=>n.id==='field-code').text,'REAL')
  for(const delta of [{width:.01},{visible:false},{style:{...good.elements.find(e=>e.field==='code').style,fontSize:10}}]){
    const bad=structuredClone(good);Object.assign(bad.elements.find(e=>e.field==='code'),delta)
    assert.ok(model.prepareCouponScene(bad,data,measure).issues.some(i=>i.elementId==='field-code'&&i.severity==='error'))
  }
  good.elements.push({id:'cover',kind:'shape',shape:'rect',color:'#ffffff',borderColor:'#ffffff',borderWidth:0,radius:0,x:0,y:0,width:1,height:1,visible:true,locked:false,opacity:1})
  assert.ok(model.prepareCouponScene(good,data,measure).issues.some(i=>i.code==='OCCLUDED'))
})
test('both print presets preserve aspect, all tiles fit page before footer',()=>{
  for(const preset of ['standard','large']){
    const p=model.getCouponPrintLayout(preset)
    assert.ok(Math.abs(p.tileHeight/p.tileWidth-.72)<.000001)
    assert.ok(p.top+p.rows*p.tileHeight+(p.rows-1)*p.gap<p.pageHeight-10)
  }
})
test('mandatory text painted over another required field or white on white is detected',()=>{
  const good=design.createDefaultCouponDesign(),data=model.couponData({name:'QA',type:{name:'PERCENTAGE'},discount_percentage:15},{code:'REAL'},branding)
  const covered=structuredClone(good),code=covered.elements.find(e=>e.field==='code')
  covered.elements.push({...code,id:'cover-text',kind:'text',field:undefined,text:'OVERPRINT'})
  delete covered.elements.at(-1).field
  assert.ok(model.prepareCouponScene(covered,data,measure).issues.some(i=>i.elementId==='field-code'&&i.code==='OCCLUDED'))
  const pale=structuredClone(good);pale.elements.find(e=>e.field==='code').style.background='#ffffff'
  assert.ok(model.prepareCouponScene(pale,data,measure).issues.some(i=>i.elementId==='field-code'&&i.code==='LOW_CONTRAST'))
})
test('thick line painted across code is blocked and diagonal line missing code is not a false occlusion',()=>{
  const good=design.createDefaultCouponDesign(),data=model.couponData({name:'QA',type:{name:'PERCENTAGE'},discount_percentage:15},{code:'REAL'},branding)
  good.elements.push({id:'cover-line',kind:'shape',shape:'line',color:'#0c203a',borderColor:'#0c203a',borderWidth:20,radius:0,x:.025,y:.535,width:.95,height:.02,visible:true,locked:false,opacity:1})
  assert.ok(model.prepareCouponScene(good,data,measure).issues.some(i=>i.elementId==='field-code'&&i.code==='OCCLUDED'&&i.severity==='error'))
})
test('combo benefit chooses percent first or capped fixed amount like checkout',()=>{
  const percent=model.couponData({name:'QA',type:{name:'COMBO_DISCOUNT'},discount_percentage:20,discount_value:50},{code:'QA'},branding)
  assert.equal(percent.benefit,'20% en el segundo producto del combo')
  const fixed=model.couponData({name:'QA',type:{name:'COMBO_DISCOUNT'},discount_percentage:null,discount_value:50},{code:'QA'},branding)
  assert.match(fixed.benefit,/50\.00/);assert.ok(!fixed.benefit.includes('0%'));assert.match(fixed.benefit,/Hasta/)
})
test('semi-transparent white background over navy stays legible rather than cause false blocking contrast',()=>{
  const good=design.createDefaultCouponDesign(),data=model.couponData({name:'QA',type:{name:'PERCENTAGE'},discount_percentage:15},{code:'REAL'},branding)
  good.background={kind:'solid',color:'#0c203a'}
  const index=good.elements.findIndex(e=>e.field==='code')
  good.elements.splice(index,0,{id:'soft-bg',kind:'shape',shape:'rect',color:'#ffffff',borderColor:'#ffffff',borderWidth:0,radius:0,x:0,y:.5,width:1,height:.08,visible:true,locked:false,opacity:.1})
  assert.ok(!model.prepareCouponScene(good,data,measure).issues.some(i=>i.elementId==='field-code'&&i.code==='LOW_CONTRAST'&&i.severity==='error'))
})

test('a small state is only advice for available codes but blocks used codes, naming the code and the size in design px',()=>{
  const d=design.createDefaultCouponDesign();d.elements.find(e=>e.field==='state').style.fontSize=12
  const promo={name:'QA',type:{name:'PERCENTAGE'},discount_percentage:15,max_uses:1}
  const stateIssue=code=>model.prepareCouponScene(d,model.couponData(promo,code,branding),measure).issues.find(i=>i.elementId==='field-state')
  const advice=stateIssue({code:'LIBRE',active:true,current_uses:0})
  assert.equal(advice.severity,'warning');assert.match(advice.message,/18px/);assert.match(advice.message,/usados o inactivos/)
  const blocked=stateIssue({code:'USADO',active:true,current_uses:1})
  assert.equal(blocked.severity,'error');assert.match(blocked.message,/USADO/);assert.match(blocked.message,/18px/);assert.match(blocked.message,/quita/)
  d.printPreset='large';d.elements.find(e=>e.field==='state').style.fontSize=10
  assert.match(stateIssue({code:'USADO',active:true,current_uses:1}).message,/12px/)
})

test('phase 2: uppercase reaches the lines, rotated or shadowed layers count as covering, phase-1 nodes stay unchanged',()=>{
  const d=design.createDefaultCouponDesign(),data=model.couponData({name:'promo de prueba',type:{name:'PERCENTAGE'},discount_percentage:15},{code:'REAL'},branding)
  const node=(scene,id)=>scene.nodes.find(n=>n.id===id)
  assert.ok(!('rotation' in node(model.prepareCouponScene(d,data,measure),'field-name')),'phase-1 nodes carry no new keys')
  d.elements.find(e=>e.field==='name').style.uppercase=true
  assert.equal(node(model.prepareCouponScene(d,data,measure),'field-name').lines[0].text.startsWith('PROMO DE'),true)
  const covers=extra=>{
    const scene=structuredClone(d)
    scene.elements.push({id:'forma-1',kind:'shape',shape:'rect',color:'#ffffff',borderColor:'#ffffff',borderWidth:0,radius:0,x:.05,y:.44,width:.1,height:.05,visible:true,locked:false,opacity:1,...extra})
    return model.prepareCouponScene(scene,data,measure).issues.some(i=>i.elementId==='field-code'&&i.code==='OCCLUDED'&&i.severity==='error')
  }
  assert.equal(covers({}),false,'the plain shape sits above the code')
  assert.equal(covers({rotation:45}),true,'rotated, its painted area reaches the code')
  assert.equal(covers({shadow:{x:0,y:30,color:'#000000',opacity:.5}}),true,'its shadow falls on the code')
})

test('phase 3: without a proportion the layouts stay exact; with one, the largest A4 grid that fits wins',()=>{
  assert.deepEqual(model.getCouponPrintLayout('standard'),{orientation:'landscape',pageWidth:297,pageHeight:210,tileWidth:120,tileHeight:86.4,columns:2,rows:2,gap:6,top:10})
  assert.deepEqual(model.getCouponPrintLayout('large'),{orientation:'portrait',pageWidth:210,pageHeight:297,tileWidth:185,tileHeight:133.2,columns:1,rows:2,gap:6,top:8})
  for(const preset of ['standard','large'])for(const aspect of [.5,1,1.5,3]){
    const p=model.getCouponPrintLayout(preset,aspect),count=preset==='standard'?4:2
    assert.equal(p.columns*p.rows,count)
    assert.ok(Math.abs(p.tileWidth/p.tileHeight-aspect)<1e-9)
    const width=p.columns*p.tileWidth+(p.columns-1)*p.gap,height=p.rows*p.tileHeight+(p.rows-1)*p.gap
    assert.ok(width<=p.pageWidth-20+1e-9&&p.top>=10-1e-9&&p.top+height<=p.pageHeight-16+1e-9,`${preset} ${aspect} cabe en la hoja`)
    for(const[pw,ph]of [[210,297],[297,210]])for(let columns=1;columns<=count;columns++){
      if(count%columns)continue
      const rows=count/columns,w=Math.min((pw-20-(columns-1)*6)/columns,(ph-26-(rows-1)*6)/rows*aspect)
      assert.ok(w<=p.tileWidth+1e-9,`${preset} ${aspect}: ${columns}×${rows} no da un cupón más grande`)
    }
  }
})

test('phase 3: the scene uses the real height and the 6 pt minimum the real printed width',()=>{
  const data=model.couponData({type:{name:'PERCENTAGE'},discount_percentage:15},{code:'A'},branding)
  const tall={...design.createDefaultCouponDesign(),aspect:.5},scene=model.prepareCouponScene(tall,data,measure)
  assert.equal(scene.height,2000);assert.equal(scene.nodes[0].height,2000)
  const code=tall.elements.find(e=>e.id==='field-code')
  assert.ok(Math.abs(scene.nodes.find(n=>n.id==='field-code').y-code.y*2000)<1e-9)
  assert.equal(model.prepareCouponScene(design.createDefaultCouponDesign(),data,measure).height,720)
  const small=d=>{const copy=structuredClone(d);copy.elements.find(e=>e.id==='field-validity').style.fontSize=16;return model.prepareCouponScene(copy,data,measure).issues.some(i=>i.elementId==='field-validity'&&i.code==='SMALL_TEXT')}
  assert.equal(small(design.createDefaultCouponDesign()),true,'16px is under 6 pt on a 120 mm coupon')
  assert.equal(small({...design.createDefaultCouponDesign(),aspect:3}),false,'and readable on the wider printed coupon')
})
