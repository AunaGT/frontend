const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
function layout({allowed=true,leave=true}={}){
  const nodes=[],paths=[],{TemplateSettingsLayout}=loadReportModule('../config/documentTemplates/TemplateSettingsLayout.tsx',{
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>allowed})},
    '@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set(['payroll'])})},
    'react-router-dom':{useNavigate:()=>to=>paths.push(to)},
  },nodes)
  const html=renderToStaticMarkup(React.createElement(TemplateSettingsLayout,{companyName:'Empresa QA',canLeave:()=>leave},React.createElement('h1',null,'Diseños')))
  return {html,nodes,paths}
}
test('template shell keeps settings navigation and active template section beside its content',()=>{
  const view=layout();assert.match(view.html,/Secciones de configuración/);assert.match(view.html,/Empresa QA/)
  assert.match(view.html,/aria-current="page"[^>]*>.*?Plantillas de documentos/)
  assert.match(view.html,/Datos fiscales/);assert.match(view.html,/Diseños/)
})
test('sidebar navigation honors unsaved changes and limits links to existing settings permissions',()=>{
  const blocked=layout({leave:false}),nav=blocked.nodes.find(n=>n.type.name==='SettingsNavigation')
  nav.props.onSelect('fiscal');assert.equal(blocked.paths.length,0)
  const permitted=layout();permitted.nodes.find(n=>n.type.name==='SettingsNavigation').props.onSelect('fiscal')
  assert.deepEqual(permitted.paths,['/configuracion?seccion=fiscal'])
  const restricted=layout({allowed:false});assert.ok(!restricted.html.includes('Datos fiscales'));assert.match(restricted.html,/Plantillas de documentos/)
})
for(const page of ['DocumentTemplatesPage','DocumentTemplateEditorPage'])test(`${page} actually retains the settings sidebar, including its initial loading state`,()=>{
  const {MemoryRouter}=require('react-router-dom'),scope={companyId:'A',branchId:'B',userId:'U',sessionId:'S'},context={scope,key:'A',canRead:true,canManage:true,canPublish:true,companyName:'Empresa QA',registerGuard:()=>()=>{}}
  const Page=loadReportModule(`../config/pages/${page}.tsx`,{
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set()})},
    '@/components/layout/PageNavigation':{usePageTrail(){}},'../documentTemplates/useTemplateScope':{useTemplateScope:()=>context},
    './useTemplateDraft':{useTemplateDraft:()=>({loading:true,pending:false,dirty:false,signal:new AbortController().signal})},
    '@/services/api':{},
  }).default
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Page)))
  assert.match(html,/Secciones de configuración/);assert.match(html,/Plantillas de documentos/);assert.match(html,/Datos fiscales/)
})
