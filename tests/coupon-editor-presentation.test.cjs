const {test}=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const{renderToStaticMarkup}=require('react-dom/server')
const{loadReportModule}=require('./helpers/loadReportModule.cjs')
const{makeCouponFixture}=require('./fixtures/couponFixtures.cjs')
test('canvas renders scene lines and actual image, no editor handles in preview and real selection callback',()=>{
  const f=makeCouponFixture(),nodes=[]
  const{couponData,prepareCouponScene}=loadReportModule('../promotions/coupons/couponPresentation.ts')
  const scene=prepareCouponScene(f.design,couponData(f.promotion,f.codes[0],f.branding),(text,s)=>text.length*s.fontSize*.5)
  const{CouponCanvas}=loadReportModule('../promotions/coupons/CouponCanvas.tsx',{},nodes)
  const html=renderToStaticMarkup(React.createElement(CouponCanvas,{scene,previewOnly:true,selectedId:'field-code'}))
  assert.ok(html.includes('CUPON-QA'));assert.ok(!html.includes('Redimensionar capa'));assert.ok(!html.includes('stroke-dasharray'))
  let selected
  renderToStaticMarkup(React.createElement(CouponCanvas,{scene,onSelect:id=>selected=id}))
  const code=nodes.find(n=>n.type==='g'&&n.props['data-layer']==='field-code'&&n.props.onPointerDown)
  code.props.onPointerDown({});assert.equal(selected,'field-code')
})

test('canvas draws every phase-2 style from the same scene',()=>{
  const f=makeCouponFixture(),{textStyle}=loadReportModule('../promotions/coupons/couponDesign.ts')
  const shadow={x:3,y:4,color:'#000000',opacity:.4},d=f.design
  d.background={kind:'gradient',from:'#0c203a',via:'#ff6f00',to:'#ffd166',angle:135}
  Object.assign(d.elements.find(e=>e.field==='name').style,{font:'Montserrat',italic:true,underline:true,strike:true,letterSpacing:2,strokeColor:'#000000',strokeWidth:1,shadow})
  d.elements.push(
    {id:'forma-1',kind:'shape',shape:'star',color:'#ff6f00',borderColor:'#ffffff',borderWidth:2,radius:0,x:.7,y:.3,width:.2,height:.25,visible:true,locked:false,opacity:1,rotation:15,borderStyle:'dashed',gradient:{from:'#ff6f00',to:'#ffd166',angle:90},shadow},
    {id:'forma-2',kind:'shape',shape:'ellipse',color:'#ffffff',borderColor:'#0c203a',borderWidth:1,radius:0,x:.1,y:.6,width:.2,height:.2,visible:true,locked:false,opacity:1,borderStyle:'dotted'},
    {id:'forma-3',kind:'shape',shape:'badge',color:'#b94700',borderColor:'#b94700',borderWidth:0,radius:0,x:.4,y:.6,width:.15,height:.2,visible:true,locked:false,opacity:1},
    {id:'imagen-1',kind:'image',assetId:'11111111-1111-4111-8111-111111111111',fit:'cover',focalX:.5,focalY:.5,x:.05,y:.05,width:.2,height:.2,visible:true,locked:false,opacity:1,radius:24,shadow},
  )
  const{couponData,prepareCouponScene}=loadReportModule('../promotions/coupons/couponPresentation.ts')
  const measure=(text,s)=>text.length*s.fontSize*.5+(s.letterSpacing??0)*text.length
  const scene=prepareCouponScene(d,couponData(f.promotion,f.codes[0],f.branding),measure)
  const{CouponCanvas}=loadReportModule('../promotions/coupons/CouponCanvas.tsx')
  const assets=new Map([['11111111-1111-4111-8111-111111111111',{id:'11111111-1111-4111-8111-111111111111',url:'https://signed.example/qa.png',expiresAt:'later',width:400,height:400}]])
  const html=renderToStaticMarkup(React.createElement(CouponCanvas,{scene,assets,previewOnly:true}))
  const name=html.match(/<g[^>]*data-layer="field-name"[\s\S]*?<\/g><\/g>|<g[^>]*data-layer="field-name"[\s\S]*?(?=<g[^>]*data-layer=)/)[0]
  assert.match(name,/font-style="italic"/);assert.match(name,/CouponMontserrat/);assert.match(name,/letter-spacing="2"/)
  assert.match(name,/stroke="#000000"[^>]*stroke-width="1"|stroke-width="1"[^>]*stroke="#000000"/)
  assert.match(name,/data-decoration="underline"/);assert.match(name,/data-decoration="strike"/);assert.match(name,/data-shadow/)
  const star=html.match(/<g[^>]*data-layer="forma-1"[\s\S]*?(?=<g[^>]*data-layer=)/)[0]
  assert.match(star,/transform="rotate\(15 /);assert.match(star,/stroke-dasharray/);assert.match(star,/data-shadow/)
  assert.equal(star.match(/<polygon[^>]*points="([^"]+)"/g).at(-1).match(/points="([^"]+)"/)[1].trim().split(/\s+/).length,10)
  assert.match(html,/<linearGradient[^>]*id="[^"]*forma-1/)
  assert.match(html,/<ellipse/)
  const badge=html.match(/<g[^>]*data-layer="forma-3"[\s\S]*?(?=<g[^>]*data-layer=)/)[0]
  assert.equal(badge.match(/points="([^"]+)"/)[1].trim().split(/\s+/).length,32)
  assert.match(html,/<clipPath[^>]*>[^<]*<rect[^>]*rx="24"/)
  assert.match(html,/<linearGradient[^>]*gradientUnits="userSpaceOnUse"/)
})

test('phase 3: a coupon with its own proportion draws at its real height',()=>{
  const f=makeCouponFixture()
  const{couponData,prepareCouponScene}=loadReportModule('../promotions/coupons/couponPresentation.ts')
  const scene=prepareCouponScene({...f.design,aspect:.5},couponData(f.promotion,f.codes[0],f.branding),(text,s)=>text.length*s.fontSize*.5)
  const{CouponCanvas}=loadReportModule('../promotions/coupons/CouponCanvas.tsx')
  const html=renderToStaticMarkup(React.createElement(CouponCanvas,{scene,previewOnly:true}))
  assert.match(html,/viewBox="0 0 1000 2000"/)
  assert.ok(!html.includes('720'),'no leftover of the fixed 1000 × 720 frame')
})
