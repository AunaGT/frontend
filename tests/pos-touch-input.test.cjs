const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')

test('touch keys edit canonical decimal strings without arithmetic or precision loss',()=>{
 const {applyPosKey}=loadReportModule('../sales/posInput.ts')
 for(const [value,key,decimals,replace,want] of [
  ['12','3',0,true,'3'],['3','4',0,false,'34'],['1','decimal',0,false,'1'],
  ['1','decimal',2,false,'1.'],['','decimal',2,false,'0.'],['2.','decimal',2,false,'2.'],
  ['2.34','5',2,false,'2.34'],['2.12345','6',6,false,'2.123456'],['2.123456','7',6,false,'2.123456'],
  ['999999999','backspace',0,false,'99999999'],['12','clear',0,false,''],['','backspace',0,false,''],
  ['0','7',0,false,'7'],['12','-1',2,false,'12'],['12','oops',2,false,'12'],
  ['12','3',-1,false,'12'],['12','3',7,false,'12'],['12','3',NaN,false,'12'],
  ['999999999999','9',2,false,'999999999999']
 ])assert.equal(applyPosKey(value,key,decimals,replace),want,`${value} ${key} / ${decimals}`)
})

test('numeric keypad exposes labeled controls and disabled controls cannot emit edits',()=>{
 const nodes=[],calls=[]
 const {PosNumericKeypad}=loadReportModule('../sales/components/PosNumericKeypad.tsx',{},nodes)
 const html=renderToStaticMarkup(React.createElement(PosNumericKeypad,{decimalEnabled:false,onKey:key=>calls.push(key)}))
 assert.match(html,/aria-label="Borrar último dígito"/)
 const digit=nodes.find(n=>n.props['aria-label']==='Número 3')
 digit.props.onClick();assert.deepEqual(calls,['3'])
 const dot=nodes.find(n=>n.props['aria-label']==='Separador decimal')
 assert.equal(dot.props.disabled,true);dot.props.onClick();assert.deepEqual(calls,['3'])
 nodes.length=0;renderToStaticMarkup(React.createElement(PosNumericKeypad,{disabled:true,onKey:key=>calls.push(key)}))
 nodes.find(n=>n.props['aria-label']==='Número 3').props.onClick();assert.deepEqual(calls,['3'])
})
