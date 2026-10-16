const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
function entry(perms, { enabled=['config','catalogs','inventory'], error=false, loading=false }={}) {
  let settingsMounts=0; const nodes=[], requests=[],trails=[]
  const Page = loadReportModule('../config/pages/ConfigEntryPage.tsx', {
    './ConfigManagement': {__esModule:true,default:()=>{settingsMounts++; return React.createElement('b',null,'AJUSTES GENERALES')}},
    '@/hooks/useAuthPermissions': {useAuthPermissions:()=>({permissionsReady:true,hasPermission:(...codes)=>codes.some(c=>perms.includes(c))})},
    '@/context/useModules': {useModules:()=>({enabledModuleCodes:new Set(enabled),isEnabled:code=>enabled.includes(code),isLoading:loading,isError:error})},
    '@/services/api': {apiFetch:async url=>{requests.push(url); throw Error('Petición general no autorizada')}},
    '@/components/layout/PageNavigation':{usePageTrail:items=>trails.push(items)},
  },nodes).default
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Page)))
  return {html,nodes,requests,settingsMounts,trails}
}
test('catalog-only configuration entry exposes canonical catalogs without mounting or requesting private preferences',()=>{
  for(const permission of ['catalogs.manage','catalogs.view']) {
    const result=entry([permission]); assert.equal(result.settingsMounts,0); assert.deepEqual(result.requests,[])
    for(const path of ['/inventario/categorias','/configuracion/cajas','/configuracion/metodos-de-pago','/configuracion/condiciones-de-pago']) assert.ok(result.html.includes(`href="${path}"`),path)
    assert.doesNotMatch(result.html,/company_nit|company_logo|AJUSTES GENERALES|href="\/configuracion\?seccion=fiscal/)
  }
})
test('settings authority preserves the original preferences editor and does not become catalog authority',()=>{
  for(const permission of ['settings.manage','settings.view']) {const result=entry([permission]);assert.equal(result.settingsMounts,1);assert.match(result.html,/AJUSTES GENERALES/);assert.equal(result.trails[0],null,'parent entry must not overwrite the preferences breadcrumb')}
  const nodes=[], {SettingsRelatedLinks}=loadReportModule('../config/components/SettingsRelatedLinks.tsx',{
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:(...codes)=>codes.includes('settings.manage')})},
    '@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set(['catalogs','inventory']),isLoading:false,isError:false})},
  },nodes)
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(SettingsRelatedLinks,{confirmLeave(){}})))
  assert.match(html,/href="\/configuracion\/cajas"/);assert.doesNotMatch(html,/href="\/(inventario\/categorias|configuracion\/(metodos-de-pago|condiciones-de-pago))/)
})
test('unavailable catalogs and unready permissions never expose operational links',()=>{
  for(const options of [{enabled:['config']},{error:true},{loading:true}]) {const result=entry(['catalogs.manage'],options);assert.doesNotMatch(result.html,/href="\/(inventario|configuracion)\//);assert.equal(result.settingsMounts,0);assert.deepEqual(result.requests,[])}
  const denied=entry([]);assert.equal(denied.settingsMounts,0);assert.doesNotMatch(denied.html,/href="/)
  assert.doesNotMatch(entry(['catalogs.manage'],{enabled:['config','catalogs']}).html,/href="\/inventario\/categorias/)
})
test('relocated links keep the settings draft leave guard',()=>{
  const nodes=[],left=[],{SettingsRelatedLinks}=loadReportModule('../config/components/SettingsRelatedLinks.tsx',{
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
    '@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set(['catalogs','inventory']),isLoading:false,isError:false})},
  },nodes)
  renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(SettingsRelatedLinks,{confirmLeave:to=>left.push(to)})))
  const link=nodes.find(n=>n.props.to==='/configuracion/metodos-de-pago' && n.props.onClick)
  let prevented=false;link.props.onClick({button:0,preventDefault(){prevented=true}})
  assert.equal(prevented,true);assert.deepEqual(left,['/configuracion/metodos-de-pago'])
})
