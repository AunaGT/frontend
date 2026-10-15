const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
test('invoice action offers the certifier workflow without manual certificate fields',()=>{
  const {SaleFiscalAction}=loadReportModule('../sales/components/SaleFiscalAction.tsx',{'./api':{apiFetch(){throw Error('Network forbidden')}}})
  const sale={id:'s',commercial:{state:'CONFIRMED',version:1,fiscalState:'UNRECORDED'},capabilities:{requestInvoice:true}}
  const html=renderToStaticMarkup(React.createElement(SaleFiscalAction,{sale,onRequested(){}}))
  assert.match(html,/Generar factura/);assert.doesNotMatch(html,/<input|Registrar factura externa/)
  const pending=renderToStaticMarkup(React.createElement(SaleFiscalAction,{sale:{...sale,commercial:{...sale.commercial,fiscalState:'PENDING_CONNECTOR'},capabilities:{requestInvoice:false}},onRequested(){}}))
  assert.match(pending,/conector no disponible/i);assert.doesNotMatch(pending,/Generar factura/)
})
test('invoice retries keep their request identity and errors do not create a success state',async()=>{
  const h=hookHarness(),nodes=[],requests=[],saved=[]
  const {SaleFiscalAction}=loadReportModule('../sales/components/SaleFiscalAction.tsx',{react:h.hooks,'./api':{apiFetch:async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});throw Error('Sin conexión')}}},nodes)
  const sale={id:'s',commercial:{state:'CONFIRMED',version:3,fiscalState:'UNRECORDED'},capabilities:{requestInvoice:true}}
  const render=()=>{nodes.length=0;h.render(()=>SaleFiscalAction({sale,onRequested:r=>saved.push(r)}))}
  render();await nodes.find(n=>n.props.onClick).props.onClick();render();await nodes.find(n=>n.props.onClick).props.onClick()
  assert.equal(requests.length,2);assert.equal(requests[0].body.idempotencyKey,requests[1].body.idempotencyKey)
  assert.equal(requests[0].body.expectedVersion,3);assert.equal(requests[0].path,'/sales/s/invoice-request');assert.deepEqual(saved,[])
})
