const{test}=require('node:test'),assert=require('node:assert/strict')
const{mountCouponForm}=require('./helpers/couponFormHarness.cjs')
const{loadReportModule}=require('./helpers/loadReportModule.cjs')
const{createDefaultCouponDesign}=loadReportModule('../promotions/coupons/couponDesign.ts')
const COMPANY='11111111-1111-4111-8111-111111111111',PROMOTION='44444444-4444-4444-8444-444444444444'
const memoryStorage=()=>{const map=new Map();return{map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>{map.set(k,String(v))},removeItem:k=>{map.delete(k)}}}
const drafts=storage=>[...storage.map.keys()].filter(k=>k.startsWith('promotion-draft:'))
const hasText=(nodes,text)=>nodes.some(n=>[n.props?.children].flat(4).some(c=>typeof c==='string'&&c.includes(text)))

test('the form links to the coupon view and the coupon route renders the designer instead of the form',()=>{
  const form=mountCouponForm()
  try{assert.equal(form.preview().designPath,`/promociones/${PROMOTION}/editar/cupon`)}finally{form.unmount()}
  const created=mountCouponForm({mode:'create'})
  try{assert.equal(created.preview().designPath,'/promociones/nueva/cupon')}finally{created.unmount()}
  const designer=mountCouponForm({pathname:`/promociones/${PROMOTION}/editar/cupon`})
  try{
    assert.ok(!designer.nodes.some(n=>n.type==='form'),'the form is not rendered on the coupon route')
    const view=designer.nodes.find(n=>n.type?.name==='PromotionCouponDesigner')
    assert.ok(view,'the designer view is rendered');assert.equal(view.props.formPath,`/promociones/${PROMOTION}/editar`)
    assert.equal(view.props.coupon.design.elements.some(e=>e.field==='code'),true)
  }finally{designer.unmount()}
})

test('an unsaved draft survives a reload and saving clears it',async()=>{
  const storage=memoryStorage();global.sessionStorage=storage
  try{
    const first=mountCouponForm(),design=createDefaultCouponDesign();design.terms='Sobrevive a recargar'
    assert.deepEqual(drafts(storage),[],'opening the form without changes does not create a draft')
    first.editDesign(design)
    assert.deepEqual(drafts(storage),[`promotion-draft:${COMPANY}:${PROMOTION}`])
    first.unmount()
    const second=mountCouponForm()
    assert.equal(second.currentDesign().terms,'Sobrevive a recargar')
    assert.ok(hasText(second.nodes,'Se recuperó un borrador sin guardar'))
    await second.submit()
    assert.equal(second.requests.at(-1).body.coupon_design.terms,'Sobrevive a recargar')
    assert.deepEqual(drafts(storage),[],'saving removes the draft')
    second.unmount()
  }finally{delete global.sessionStorage}
})

test('the create view restores its draft and a tampered draft is discarded',()=>{
  const storage=memoryStorage();global.sessionStorage=storage
  try{
    const first=mountCouponForm({mode:'create'}),design=createDefaultCouponDesign();design.terms='Nueva sin guardar'
    first.editDesign(design);first.unmount()
    const second=mountCouponForm({mode:'create'})
    assert.equal(second.currentDesign().terms,'Nueva sin guardar');second.unmount()
    storage.setItem(`promotion-draft:${COMPANY}:new`,JSON.stringify({formData:{},coupon:{design:{elements:'<script>alert(1)</script>'},draftId:'x'}}))
    const third=mountCouponForm({mode:'create'})
    assert.equal(third.currentDesign().terms,'');assert.equal(storage.getItem(`promotion-draft:${COMPANY}:new`),null)
    assert.ok(!hasText(third.nodes,'Se recuperó un borrador sin guardar'))
    third.unmount()
  }finally{delete global.sessionStorage}
})
