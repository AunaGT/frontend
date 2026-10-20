const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('drawer policy clearly labels simulation, not electrical opening',()=>{
 const {DrawerPolicyFields}=loadReportModule('../config/hardware/drawer/DrawerPolicy.tsx',{'@/services/api':{}})
 const html=renderToStaticMarkup(React.createElement(DrawerPolicyFields,{value:{version:0,posCashSale:true,initialCreditReceipt:false,receivableReceipt:false,agendaReceipt:false,cashReturn:false},onChange(){},disabled:true}))
 assert.match(html,/Solo simulación/);assert.match(html,/no envía pulsos/i);assert.equal((html.match(/type="checkbox"/g)||[]).length,5);assert.equal((html.match(/checked=""/g)||[]).length,1)
})
