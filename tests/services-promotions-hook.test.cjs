const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
function harness(validate){
  const values=[],refs=[],effects=[],messages=[],requests=[];let cursor=0,refCursor=0
  const {usePromotions}=loadReportModule('../../hooks/usePromotions.ts',{
    react:{...React,useState:initial=>{const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],next=>values[i]=typeof next==='function'?next(values[i]):next]},useMemo:fn=>fn(),useCallback:fn=>fn,useRef:initial=>refs[refCursor++]??=( {current:initial}),useEffect:fn=>effects.push(fn)},
    '@/hooks/use-toast':{useToast:()=>({toast:value=>messages.push(value)})},
    '@/services/promotionService':{validatePromotionCode:async(code,items)=>{requests.push(items);return validate(code,items)}},
  })
  return{requests,messages,render:(qty='1',contextKey='A')=>{cursor=0;refCursor=0;const result=usePromotions({cartItems:[{product_id:'s',price:100,qty}],cartTotal:Number(qty)*100,contextKey});while(effects.length)effects.shift()();return result}}
}
const result={valid:true,discount:10,promotion:{id:'p',code:'TEN',name:'10%'}}
test('cart or tenant changes immediately remove prior discounts and explain why',async()=>{
  const h=harness(async()=>result)
  await h.render().applyCode('TEN')
  assert.equal(h.render().finalTotal,90)
  assert.equal(h.render('2').finalTotal,200)
  assert.deepEqual(h.render('2').promotionCodes,[])
  assert.ok(h.messages.some(message=>/cambi|actualiz/i.test(message.description)))
  await h.render('2').applyCode('TEN')
  assert.deepEqual(h.render('2','B').promotionCodes,[])
})
test('late promotion validation from an older cart is discarded',async()=>{
  let finish
  const h=harness(()=>new Promise(resolve=>{finish=resolve}))
  const pending=h.render('1.5').applyCode('TEN')
  assert.equal(h.requests[0][0].qty,'1.5')
  h.render('2')
  finish(result)
  assert.equal(await pending,false)
  assert.equal(h.render('2').finalTotal,200)
  assert.deepEqual(h.render('2').promotionCodes,[])
})
