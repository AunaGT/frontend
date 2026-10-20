const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('diagnostics explains simulation and hides unauthorized drawer and print actions',()=>{
 const HardwareDiagnostics=loadReportModule('../config/hardware/HardwareDiagnostics.tsx',{'@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set(['inventory'])})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'./api':{},'@/services/scannerService':{}}).HardwareDiagnostics
 const workspace={workstations:[{id:'W',name:'Mostrador',state:'ACTIVE'}],devices:[{id:'D',name:'Gaveta',kind:'CASH_DRAWER',state:'ACTIVE',profile:{}}],assignments:[{workstationId:'W',deviceId:'D',role:'DRAWER'}]}
 const html=renderToStaticMarkup(React.createElement(require('react-router-dom').MemoryRouter,null,React.createElement(HardwareDiagnostics,{hardware:{workspace,canTestPrint:false,canTestDrawer:false,companyId:'A',branchId:'B',pending:false}})))
 assert.match(html,/prueba física/i);assert.doesNotMatch(html,/>Simular gaveta</)
})
