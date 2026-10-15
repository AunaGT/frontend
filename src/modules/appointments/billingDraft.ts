import {useRef,useState} from 'react'
import {useAgendaMutation} from './hooks'
import type {AgendaScope} from './types'
import type {BillingOrigin,BillingChoices,BillingPreview,EngagementDetail} from './commercialTypes'
// Reuse Agenda's abort/tenant gate; this draft only owns choices and explicit review.
export function useSourceBillingDraft({scope,origin,preview,onSaved}:{scope:AgendaScope;origin:BillingOrigin;preview?:BillingPreview;onSaved:(value:EngagementDetail)=>void}){
  const key=JSON.stringify([scope.companyId,scope.branchId,origin]),initial:BillingChoices=origin.kind==='BOOKING'?{}:{quantity:'1'}
  const [state,setState]=useState<{key:string;choices:BillingChoices;reviewed:string|null}>({key,choices:initial,reviewed:null})
  const mutation=useAgendaMutation(scope),attempt=useRef<{hash:string;requestKey:string}|null>(null)
  const choices=state.key===key?state.choices:initial
  const signature=(current=preview)=>JSON.stringify([key,choices,current?.origin.version,current?.reviewHash])
  const isApproved=(current=preview)=>state.key===key&&state.reviewed===signature(current)&&!!current?.canPrepare
  const change=(choices:BillingChoices)=>{if(!mutation.pending)setState({key,choices,reviewed:null})}
  const approve=(value:boolean,current=preview)=>{if(!mutation.pending)setState({key,choices,reviewed:value?signature(current):null})}
  const save=async(current=preview)=>{
    if(!isApproved(current)||!current?.reviewHash||current.engagementId||mutation.pending)return
    const body={...choices,expectedVersion:current.origin.version,reviewHash:current.reviewHash},hash=JSON.stringify([key,body])
    if(attempt.current?.hash!==hash)attempt.current={hash,requestKey:crypto.randomUUID()}
    const row=await mutation.submit<EngagementDetail>(`/billing-sources/${origin.kind==='BOOKING'?'bookings':'activities'}/${encodeURIComponent(origin.id)}/prepare`,{...body,idempotencyKey:attempt.current.requestKey})
    if(row)onSaved(row)
  }
  return {...mutation,choices,change,approved:isApproved(),isApproved,approve,save,dirty:state.key===key&&(!!choices.contactId||choices.quantity!==initial.quantity||state.reviewed!==null)}
}
