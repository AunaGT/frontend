const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('history shows actual author and values with shared pagination rather than editable event controls',()=>{
  let queryKey
  const Page=loadReportModule('../config/components/SettingsHistorySection.tsx',{
    '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'BA'}})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},hasPermission:()=>false,permissionsReady:true})},
    '@/services/settingsService':{},'@tanstack/react-query':{useQuery:options=>{queryKey=options.queryKey;return{data:{items:[{id:'E',key:'company_name',actor_id:'UUID',actor_name:'Operador QA',source:'configuration',revision:2,created_at:'2026-10-16T12:00:00Z',before_value:'Anterior',after_value:'Nueva empresa'}],totalItems:11,totalPages:2},isLoading:false}}},
  }).SettingsHistorySection
  const html=renderToStaticMarkup(React.createElement(Page))
  assert.match(html,/Operador QA/);assert.match(html,/Anterior/);assert.match(html,/Nueva empresa/);assert.match(html,/Paginación de cambios/);assert.doesNotMatch(html,/Restaurar|Eliminar evento|Editar evento/)
  assert.ok(queryKey.includes('U'));assert.ok(queryKey.includes('A'))
})
