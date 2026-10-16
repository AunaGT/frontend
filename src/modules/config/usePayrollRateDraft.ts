import {useEffect,useRef,useState} from 'react'
import {getActiveCompanyId,getActiveBranchId} from '@/services/api'
import {getRateVersions,publishRateVersion,cancelRateVersion,type RateVersionsResult} from '@/modules/payroll/api/rateVersions'
import {ratesToDraft,ratesPayload,validateRatesDraft,type RatesDraft} from './payrollRateModel'
export type RatesEditorContext={userId:string;companyId:string;branchId:string;canRead:boolean;canPublish:boolean}
const initial=(key:string)=>({key,active:true,data:null as RateVersionsResult|null,draft:{} as RatesDraft,effectiveFrom:'',reason:'',busy:false,status:'loading',error:'',errors:{} as Record<string,string>})
export function usePayrollRateDraft(context:RatesEditorContext,canStartOperation:()=>boolean){
  const key=JSON.stringify(context),live=useRef(initial(key)),[,paint]=useState(0)
  if(live.current.key!==key)live.current=initial(key)
  const owner=live.current,scope={companyId:context.companyId,branchId:context.branchId}
  const current=()=>live.current===owner&&owner.active&&getActiveCompanyId()===scope.companyId&&getActiveBranchId()===scope.branchId
  const render=()=>paint(n=>n+1)
  const canWrite=()=>current()&&context.canPublish&&owner.status==='ready'&&!owner.busy&&canStartOperation()
  const dirty=()=>!!owner.data&&(JSON.stringify(owner.draft)!==JSON.stringify(ratesToDraft(owner.data.current.rates))||!!owner.reason||!!owner.effectiveFrom)
  async function load(){
    if(!current()||!context.canRead)return
    owner.busy=true;render()
    try{const data=await getRateVersions(scope);if(!current())return;owner.data=data;owner.draft=ratesToDraft(data.current.rates);owner.reason='';owner.effectiveFrom='';owner.errors={};owner.error='';owner.status='ready'}
    catch(e){if(current()){owner.error=e instanceof Error?e.message:'No se pudieron cargar los parámetros';owner.status=owner.data?'ready':'error'}}
    finally{if(current()){owner.busy=false;render()}}
  }
  useEffect(()=>{owner.active=true;void load();return()=>{owner.active=false}},[key])
  function setField(field:string,value:string){if(!canWrite())return;owner.draft={...owner.draft,[field]:value};owner.errors={};owner.error='';render()}
  function setMeta(field:'reason'|'effectiveFrom',value:string){if(!canWrite())return;owner[field]=value;owner.errors={};owner.error='';render()}
  async function publish(){
    if(!canWrite())return false
    owner.errors=validateRatesDraft(owner.draft)
    if(!/^\d{4}-\d{2}-\d{2}$/.test(owner.effectiveFrom)||owner.effectiveFrom<owner.data!.today)owner.errors.effectiveFrom='Selecciona hoy o una fecha futura.'
    if(!owner.reason.trim()||owner.reason.trim().length>1000)owner.errors.reason='Indica un motivo de hasta 1000 caracteres.'
    if(Object.keys(owner.errors).length){render();return false}
    owner.busy=true;owner.error='';render()
    try{
      await publishRateVersion({rates:ratesPayload(owner.draft),effectiveFrom:owner.effectiveFrom,reason:owner.reason},scope)
      if(!current())return false
      // Publication committed. A failed refresh must not invite resubmission.
      owner.reason='';owner.effectiveFrom='';owner.draft=ratesToDraft(owner.data!.current.rates)
      await load();if(current()&&owner.error)owner.error=`Versión publicada. ${owner.error}`
      return true
    }catch(e){if(current())owner.error=e instanceof Error?e.message:'No se pudo publicar';return false}
    finally{if(current()){owner.busy=false;render()}}
  }
  async function cancel(id:string,reason:string){
    if(!canWrite()||!reason.trim())return false
    owner.busy=true;owner.error='';render()
    let committed=false
    try{await cancelRateVersion(id,reason,scope);committed=true;if(!current())return false
      const data=await getRateVersions(scope);if(current())owner.data=data
      return true
    }catch(e){if(current())owner.error=(committed?'Versión cancelada. No necesitas repetir la operación. ':'')+(e instanceof Error?e.message:'No se pudo cancelar');return committed}
    finally{if(current()){owner.busy=false;render()}}
  }
  return{...owner,dirty:dirty(),setField,setMeta,publish,cancel,reload:load,reset:()=>{if(canWrite()){owner.draft=ratesToDraft(owner.data!.current.rates);owner.reason='';owner.effectiveFrom='';owner.errors={};owner.error='';render()}}}
}
