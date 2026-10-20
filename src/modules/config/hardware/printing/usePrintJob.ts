import {useEffect,useMemo,useRef,useState} from 'react'
import {getActiveBranchId,getActiveCompanyId} from '@/services/api'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import {downloadReportBlob} from '@/modules/reports/documents/reportDownload'
import {createPrintFlow} from './flow'
import {createPrintJob,printDocument,printEvent,reprintJob,operationalWorkstation} from './api'
import type {HardwareScope,PrintSource,PrintOptions,PrintState,PrintRoute,RenderedPrint} from './types'
export function usePrintJob(scope:HardwareScope,render:(snapshot:unknown,document:'MAIN'|'GUIDE')=>Promise<RenderedPrint>,allowed=true){
 const identity=authSessionIdentity(),key=JSON.stringify([scope,identity,allowed]),live=useRef(key);live.current=key
 const renderer=useRef(render);renderer.current=render
 const [state,setState]=useState<{key:string;value:PrintState}|null>(null)
 const flow=useMemo(()=>{
  const controller=new AbortController(),current=()=>live.current===key&&allowed&&!controller.signal.aborted&&authSessionIdentity()===identity&&!!scope.userId&&authSessionMatches(scope.userId)&&getActiveCompanyId()===scope.companyId&&getActiveBranchId()===scope.branchId
  const run=createPrintFlow({current,create:(source,options)=>createPrintJob(scope,source,options,controller.signal),document:id=>printDocument(scope,id,controller.signal),event:(id,event,error)=>printEvent(scope,id,event,error,controller.signal),reprint:(id,reason,pdfOnly)=>reprintJob(scope,id,reason,pdfOnly,controller.signal),render:(snapshot,doc)=>renderer.current(snapshot,doc),save:downloadReportBlob,update:value=>setState({key,value})})
  return{...run,current,dispose:()=>{controller.abort();run.cancel()}}
  // Every owner/permission change creates a new flow; old completions cannot publish.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key])
 useEffect(()=>()=>flow.dispose(),[flow])
 const visible=state?.key===key?state.value:null
 return{pending:visible?.pending||false,job:visible?.job||null,blob:visible?.blob||null,error:visible?.error||'',isCurrent:flow.current,canUseUntrackedPdf:()=>flow.current()&&flow.state().fallbackAvailable,prepare:(source:PrintSource,options:PrintOptions={})=>flow.prepare(source,options),retry:flow.retry,download:flow.download}
}
export function usePrintDestination(scope:HardwareScope,purpose:'RECEIPT'|'LABEL',cashRegisterId?:string){
 const [state,setState]=useState<{key:string;route:PrintRoute|null;destinationId:string|null}>({key:'',route:null,destinationId:null})
 const session=authSessionIdentity(),key=JSON.stringify([scope,purpose,cashRegisterId,session])
 useEffect(()=>{
  const abort=new AbortController();let remembered:string|null=null
  try{remembered=localStorage.getItem(`hardware:workstation:${JSON.stringify([scope.companyId,scope.branchId,scope.userId])}`)}catch{/* PDF remains available. */}
  setState({key,route:null,destinationId:null})
  if(scope.companyId&&scope.branchId&&scope.branchId!=='all'&&(remembered||cashRegisterId))void operationalWorkstation(scope,{purpose,...(remembered?{workstationId:remembered}:{}),...(cashRegisterId?{cashRegisterId}:{})},abort.signal).then(route=>{if(!abort.signal.aborted&&authSessionIdentity()===session)setState({key,route,destinationId:null})}).catch(()=>{/* Invalid or inaccessible route never blocks business PDF. */})
  return()=>abort.abort()
 },[key])
 const current=state.key===key?state:{route:null,destinationId:null}
 return{...current,onChange:(destinationId:string|null)=>setState(old=>old.key===key?{...old,destinationId}:old),options:current.destinationId&&current.route?{workstationId:current.route.workstationId,destinationId:current.destinationId}:{}}
}
