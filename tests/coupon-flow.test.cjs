const{test}=require('node:test'),assert=require('node:assert/strict')
const{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const{createDefaultCouponDesign}=loadReportModule('../promotions/coupons/couponDesign.ts')
test('actual edit form sends draft and design, failed save retains edits and refetch cannot reset form',async()=>{
  const{mountCouponForm}=require('./helpers/couponFormHarness.cjs')
  const h=mountCouponForm();try{
    const design=createDefaultCouponDesign();design.terms='Conservar borrador';h.editDesign(design);h.setFailure(true);await h.submit()
    assert.deepEqual(h.requests.at(-1).body.coupon_design,design);assert.match(h.requests.at(-1).body.coupon_draft_id,/^[0-9a-f-]{36}$/i)
    h.render();assert.equal(h.currentDesign().terms,'Conservar borrador')
  }finally{h.unmount()}
})
test('coupon draft initializes once, refetch cannot overwrite dirty edits, late uploads cannot contaminate a new scope',async()=>{
  const h=hookHarness();let finish;const requests=[]
  const api={resolveCouponAssets:async()=>[],removeDraftCouponAsset:async()=>{},uploadCouponAsset:async(file,ctx)=>{requests.push(ctx);return new Promise(r=>finish=r)}}
  const{useCouponDesign}=loadReportModule('../promotions/coupons/useCouponDesign.ts',{'react':h.hooks,'./couponAssetsApi':api})
  let scope={companyId:'A',promotionId:'P',initialDesign:null,ready:true},result
  const render=()=>result=h.render(()=>useCouponDesign(scope))
  render();render();const changed=createDefaultCouponDesign();changed.terms='Condición QA';result.setDesign(changed);render()
  scope={...scope,initialDesign:createDefaultCouponDesign()};render();render()
  assert.equal(result.design.terms,'Condición QA');assert.deepEqual(result.payload().coupon_design,changed)
  assert.match(result.payload().coupon_draft_id,/^[0-9a-f-]{36}$/i)
  const pending=result.upload({name:'qa.png'});scope={companyId:'B',promotionId:'Q',initialDesign:null,ready:true};render();render()
  finish({id:'old',url:'old-url',expiresAt:'later',width:20,height:20});await assert.rejects(pending,/contexto|cancelada/)
  render();assert.equal(result.assets.size,0);assert.equal(result.design.terms,'');assert.equal(result.pending,false)
  h.unmount()
})
test('multipart sends tenant/auth headers without JSON content type and forwards cancellation',async()=>{
  const calls=[],abort=new AbortController(),old=global.fetch
  global.fetch=async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({id:'image',url:'signed'})}}
  try{
    const api=loadReportModule('../promotions/coupons/couponAssetsApi.ts',{'@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=>'qa-token',tenantHeaders:()=>({'X-Company-Id':'old-company'}),apiFetch(){throw Error('Unexpected')}}})
    await api.uploadCouponAsset(new Blob(['image']),{companyId:'current-company',draftId:'draft'},abort.signal)
    assert.equal(calls[0].options.headers['X-Company-Id'],'current-company')
    assert.equal(calls[0].options.headers.Authorization,'Bearer qa-token')
    assert.ok(!('Content-Type'in calls[0].options.headers));assert.equal(calls[0].options.signal,abort.signal)
  }finally{global.fetch=old}
})
