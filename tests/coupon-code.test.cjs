const {test}=require('node:test'),assert=require('node:assert/strict')
const{loadReportModule}=require('./helpers/loadReportModule.cjs')
const{createDefaultCouponDesign,textStyle}=loadReportModule('../promotions/coupons/couponDesign.ts')
const{parseCouponCode,serializeCouponDesign}=loadReportModule('../promotions/coupons/couponCode.ts')
const ok=(source,options)=>{const result=parseCouponCode(source,options);assert.equal(result.ok,true,JSON.stringify(result.errors));return result}
const fails=(source,pattern,options)=>{const result=parseCouponCode(source,options);assert.equal(result.ok,false,'should reject: '+source.slice(0,80));assert.match(result.errors.map(e=>e.message).join(' | '),pattern);return result.errors}
const wrap=(layers,fondo='<fondo color="#0c203a" />')=>`<cupon tamaño="estandar">\n  ${fondo}\n  <campo dato="beneficio" x="5%" y="40%" ancho="90%" alto="8%" />\n  <campo dato="codigo" x="5%" y="50%" ancho="90%" alto="7%" />\n  ${layers}\n</cupon>`

test('default design serializes to readable code and parses back to the same model',()=>{
  const design=createDefaultCouponDesign(),code=serializeCouponDesign(design)
  assert.match(code,/^<cupon tamaño="estandar">/)
  assert.match(code,/<fondo degradado="#0c203a #ff6f00" \/>/)
  assert.match(code,/<campo dato="codigo" x="5%" y="51.5%" ancho="90%" alto="6.5%"\n\s+style="font-size: 32px; font-weight: bold" \/>/)
  assert.match(code,/<forma id="lower-band" tipo="rect" x="0%" y="59%" ancho="100%" alto="41%" bloqueado\n\s+style="background: #f5f7fa" \/>/)
  assert.deepEqual(ok(code).design,design)
})

test('serialization is idempotent and keeps every box inside the coupon after rounding',()=>{
  const design=createDefaultCouponDesign()
  design.elements.push({id:'texto-1',kind:'text',text:'Línea 1\nLínea <2> & más',x:.123456,y:.45,width:.876544,height:.1,visible:false,locked:false,opacity:.5,style:textStyle({font:'Helvetica',color:'#123abc',align:'center',background:'#000000',borderColor:'#ffffff',borderWidth:2,radius:8,padding:4,lineHeight:1.5})})
  design.terms='Válido 1 vez & no acumulable'
  const first=serializeCouponDesign(design),parsed=ok(first).design
  assert.equal(serializeCouponDesign(parsed),first)
  const text=parsed.elements.find(e=>e.id==='texto-1')
  assert.equal(text.text,'Línea 1\nLínea <2> & más');assert.equal(parsed.terms,'Válido 1 vez & no acumulable')
  assert.ok(text.x+text.width<=1,'rounding never pushes a box past the edge')
  assert.match(first,/Línea &lt;2&gt; &amp; más/)
})

test('hand-written code maps every element kind and assigns readable ids',()=>{
  const {design,ranges}=ok(`<cupon tamaño="grande">
  <!-- comentarios permitidos -->
  <fondo imagen="11111111-1111-4111-8111-111111111111" style="object-fit: cover; object-position: 50% 30%" />
  <condiciones>
    Una vez por cliente.
  </condiciones>
  <campo dato="beneficio" x="5%" y="40%" ancho="90%" alto="8%" style="font-family: 'Noto Sans'; font-size: 36; font-weight: 700; color: #FFF" />
  <campo dato="codigo" x="5%" y="50%" ancho="90%" alto="7%" />
  <texto x="5%" y="10%" ancho="40%" alto="6%" oculto style="text-align: right; border: 1px solid #0c203a">HOLA</texto>
  <imagen recurso="22222222-2222-4222-8222-222222222222" x="60%" y="5%" ancho="30%" alto="30%" style="opacity: 0.8" />
  <forma tipo="linea" x="5%" y="60%" ancho="90%" alto="1%" style="stroke: #ff6f00; stroke-width: 3px" />
</cupon>`)
  assert.equal(design.printPreset,'large');assert.equal(design.terms,'Una vez por cliente.')
  assert.deepEqual(design.background,{kind:'image',assetId:'11111111-1111-4111-8111-111111111111',fit:'cover',focalX:.5,focalY:.3})
  const[benefit,code,text,image,line]=design.elements
  assert.deepEqual(benefit.style,textStyle({fontSize:36,bold:true,color:'#ffffff'}))
  assert.equal(code.id,'field-code')
  assert.deepEqual([text.id,text.visible,text.style.align,text.style.borderWidth,text.style.borderColor],['texto-1',false,'right',1,'#0c203a'])
  assert.deepEqual([image.id,image.fit,image.opacity],['imagen-1','contain',.8])
  assert.deepEqual([line.id,line.shape,line.color,line.borderWidth],['forma-1','line','#ff6f00',3])
  assert.ok(ranges['texto-1'].from<ranges['texto-1'].to)
})

test('errors point to the line and column and name the problem',()=>{
  const[error]=fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%" style="font-size: 300px">X</texto>'),/font-size/)
  assert.equal(error.line,5);assert.ok(error.column>1)
  fails(wrap('<div />'),/div/)
  fails(wrap('<texto x="5" y="10%" ancho="40%" alto="6%">X</texto>'),/porcentaje/)
  fails(wrap('<texto x="70%" y="10%" ancho="40%" alto="6%">X</texto>'),/100%/)
  fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%">X'),/cierra|cerrar/)
  fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%" style="box-shadow: 0 0 1px #000">X</texto>'),/box-shadow/)
  fails(`<cupon tamaño="estandar"><fondo color="#0c203a" /><campo dato="beneficio" x="5%" y="40%" ancho="90%" alto="8%" /></cupon>`,/codigo/)
})

test('code cannot hide or drop the restrictions the promotion requires',()=>{
  fails(wrap(''),/vigencia/,{requiredFields:['code','benefit','validity']})
  fails(wrap('<campo dato="vigencia" x="5%" y="70%" ancho="90%" alto="5%" oculto />'),/vigencia/,{requiredFields:['code','benefit','validity']})
  fails(wrap('<campo dato="vigencia" x="5%" y="70%" ancho="90%" alto="5%" style="opacity: 0.4" />'),/vigencia/,{requiredFields:['code','benefit','validity']})
  ok(wrap('<campo dato="vigencia" x="5%" y="70%" ancho="90%" alto="5%" />'),{requiredFields:['code','benefit','validity']})
})

test('malicious markup is rejected as data and never reaches the model',()=>{
  fails(wrap('<script>alert(1)</script>'),/script/)
  fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%" onclick="alert(1)">X</texto>'),/onclick/)
  fails('<!DOCTYPE cupon [<!ENTITY x "y">]>'+wrap(''),/<!/)
  fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%">&xxe;</texto>'),/entidad/i)
  fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%">&#1;</texto>'),/carácter/i)
  fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%" style="background: url(javascript:alert(1))">X</texto>'),/background/)
  fails(wrap('<imagen recurso="https://evil.example/x.png" x="5%" y="10%" ancho="40%" alto="6%" />'),/recurso/)
  fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%"><b>X</b></texto>'),/<texto>/)
  fails(wrap('<?xml-stylesheet href="x"?>'),/<\?/)
  fails(wrap('<texto __proto__="x" x="5%" y="10%" ancho="40%" alto="6%">X</texto>'),/__proto__/)
  assert.equal(({}).x,undefined)
  fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%">'+'a'.repeat(30001)+'</texto>'),/30[ .,]?000/)
  const literal=ok(wrap('<texto id="lit" x="5%" y="10%" ancho="40%" alto="6%">&lt;script&gt;alert(1)&lt;/script&gt;</texto>')).design
  assert.equal(literal.elements.find(e=>e.id==='lit').text,'<script>alert(1)</script>')
  assert.match(serializeCouponDesign(literal),/&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test('phase 2 styles round-trip through real CSS syntax',()=>{
  const d=createDefaultCouponDesign(),shadow={x:3,y:-4,color:'#000000',opacity:.4}
  d.background={kind:'gradient',from:'#0c203a',via:'#ff6f00',to:'#ffd166',angle:135}
  Object.assign(d.elements.find(e=>e.field==='name').style,{font:'PlayfairDisplay',italic:true,underline:true,strike:true,uppercase:true,letterSpacing:-1.5,strokeColor:'#000000',strokeWidth:1,shadow})
  d.elements.push(
    {id:'texto-1',kind:'text',text:'¡OFERTA!',x:.6,y:.05,width:.3,height:.1,visible:true,locked:false,opacity:1,rotation:-12,style:textStyle({font:'Pacifico',fontSize:30})},
    {id:'forma-1',kind:'shape',shape:'star',color:'#ff6f00',borderColor:'#ffffff',borderWidth:2,radius:0,x:.7,y:.3,width:.2,height:.25,visible:true,locked:false,opacity:1,rotation:15,borderStyle:'dashed',gradient:{from:'#ff6f00',to:'#ffd166',angle:90},shadow},
    {id:'forma-2',kind:'shape',shape:'ellipse',color:'#ffffff',borderColor:'#0c203a',borderWidth:1,radius:0,x:.1,y:.6,width:.2,height:.2,visible:true,locked:false,opacity:1,borderStyle:'dotted'},
    {id:'forma-3',kind:'shape',shape:'badge',color:'#b94700',borderColor:'#b94700',borderWidth:0,radius:0,x:.4,y:.6,width:.15,height:.2,visible:true,locked:false,opacity:1},
    {id:'forma-4',kind:'shape',shape:'line',color:'#0c203a',borderColor:'#0c203a',borderWidth:2,radius:0,x:.05,y:.9,width:.9,height:.01,visible:true,locked:false,opacity:1,borderStyle:'dashed'},
    {id:'imagen-1',kind:'image',assetId:'11111111-1111-4111-8111-111111111111',fit:'cover',focalX:.5,focalY:.5,x:.05,y:.05,width:.2,height:.2,visible:true,locked:false,opacity:1,rotation:5,radius:24,shadow},
  )
  const code=serializeCouponDesign(d)
  assert.match(code,/<fondo degradado="#0c203a #ff6f00 #ffd166" angulo="135" \/>/)
  assert.match(code,/font-family: 'Playfair Display'; .*font-style: italic; text-decoration: underline line-through; text-transform: uppercase; letter-spacing: -1.5px; -webkit-text-stroke: 1px #000000; text-shadow: 3px -4px rgba\(0,0,0,0.4\)/)
  assert.match(code,/<forma id="forma-1" tipo="estrella"[\s\S]*?background: linear-gradient\(90deg, #ff6f00, #ffd166\); border: 2px dashed #ffffff; box-shadow: 3px -4px rgba\(0,0,0,0.4\); transform: rotate\(15deg\)/)
  assert.match(code,/tipo="elipse"/);assert.match(code,/tipo="sello"/);assert.match(code,/border-style: dashed/)
  assert.match(code,/<imagen id="imagen-1"[\s\S]*?border-radius: 24px; box-shadow: 3px -4px rgba\(0,0,0,0.4\); transform: rotate\(5deg\)/)
  assert.deepEqual(ok(code).design,d)
})

test('phase 2 code keeps the legibility rules and real font variants',()=>{
  fails(wrap('<campo dato="vigencia" x="5%" y="70%" ancho="90%" alto="5%" style="transform: rotate(10deg)" />'),/rotar/)
  fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%" style="font-family: Pacifico; font-weight: bold">X</texto>'),/Pacifico/)
  fails(wrap('<texto x="5%" y="10%" ancho="40%" alto="6%" style="text-shadow: 2px 2px rgba(0,0,0,2)">X</texto>'),/text-shadow/)
  fails(wrap('',`<fondo degradado="#0c203a #ff6f00 #ffd166" />`),/angulo/)
  fails(wrap('<forma tipo="triangulo" x="5%" y="10%" ancho="40%" alto="6%" />'),/tipo/)
})

test('phase 3: the coupon proportion round-trips as proporcion and is checked',()=>{
  const d={...createDefaultCouponDesign(),aspect:1.498},code=serializeCouponDesign(d)
  assert.match(code,/^<cupon tamaño="estandar" proporcion="1.498">/)
  assert.deepEqual(ok(code).design,d)
  assert.ok(!serializeCouponDesign(createDefaultCouponDesign()).includes('proporcion'),'a standard coupon writes no proporcion')
  fails(code.replace('proporcion="1.498"','proporcion="5"'),/proporcion/)
  fails(code.replace('proporcion="1.498"','proporcion="ancho"'),/proporcion/)
})

test('line styles are not rectangle styles and dashed borders belong to shapes',()=>{
  const shape=style=>`<forma tipo="rect" x="5%" y="5%" ancho="30%" alto="10%" style="${style}" />`
  for(const style of ['border-style: dashed','stroke: #ff6f00','stroke-width: 2px'])fails(wrap(shape(style)),/Propiedad no soportada/)
  ok(wrap('<forma tipo="linea" x="5%" y="5%" ancho="30%" alto="1%" style="stroke: #ff6f00; stroke-width: 20px; border-style: dashed" />'))
  ok(wrap(shape('border: 2px dashed #ff6f00')))
  for(const tag of ['campo','texto']){
    const layer=style=>tag==='campo'?`<campo dato="nombre" x="5%" y="5%" ancho="30%" alto="10%" style="${style}" />`:`<texto x="5%" y="5%" ancho="30%" alto="10%" style="${style}">X</texto>`
    for(const style of ['dashed','dotted'])fails(wrap(layer(`border: 2px ${style} #ff6f00`)),/borde es solid/)
    ok(wrap(layer('border: 20px solid #ff6f00')))
    ok(wrap(layer('border: none')))
  }
})

test('supported fonts and inclusive padding limits remain valid',()=>{
  const layer=style=>`<texto x="5%" y="5%" ancho="30%" alto="10%" style="${style}">X</texto>`
  for(const font of ['Noto Sans','Helvetica','Montserrat','Poppins','Playfair Display','Oswald','Roboto Slab','Bebas Neue','Pacifico'])ok(wrap(layer(`font-family: '${font}'`)))
  fails(wrap(layer('font-family: Arial')),/font-family no es válido/)
  for(const padding of [0,30])ok(wrap(layer(`padding: ${padding}px`)))
  fails(wrap(layer('padding: 31px')),/padding no es válido/)
})
