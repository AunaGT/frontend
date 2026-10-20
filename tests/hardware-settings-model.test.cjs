const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('hardware is a searchable specialized section, without becoming a general setting key',()=>{
 const m=loadReportModule('../config/settingsModel.ts')
 for(const term of ['lector','impresora','hardware'])assert.ok(m.findSettingsSections(term).some(s=>s.id==='hardware'))
 assert.equal(m.SECTION_KEYS.hardware,undefined)
 const permissions=loadReportModule('../../lib/permissionGroups.ts')
 assert.equal(permissions.formatPermissionGroupLabel('hardware'),'Hardware y puntos de cobro')
})
test('remembered station is scoped and only retained if revalidated in live workspace',()=>{
 const m=loadReportModule('../config/hardware/model.ts'),scope={companyId:'A',branchId:'B',userId:'U'},storage=new Map(),local={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}
 assert.equal(m.rememberedWorkstation(scope,[],local),null)
 const row={id:'W',companyId:'A',branchId:'B',state:'ACTIVE'}
 m.rememberWorkstation(scope,row,local)
 assert.equal(m.rememberedWorkstation(scope,[row],local),'W')
 assert.equal(m.rememberedWorkstation({...scope,companyId:'C'},[row],local),null)
 assert.equal(m.rememberedWorkstation(scope,[{...row,state:'DISABLED'}],local),null)
})
