import {getApiBaseUrl,getAuthToken} from '@/services/api'
import type {ReviewScope} from './cashReviewService'
export type DisputeScope=ReviewScope
export type DisputeStatus='OPEN'|'SUBMITTED'|'WON'|'PARTIALLY_LOST'|'LOST'|'CANCELLED'
export type DisputeCan={read:boolean;manage:boolean;movements:boolean;resolve:boolean;charge:boolean;adjust?:boolean;post?:boolean}
export type DisputeCapabilities={available:boolean;commandsAvailable:boolean;reason:string;can:DisputeCan}
export type DisputeAccounting={enabled:boolean;status:'READY'|'BLOCKED'|'DEFERRED';issues:string[];sources:{id:string;kind:string;status:string;economicOn:string|null;accountingOn:string|null;entryId:string|null;entryNumber:string|null;dateChangeReason?:string|null;suggestedAccountingOn?:string|null;suggestedDateChangeReason?:string|null;settlementId?:string|null;settlementReference?:string|null;accountingRoute?:'STANDALONE'|'SETTLEMENT'|'RECLASSIFICATION'}[]}
export type DisputeListItem=Record<string,unknown>&{id:string;event_id:string;payment_method_id?:number;status:DisputeStatus;version:number;currency_code:string;claimed:string;won:string;lost:string;provider_reference:string;deadline:string|null;created_at:string}
export type DisputeProposal={id:string;kind:string;status:string;payload:Record<string,string>;expected_version:number;preview_key:string;proposed_by_name:string;proposed_at:string;decided_by_name:string|null;decided_at:string|null;decision_reason:string|null}
export type DisputeDocument={id:string;eventId:string;branchId:string;customerName:string|null;providerReference:string;reason:string;deadline:string|null;status:DisputeStatus;version:number;originMode?:'DIRECT'|'DEFERRED'|null;providerPending?:string|null;claimed:string;withdrawn:string;recovered:string;won:string;lost:string;charged:string;customerCredit:string;disposed:string;unresolved:string;fees:string;currencyCode:string;createdAt:string;createdByName:string;replacesCaseId:string|null;replacedByCaseId:string|null;can:DisputeCan;ownerSelfReviewEnabled?:boolean;accounting?:DisputeAccounting;lots?:DisputeLot[];legacyDeductions?:LegacyDeduction[];proposals:DisputeProposal[];history:{id:string;kind:string;principal:string;fee:string;reference:string|null;actor_name:string;created_at:string;accounting_status:string;economic_on:string|null;accounting_on:string|null;payload:Record<string,unknown>}[]}
export type DisputeOrigin={eventId:string;sourceType:string;sourceId:string;customerName:string|null;methodName:string;amount:string;effectiveRefunded:string;claimable:string;eligible:boolean;available:boolean;issues:string[];currencyCode:string;economicAt:string;reference:string|null;baseKey:string}
export type DisputeInput={eventId:string;claimed:string;providerReference:string;reason:string;deadline?:string;evidence?:{identifier:string};replacesCaseId?:string;requestKey:string}
export type DisputeLot={id:string;kind:'ABSORBED'|'RECEIPT_RETIRED'|'CUSTOMER_CHARGE';remaining:string;outstanding:string|null;chargeReference:string|null}
export type LegacyDeduction={id:string;amount:string;settlementId:string;depositedOn:string|null;reference:string|null}
export type LegacyDeductionInput={deductionId:string;principal:string;reference:string;accountingDate?:string;dateChangeReason?:string;expectedVersion:number;requestKey:string}
export type DisputeEffectInput={kind:'BANK_DEBIT'|'PROVIDER_WITHHOLDING'|'BANK_RECOVERY';principal:string;fee:string;effectiveOn:string;reference:string;evidence?:{identifier:string};accountingDate?:string;dateChangeReason?:string;expectedVersion:number;requestKey:string}
export type DisputeActionInput={kind:string;payload:Record<string,string>;expectedVersion:number;requestKey?:string;previewKey?:string}
export type DisputePreview={version:number;kind:string;payload:Record<string,unknown>;previewKey:string;before:{status:DisputeStatus;won:string;lost:string;charged:string};after:{status:DisputeStatus;won:string;lost:string;charged:string};issues:string[]}
async function request<T>(path:string,scope:DisputeScope,options:RequestInit={}):Promise<T>{
  const signal=options.signal??AbortSignal.timeout(30_000)
  const res=await fetch(`${getApiBaseUrl()}/cash-closures/disputes${path}`,{...options,signal,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${getAuthToken()??''}`,'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}})
  let body:{message?:string;error?:string;code?:string}|null=null
  try{body=await res.json()}catch{if(res.ok)throw new Error('No se pudo leer la respuesta. Reintenta la misma solicitud para recuperar su resultado.')}
  if(signal.aborted)throw new DOMException('Consulta cancelada','AbortError')
  if(!res.ok)throw Object.assign(new Error(body?.message||body?.error||'No se pudo completar la consulta de disputas'),{status:res.status,code:body?.code})
  return body as T
}
const post=(body:unknown,signal?:AbortSignal)=>({method:'POST',body:JSON.stringify(body),signal})
const path=(id:string)=>`/${encodeURIComponent(id)}`
export const fetchDisputeCapabilities=(scope:DisputeScope,signal?:AbortSignal)=>request<DisputeCapabilities>('/capabilities',scope,{signal})
export const fetchDisputes=(scope:DisputeScope,filters:{page?:number;status?:string;q?:string;methodId?:number;pageSize?:number},signal?:AbortSignal)=>request<{items:DisputeListItem[];page:number;pageSize:number;totalPages:number;totalItems:number}>(`?${new URLSearchParams({page:String(filters.page||1),pageSize:String(filters.pageSize||20),...(filters.status?{status:filters.status}:{}),...(filters.methodId?{methodId:String(filters.methodId)}:{}),...(filters.q?{q:filters.q}:{})})}`,scope,{signal})
export const fetchDispute=(id:string,scope:DisputeScope,signal?:AbortSignal)=>request<DisputeDocument>(path(id),scope,{signal})
export const fetchDisputeOrigin=(id:string,scope:DisputeScope,signal?:AbortSignal)=>request<DisputeOrigin>(`/origins/${encodeURIComponent(id)}`,scope,{signal})
export const createDispute=(input:DisputeInput,scope:DisputeScope,signal?:AbortSignal)=>request<DisputeDocument>('',scope,post(input,signal))
export const previewDispute=(id:string,input:DisputeActionInput,scope:DisputeScope,signal?:AbortSignal)=>request<DisputePreview>(`${path(id)}/preview`,scope,post(input,signal))
export const proposeDispute=(id:string,input:DisputeActionInput,scope:DisputeScope,signal?:AbortSignal)=>request<DisputeProposal>(`${path(id)}/proposals`,scope,post(input,signal))
export const decideDispute=(id:string,proposalId:string,input:{decision:'APPROVE'|'REJECT';expectedVersion:number;reason?:string;selfReviewReason?:string;requestKey:string},scope:DisputeScope,signal?:AbortSignal)=>request<DisputeDocument>(`${path(id)}/proposals/${encodeURIComponent(proposalId)}/decide`,scope,post(input,signal))
export const confirmDisputeEffect=(id:string,input:DisputeEffectInput,scope:DisputeScope,signal?:AbortSignal)=>request<DisputeDocument>(`${path(id)}/effects`,scope,post(input,signal))
export const linkLegacyDeduction=(id:string,input:LegacyDeductionInput,scope:DisputeScope,signal?:AbortSignal)=>request<DisputeDocument>(`${path(id)}/legacy-deductions`,scope,post(input,signal))
// Registro contable tardío de las fuentes pendientes; el servidor exige permiso contable.
export const postDisputeSources=(id:string,scope:DisputeScope,signal?:AbortSignal)=>request<{status:string;entries:unknown[]}>(`${path(id)}/post`,scope,post({},signal))
export const disputeLotLabel:Record<DisputeLot['kind'],string>={ABSORBED:'Pérdida asumida por la empresa',RECEIPT_RETIRED:'Saldo del recibo cancelado',CUSTOMER_CHARGE:'Cargo al cliente'}
// El soporte viaja como archivo con su clave de intento; repetir el mismo archivo no lo carga dos veces.
export async function uploadDisputeEvidence(id:string,file:File,requestKey:string,scope:DisputeScope,signal?:AbortSignal):Promise<DisputeDocument>{
  const body=new FormData();body.append('requestKey',requestKey);body.append('file',file)
  const res=await fetch(`${getApiBaseUrl()}/cash-closures/disputes${path(id)}/evidence`,{method:'POST',body,signal:signal??AbortSignal.timeout(60_000),cache:'no-store',headers:{Authorization:`Bearer ${getAuthToken()??''}`,'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}})
  const result=await res.json().catch(()=>null)
  if(!res.ok)throw Object.assign(new Error(result?.message||'No se pudo agregar el soporte'),{status:res.status,code:result?.code})
  return result as DisputeDocument
}
export const openDisputeEvidence=(id:string,evidenceId:string,scope:DisputeScope,signal?:AbortSignal)=>request<{url:string;expiresAt:string}>(`${path(id)}/evidence/${encodeURIComponent(evidenceId)}`,scope,{signal})
export const disputeStatus:Record<DisputeStatus,string>={OPEN:'En preparación',SUBMITTED:'Respuesta presentada',WON:'Ganada',PARTIALLY_LOST:'Pérdida parcial',LOST:'Perdida',CANCELLED:'Cancelada'}
export const disputeEventLabel:Record<string,string>={BANK_DEBIT:'Retiro del banco',BANK_RECOVERY:'Recuperación bancaria',PROVIDER_WITHHOLDING:'Retención del proveedor',PROVIDER_RECOVERY:'Recuperación del proveedor',LEGACY_WITHHOLDING:'Deducción histórica',COMPENSATION:'Compensación',COMMUNICATION:'Actualización del expediente',STATUS:'Cambio de estado',EVIDENCE:'Soporte agregado',DISPOSITION:'Resolución de la pérdida',ADJUSTMENT:'Ajuste',RESULT:'Resultado del reclamo',SUBMIT:'Presentar respuesta',CANCEL:'Cancelar expediente',REOPEN:'Reabrir expediente',FORGIVE:'Condonación',CORRECT:'Corrección'}
