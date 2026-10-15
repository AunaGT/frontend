const {loadReportModule}=require('./loadReportModule.cjs'),{hookHarness}=require('./reportHookHarness.cjs')
function renderActivityForm({companyId='A',branchId='B',api,initial}={}) {
  const h=hookHarness(),navigations=[],writes=[]
  let scope={companyId,branchId},resolveSubmit,rejectSubmit
  const fakeApi={mutateAgenda:async(path,s,body,signal,method)=>{
    writes.push({path,scope:s,body,signal,method})
    if(api)return api(path,body)
    return new Promise((resolve,reject)=>{resolveSubmit=resolve;rejectSubmit=reject})
  }}
  const {useActivityDraft}=loadReportModule('../appointments/activityDraft.ts',{
    react:h.hooks,'./api':fakeApi,'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async()=>{}})},
  })
  let current
  const render=()=>current=h.render(()=>useActivityDraft({scope,userId:'user',timezone:'America/Guatemala',initial,onSaved:r=>navigations.push(`/agenda/actividades/${r.id}`)}))
  render()
  return {writes,navigations,value:()=>render().value,change:patch=>{render().change({...current.value,...patch});render()},
    submit:()=>render().save(),handoff:()=>render().handoff(),changeScope:next=>{scope={companyId:next.companyId,branchId:next.branchId};render()},
    resolveSubmit:v=>resolveSubmit(v),rejectSubmit:e=>rejectSubmit(e),state:()=>render()}
}
module.exports={renderActivityForm}
