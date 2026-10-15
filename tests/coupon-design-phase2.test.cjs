const{test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path')
const{loadReportModule}=require('./helpers/loadReportModule.cjs')
const front=loadReportModule('../promotions/coupons/couponDesign.ts')
const back=require(path.join(__dirname,'../../deposito-backend/src/modules/promotions/couponDesign.js'))
const fonts=loadReportModule('../promotions/coupons/couponFonts.ts')
const validators=[['frontend',front.parseCouponDesign],['backend',back.parseCouponDesign]]
const shadow={x:3,y:4,color:'#000000',opacity:.4}

function fullDesign(){
  const d=front.createDefaultCouponDesign()
  d.background={kind:'gradient',from:'#0c203a',via:'#ff6f00',to:'#ffd166',angle:135}
  const name=d.elements.find(e=>e.field==='name')
  Object.assign(name.style,{font:'Montserrat',bold:true,italic:true,underline:true,strike:false,uppercase:true,letterSpacing:2,strokeColor:'#000000',strokeWidth:1,shadow})
  d.elements.push(
    {id:'texto-1',kind:'text',text:'¡OFERTA!',x:.6,y:.05,width:.3,height:.1,visible:true,locked:false,opacity:1,rotation:-12,style:front.textStyle({font:'Pacifico',fontSize:30})},
    {id:'forma-1',kind:'shape',shape:'star',color:'#ff6f00',borderColor:'#ffffff',borderWidth:2,radius:0,x:.7,y:.3,width:.2,height:.25,visible:true,locked:false,opacity:1,rotation:15,borderStyle:'dashed',gradient:{from:'#ff6f00',to:'#ffd166',angle:90},shadow},
    {id:'forma-2',kind:'shape',shape:'ellipse',color:'#ffffff',borderColor:'#0c203a',borderWidth:1,radius:0,x:.1,y:.6,width:.2,height:.2,visible:true,locked:false,opacity:1,borderStyle:'dotted'},
    {id:'forma-3',kind:'shape',shape:'badge',color:'#b94700',borderColor:'#b94700',borderWidth:0,radius:0,x:.4,y:.6,width:.15,height:.2,visible:true,locked:false,opacity:1,gradient:null,shadow:null},
    {id:'imagen-1',kind:'image',assetId:'11111111-1111-4111-8111-111111111111',fit:'cover',focalX:.5,focalY:.5,x:.05,y:.05,width:.2,height:.2,visible:true,locked:false,opacity:1,rotation:5,radius:24,shadow},
  )
  return d
}

for(const[side,parse]of validators){
  test(`${side}: saved phase-1 designs stay valid and untouched`,()=>{
    const legacy=front.createDefaultCouponDesign()
    assert.deepEqual(parse(structuredClone(legacy)),legacy)
  })
  test(`${side}: accepts every phase-2 property and keeps it`,()=>{
    const d=fullDesign()
    assert.deepEqual(parse(structuredClone(d)),d)
  })
  test(`${side}: rejects what would break legibility or the allowlist`,()=>{
    const bad=[
      d=>{d.elements.find(e=>e.field==='code').rotation=10},
      d=>{Object.assign(d.elements.find(e=>e.id==='texto-1').style,{bold:true})},
      d=>{d.elements.find(e=>e.id==='forma-1').shadow={...shadow,x:100}},
      d=>{d.elements.find(e=>e.id==='forma-1').blur=4},
      d=>{d.elements.find(e=>e.id==='forma-2').borderStyle='wavy'},
      d=>{d.elements.find(e=>e.id==='forma-1').gradient={from:'#ff6f00',to:'#ffd166',angle:400}},
      d=>{d.background.via='naranja'},
      d=>{d.elements.find(e=>e.id==='forma-3').shape='triangle'},
      d=>{d.elements.find(e=>e.field==='name').style.letterSpacing=100},
      d=>{d.elements.find(e=>e.field==='name').style.strokeColor='red'},
      d=>{d.elements.find(e=>e.id==='imagen-1').radius=500},
      d=>{d.elements.find(e=>e.field==='name').style.font='ComicSans'},
    ]
    for(const[index,mutate]of bad.entries()){const d=fullDesign();mutate(d);assert.throws(()=>parse(d),/cupón/,`caso ${index}`)}
  })
}

test('font variants allowed by the validator match the files the app ships',()=>{
  for(const[font,variants]of Object.entries(front.COUPON_FONT_VARIANTS))
    for(const variant of ['normal','bold','italic','bolditalic'])assert.equal(fonts.supportsVariant(font,variant),variants.includes(variant),`${font} ${variant}`)
})

for(const[side,parse]of validators)test(`${side}: a middle gradient color needs an angle`,()=>{
  const d=front.createDefaultCouponDesign();d.background={kind:'gradient',from:'#0c203a',via:'#ff6f00',to:'#ffd166'}
  assert.throws(()=>parse(d),/cupón/)
})

for(const[side,parse]of validators)test(`${side}: the coupon may take an image's proportion between 1:2 and 3:1`,()=>{
  for(const aspect of [.5,1,3]){const d={...front.createDefaultCouponDesign(),aspect};assert.deepEqual(parse(structuredClone(d)),d)}
  for(const aspect of [.4,3.1,'1.5',NaN,null])assert.throws(()=>parse({...front.createDefaultCouponDesign(),aspect}),/cupón/,String(aspect))
})

test('the coupon height follows its proportion and stays 720 without one',()=>{
  assert.equal(front.couponHeight(front.createDefaultCouponDesign()),720)
  assert.equal(front.couponHeight({aspect:.5}),2000)
  assert.deepEqual(front.COUPON_ASPECT,{min:.5,max:3})
})
