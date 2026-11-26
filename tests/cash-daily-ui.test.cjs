const test = require('node:test'), assert = require('node:assert/strict'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const turn = (extra = {}) => ({ id: 't1', register_name: 'Mostrador', register_type: 'PHYSICAL', responsible_name: 'Ana', opened_at: '2026-11-01T14:00:00.000Z', closed_at: '2026-11-01T22:00:00.000Z', state: 'FINALIZED', closure_id: 'c1', closure_number: 42, review_result: 'REVIEW', difference: '-1.00', ...extra })
const view = (extra = {}) => ({ status: 'PROVISIONAL', businessDate: '2026-11-01', contentKey: 'k'.repeat(64), finalizedBy: null, finalizedAt: null, canFinalize: true,
  turns: [turn(), turn({ id: 't2', register_name: 'Cobros web', register_type: 'VIRTUAL', review_result: 'CLEAN', difference: '0.00' })], blockers: [],
  cash: { opening: '100.00', received: '50.00', fundIn: '0.00', custodyIn: '0.00', paidOut: '10.00', sentToCustody: '0.00', delivered: '100.00', retained: '40.00', acceptedDifference: '-1.00', inTransit: { count: 1, amount: '100.00' } },
  digital: { byMethod: [{ name: 'Tarjeta', amount: '75.00' }], toSettle: '75.00', pendingNotices: { count: 1, amount: '20.00', oldest: '2026-10-31' }, settlements: { count: 0, net: '0.00' } },
  entries: ['A-000042'], legacyNotice: null, ...extra })
function page(data,{denied=false,permissions=null,consolidated=false}={}) {
  if(!data.snapshot){const {status,contentKey,finalizedBy,finalizedAt,canFinalize,...snapshot}=data;data={status,contentKey,finalizedBy,finalizedAt,canFinalize,snapshot,current:{asOf:'2026-11-19T20:30:00Z',pendingNotices:snapshot.digital.pendingNotices,toSettle:snapshot.digital.toSettle,settlementReferences:[],depositsByRealDate:{date:snapshot.businessDate,...snapshot.digital.settlements}}}}
  const nodes = []
  const Page = loadReportModule('../cash-closure/CashDailyPage.tsx', {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'c' }, branch: { id: 'b', name: 'Central' },isConsolidated:consolidated }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'u' }, hasPermission: (...codes) => !permissions||codes.some(c=>permissions.includes(c)) }) },
    './hooks':{useMineClosureGate:()=>({gate:{loading:false,closableSessionId:null},refresh(){}}),canRegisterMineClosure:()=>false},
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala' }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} }, '@/services/cashDailyService': {},
    '@tanstack/react-query': { useQuery: () => ({ isLoading: false,isPending:false,isError:denied,error:denied?Error('Acceso retirado'):null, data }), useQueryClient: () => ({ invalidateQueries() {} }) },
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page))), nodes }
}
test('a provisional day lists blockers first and cannot be finalized', () => {
  const { html, nodes } = page(view({ blockers: [{ code: 'PENDING_REVIEW', sessionId: 't1', closureId: 'c1', register: 'Mostrador', message: 'Mostrador · Ana: El arqueo espera revisión: finalízalo o pide reconteo.' }], turns: [turn({ state: 'PENDING_REVIEW' })] }))
  for (const text of ['Cierre del día', 'Provisional', 'El arqueo espera revisión', 'Pendiente de revisión']) assert.ok(html.includes(text), text)
  assert.ok(html.indexOf('El arqueo espera revisión') < html.indexOf('Efectivo del día'), 'blockers come first')
  assert.equal(nodes.find(n => n.props?.children === 'Finalizar día')?.props.disabled ?? true, true)
})
test('a clean day shows turns, cash and digital pending in words and offers finalizing', () => {
  const { html, nodes } = page(view())
  for (const text of ['Finalizado', 'Cobros web', 'Fondo inicial', 'Entregado a custodia', 'Fondo retenido', 'Faltante aceptado', 'Por liquidar', 'Avisos por confirmar', 'En tránsito', 'A-000042']) assert.ok(html.includes(text), text)
  assert.match(html, /−Q\s?1\.00/)
  assert.equal(nodes.find(n => n.props?.children === 'Finalizar día').props.disabled, false)
})
test('a finalized day is read-only and says who closed it', () => {
  const { html, nodes } = page(view({ status: 'FINALIZED', finalizedBy: 'Marta', finalizedAt: '2026-11-02T01:00:00.000Z' }))
  assert.ok(html.includes('Finalizado por Marta')); assert.doesNotMatch(html,/>Finalizar día</)
})
test('cached daily amounts and finalization disappear on permission denial or consolidated scope',()=>{
  const error=page(view(),{denied:true})
  assert.doesNotMatch(error.html,/A-000042|Cobros web|>Finalizar día</)
  const all=page(view(),{consolidated:true});assert.match(all.html,/Selecciona una sucursal/);assert.doesNotMatch(all.html,/A-000042|Cobros web/)
})
test('a reviewer cannot finalize even if an old response advertised the capability',()=>{
  const {html}=page(view(),{permissions:['cashclosure.approve']})
  assert.doesNotMatch(html,/>Finalizar día</)
})
test('the default date is today in the branch time zone and daily/count screens share one main tab', () => {
  const { todayIn } = loadReportModule('../cash-closure/components/settlementParts.ts')
  assert.equal(todayIn('America/Guatemala', new Date('2026-11-02T03:00:00Z')), '2026-11-01')
  const nodes = []
  const { CashClosureTabs } = loadReportModule('../cash-closure/components/CashClosureTabs.tsx', {
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: (...codes) => codes.some(c => ['cashclosure.view', 'cash.day.close','cash.movements.view_own'].includes(c)) }) },
    '@/components/shared/ModuleTabs': { ModuleTabBar: props => { nodes.push(props); return null } },
  })
  renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(CashClosureTabs, { value: 'closures' })))
  assert.equal(nodes[0].items.filter(i=>i.value==='closures').length,1)
  assert.equal(nodes[0].items.some(i=>i.value==='day'),false)
})
test('the launcher and the route reach the day close with its own permission', () => {
  const { appModules } = loadReportModule('../../config/appModules.ts')
  assert.ok(appModules.find(m => m.id === 'cash-closure').permissions.includes('cash.day.close'))
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/App.tsx'), 'utf8')
  assert.ok(app.includes('paths.day}'))
})
function currentView(){const old=view();return {status:'FINALIZED',contentKey:old.contentKey,canFinalize:false,finalizedBy:'Marta',finalizedAt:'2026-11-02T01:00:00Z',snapshot:{...old,version:2,cash:{...old.cash,bridge:{initial:'140.00',declaredInitial:'100.00',inheritedInitial:'40.00',externalIn:'105.00',externalOut:'10.00',openingDifference:'0.00',acceptedDifference:'-1.00',internal:{inheritedWithinDay:'60.00',openingTransfersIn:'15.00',sessionsIn:'20.00',sessionsOut:'20.00',delivered:'164.00',net:'-149.00'},retainedFinal:'0.00',undeliveredFinal:'85.00',final:'85.00',calculatedFinal:'85.00',difference:'0.00',balanced:true,sources:[]}},digital:{byMethod:old.digital.byMethod,toSettle:'75.00'}},current:{asOf:'2026-11-19T20:30:00Z',pendingNotices:{count:1,amount:'999.00',oldest:'2026-11-19'},toSettle:'0.00',settlementReferences:[{id:'settlement',reference:'VN-801',deposited_on:'2026-11-19'}],depositsByRealDate:{date:'2026-11-01',count:0,net:'0.00'}}}}
test('historical v2 bridge and live unconfirmed notices are in distinct labelled regions',()=>{
  const {html}=page(currentView())
  for(const text of ['Estado actual','consultado','no es dinero confirmado','Saldo inicial','Saldo final','Cuadra','Movimientos internos','VN-801','Por liquidar al finalizar'])assert.ok(html.toLowerCase().includes(text.toLowerCase()),text)
  assert.ok(html.indexOf('Estado actual')>html.indexOf('Digital del día operativo'))
  assert.ok(!html.slice(html.indexOf('Digital del día operativo'),html.indexOf('Estado actual')).includes('999.00'))
})
test('a finalized legacy snapshot is labelled and retains its original amounts rather than synthesizing a bridge',()=>{
  const old=view(),data=currentView();data.snapshot=old
  const {html}=page(data)
  assert.match(html,/formato anterior/i);assert.ok(html.includes('Fondo inicial'));assert.ok(!html.includes('Cuadra'))
})
test('a day-only closer can read correction summaries without links that require another authority',()=>{
  const data=currentView();data.current.corrections=[{id:'adjustment',closure_id:'c1',closure_number:42,sequence:1,currency_code:'GTQ',cash_delta:'1.00',accounting_date:'2026-11-24',entry_number:null}]
  const {html}=page(data,{permissions:['cash.day.close']})
  assert.match(html,/Corrección 1/);assert.match(html,/VN-801/)
  assert.doesNotMatch(html,/href="\/cierre-caja\/c1\/correcciones|href="\/cierre-caja\/liquidaciones/)
})
