const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('destination labels planned routing honestly and always offers PDF without equipment',()=>{
 const {PrintDestination}=loadReportModule('../config/hardware/printing/PrintDestination.tsx')
 const html=renderToStaticMarkup(React.createElement(PrintDestination,{route:{workstationId:'W',destination:{id:'D',name:'Tickets'}},value:null,onChange(){}}))
 assert.match(html,/Destino previsto/);assert.match(html,/PDF sin equipo/);assert.match(html,/Tickets/);assert.doesNotMatch(html,/Conectado/)
})
