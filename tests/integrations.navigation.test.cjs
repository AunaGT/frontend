const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{matchRoutes}=require('react-router-dom'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('integration pages have reloadable routes with separate read and management permissions',()=>{
 const {integrationRoutes}=loadReportModule('../config/integrations/pageRoutes.ts')
 for(const path of ['/configuracion/integraciones','/configuracion/integraciones/nueva','/configuracion/integraciones/key'])assert.ok(matchRoutes(integrationRoutes,path))
 assert.deepEqual(integrationRoutes[1].permissions,['integrations.manage'])
 const {findSettingsSections}=loadReportModule('../config/settingsModel.ts');assert.ok(findSettingsSections('api claves').some(s=>s.id==='integraciones'))
})
test('integration navigation retains the shared sidebar and hides sections without permission',()=>{
 const nodes=[],{IntegrationSettingsLayout}=loadReportModule('../config/integrations/IntegrationSettingsLayout.tsx',{
  'react-router-dom':{useNavigate:()=>()=>{},Link:({children,to})=>React.createElement('a',{href:to},children)},
  '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:(...p)=>p.includes('integrations.view')})},
  '@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set()})}
 },nodes)
 const html=renderToStaticMarkup(React.createElement(IntegrationSettingsLayout,{companyName:'Empresa'},'Contenido'))
 assert.match(html,/Secciones de configuración/);assert.match(html,/API y claves/);assert.doesNotMatch(html,/Datos fiscales|Conectores|Plantillas de documentos/)
})
test('integration timestamps use the company timezone rather than the browser timezone',()=>{
 const {useIntegrationDate}=loadReportModule('../config/integrations/useIntegrationDate.ts',{'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',timezone:'America/Guatemala'})}})
 const text=useIntegrationDate()('2026-10-25T01:00:00.000Z');assert.match(text,/24/);assert.match(text,/19:00/)
})
test('users with integration permissions can discover Configuration from the application navigation',()=>{
 const {appModules}=loadReportModule('../../config/appModules.ts'),config=appModules.find(m=>m.id==='config')
 assert.ok(config.permissions.includes('integrations.view'))
})
