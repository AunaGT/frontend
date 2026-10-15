const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs'),{labelProduct}=require('./fixtures/barcodeLabelFixtures.cjs')
test('one pointer gesture commits once, cancel preserves draft, keyboard alternative remains',()=>{
  const h=hookHarness(),nodes=[],hooks={...h.hooks,useReducer:(r,initial)=>{const[s,set]=h.hooks.useState(initial);return[s,a=>set(old=>r(old,a))]}}
  const {createLabelTemplate}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts')
  const {BarcodeLabelEditor}=loadReportModule('../inventory/barcodeLabels/BarcodeLabelEditor.tsx',{react:hooks,'@/modules/promotions/coupons/couponFonts':{...loadReportModule('../promotions/coupons/couponFonts.ts'),createCouponMeasure:async()=>(text,s)=>text.length*s.fontSize*.5}},nodes)
  let edits=0;const props={design:createLabelTemplate(),product:labelProduct(),branding:{companyName:'QA',locale:'es-GT',currencyCode:'GTQ'},onChange:()=>edits++,onSave:async()=>{},onBack(){},canSave:true,saving:false}
  const render=()=>{nodes.length=0;h.render(()=>BarcodeLabelEditor(props))};render()
  const canvas=()=>nodes.find(n=>n.type?.name==='BarcodeLabelCanvas').props
  const svg={focus(){},setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false,getBoundingClientRect:()=>({width:350,height:175})}
  const event={clientX:10,clientY:10,pointerId:1,currentTarget:{ownerSVGElement:svg},preventDefault(){}}
  canvas().onBeginMove('bars',event);canvas().onPointerMove({clientX:13.5,clientY:10});render();canvas().onPointerUp();render()
  assert.equal(edits,1)
  canvas().onBeginMove('bars',event);canvas().onPointerMove({clientX:17,clientY:10});render();canvas().onPointerCancel();render();assert.equal(edits,1)
  canvas().onKeyDown({key:'ArrowLeft',shiftKey:false,preventDefault(){}});render();assert.equal(edits,2)
  h.unmount()
})
test('explicit saved-design reload resets canvas even when the saved revision is unchanged',()=>{
  const h=hookHarness(),nodes=[],hooks={...h.hooks,useReducer:(r,initial)=>{const[s,set]=h.hooks.useState(initial);return[s,a=>set(old=>r(old,a))]}},design=loadReportModule('../inventory/barcodeLabels/labelDesign.ts').createLabelTemplate()
  const {BarcodeLabelEditor}=loadReportModule('../inventory/barcodeLabels/BarcodeLabelEditor.tsx',{react:hooks,'@/modules/promotions/coupons/couponFonts':{createCouponMeasure:async()=>(t,s)=>t.length*s.fontSize*.5}},nodes)
  const props={design,product:labelProduct(),branding:{companyName:'QA',locale:'es-GT',currencyCode:'GTQ'},onChange(){},onSave:async()=>{},onBack(){},canSave:true,saving:false,reloadVersion:0}
  const render=()=>{nodes.length=0;h.render(()=>BarcodeLabelEditor(props))},canvas=()=>nodes.find(n=>n.type?.name==='BarcodeLabelCanvas').props
  render();props.design={...design,widthMm:100};props.reloadVersion=1;render();render();assert.equal(canvas().design.widthMm,100);h.unmount()
})
