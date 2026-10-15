const {loadReportModule}=require('./loadReportModule.cjs'),{hookHarness}=require('./reportHookHarness.cjs')
function creationHarness({api}={}){
  const h=hookHarness(),writes=[],saved=[];let scope={companyId:'A',branchId:'B'},resolve,reject
  const {useCreationDraft}=loadReportModule('../appointments/creationDraft.ts',{react:h.hooks,
    './api':{mutateAgenda:async(path,s,body)=>{writes.push({path,scope:s,body});return api?api(path,body):new Promise((ok,no)=>{resolve=ok;reject=no})}},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async()=>{}})}})
  const render=()=>h.render(()=>useCreationDraft({scope,userId:'u',timezone:'America/Guatemala',onSaved:(row,kind)=>saved.push({row,kind})}))
  return {render,writes,saved,change:patch=>{const state=render();state.change({...state.value,...patch});return render()},
    resolve:v=>resolve(v),reject:e=>reject(e),scope:s=>{scope=s;return render()}}
}
module.exports={creationHarness}
