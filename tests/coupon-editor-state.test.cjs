const{test}=require('node:test'),assert=require('node:assert/strict')
const{loadReportModule}=require('./helpers/loadReportModule.cjs')
const{createDefaultCouponDesign}=loadReportModule('../promotions/coupons/couponDesign.ts')
const{couponEditorReducer:r,pointerDelta,moveCouponBox}=loadReportModule('../promotions/coupons/couponEditorState.ts')
const initial=()=>({design:createDefaultCouponDesign(),past:[],future:[],selectedId:null,zoom:1})
test('drag delta uses displayed rectangle once, history restores entire design and new action clears redo',()=>{
  assert.deepEqual(pointerDelta({x:100,y:100},{x:140,y:120},{width:400,height:288}),{x:.1,y:20/288})
  const state=initial(),next=r(state,{type:'MOVE',id:'field-code',dx:.05,dy:0})
  assert.ok(Math.abs(next.design.elements.find(e=>e.id==='field-code').x-.1)<1e-9)
  const undone=r(next,{type:'UNDO'});assert.deepEqual(undone.design,state.design)
  assert.deepEqual(r(undone,{type:'REDO'}).design,next.design)
  assert.equal(r(undone,{type:'MOVE',id:'field-code',dx:.01,dy:0}).future.length,0)
  assert.equal(moveCouponBox({x:.8,y:.8,width:.2,height:.2},.5,.5).x,.8)
})
test('locked layers cannot move/delete, mandatory fields cannot hide/delete and fields cannot duplicate',()=>{
  const state=initial()
  for(const action of [{type:'DELETE',id:'field-code'},{type:'PATCH',id:'field-code',patch:{visible:false}},{type:'DUPLICATE',id:'field-code'},{type:'MOVE',id:'lower-band',dx:.1,dy:0},{type:'DELETE',id:'lower-band'}])assert.deepEqual(r(state,action).design,state.design)
  const clone=r(state,{type:'DUPLICATE',id:'promotion-label',newId:'copy'})
  assert.equal(clone.design.elements.at(-1).id,'copy');assert.equal(clone.design.elements.at(-1).locked,false)
  let many=state;for(let i=0;i<60;i++)many=r(many,{type:'PATCH',id:'promotion-label',patch:{text:String(i)}})
  assert.equal(many.past.length,50)
})
test('unshifted keyboard moves escape left, center and right snap anchors rather than stick',()=>{
  for(const x of [.025,.05,.075]){
    let state=initial();state.design.elements.find(e=>e.field==='code').x=x
    state=r(state,{type:'MOVE',id:'field-code',dx:.001,dy:0})
    assert.ok(Math.abs(state.design.elements.find(e=>e.field==='code').x-(x+.001))<1e-9)
  }
})

test('blank start keeps only the required fields, readable on a white coupon, and can be undone',()=>{
  const state=initial(),blank=r(state,{type:'BLANK'},['code','benefit'])
  assert.deepEqual(blank.design.background,{kind:'solid',color:'#ffffff'})
  assert.deepEqual(blank.design.elements.map(e=>e.id).sort(),['field-benefit','field-code'])
  assert.ok(blank.design.elements.every(e=>e.visible&&e.opacity===1&&e.style.color==='#0c203a'&&e.style.background===null))
  assert.equal(blank.design.terms,state.design.terms);assert.equal(blank.selectedId,null)
  assert.deepEqual(r(blank,{type:'UNDO'}).design,state.design)
})

test('phase 3: a design from an image takes its proportion and keeps only readable, fitting required fields',()=>{
  const{couponData,prepareCouponScene}=loadReportModule('../promotions/coupons/couponPresentation.ts')
  const required=['code','benefit','validity','branches','limits'],asset='11111111-1111-4111-8111-111111111111'
  const data={...couponData({type:{name:'PERCENTAGE'},discount_percentage:15,start_date:'2026-10-11',applies_to_all_branches:false,branches:[{branch:{name:'Centro'}}],max_uses:10},{code:'CUPON-QA'},{companyName:'Empresa QA',locale:'es-GT',currencyCode:'GTQ',timezone:'America/Guatemala'}),requiredFields:required}
  const measure=(text,style)=>text.length*style.fontSize*.5
  for(const aspect of [3,.5])for(const printPreset of ['standard','large']){
    const state={...initial(),design:{...initial().design,printPreset}},next=r(state,{type:'IMAGE_DESIGN',assetId:asset,aspect},required)
    assert.equal(next.design.aspect,aspect)
    assert.deepEqual(next.design.background,{kind:'image',assetId:asset,fit:'cover',focalX:.5,focalY:.5})
    assert.deepEqual(next.design.elements.map(e=>e.field).sort(),[...required].sort())
    assert.ok(next.design.elements.every(e=>e.style.background==='#ffffff'&&e.style.color==='#0c203a'))
    const problems=prepareCouponScene(next.design,data,measure).issues.filter(i=>['TEXT_OVERFLOW','SAFE_MARGIN','OCCLUDED','REQUIRED','SMALL_TEXT'].includes(i.code))
    assert.deepEqual(problems,[],`aspect ${aspect} ${printPreset}: printable as created (6 pt included)`)
    assert.deepEqual(r(next,{type:'UNDO'}).design,state.design)
  }
  const blank=r({...initial(),design:{...initial().design,aspect:3}},{type:'BLANK'},required)
  assert.equal(blank.design.aspect,3,'starting blank keeps the coupon shape')
  assert.deepEqual(prepareCouponScene(blank.design,data,measure).issues.filter(i=>['TEXT_OVERFLOW','SAFE_MARGIN','OCCLUDED','SMALL_TEXT'].includes(i.code)),[])
  const tallBlank=r({...initial(),design:{...initial().design,aspect:.5}},{type:'BLANK'},required)
  assert.deepEqual(prepareCouponScene(tallBlank.design,data,measure).issues.filter(i=>i.code==='SMALL_TEXT'),[],'a tall blank coupon is printable too')
})
