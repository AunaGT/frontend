import {useRef,useState} from 'react'
import {useAgendaMutation} from './hooks'
import type {AgendaScope} from './types'
import type {EngagementDetail,EngagementProgram,EngagementDraftHandoff} from './commercialTypes'
import {timelinePayload,timelineInstant} from './operationalTimeline'
export function useEngagementDraft({scope,engagementId,version,initial=[],onSaved}:{scope:AgendaScope;engagementId:string;version:number;initial?:EngagementProgram[];onSaved:(value:EngagementDetail)=>void}){
  const key=`${scope.companyId}:${scope.branchId}:${engagementId}`,seed=useRef({key,programs:initial,version})
  if(seed.current.key!==key)seed.current={key,programs:[],version}
  const [state,setState]=useState({key,programs:seed.current.programs}),mutation=useAgendaMutation(scope)
  const [localError,setLocalError]=useState<{key:string;message:string}|null>(null)
  const attempt=useRef<{key:string;hash:string;requestKey:string}|null>(null)
  const programs=state.key===key?state.programs:seed.current.programs
  const change=(programs:EngagementProgram[])=>{setState({key,programs});setLocalError(null);mutation.reset()}
  const save=async(partial:boolean,acknowledgedPaymentReviewHash?:string)=>{
    if(mutation.pending||!programs.length)return
    let prepared:EngagementProgram[]
    try{prepared=programs.map(p=>({...p,startsAt:timelineInstant(p.startsAt,p.timezone),...(p.endsAt?{endsAt:timelineInstant(p.endsAt,p.timezone)}:{}),...(p.operationalTimeline?{operationalTimeline:timelinePayload(p.operationalTimeline,{...p,endsAt:p.endsAt||''})}:{})}))}catch(error){setLocalError({key,message:error instanceof Error?error.message:'Revisa los horarios propios.'});return}
    const body={expectedVersion:seed.current.version,partial,programs:prepared,...(acknowledgedPaymentReviewHash?{acknowledgedPaymentReviewHash}:{})},hash=JSON.stringify(body)
    if(attempt.current?.key!==key||attempt.current.hash!==hash)attempt.current={key,hash,requestKey:crypto.randomUUID()}
    const result=await mutation.submit<EngagementDetail>(`/engagements/${engagementId}/program`,{...body,idempotencyKey:attempt.current.requestKey})
    if(result)onSaved(result)
  }
  return {programs,change,save,reviewVersion:(next:number)=>{if(!mutation.pending){seed.current.version=next;attempt.current=null}},pending:mutation.pending,error:(localError?.key===key?localError.message:null)||mutation.error,fields:mutation.fields,dirty:JSON.stringify(programs)!==JSON.stringify(seed.current.programs),
    handoff:():EngagementDraftHandoff=>({scope:{...scope},engagementId,version:seed.current.version,programs})}
}
export function useEngagementCommand({scope,engagementId,version}:{scope:AgendaScope;engagementId:string;version:number}){
  const key=`${scope.companyId}:${scope.branchId}:${engagementId}`,seed=useRef({key,version}),attempt=useRef<{hash:string;body:object}|null>(null),mutation=useAgendaMutation(scope)
  if(seed.current.key!==key){seed.current={key,version};attempt.current=null}
  const send=async<T,>(suffix:'payments'|'sale'|'resolution',input:object):Promise<T|null>=>{
    if(mutation.pending)return null
    const base={...input,expectedVersion:seed.current.version},hash=JSON.stringify({key,suffix,base})
    if(attempt.current?.hash!==hash)attempt.current={hash,body:{...base,...(suffix==='payments'?{paidAt:new Date().toISOString()}:{}),idempotencyKey:crypto.randomUUID()}}
    return mutation.submit<T>(`/engagements/${engagementId}/${suffix}`,attempt.current.body)
  }
  return {...mutation,send,reviewVersion:(next:number)=>{if(!mutation.pending){seed.current.version=next;attempt.current=null}}}
}
