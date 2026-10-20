const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const branch={id:'branch',company_id:'company',code:'CENT',name:'Sucursal Centro',address:'Zona 1, Guatemala',phone:'5555-0000',active:true,is_default:true,manager:{name:'Ana Gómez'}}
const company={id:'company',name:'Comercial del Centro',code:'COM',tax_id:'1234567',active:true,branches:[branch]}
function render(companies=false,manage=true){
  const nodes=[]
  const module=loadReportModule(companies?'../branches/pages/CompaniesCard.tsx':'../branches/pages/BranchesManagement.tsx',{
    '@/context/useTenant':{useTenant:()=>({company,companies:[company],setCompany(){}})},
    '@/context/useAuth':{useAuth:()=>({refreshUser(){}})},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},
    '@/components/layout/PageNavigation':{usePageTrail(){}},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>manage})},
    '@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,pageSize:50,setPage(){},setPageSize(){}})},
    '@/services/api':{getApiBaseUrl:()=>'/api',apiFetch(){throw Error('Unexpected request')}},
    './api':{getApiBaseUrl:()=>'/api',apiFetch(){throw Error('Unexpected request')}},
    '@tanstack/react-query':{useQuery:options=>({data:options.queryKey[0]==='companies'?[company]:options.queryKey[0]==='branches'?[branch]:[],isLoading:false,isFetching:false,isError:false}),useMutation:()=>({isPending:false}),useQueryClient:()=>({invalidateQueries(){}})},
  },nodes)
  const Page=companies?module.CompaniesCard:module.default
  const props=companies?{canManage:manage,activeBranches:[branch],onAddBranch(){}}:{}
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Page,props)))
  const fragment=className=>{
    const node=nodes.find(n=>n.props.className===className)
    assert.ok(node,'Missing '+className)
    return renderToStaticMarkup(React.createElement(node.type,node.props))
  }
  return {html,fragment}
}
test('company identity uses its name, code and NIT without decorative entity icons',()=>{
  const {html,fragment}=render(true)
  const identity=fragment('branches-company-top')
  assert.match(identity,/<h3[^>]*>Comercial del Centro<\/h3>/)
  assert.match(identity,/Código COM/);assert.match(identity,/NIT 1234567/)
  assert.doesNotMatch(identity,/lucide-building|lucide-star|branches-company-icon/)
  const nested=fragment('branches-company-branch')
  assert.match(nested,/Sucursal Centro/);assert.match(nested,/CENT/);assert.match(nested,/Predeterminada/)
  assert.doesNotMatch(nested,/<svg/)
  assert.match(html,/Expandir|Contraer/);assert.match(html,/Editar empresa/)
})
test('branch identity is text-first and keeps its operational data and action controls',()=>{
  const {html,fragment}=render()
  const identity=fragment('branches-row-identity')
  assert.match(identity,/<h2[^>]*>Sucursal Centro<\/h2>/)
  assert.match(identity,/Código CENT/);assert.match(identity,/Comercial del Centro/);assert.match(identity,/Zona 1, Guatemala/)
  assert.doesNotMatch(identity,/<svg|branches-row-icon/)
  assert.match(html,/Ana Gómez/);assert.match(html,/Operativa/)
  assert.match(html,/aria-label="Ver detalles de Sucursal Centro"/)
  assert.match(html,/aria-label="Editar Sucursal Centro"/)
})
test('text-first rows retain read-only permission boundaries',()=>{
  const branches=render(false,false).html
  assert.match(branches,/Ver detalles de Sucursal Centro/)
  assert.doesNotMatch(branches,/aria-label="Editar Sucursal Centro"|Nueva sucursal/)
  const companies=render(true,false).html
  assert.match(companies,/Comercial del Centro/)
  assert.doesNotMatch(companies,/Editar empresa|Nueva empresa/)
})
