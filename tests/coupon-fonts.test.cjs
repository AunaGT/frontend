const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const{loadReportModule}=require('./helpers/loadReportModule.cjs')
const publicDir=path.join(__dirname,'../public')
global.fetch=async url=>({ok:fs.existsSync(path.join(publicDir,url)),arrayBuffer:async()=>{const b=fs.readFileSync(path.join(publicDir,url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}})
const fonts=loadReportModule('../promotions/coupons/couponFonts.ts')
const{textStyle}=loadReportModule('../promotions/coupons/couponDesign.ts')

test('every registered font file ships with the app together with its OFL license',()=>{
  for(const[id,font]of Object.entries(fonts.COUPON_FONTS)){
    if(!font.files)continue
    for(const file of Object.values(font.files)){
      assert.ok(fs.existsSync(path.join(publicDir,file)),`${id}: falta ${file}`)
      assert.ok(['LICENSE','OFL.txt','LICENSE.txt'].some(name=>fs.existsSync(path.join(publicDir,path.dirname(file),name))),`${id}: falta la licencia`)
    }
  }
  assert.ok(Object.keys(fonts.COUPON_FONTS).length>=9)
})

test('variants follow what each family really ships instead of being simulated',()=>{
  assert.equal(fonts.fontVariant({bold:true,italic:true}),'bolditalic')
  assert.equal(fonts.fontVariant({bold:false}),'normal')
  assert.equal(fonts.supportsVariant('Pacifico','bold'),false)
  assert.equal(fonts.supportsVariant('BebasNeue','italic'),false)
  assert.equal(fonts.supportsVariant('Montserrat','bolditalic'),true)
  assert.equal(fonts.supportsVariant('NotoSans','italic'),true)
  assert.equal(fonts.supportsVariant('Helvetica','bolditalic'),true)
})

test('measuring uses the real font, adds letter spacing and refuses fonts that are not loaded yet',async()=>{
  const measure=await fonts.createCouponMeasure()
  const noto=textStyle({fontSize:30}),pacifico=textStyle({font:'Pacifico',fontSize:30})
  assert.throws(()=>measure('Hola',pacifico),/fuente/i,'never measures with a silent fallback')
  await fonts.ensureCouponFonts(['Montserrat','Pacifico'])
  const montserrat=textStyle({font:'Montserrat',fontSize:30})
  assert.notEqual(measure('Hola cupón',montserrat),measure('Hola cupón',noto))
  assert.ok(measure('Hola',pacifico)>0)
  assert.ok(Math.abs(measure('Hola',{...montserrat,letterSpacing:2})-(measure('Hola',montserrat)+8))<1e-6)
  assert.equal(measure.supports('ñandú',montserrat),true)
})
