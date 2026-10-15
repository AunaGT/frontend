const{test}=require('node:test'),assert=require('node:assert/strict')
const{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs'),{makeCouponFixture}=require('./fixtures/couponFixtures.cjs')
test('actual editor commits one pointer gesture, cancels transient moves and preserves keyboard alternatives at zoom',async()=>{
  const h=hookHarness(),nodes=[],f=makeCouponFixture()
  const hooks={...h.hooks,useReducer:(reducer,initial)=>{const[state,set]=h.hooks.useState(initial);return[state,action=>set(old=>reducer(old,action))]}}
  const{couponData}=loadReportModule('../promotions/coupons/couponPresentation.ts')
  const{CouponEditor}=loadReportModule('../promotions/coupons/CouponEditor.tsx',{react:hooks,'./couponFonts':{...loadReportModule('../promotions/coupons/couponFonts.ts'),createCouponMeasure:async()=>(text,s)=>text.length*s.fontSize*.5},'./CouponCodePanel':{CouponCodePanel:()=>null}},nodes)
  let saved
  const props={value:f.design,onChange:d=>saved=d,data:couponData(f.promotion,f.codes[0],f.branding),assets:f.assets,onUpload:async()=>{},onBack(){}}
  const render=()=>{nodes.length=0;h.render(()=>CouponEditor(props))}
  render();await new Promise(r=>setImmediate(r));render()
  const canvas=()=>nodes.find(n=>n.type?.name==='CouponCanvas').props
  let held=false
  const svg={focus(){},setPointerCapture(){held=true},releasePointerCapture(){held=false},hasPointerCapture(){return held},getBoundingClientRect:()=>({width:400,height:288})}
  const event={clientX:100,clientY:100,pointerId:1,currentTarget:{ownerSVGElement:svg},preventDefault(){}}
  canvas().onSelect('field-code');render();canvas().onBeginMove('field-code',event)
  canvas().onPointerMove({clientX:110,clientY:100});render()
  assert.ok(canvas().guides.length>0,'snapped move should show a transient alignment guide')
  canvas().onPointerUp({});render()
  assert.ok(Math.abs(canvas().scene.nodes.find(n=>n.id==='field-code').x-75)<1e-8)
  canvas().onBeginMove('field-code',event);canvas().onPointerMove({clientX:130,clientY:100});render();canvas().onPointerCancel();render()
  assert.ok(Math.abs(canvas().scene.nodes.find(n=>n.id==='field-code').x-75)<1e-8)
  canvas().onKeyDown({key:'ArrowRight',shiftKey:true,preventDefault(){}});render()
  assert.ok(Math.abs(canvas().scene.nodes.find(n=>n.id==='field-code').x-85)<1e-8)
  nodes.find(n=>n.props['aria-label']==='Deshacer').props.onClick();render()
  assert.ok(Math.abs(canvas().scene.nodes.find(n=>n.id==='field-code').x-75)<1e-8)
  nodes.find(n=>n.props.value==='1'&&n.props.onValueChange).props.onValueChange('2');render()
  assert.equal(canvas().zoom,2);svg.getBoundingClientRect=()=>({width:800,height:576})
  canvas().onBeginMove('field-code',event);canvas().onPointerMove({clientX:120,clientY:100});render();canvas().onPointerUp({});render()
  assert.ok(Math.abs(canvas().scene.nodes.find(n=>n.id==='field-code').x-100)<1e-8,'200% zoom uses the expanded rectangle once, not a second zoom divisor')
  assert.equal(saved.elements.find(e=>e.field==='code').x,canvas().scene.nodes.find(n=>n.id==='field-code').x/1000,'every committed gesture already reached the draft')
  h.unmount()
})
