const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
function render({manage=true,error='',route='/configuracion?seccion=hardware',data={workstations:[],devices:[],assignments:[],registers:[]}}={}){
 const nodes=[],Section=loadReportModule('../config/hardware/HardwareSettingsSection.tsx',{'@/services/api':{},'./useHardwareWorkspace':{useHardwareWorkspace:()=>({workspace:error?null:data,loading:false,error,notice:'',fields:{},canRead:true,canManage:manage,canTestPrint:false,canTestDrawer:false,pending:false,companyId:'A',branchId:'B',userId:'U',reload(){},setDirty(){},saveWorkstation(){},saveDevice(){}})}},nodes).HardwareSettingsSection
 return{html:renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[route]},React.createElement(Section))),nodes}
}
test('empty hardware uses shared art and create action only when permitted',()=>{
 assert.match(render().html,/Crear puesto/);assert.match(render().html,/illustrations/);assert.doesNotMatch(render({manage:false}).html,/>Crear puesto</)
})
test('hardware request error is actionable rather than a successful empty result',()=>{
 const {html}=render({error:'Sin conexión'});assert.match(html,/role="alert"/);assert.match(html,/Reintentar/);assert.doesNotMatch(html,/Crear puesto/)
})
test('new station deep link renders full editor with optional register, not a modal',()=>{
 const {html}=render({route:'/configuracion?seccion=hardware&puesto=nuevo&vista=editar'});assert.match(html,/Nombre del puesto/);assert.match(html,/Sin caja/);assert.doesNotMatch(html,/role="dialog"/)
})
