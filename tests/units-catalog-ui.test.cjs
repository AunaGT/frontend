const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const unit={id:'kg',company_id:'A',code:'KG',family:'MASS',name:'Kilogramo',label:'kg',factor:'1',quantity_decimals:6,active:true,is_standard:true}
const gram={...unit,id:'g',code:'G',name:'Gramo',label:'g',factor:'0.001'}
const minute={...unit,id:'min',code:'MIN',family:'TIME',name:'Minuto',label:'min',quantity_decimals:4}
const hour={...minute,id:'h',code:'H',name:'Hora',label:'h',factor:'60'}
function page({manage=true,enabled=true,units=[unit,gram,minute,hour],route='',pageSize=50}={}){
  const h=hookHarness(),nodes=[],requests=[];let scope={companyId:'A',branchId:'B'},params=new URLSearchParams(route),currentPage=1,trail=[]
  const Page=loadReportModule('../inventory/units/UnitsPage.tsx',{
    react:h.hooks,'react-router-dom':{...require('react-router-dom'),useSearchParams:()=>[params,next=>{params=new URLSearchParams(typeof next==='function'?next(params):next)}]},
    '@/context/useTenant':{useTenant:()=>({registerTenantExitGuard:()=>()=>{}})},
    '@/components/layout/PageNavigation':{usePageTrail:value=>{trail=value}},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryUnitsEnabled:enabled,locale:'es-GT'})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>manage})},
    '@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},
    './useUnitCatalog':{useUnitCatalog:()=>({scope,units,canWrite:true,isLoading:false,isError:false,refetch:async()=>{}})},
    '@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:currentPage,setPage:value=>{currentPage=value},pageSize,setPageSize(){},viewMode:'cards',setViewMode(){}})},
    '@/services/api':{apiFetch:async(path,options)=>{requests.push({path,options});return unit}},
  },nodes).default
  const render=()=>{nodes.length=0;h.render(()=>Page())};render();render()
  const clickFamily=name=>{nodes.find(n=>n.props['aria-label']==='Abrir familia '+name).props.onClick();render();render()}
  return {nodes,requests,render,clickFamily,unmount:h.unmount,setScope:value=>{scope=value},setRoute:value=>{params=new URLSearchParams(value)},trail:()=>trail}
}
const childText=value=>Array.isArray(value)?value.map(childText).join(''):typeof value==='string'?value:''
const button=(p,text)=>p.nodes.find(n=>childText(n.props.children)===text&&typeof n.props.onClick==='function')
const text=(p,value)=>p.nodes.some(n=>n.props.children===value)
test('catalog starts with family table, counts and unit names, never a card switch or root creation',()=>{
  const p=page({manage:false});try{
    assert.ok(p.nodes.some(n=>n.props['aria-label']==='Abrir familia Peso'))
    assert.ok(p.nodes.some(n=>n.props['aria-label']==='Abrir familia Tiempo'))
    assert.ok(text(p,'Gramo, Kilogramo'));assert.ok(text(p,'2 unidades'))
    assert.ok(!button(p,'Nueva unidad'));assert.ok(!p.nodes.some(n=>n.props.ariaLabel==='Vista de unidades'))
    const pagination=p.nodes.find(n=>n.props.itemLabel==='familias');assert.equal(pagination.props.totalItems,2)
    assert.equal(p.requests.length,0)
  }finally{p.unmount()}
})
test('family click drills down to only its unit attributes with explicit reference and breadcrumb',()=>{
  const p=page();try{
    p.clickFamily('Tiempo');assert.ok(text(p,'Hora'));assert.ok(text(p,'Minuto'));assert.ok(!text(p,'Kilogramo'))
    assert.ok(text(p,'1 h = 60 min'));assert.equal(p.trail().at(-1).label,'Tiempo')
    assert.ok(button(p,'Nueva unidad'));button(p,'Volver a familias').props.onClick();p.render();p.render()
    assert.ok(p.nodes.some(n=>n.props['aria-label']==='Abrir familia Peso'));assert.ok(!button(p,'Nueva unidad'))
  }finally{p.unmount()}
})
test('creation inside a family infers hidden family and posts exact equivalence and scoped headers',async()=>{
  const p=page({route:'familia=MASS'});try{
    button(p,'Nueva unidad').props.onClick();p.render()
    assert.ok(!p.nodes.some(n=>n.props.id==='unit-family'))
    assert.ok(p.nodes.some(n=>n.props.htmlFor==='unit-factor'&&n.props.children==='Equivalencia en kg'))
    for(const [id,value] of [['unit-code','SACK'],['unit-name','Saco'],['unit-label','saco'],['unit-factor','25,123456789012'],['unit-decimals','6']]){p.nodes.find(n=>n.props.id===id).props.onChange({target:{value}});p.render()}
    await button(p,'Guardar unidad').props.onClick();p.render()
    assert.equal(p.requests[0].path,'/api/products/units')
    assert.deepEqual(p.requests[0].options.headers,{'X-Company-Id':'A','X-Branch-Id':'B'})
    assert.deepEqual(JSON.parse(p.requests[0].options.body),{code:'SACK',family:'MASS',name:'Saco',label:'saco',factor:'25.123456789012',quantity_decimals:6})
  }finally{p.unmount()}
})
test('search and pagination count families separately from their units and archived toggle keeps reference',()=>{
  const p=page({units:[{...unit,active:false},gram,minute,hour],pageSize:1});try{
    const pagination=()=>p.nodes.find(n=>n.props.itemLabel==='familias')
    assert.equal(pagination().props.totalItems,2);assert.equal(pagination().props.count,1)
    p.nodes.find(n=>n.props.id==='unit-search').props.onChange({target:{value:'gramo'}});p.render()
    assert.equal(pagination().props.totalItems,1)
    p.clickFamily('Peso');assert.ok(text(p,'1 g = 0.001 kg'));assert.ok(!text(p,'Kilogramo'))
    p.nodes.find(n=>n.props.id==='units-archived').props.onCheckedChange(true);p.render()
    assert.equal(p.nodes.find(n=>n.props.itemLabel==='unidades').props.totalItems,2)
  }finally{p.unmount()}
})
test('readers and disabled feature do not expose writes, and changed tenant or family invalidates stale save',async()=>{
  const reader=page({manage:false,route:'familia=MASS'}),off=page({enabled:false});try{
    assert.ok(text(reader,'Kilogramo'));assert.ok(!button(reader,'Nueva unidad'));assert.ok(!button(off,'Nueva unidad'))
  }finally{reader.unmount();off.unmount()}
  for(const change of ['scope','family']){
    const p=page({route:'familia=MASS'});try{
      button(p,'Nueva unidad').props.onClick();p.render();const save=button(p,'Guardar unidad')
      if(change==='scope')p.setScope({companyId:'X',branchId:'Y'});else p.setRoute('familia=TIME')
      p.render();await save.props.onClick();assert.equal(p.requests.length,0);assert.ok(!p.nodes.some(n=>n.props.id==='unit-name'))
    }finally{p.unmount()}
  }
})
test('unknown family cannot create units or accidentally fall back to another family',()=>{
  const p=page({route:'familia=UNKNOWN'});try{assert.ok(!button(p,'Nueva unidad'));assert.ok(!text(p,'Gramo'));assert.ok(button(p,'Volver a familias'));assert.equal(p.requests.length,0)}finally{p.unmount()}
})
test('inventory setting preserves its draft and revision after the real readiness conflict',async()=>{
  const {configHarness,flush}=require('./helpers/configHarness.cjs'),requests=[]
  const h=configHarness({getSettings:async()=>({inventory_units_enabled:'false',_revisions:{inventory_units_enabled:7}}),updateSettings:async(payload,options)=>{requests.push({payload,options});throw new Error('Las unidades y presentaciones aún requieren la activación coordinada')}},{userId:'u',companyId:'A',branchId:'B',ready:true,canRead:true,canManage:true,consolidated:false})
  try{h.render();await flush();h.render().setField('inventario','inventory_units_enabled','true');const outcome=await h.render().save('inventario');assert.equal(outcome,'failed');const value=h.render();assert.equal(value.confirmed.inventory_units_enabled,'false');assert.equal(value.drafts.inventario.inventory_units_enabled,'true');assert.equal(requests.length,1);assert.equal(requests[0].options.expectedRevisions.inventory_units_enabled,7);assert.match(value.error,/activación coordinada/)}finally{h.unmount()}
})
