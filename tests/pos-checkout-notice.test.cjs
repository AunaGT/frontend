const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('unknown checkout offers reconciliation, not a second charge; saved sale offers document retry',()=>{
 const nodes=[],{CheckoutRecoveryNotice}=loadReportModule('../sales/checkout/CheckoutRecoveryNotice.tsx',{},nodes)
 let checked=0,tickets=0
 const common={pending:false,onCheck:()=>checked++,onTicket:()=>tickets++,onDetail(){}}
 const unknown=renderToStaticMarkup(React.createElement(CheckoutRecoveryNotice,{...common,attempt:{state:'UNKNOWN'}}))
 assert.match(unknown,/No vuelvas a cobrar/);assert.match(unknown,/Comprobar resultado/)
 nodes.find(n=>n.props.children==='Comprobar resultado').props.onClick();assert.equal(checked,1)
 const confirmed=renderToStaticMarkup(React.createElement(CheckoutRecoveryNotice,{...common,lastSaleId:'V',ticketFailed:true}))
 assert.match(confirmed,/Venta registrada; ticket pendiente/);assert.match(confirmed,/Descargar ticket/)
 nodes.find(n=>n.props.children==='Descargar ticket').props.onClick();assert.equal(tickets,1)
})
