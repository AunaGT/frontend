const {test}=require('node:test'),assert=require('node:assert/strict')
const {EditorState}=require('@codemirror/state'),{CompletionContext}=require('@codemirror/autocomplete'),{xml}=require('@codemirror/lang-xml')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {styleCompletion}=loadReportModule('../promotions/coupons/couponCodeCompletion.ts')
const {parseCouponCode}=loadReportModule('../promotions/coupons/couponCode.ts')
function complete(source){
  const pos=source.indexOf('|'),doc=source.replace('|','')
  return styleCompletion(new CompletionContext(EditorState.create({doc,extensions:[xml()]}),pos,true))
}

test('shape style suggestions respect tipo, including a type after style',()=>{
  for(const source of ['<forma tipo="rect" style="|" />','<forma style="|" tipo="rect" />']){
    assert.deepEqual(complete(source).options.map(o=>o.label),['background','border','border-radius','box-shadow','transform','opacity'])
  }
  assert.deepEqual(complete('<forma tipo="linea" style="|" />').options.map(o=>o.label),['stroke','stroke-width','border-style','box-shadow','transform','opacity'])
  for(const tipo of ['elipse','estrella','sello'])assert.deepEqual(complete(`<forma tipo="${tipo}" style="|" />`).options.map(o=>o.label),['background','border','box-shadow','transform','opacity'])
})

test('completing a font with spaces replaces the whole value with a valid font',()=>{
  const source='<texto x="5%" y="5%" ancho="30%" alto="10%" style="font-family: \'Noto S|">X</texto>'
  const result=complete(source),option=result.options.find(o=>o.label==="'Noto Sans'"),pos=source.indexOf('|'),doc=source.replace('|','')
  assert.ok(option)
  const layer=doc.slice(0,result.from)+(option.apply??option.label)+doc.slice(pos)
  const parsed=parseCouponCode(`<cupon><fondo color="#fff" /><campo dato="beneficio" x="0%" y="30%" ancho="90%" alto="10%" /><campo dato="codigo" x="0%" y="50%" ancho="90%" alto="10%" />${layer}</cupon>`)
  assert.equal(parsed.ok,true,JSON.stringify(parsed.errors))
})

test('font completion in the middle of a value leaves following declarations intact',()=>{
  const source='<texto style="font-family: \'Noto S|ans\'; color: #ff6f00">X</texto>',pos=source.indexOf('|'),doc=source.replace('|','')
  const result=complete(source),option=result.options.find(o=>o.label==="'Noto Sans'")
  const completed=doc.slice(0,result.from)+(option.apply??option.label)+doc.slice(result.to??pos)
  assert.equal(completed,'<texto style="font-family: \'Noto Sans\'; color: #ff6f00">X</texto>')
})

test('unsupported properties do not get value suggestions for the selected shape',()=>{
  assert.equal(complete('<forma tipo="rect" style="border-style: |" />'),null)
  assert.deepEqual(complete('<forma tipo="linea" style="border-style: |" />').options.map(o=>o.label),['solid','dashed','dotted'])
})
