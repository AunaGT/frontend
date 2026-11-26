const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom')
const {QueryClient,QueryClientProvider}=require('@tanstack/react-query')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
function render({permissions=[],route='/cierre-caja',consolidated=false}={}){
  const Page=loadReportModule('../cash-closure/CashClosureManagement.tsx',{
    '@/context/useAuth':{useAuth:()=>({user:{id:'actor'}})},
    '@/context/useTenant':{useTenant:()=>({company:{id:'company'},branch:{id:'branch'},isConsolidated:consolidated})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:(...codes)=>codes.some(c=>permissions.includes(c))})},
    '@/components/layout/PageNavigation':{usePageTrail(){}},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ',timezone:'America/Guatemala'})},
    '@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=>null},
    './hooks':{useMineClosureGate:()=>({gate:{loading:false},refresh(){}}),canRegisterMineClosure:()=>false,mineClosureBlockedHint:()=>''},
    './CashClosureCreatePage':{CASH_CLOSURE_CREATE_PATH:'/cierre-caja/nuevo'},
    './CashDailyPage':{__esModule:true,default:()=>React.createElement('p',null,'DAY_TOTALS_PRIVATE')},
    './CashClosureHistory':{__esModule:true,default:()=>React.createElement('p',null,'HISTORY_PRIVATE')},
  }).default
  return renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[route]},React.createElement(QueryClientProvider,{client:new QueryClient()},React.createElement(Page))))
}
test('a day-only closer reaches the day while an own-history reader never mounts daily totals',()=>{
  const day=render({permissions:['cash.day.close']});assert.match(day,/DAY_TOTALS_PRIVATE/);assert.doesNotMatch(day,/HISTORY_PRIVATE/)
  const own=render({permissions:['cashclosure.view']});assert.match(own,/HISTORY_PRIVATE/);assert.doesNotMatch(own,/DAY_TOTALS_PRIVATE/)
  assert.doesNotMatch(render({permissions:['cashclosure.view'],route:'/cierre-caja?vista=dia'}),/DAY_TOTALS_PRIVATE/)
})
test('the workspace defaults to the day, retains an explicit history view and asks for a concrete branch',()=>{
  const permissions=['cash.day.close','cashclosure.view_team']
  assert.match(render({permissions}),/DAY_TOTALS_PRIVATE/)
  const history=render({permissions,route:'/cierre-caja?vista=historial&fecha=2026-11-24'})
  assert.match(history,/HISTORY_PRIVATE/);assert.doesNotMatch(history,/DAY_TOTALS_PRIVATE/)
  assert.match(render({permissions,consolidated:true}),/HISTORY_PRIVATE/)
  const all=render({permissions,consolidated:true,route:'/cierre-caja?vista=dia'})
  assert.match(all,/Selecciona una sucursal/);assert.doesNotMatch(all,/DAY_TOTALS_PRIVATE/)
})
test('legacy day links preserve date and other query parameters in the unified workspace',()=>{
  const {cashDayWorkspaceLink,isCashWorkspaceDate}=loadReportModule('../cash-closure/cashWorkspace.ts')
  assert.equal(cashDayWorkspaceLink('?fecha=2026-11-24&origen=menu'),'/cierre-caja?fecha=2026-11-24&origen=menu&vista=dia')
  for(const [date,valid] of [['2028-02-29',true],['2026-02-29',false],['2026-11-24',true],['2026-13-01',false],['',false]])assert.equal(isCashWorkspaceDate(date),valid,date)
})
test('count links use a verified own turn and review links respect own versus team read authority',()=>{
  const {cashTurnAction}=loadReportModule('../cash-closure/cashWorkspace.ts')
  const access={actorId:'actor',canReadOwn:true,canReadTeam:false,canCountOwn:true,closableSessionId:'own',finalized:false}
  assert.deepEqual(cashTurnAction({id:'own',state:'PENDING_COUNT',responsible_id:'actor'},access),{label:'Contar',to:'/cierre-caja/nuevo?turno=own'})
  assert.equal(cashTurnAction({id:'foreign',state:'PENDING_COUNT',responsible_id:'other'},access),null)
  assert.equal(cashTurnAction({id:'foreign',state:'PENDING_REVIEW',responsible_id:'other',closure_id:'c1'},access),null)
  assert.deepEqual(cashTurnAction({id:'foreign',state:'PENDING_REVIEW',responsible_id:'other',closure_id:'c1'},{...access,canReadTeam:true}),{label:'Revisar',to:'/cierre-caja/c1'})
  assert.equal(cashTurnAction({id:'own',state:'PENDING_COUNT',responsible_id:'actor'},{...access,finalized:true}),null)
  assert.deepEqual(cashTurnAction({id:'own',state:'OPERATING',responsible_id:'actor'},{...access,canOperatePos:true}),{label:'Ir al POS',to:'/pos'})
  assert.equal(cashTurnAction({id:'other',state:'OPERATING',responsible_id:'other'},{...access,canOperatePos:true}),null)
})
test('roles for other cash modules route directly to their authorized area without mounting counts or day totals',()=>{
  const {cashWorkspaceFallback}=loadReportModule('../cash-closure/cashWorkspace.ts')
  for(const [permission,expected] of [['cash.movements.view_own','/cierre-caja/movimientos'],['cash.notices.create','/cierre-caja/cobros-digitales'],['cash.bank_methods.manage','/cierre-caja/medios-bancarios'],['cash.disputes.view','/cierre-caja/disputas']]){
    assert.equal(cashWorkspaceFallback((...codes)=>codes.includes(permission)),expected)
    assert.doesNotMatch(render({permissions:[permission]}),/HISTORY_PRIVATE|DAY_TOTALS_PRIVATE/)
  }
})
test('daily finalization uses an explicit abortable scope and rejects responses cancelled during decoding',async()=>{
  const old=global.fetch,abort=new AbortController(),scope={companyId:'c',branchId:'b',actorId:'u'};let request
  try{
    const api=loadReportModule('../../services/cashDailyService.ts',{'@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=>'qa'}})
    global.fetch=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({replayed:false,view:{status:'FINALIZED'}})}}
    await api.finalizeDay('2026-11-24','reviewed-key',scope,abort.signal)
    assert.equal(request.options.signal.aborted,false);assert.equal(request.options.headers['X-Branch-Id'],'b')
    assert.deepEqual(JSON.parse(request.options.body),{contentKey:'reviewed-key'})
    global.fetch=async()=>({ok:true,json:async()=>{abort.abort();return {snapshot:{private:'old company'}}}})
    await assert.rejects(api.fetchDay('2026-11-24',scope,abort.signal),{name:'AbortError'})
  }finally{global.fetch=old}
})
test('a caller cancellation signal never removes the thirty-second financial request deadline',async t=>{
  const old=global.fetch,caller=new AbortController(),deadline=new AbortController();let milliseconds,outgoing
  t.mock.method(AbortSignal,'timeout',ms=>{milliseconds=ms;return deadline.signal})
  global.fetch=async(url,options)=>{outgoing=options.signal;return new Promise((resolve,reject)=>outgoing.addEventListener('abort',()=>reject(outgoing.reason),{once:true}))}
  try{
    const api=loadReportModule('../../services/cashDailyService.ts',{'@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=>null}})
    const pending=api.finalizeDay('2026-11-24','reviewed-key',{companyId:'c',branchId:'b',actorId:'u'},caller.signal)
    pending.catch(()=>{})
    assert.equal(milliseconds,30000,'providing teardown cancellation must retain the service deadline')
    deadline.abort(new DOMException('El plazo terminó','TimeoutError'))
    await assert.rejects(pending,e=>e.name==='TimeoutError')
    assert.equal(outgoing.aborted,true);assert.equal(caller.signal.aborted,false)
  }finally{caller.abort();global.fetch=old}
})
