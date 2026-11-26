const test=require('node:test'),assert=require('node:assert/strict'),{matchRoutes}=require('react-router-dom'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('library, create, editor, preview and history have distinct reloadable page routes',()=>{
 const {customerPageRoutes}=loadReportModule('../config/customerPages/pageRoutes.ts'),routes=customerPageRoutes.map(r=>({...r,element:r.key}))
 for(const [path,key]of [['/configuracion/paginas-clientes','library'],['/configuracion/paginas-clientes/nueva','create'],['/configuracion/paginas-clientes/123/editar','editor'],['/configuracion/paginas-clientes/123/vista-previa','preview'],['/configuracion/paginas-clientes/123/historial','history']])assert.equal(matchRoutes(routes,path)?.at(-1).route.key,key)
 const {findSettingsSections}=loadReportModule('../config/settingsModel.ts');assert.ok(findSettingsSections('páginas clientes').some(s=>s.id==='paginas-clientes'))
})
