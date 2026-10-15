const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process')
const{loadReportModule}=require('./helpers/loadReportModule.cjs'),{makeCouponFixture}=require('./fixtures/couponFixtures.cjs')
global.fetch=async url=>({ok:true,arrayBuffer:async()=>{const b=fs.readFileSync(path.join(__dirname,'../public',url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}})
const{buildCouponPdf}=loadReportModule('../promotions/coupons/couponPdf.ts')
test('coupon PDF uses same scene for every code across pages, branding and terms stay inside cuts',async()=>{
  for(const preset of ['standard','large']){
    const f=makeCouponFixture();f.design.printPreset=preset;f.design.terms='Condición QA';f.codes=Array.from({length:9},(_,i)=>({code:`CUPON-QA-${i+1}`,active:true,current_uses:0}))
    const blob=await buildCouponPdf(f),bytes=Buffer.from(await blob.arrayBuffer()),res=spawnSync('pdftotext',['-','-'],{input:bytes})
    assert.equal(res.status,0);const text=res.stdout.toString()
    for(const code of f.codes)assert.ok(text.includes(code.code),code.code)
    assert.ok(text.includes('Empresa QA'));assert.ok(text.includes('Condición QA'));assert.ok(text.includes(preset==='standard'?'Página 3 de 3':'Página 5 de 5'))
    const dir=path.join(__dirname,'../output/coupons');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`coupon-${preset}.pdf`),bytes)
  }
})
test('export blocks missing assets, clipped text, unsupported glyphs and mandatory occlusion before downloading',async()=>{
  const f=makeCouponFixture();await assert.rejects(buildCouponPdf({...f,codes:[]}),/código/)
  f.design.elements.push({id:'cover',kind:'shape',shape:'rect',color:'#ffffff',borderColor:'#ffffff',borderWidth:0,radius:0,x:0,y:0,width:1,height:1,visible:true,locked:false,opacity:1})
  await assert.rejects(buildCouponPdf(f),/tapado/)
  const bad=makeCouponFixture();bad.design.elements.find(e=>e.field==='code').width=.02
  await assert.rejects(buildCouponPdf(bad),/Código.*no cabe/)
  const unicode=makeCouponFixture();unicode.promotion.name='Cupón 漢字';await assert.rejects(buildCouponPdf(unicode),/caracteres/)
  const missing=makeCouponFixture();missing.design.background={kind:'image',assetId:'11111111-1111-4111-8111-111111111111',fit:'cover',focalX:.5,focalY:.5};await assert.rejects(buildCouponPdf(missing),/imagen/i)
})
test('edited coupon preserves wide logo, private alpha image, long title/code and 500-character terms',async()=>{
  const sharp=require('../../deposito-backend/node_modules/sharp'),f=makeCouponFixture(),old=global.fetch
  const image=await sharp({create:{width:1000,height:720,channels:4,background:'#0c203a'}}).png().toBuffer()
  const alpha=await sharp({create:{width:120,height:80,channels:4,background:{r:255,g:111,b:0,alpha:.5}}}).png().toBuffer()
  f.branding.logoDataUrl='data:image/png;base64,'+(await sharp({create:{width:1000,height:100,channels:4,background:'#ffffff'}}).png().toBuffer()).toString('base64')
  const bg='11111111-1111-4111-8111-111111111111',img='22222222-2222-4222-8222-222222222222'
  f.design.background={kind:'image',assetId:bg,fit:'cover',focalX:.25,focalY:.75}
  f.assets=new Map([bg,img].map(id=>[id,{id,url:'https://qa.test/'+id,expiresAt:new Date(Date.now()+3600000).toISOString(),width:id===bg?1000:120,height:id===bg?720:80}]))
  f.design.elements.push({id:'own-image',kind:'image',assetId:img,fit:'contain',focalX:.25,focalY:.5,x:.88,y:.37,width:.06,height:.045,opacity:.7,visible:true,locked:false})
  f.promotion.name='Promoción válida en nuestra empresa para clientes participantes '.repeat(4).slice(0,150-'ÁREA QA FINAL'.length)+'ÁREA QA FINAL'
  f.codes=[{code:'X'.repeat(50),active:true,current_uses:0}]
  const name=f.design.elements.find(e=>e.field==='name');name.height=.18;name.style.fontSize=22
  f.design.elements.find(e=>e.field==='code').style.fontSize=24
  const suffix=' FIN_CONDICIONES_QA';f.design.terms='Condiciones especiales para clientes participantes. '.repeat(20).slice(0,500-suffix.length)+suffix
  const terms=f.design.elements.find(e=>e.field==='terms');terms.y=.67;terms.height=.30
  for(const e of f.design.elements)if(['branches','limits','minimumPurchase','state'].includes(e.field))e.visible=false
  global.fetch=async url=>url.startsWith('https://qa.test/')?{ok:true,arrayBuffer:async()=>{const b=url.endsWith(bg)?image:alpha;return b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}}:old(url)
  try{
    const bytes=Buffer.from(await(await buildCouponPdf(f)).arrayBuffer()),res=spawnSync('pdftotext',['-','-'],{input:bytes});assert.equal(res.status,0)
    fs.writeFileSync(path.join(__dirname,'../output/coupons/coupon-edited.pdf'),bytes)
    const text=res.stdout.toString().replace(/\s+/g,' ');assert.ok(text.includes('ÁREA QA FINAL'),text);assert.ok(text.includes('FIN_CONDICIONES_QA'));assert.ok(text.includes('X'.repeat(50)))
  }finally{global.fetch=old}
})
test('real backend-normalized WebP cutout retains alpha mask in the PDF instead of becoming JPEG',async()=>{
  const sharp=require('../../deposito-backend/node_modules/sharp'),{createCouponApiHarness}=require('../../deposito-backend/tests/helpers/couponApiHarness.cjs'),h=createCouponApiHarness(),f=makeCouponFixture()
  const old={fetch:global.fetch,bitmap:global.createImageBitmap,canvas:global.OffscreenCanvas}
  try{
    const png=await sharp({create:{width:120,height:80,channels:4,background:{r:255,g:111,b:0,alpha:.5}}}).png().toBuffer()
    const dto=await h.assets.uploadCouponAsset(h.ctx,{mimetype:'image/png',buffer:png}),webp=h.calls.find(c=>c.op==='upload').buffer
    assert.equal((await sharp(webp).metadata()).format,'webp')
    global.createImageBitmap=async blob=>{const png=await sharp(Buffer.from(await blob.arrayBuffer())).png().toBuffer(),meta=await sharp(png).metadata();return{width:meta.width,height:meta.height,png,close(){}}}
    global.OffscreenCanvas=class{constructor(width,height){this.width=width;this.height=height}getContext(){return{drawImage:bitmap=>this.bitmap=bitmap}}async convertToBlob(){return new Blob([this.bitmap.png],{type:'image/png'})}}
    global.fetch=async url=>url===dto.url?{ok:true,arrayBuffer:async()=>webp.buffer.slice(webp.byteOffset,webp.byteOffset+webp.length)}:old.fetch(url)
    f.assets=new Map([[dto.id,dto]])
    f.design.elements.push({id:'cutout',kind:'image',assetId:dto.id,fit:'contain',focalX:.5,focalY:.5,x:.88,y:.37,width:.06,height:.045,opacity:1,visible:true,locked:false})
    const bytes=Buffer.from(await(await buildCouponPdf(f)).arrayBuffer())
    fs.writeFileSync(path.join(__dirname,'../output/coupons/coupon-normalized-alpha.pdf'),bytes)
    const pdf=bytes.toString('latin1')
    assert.ok(pdf.includes('/SMask'),'WebP transparency must survive native bitmap → PNG → PDF')
    assert.ok(!pdf.includes('/DCTDecode'),'normalized transparent upload must not be flattened to JPEG')
  }finally{global.fetch=old.fetch;global.createImageBitmap=old.bitmap;global.OffscreenCanvas=old.canvas;h.restore()}
})
test('painted decorative strokes are clipped at the coupon cut just like the SVG viewport',async()=>{
  const sharp=require('../../deposito-backend/node_modules/sharp'),f=makeCouponFixture()
  f.design.elements.unshift({id:'frame',kind:'shape',shape:'rect',x:0,y:0,width:1,height:1,color:'#0c203a',borderColor:'#ff6f00',borderWidth:20,radius:0,opacity:1,visible:true,locked:false})
  const bytes=Buffer.from(await(await buildCouponPdf(f)).arrayBuffer()),render=spawnSync('pdftoppm',['-f','1','-l','1','-r','72','-singlefile','-png','-'],{input:bytes})
  assert.equal(render.status,0)
  const pixel=await sharp(render.stdout).extract({left:Math.round(30/25.4*72),top:Math.round(9.4/25.4*72),width:1,height:1}).raw().toBuffer()
  assert.ok(pixel[0]>245&&pixel[1]>245&&pixel[2]>245,'outside the 10mm cut margin must stay white even with a thick border')
})

test('phase 2 reaches the PDF: new fonts embedded, uppercase text, rotation drawn and every effect exports',async()=>{
  const sharp=require('../../deposito-backend/node_modules/sharp'),f=makeCouponFixture(),d=f.design,shadow={x:3,y:4,color:'#000000',opacity:.4}
  const{textStyle}=loadReportModule('../promotions/coupons/couponDesign.ts')
  d.background={kind:'gradient',from:'#0c203a',via:'#163c66',to:'#ff6f00',angle:120}
  Object.assign(d.elements.find(e=>e.field==='name').style,{font:'Montserrat',bold:true,italic:true,uppercase:true,underline:true,letterSpacing:1,strokeColor:'#000000',strokeWidth:.5,shadow})
  d.elements.push(
    {id:'texto-1',kind:'text',text:'¡Oferta!',x:.62,y:.04,width:.3,height:.1,visible:true,locked:false,opacity:1,rotation:-8,style:textStyle({font:'Pacifico',fontSize:30,strike:true})},
    {id:'forma-1',kind:'shape',shape:'star',color:'#ffd166',borderColor:'#ffffff',borderWidth:2,radius:0,x:.84,y:.62,width:.12,height:.16,visible:true,locked:false,opacity:1,borderStyle:'dashed',gradient:{from:'#ffd166',to:'#ff6f00',angle:90},shadow},
    {id:'forma-2',kind:'shape',shape:'ellipse',color:'#ffffff',borderColor:'#0c203a',borderWidth:1,radius:0,x:.84,y:.80,width:.1,height:.12,visible:true,locked:false,opacity:.6,borderStyle:'dotted'},
    {id:'forma-3',kind:'shape',shape:'badge',color:'#b94700',borderColor:'#b94700',borderWidth:0,radius:0,x:.7,y:.80,width:.1,height:.14,visible:true,locked:false,opacity:1},
    {id:'barra',kind:'shape',shape:'rect',color:'#ff0000',borderColor:'#ff0000',borderWidth:0,radius:0,x:.40,y:.45,width:.20,height:.04,visible:true,locked:false,opacity:1,rotation:90},
  )
  const bytes=Buffer.from(await(await buildCouponPdf(f)).arrayBuffer())
  const dir=path.join(__dirname,'../output/coupons');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'coupon-phase2.pdf');fs.writeFileSync(file,bytes)
  const text=spawnSync('pdftotext',[file,'-']).stdout.toString()
  assert.ok(text.includes('PROMOCIÓN QA'),'uppercase reaches the PDF text');assert.ok(text.includes('Oferta'))
  const fonts=spawnSync('pdffonts',[file]).stdout.toString()
  assert.match(fonts,/Montserrat/);assert.match(fonts,/Pacifico/)
  const render=spawnSync('pdftoppm',['-f','1','-l','1','-r','72','-singlefile','-png','-'],{input:bytes})
  assert.equal(render.status,0)
  const at=async(xmm,ymm)=>[...await sharp(render.stdout).extract({left:Math.round(xmm/25.4*72),top:Math.round(ymm/25.4*72),width:1,height:1}).raw().toBuffer()]
  const red=([r,g,b])=>r>200&&g<80&&b<80
  assert.ok(red(await at(85.5,42)),'the bar rotated 90° stands vertical')
  assert.ok(!red(await at(76,50.6)),'nothing is drawn where the unrotated bar would be')
})

test('phase 3: a tall coupon prints with its real height inside its cut and the page grid that fits',async()=>{
  const sharp=require('../../deposito-backend/node_modules/sharp'),f=makeCouponFixture()
  const{getCouponPrintLayout}=loadReportModule('../promotions/coupons/couponPresentation.ts')
  Object.assign(f.design,{aspect:.5,printPreset:'large',background:{kind:'solid',color:'#ff0000'}})
  f.design.elements=f.design.elements.filter(e=>e.id!=='lower-band')
  for(const e of f.design.elements)if(e.style)e.style.fontSize=Math.max(e.style.fontSize,34)
  f.codes=[{code:'ALTO-1',active:true,current_uses:0},{code:'ALTO-2',active:true,current_uses:0}]
  const bytes=Buffer.from(await(await buildCouponPdf(f)).arrayBuffer())
  const text=spawnSync('pdftotext',['-','-'],{input:bytes}).stdout.toString()
  assert.ok(text.includes('ALTO-1')&&text.includes('ALTO-2')&&text.includes('Página 1 de 1'))
  const render=spawnSync('pdftoppm',['-f','1','-l','1','-r','72','-singlefile','-png','-'],{input:bytes});assert.equal(render.status,0)
  const image=sharp(render.stdout),meta=await image.metadata(),p=getCouponPrintLayout('large',.5)
  assert.equal(meta.width<meta.height,p.orientation==='portrait')
  const at=async(xmm,ymm)=>[...await sharp(render.stdout).extract({left:Math.round(xmm/25.4*72),top:Math.round(ymm/25.4*72),width:1,height:1}).raw().toBuffer()]
  const x=(p.pageWidth-(p.columns*p.tileWidth+(p.columns-1)*p.gap))/2+2
  const inside=await at(x,p.top+p.tileHeight-2),below=await at(x,p.top+p.tileHeight+2.5)
  assert.ok(inside[0]>200&&inside[1]<60,'the coupon reaches its real height')
  assert.ok(below[0]>245&&below[1]>245&&below[2]>245,'and nothing is painted below its cut')
})

test('a shared code can print as many copies as asked, with or without the code on the coupon',async()=>{
  const f=makeCouponFixture(),code={code:'TODOS-15',active:true,current_uses:0}
  const{sharedCouponCode}=loadReportModule('../promotions/coupons/couponPresentation.ts')
  assert.equal(sharedCouponCode({max_uses:null,codes:[code]}),true)
  assert.equal(sharedCouponCode({max_uses:50,codes:[code]}),false,'limited uses must keep one coupon per code')
  assert.equal(sharedCouponCode({max_uses:null,codes:[code,{...code,code:'OTRO'}]}),false)
  const text=async options=>spawnSync('pdftotext',['-','-'],{input:Buffer.from(await(await buildCouponPdf({...f,codes:Array(6).fill(code),...options})).arrayBuffer())}).stdout.toString()
  const withCode=await text({}),without=await text({printCode:false})
  assert.equal(withCode.split('TODOS-15').length-1,6);assert.ok(withCode.includes('Página 2 de 2'))
  assert.ok(!without.includes('TODOS-15'),'the code is not printed');assert.equal(without.split('15% de descuento').length-1,6);assert.ok(without.includes('Página 2 de 2'))
})
