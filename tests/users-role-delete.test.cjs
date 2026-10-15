const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const context={companyId:'a',userId:'u'}
test('protected admin detail has no save, copy or delete actions',()=>{
 const role={id:73,name:'admin',company_id:null,revision:0,protected:true,permissions:[]},nodes=[]
 const Editor=loadReportModule('../users/RoleEditor.tsx',{
  '@tanstack/react-query':{useQuery:opts=>({data:opts.queryKey[0]==='permissions'?[]:role,isLoading:false}),useQueryClient:()=>({invalidateQueries:async()=>{}})},
  '@/context/useTenant':{useTenant:()=>({company:{id:'a'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'u'},permissionsReady:true,hasPermission:()=>true})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/components/layout/PageNavigation':{usePageTrail(){}},
  '@/services/userService':{getPermissions(){},getRoleWithPermissions(){},createRole(){},updateRole(){}},
 },nodes).default
 const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Editor,{id:73})))
 assert.doesNotMatch(html,/Crear versión editable|Guardar cambios|Eliminar rol/);assert.match(html,/administrador del sistema/i)
})
test('shared delete confirmation blocks a used role and sends revision only once',async()=>{
 const h=hookHarness(),nodes=[],requests=[];let done=0,allow=true,role={id:101,name:'Bodega',revision:3,canDelete:false,deleteBlockedReason:'Reasigna sus usuarios'}
 let Dialog;try{Dialog=loadReportModule('../users/RoleDeleteDialog.tsx',{react:h.hooks,
  '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async()=>{}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>allow,permissionsReady:true})},
  '@/services/userService':{deleteRole:async(id,revision)=>{requests.push({id,revision})}},
 },nodes).RoleDeleteDialog}catch(e){if(!e.message.includes('ENOENT'))throw e}
 assert.equal(typeof Dialog,'function')
 const render=()=>{nodes.length=0;return h.render(()=>Dialog({role,context,onClose(){},onDeleted(){done++}}))}
 render();const confirm=()=>nodes.find(n=>n.props?.['data-role-delete-confirm'])?.props
 assert.equal(confirm().disabled,true);assert.equal(requests.length,0)
 role={...role,canDelete:true};render();await confirm().onClick();assert.deepEqual(requests,[{id:101,revision:3}]);assert.equal(done,1)
 allow=false;assert.equal(render(),null)
})
