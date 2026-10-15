const {test} = require('node:test')
const assert = require('node:assert/strict')
const {loadReportModule} = require('./helpers/loadReportModule.cjs')
const fe = loadReportModule('../promotions/coupons/couponDesign.ts')
const be = require('../../deposito-backend/src/modules/promotions/couponDesign.js')
test('coupon contract accepts template/restoration identically on client and server', () => {
  const design = fe.createDefaultCouponDesign()
  for (const parser of [fe.parseCouponDesign, be.parseCouponDesign]) {
    assert.equal(parser(null), null)
    assert.deepEqual(parser(design), design)
  }
  assert.equal(design.terms, '')
  assert.deepEqual(fe.couponAssetIds(design), [])
})
test('coupon contract rejects malformed geometry, unknown keys, duplicate fields and unreadable mandatory fields', () => {
  const good = fe.createDefaultCouponDesign()
  const change = delta => ({...good, elements: good.elements.map((e,i) => i === 0 ? {...e,...delta} : e)})
  const invalid = [[], 'html', {...good, unexpected:true}, {...good,terms:'x'.repeat(501)},
    change({x:NaN}),change({y:Infinity}),change({width:-1}),change({x:.99,width:.2}),
    change({id:'<script>'}),change({opacity:2}), {...good,elements:[...good.elements,good.elements[0]]},
    {...good,elements:good.elements.map(e => e.field === 'code' ? {...e,visible:false} : e)},
    {...good,elements:good.elements.filter(e => e.field !== 'benefit')},
    {...good,background:{kind:'image',assetId:'https://evil.test',fit:'cover',focalX:.5,focalY:.5}},
    {...good,background:JSON.parse('{"kind":"solid","color":"#ffffff","__proto__":{}}')},
    {...good,elements:good.elements.map(e=> e.style ? {...e,style:{...e.style,font:'unknown'}} : e)}]
  for (const value of invalid) for(const parser of [fe.parseCouponDesign, be.parseCouponDesign]) {
    assert.throws(()=>parser(value), e=>e.status===400 && !!e.field)
  }
})
test('coupon image quota counts background and layers and rejects more than five unique assets', () => {
  const design=fe.createDefaultCouponDesign()
  const images=Array.from({length:6},(_,i)=>({id:`img-${i}`,kind:'image',assetId:`00000000-0000-4000-8000-00000000000${i}`,fit:'contain',focalX:.5,focalY:.5,x:.1,y:.1,width:.1,height:.1,opacity:1,locked:false,visible:true}))
  for(const parser of [fe.parseCouponDesign,be.parseCouponDesign]) assert.throws(()=>parser({...design,elements:[...design.elements,...images]}))
  assert.equal(fe.couponAssetIds({...design,elements:[...design.elements,...images.slice(0,5)]}).length,5)
})
