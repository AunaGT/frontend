const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const unit={id:'kg',company_id:'A',code:'KG',family:'MASS',name:'Kilogramo',label:'kg',factor:'1',quantity_decimals:6,active:true,is_standard:true}
function page({manage=true,enabled=true}={}){
  const h=hookHarness(),nodes=[],requests=[];let scope={companyId:'A',branchId:'B'}
  const tenantMock={'@/context/useTenant':{useTenant:()=>({registerTenantExitGuard:()=>()=>{}})}}
  const Page=loadReportModule('../inventory/units/UnitsPage.tsx',{react:h.hooks,...tenantMock,'@/components/layout/PageNavigation':{usePageTrail(){}},'@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryUnitsEnabled:enabled,locale:'es-GT'})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>manage})},'@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},'./useUnitCatalog':{useUnitCatalog:()=>({scope,units:[unit],canWrite:true,isLoading:false,isError:false,refetch:async()=>{}})},'@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,setPage(){},pageSize:50,setPageSize(){},viewMode:'table',setViewMode(){}})},'@/hooks/useCardPagination':{useCardPagination:()=>({pageSize:50,containerRef:{current:null},pageSizeOptions:[50],setCardPageSize(){}})},'@/services/api':{apiFetch:async(path,options)=>{requests.push({path,options});return unit}}},nodes).default
  const render=()=>{nodes.length=0;h.render(()=>Page())};render()
  return {nodes,requests,render,unmount:h.unmount,setScope:value=>{scope=value}}
}
test('catalog readers see the real unit table without write controls',async()=>{
  const p=page({manage:false});try{assert.ok(p.nodes.some(n=>n.props.children==='Kilogramo'));assert.ok(!p.nodes.some(n=>n.props.children==='Nueva unidad'));assert.equal(p.requests.length,0)}finally{p.unmount()}
})
test('catalog editor posts decimal strings and exact tenant headers through the actual unit API',async()=>{
  const p=page();try{
    p.nodes.find(n=>n.props.children==='Nueva unidad').props.onClick();p.render()
    for(const [id,value] of [['unit-code','SACK'],['unit-family','MASS'],['unit-name','Saco'],['unit-label','saco'],['unit-factor','25,123456789012'],['unit-decimals','6']]){p.nodes.find(n=>n.props.id===id).props.onChange({target:{value}});p.render()}
    await p.nodes.find(n=>n.props.children==='Guardar unidad').props.onClick();p.render()
    assert.equal(p.requests[0].path,'/api/products/units')
    assert.deepEqual(p.requests[0].options.headers,{'X-Company-Id':'A','X-Branch-Id':'B'})
    assert.equal(JSON.parse(p.requests[0].options.body).factor,'25.123456789012')
  }finally{p.unmount()}
})
test('feature-off and company changes hide drafts and reject stale catalog actions',async()=>{
  const off=page({enabled:false});try{assert.ok(!off.nodes.some(n=>n.props.children==='Nueva unidad'));assert.equal(off.requests.length,0)}finally{off.unmount()}
  const p=page();try{p.nodes.find(n=>n.props.children==='Nueva unidad').props.onClick();p.render();const save=p.nodes.find(n=>n.props.children==='Guardar unidad');p.setScope({companyId:'X',branchId:'Y'});p.render();await save.props.onClick();assert.equal(p.requests.length,0);assert.ok(!p.nodes.some(n=>n.props.id==='unit-name'))}finally{p.unmount()}
})
test('inventory setting preserves its draft and revision after the real readiness conflict',async()=>{
  const {configHarness,flush}=require('./helpers/configHarness.cjs'),requests=[]
  const h=configHarness({getSettings:async()=>({inventory_units_enabled:'false',_revisions:{inventory_units_enabled:7}}),updateSettings:async(payload,options)=>{requests.push({payload,options});throw new Error('Las unidades y presentaciones aún requieren la activación coordinada')}},{userId:'u',companyId:'A',branchId:'B',ready:true,canRead:true,canManage:true,consolidated:false})
  try{h.render();await flush();h.render().setField('inventario','inventory_units_enabled','true');const outcome=await h.render().save('inventario');assert.equal(outcome,'failed');const value=h.render();assert.equal(value.confirmed.inventory_units_enabled,'false');assert.equal(value.drafts.inventario.inventory_units_enabled,'true');assert.equal(requests.length,1);assert.equal(requests[0].options.expectedRevisions.inventory_units_enabled,7);assert.match(value.error,/activación coordinada/)}finally{h.unmount()}
})
