const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
function render(role='PARTICIPANT',can={join:false,close:false,count:false,handover:false,movement:true}) {
 const nodes=[]
 const {MyTurnList}=loadReportModule('../cash-closure/CashMyTurnPage.tsx',{'@/services/cashMyTurnService':{}},nodes)
 const turn={id:'turn',registerId:'r',registerName:'Mostrador',responsibleName:'Ana',role,operationMode:'SHARED',participants:[{user_id:'a',name:'Ana'},{user_id:'b',name:'Luis'}],openedAt:'2026-11-19T14:00:00Z',timeZone:'America/Guatemala',state:'OPERATING',operationCount:3,can}
 const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(MyTurnList,{turns:[turn],onJoin:()=>{},onClose:()=>{},busy:false})))
 return {html,nodes}
}
test('participant sees shared identity and own actions without a close action or expected money',()=>{
 const {html}=render()
 for(const text of ['Mostrador','Ana','Luis','Participante','Ingresar o retirar'])assert.ok(html.includes(text),text)
 assert.ok(!html.includes('Terminar turno'));assert.ok(!html.includes('Fondo inicial'));assert.ok(!html.includes('Efectivo esperado'))
})
test('responsible gets finishing and invited participant gets explicit joining',()=>{
 assert.ok(render('RESPONSIBLE',{close:true}).html.includes('Terminar turno'))
 assert.ok(render('INVITED',{join:true}).html.includes('Unirme al turno'))
})
