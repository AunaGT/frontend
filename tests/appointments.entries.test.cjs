const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('destino libre no requiere producto ni inscripción',()=>{
  const {entryDestination}=loadReportModule('../appointments/viewModel.ts')
  assert.equal(entryDestination({recordType:'ACTIVITY',id:'a'}),'/agenda/actividades/a')
  assert.equal(entryDestination({recordType:'SCHEDULED_SERVICE',id:'s',mode:'INDIVIDUAL',bookingId:'b'}),'/agenda/reservas/b')
})
test('carga de entradas no acepta páginas inconsistentes ni duplicadas',async()=>{
  let calls=0
  const api=loadReportModule('../appointments/api.ts',{'@/services/api':{getActiveCompanyId:()=> 'a',getActiveBranchId:()=> 'b',apiFetch:async()=>({items:[{id:'same'}],page:++calls,pageSize:100,totalItems:2})}})
  await assert.rejects(()=>api.fetchAllEntries({companyId:'a',branchId:'b'},{}),/cambió/)
  assert.equal(calls,2)
})
