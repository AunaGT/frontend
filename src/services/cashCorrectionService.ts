import { getApiBaseUrl, getAuthToken } from '@/services/api'
import type { ReviewScope } from './cashReviewService'
export type CorrectionLine={closurePaymentId:number;paymentMethodId:number;name:string;kind:'CASH'|'BANK';originalExpected:string;previousActual:string;correctedActual?:string;delta?:string;correctedDifference?:string}
export type CorrectionAccounting={enabled:boolean;status:'READY'|'BLOCKED'|'DEFERRED';issues:string[];willPostOriginal:boolean;pendingAdjustments:number}
export type CorrectionContext={available:boolean;eligible:boolean;issue:string|null;closureNumber:number;currency:string;previousCorrectionId:string|null;lines:CorrectionLine[];baseKey:string;can:{propose:boolean};accountingEnabled:boolean}
export type CorrectionInput={reason:string;accountingDate:string;previousCorrectionId:string|null;lines:{closurePaymentId:number;correctedActual:string}[];requestKey:string;previewKey?:string}
export type CustodyComparison={sessionId:string;recorded:string;corrected:string;difference:string;canOpen:boolean}
export type CorrectionPreview={lines:CorrectionLine[];currency:string;cashDelta:string;correctedDifference:string;accounting:CorrectionAccounting;previewKey:string;custodyComparison?:CustodyComparison|null}
export type CorrectionDocument=Omit<CorrectionPreview,'accounting'|'previewKey'>&{accounting?:CorrectionAccounting;id:string;closureId:string;closureNumber:number;status:'PENDING'|'APPROVED'|'REJECTED'|'CANCELLED';sequence:number|null;reason:string;accountingDate:string;previousCorrectionId:string|null;proposedByName:string;proposedAt:string;updatedAt:string;decidedByName:string|null;decidedAt:string|null;decisionReason:string|null;selfReview:boolean;requiresSelfReviewReason:boolean;accountingStatus:'DEFERRED'|'POSTED'|'ZERO';entryNumber:string|null;journalEntryId:string|null;stale:boolean;can:{approve:boolean;reject:boolean;cancel:boolean}}
export type CorrectionList={items:Pick<CorrectionDocument,'id'|'status'|'sequence'|'reason'|'proposedAt'|'accountingStatus'>[];totalItems:number;page:number;pageSize:number}
async function request<T>(path:string,scope:ReviewScope,options:RequestInit={}):Promise<T>{
  const res=await fetch(`${getApiBaseUrl()}/cash-closures${path}`,{...options,cache:'no-store',signal:options.signal??AbortSignal.timeout(30_000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${getAuthToken()??''}`,'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}})
  let data: {message?:string}|null=null
  try{data=await res.json()}catch{if(res.ok)throw new Error('No se pudo leer la respuesta. Reintenta la misma solicitud para comprobar su resultado.')}
  if(options.signal?.aborted)throw new DOMException('Consulta cancelada','AbortError')
  if(!res.ok)throw Object.assign(new Error(data?.message||'No se pudo completar la corrección'),{status:res.status})
  return data as T
}
const path=(id:string)=>`/${encodeURIComponent(id)}/corrections`
const post=(body:unknown,signal?:AbortSignal)=>({method:'POST',body:JSON.stringify(body),signal})
export const fetchCorrectionContext=(id:string,s:ReviewScope,signal?:AbortSignal)=>request<CorrectionContext>(`${path(id)}/context`,s,{signal})
export const fetchCorrections=(id:string,s:ReviewScope,page=1,signal?:AbortSignal)=>request<CorrectionList>(`${path(id)}?page=${page}&pageSize=10`,s,{signal})
export const fetchCorrection=(id:string,correctionId:string,s:ReviewScope,signal?:AbortSignal)=>request<CorrectionDocument>(`${path(id)}/${encodeURIComponent(correctionId)}`,s,{signal})
export const previewCorrection=(id:string,input:CorrectionInput,s:ReviewScope,signal?:AbortSignal)=>request<CorrectionPreview>(`${path(id)}/preview`,s,post(input,signal))
export const proposeCorrection=(id:string,input:CorrectionInput,s:ReviewScope,signal?:AbortSignal)=>request<CorrectionDocument>(path(id),s,post(input,signal))
export const decideCorrection=(id:string,correctionId:string,input:{action:'APPROVE'|'REJECT';reason?:string;expectedUpdatedAt:string;requestKey:string},s:ReviewScope,signal?:AbortSignal)=>request<CorrectionDocument>(`${path(id)}/${encodeURIComponent(correctionId)}/decide`,s,post(input,signal))
export const cancelCorrection=(id:string,correctionId:string,input:{reason:string;expectedUpdatedAt:string;requestKey:string},s:ReviewScope,signal?:AbortSignal)=>request<CorrectionDocument>(`${path(id)}/${encodeURIComponent(correctionId)}/cancel`,s,post(input,signal))
export const correctionStatus={PENDING:'Pendiente de aprobación',APPROVED:'Aprobada',REJECTED:'Rechazada',CANCELLED:'Cancelada'} as const
export const correctionAccountingStatus={DEFERRED:'Sin contabilización',POSTED:'Contabilizada',ZERO:'Sin ajuste de efectivo'} as const
