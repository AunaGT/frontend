const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('normal in-flight checkout leaves feedback in the payment button, without a recovery banner',()=>{
 const {CheckoutRecoveryNotice}=loadReportModule('../sales/checkout/CheckoutRecoveryNotice.tsx')
 const props={pending:true,hasProcessingButton:true,attempt:{state:'SUBMITTING'},onCheck(){},onTicket(){},onDetail(){}}
 assert.equal(renderToStaticMarkup(React.createElement(CheckoutRecoveryNotice,props)),'')
 for(const patch of [{pending:false},{error:'No se pudo comprobar'},{attempt:{state:'SUBMITTING',lastError:'La conexión se interrumpió'}},{attempt:{state:'UNKNOWN'}},{attempt:{state:'CONFIRMED',saleId:'V'}}]){
  assert.notEqual(renderToStaticMarkup(React.createElement(CheckoutRecoveryNotice,{...props,...patch})),'')
 }
})
test('restored submitting checkout keeps recovery visible while register selection has no payment button',()=>{
 const {renderPos}=require('./helpers/posPageHarness.cjs')
 const page=renderPos({state:{selectedRegisterId:'',cashSessionOpen:false},checkoutOverrides:{pending:true,attempt:{state:'SUBMITTING'}}})
 assert.match(page.html,/Comprobando el cobro/);assert.match(page.html,/Comprobar resultado/)
 assert.equal(page.nodes.some(node=>node.props.className==='pos-pay-button'),false)
})
test('payment button announces processing and blocks repeat submission while the normal request is pending',()=>{
 const {renderPos}=require('./helpers/posPageHarness.cjs')
 const page=renderPos({checkoutOverrides:{pending:true,attempt:{state:'SUBMITTING'}}})
 const button=page.nodes.find(node=>node.props.className==='pos-pay-button')
 assert.ok(button);assert.equal(button.props.disabled,true);assert.equal(button.props['aria-busy'],true)
 assert.match(page.html,/Procesando/);assert.doesNotMatch(page.html,/Comprobando el cobro|Comprobar resultado/)
})
test('successful checkout leaves no persistent notice, including while its ticket downloads',()=>{
 const {CheckoutRecoveryNotice}=loadReportModule('../sales/checkout/CheckoutRecoveryNotice.tsx')
 const common={pending:false,onCheck(){},onTicket(){},onDetail(){},lastSaleId:'V'}
 for(const ticketPending of [false,true])assert.equal(renderToStaticMarkup(React.createElement(CheckoutRecoveryNotice,{...common,ticketPending})), '')
 const error=renderToStaticMarkup(React.createElement(CheckoutRecoveryNotice,{...common,lastSaleId:undefined,error:'No se pudo comprobar'}))
 assert.match(error,/No se pudo comprobar/)
 const unfinished=renderToStaticMarkup(React.createElement(CheckoutRecoveryNotice,{...common,attempt:{state:'CONFIRMED',saleId:'V'}}))
 assert.match(unfinished,/Comprobar resultado/)
})
test('recovery exposes the original error, saved lines and explicit same-operation retry',()=>{
 const nodes=[],{CheckoutRecoveryNotice}=loadReportModule('../sales/checkout/CheckoutRecoveryNotice.tsx',{},nodes)
 let retries=0
 const props={attempt:{companyId:'A',branchId:'B',userId:'U',key:'K',kind:'SALE',state:'UNKNOWN',version:2,payload:{items:[{product_id:'P',qty:'1.25',price:'3'}]},lastError:'La base de datos no respondió'},error:'Resultado todavía no encontrado',pending:false,canRetry:true,onRetry:()=>retries++,productNames:{P:'Producto guardado'},onCheck(){},onTicket(){},onDetail(){}}
 const html=renderToStaticMarkup(React.createElement(CheckoutRecoveryNotice,props))
 assert.match(html,/La base de datos no respondió/);assert.match(html,/Resultado todavía no encontrado/);assert.match(html,/1.25/);assert.match(html,/Producto guardado/)
 const retry=nodes.find(n=>n.props.children==='Reintentar este cobro');assert.ok(retry);retry.props.onClick();assert.equal(retries,1)
 for(const patch of [{pending:true},{canRetry:false},{attempt:{state:'CONFIRMED',saleId:'V',version:2,payload:{}}},{attempt:{state:'UNKNOWN'}}]){
  nodes.length=0;renderToStaticMarkup(React.createElement(CheckoutRecoveryNotice,{...props,...patch}))
  const button=nodes.find(n=>n.props.children==='Reintentar este cobro')
  if(patch.pending){assert.equal(button.props.disabled,true);button.props.onClick();assert.equal(retries,1)}else assert.equal(button,undefined)
 }
})
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
