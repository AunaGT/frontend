const test=require('node:test')
const assert=require('node:assert/strict')
const React=require('react')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('cart uses canonical quantities, stock-free services and exact totals while preserving an empty draft',()=>{
  const states=[];let cursor=0
  const {useCart}=loadReportModule('../sales/hooks/useCart.ts',{
    react:{...React,useState:initial=>{const i=cursor++;states[i]??=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]},useCallback:fn=>fn},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},
    '@/services/api':{getApiBaseUrl:()=>'/api'},
  })
  const service={id:'s',name:'Asesoría',kind:'SERVICE',serviceUnitLabel:'Hora',quantityDecimals:2,price:19.99,stock:0}
  const render=()=>{cursor=0;return useCart({availableProducts:[service]})}
  const cart=render()
  cart.addToCart(service);cart.addToCart(service)
  assert.equal(render().cartItems[0].qty,'2')
  render().updateQuantity('s','1.25')
  assert.equal(render().cartItems[0].qty,'1.25')
  assert.equal(render().cartTotal,24.99)
  assert.equal(render().availabilityDialog.open,false)
  render().updateQuantity('s','')
  assert.equal(render().cartItems[0].qty,'')
  assert.equal(render().hasInvalidQuantities,true)
  render().hydrateFromLines([{productId:'s',qty:'0.5'}],[])
  assert.equal(render().cartItems[0].qty,'0.5')
})
