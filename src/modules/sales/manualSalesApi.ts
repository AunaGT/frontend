import {apiFetch,getActiveCompanyId,getActiveBranchId} from '@/services/api'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import type {UnitSnapshot} from '@/modules/inventory/units/public'
export type ManualScope={companyId:string;branchId:string;userId:string}
export type ManualItemInput={product_id:string;qty:string;presentation_id?:string|null;unit_revision?:number;accept_rounding?:boolean;expected_unit_price?:string}
export type ManualSaveInput={expectedVersion:number;idempotencyKey:string;customerId:string|null;customerName:string;customerNit:string;items:ManualItemInput[]}
export type ManualCommand={expectedVersion:number;idempotencyKey:string;dueDate?:string;creditOverride?:boolean}
export type ManualSale={id:string;reference:string;version:number;status:'DRAFT'|'CONFIRMED'|'CANCELLED';originQuote?:{id:string;reference:string|null}|null;customerId:string|null;customerName:string;customerNit:string;total:string;dueDate:string|null;
 items:{id:number;productId:string;name:string;kind:'STANDARD'|'KIT'|'SERVICE';qty:string;unitPrice:string;lineTotal:string;unitLabel:string;quantityDecimals:number;unitSnapshot:UnitSnapshot|null;unitMetadataVersion:number;baseQty:string|null}[]}
export type ManualPreview={total:string;items:{unitPrice:string;lineTotal:string;unitSnapshot:UnitSnapshot|null;baseQty:string}[]}
export function assertManualScope(scope:ManualScope,signal?:AbortSignal){
 if(signal?.aborted||!scope.companyId||!scope.branchId||scope.branchId==='all'||getActiveCompanyId()!==scope.companyId||getActiveBranchId()!==scope.branchId||!authSessionMatches(scope.userId))throw new DOMException('Cambió la empresa, sucursal o sesión','AbortError')
}
async function request<T>(scope:ManualScope,path:string,method:string,body?:object,signal?:AbortSignal):Promise<T>{
 const session=authSessionIdentity();assertManualScope(scope,signal)
 const result=await apiFetch<T>(`/sales${path}`,{method,signal,headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId},...(body?{body:JSON.stringify(body)}:{})})
 assertManualScope(scope,signal);if(authSessionIdentity()!==session)throw new DOMException('La sesión cambió','AbortError')
 return result
}
export const readManualSale=(scope:ManualScope,id:string,signal?:AbortSignal)=>request<ManualSale>(scope,`/${encodeURIComponent(id)}/draft`,'GET',undefined,signal)
export const previewManualSale=(scope:ManualScope,input:ManualSaveInput,signal?:AbortSignal)=>request<ManualPreview>(scope,'/drafts/preview','POST',input,signal)
export const saveManualSale=(scope:ManualScope,id:string|null,input:ManualSaveInput,signal?:AbortSignal)=>request<ManualSale>(scope,id?`/${encodeURIComponent(id)}/draft`:'/drafts',id?'PUT':'POST',input,signal)
export const confirmManualSale=(scope:ManualScope,id:string,input:ManualCommand,signal?:AbortSignal)=>request<ManualSale>(scope,`/${encodeURIComponent(id)}/confirm`,'POST',input,signal)
export const cancelManualSale=(scope:ManualScope,id:string,input:ManualCommand,signal?:AbortSignal)=>request<ManualSale>(scope,`/${encodeURIComponent(id)}/cancel-draft`,'POST',input,signal)
