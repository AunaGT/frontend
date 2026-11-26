import {apiFetch,getActiveCompanyId,getActiveBranchId} from '@/services/api'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import type {IntegrationScope,CredentialInput,Credential,CreatedCredential,ManagementOptions,Page,AuditEvent,CredentialFiltersValue,UsagePeriod,UsageSummary} from './types'
import {sensitiveSearch} from './model'
function assertScope(scope:IntegrationScope,signal?:AbortSignal){if(signal?.aborted||getActiveCompanyId()!==scope.companyId||(getActiveBranchId()||null)!==(scope.branchId||null)||authSessionIdentity()!==scope.sessionId||!authSessionMatches(scope.userId))throw new DOMException('Cambió la empresa o sesión','AbortError')}
export async function integrationRequest<T>(scope:IntegrationScope,path:string,options:RequestInit={}):Promise<T>{
 assertScope(scope,options.signal||undefined)
 let result:T
 try{result=await apiFetch<T>('/settings/integrations'+path,{...options,retryUnauthorized:false,cache:'no-store',headers:{'X-Company-Id':scope.companyId,...(scope.branchId?{'X-Branch-Id':scope.branchId}:{})}})}
 catch(e){assertScope(scope,options.signal||undefined);throw e}
 assertScope(scope,options.signal||undefined);return result
}
export async function listKeys(s:IntegrationScope,page=1,signal?:AbortSignal,filters?:CredentialFiltersValue){
 if(filters&&sensitiveSearch(filters.q))throw new Error('Busca por nombre o identificador público; nunca pegues una clave privada.')
 const query=new URLSearchParams({page:String(page),pageSize:'20'})
 if(filters?.q.trim())query.set('q',filters.q.trim())
 if(filters?.status&&filters.status!=='ALL')query.set('status',filters.status)
 if(filters?.scope&&filters.scope!=='ALL')query.set('scope',filters.scope)
 return integrationRequest<Page<Credential>>(s,'?'+query.toString(),{signal})
}
export const getUsage=(s:IntegrationScope,period:UsagePeriod,credentialId?:string,signal?:AbortSignal)=>integrationRequest<UsageSummary>(s,`${credentialId?'/'+encodeURIComponent(credentialId):''}/usage?period=${period}`,{signal})
export const getKey=(s:IntegrationScope,id:string,signal?:AbortSignal)=>integrationRequest<Credential>(s,'/'+encodeURIComponent(id),{signal})
export const getOptions=(s:IntegrationScope,page=1,signal?:AbortSignal)=>integrationRequest<ManagementOptions>(s,`/options?page=${page}&pageSize=25`,{signal})
export const getCustomerPaymentTerms=(s:IntegrationScope,query:{page:number;q:string},signal?:AbortSignal)=>integrationRequest<{items:{id:number;name:string}[];page:number;hasMore:boolean}>(s,`/customer-payment-terms?page=${query.page}&pageSize=25&q=${encodeURIComponent(query.q)}`,{signal})
export const getHistory=(s:IntegrationScope,id:string,page=1,signal?:AbortSignal)=>integrationRequest<Page<AuditEvent>>(s,`/${encodeURIComponent(id)}/history?page=${page}&pageSize=20`,{signal})
export const createKey=(s:IntegrationScope,input:CredentialInput,replaceId?:string,signal?:AbortSignal)=>integrationRequest<CreatedCredential>(s,replaceId?`/${encodeURIComponent(replaceId)}/replace`:'',{method:'POST',body:JSON.stringify(input),signal})
export const revokeKey=(s:IntegrationScope,id:string,signal?:AbortSignal)=>integrationRequest<Credential>(s,`/${encodeURIComponent(id)}/revoke`,{method:'POST',body:'{}',signal})
export const pauseKey=(s:IntegrationScope,id:string,signal?:AbortSignal)=>integrationRequest<Credential>(s,`/${encodeURIComponent(id)}/pause`,{method:'POST',body:'{}',signal})
export const resumeKey=(s:IntegrationScope,id:string,signal?:AbortSignal)=>integrationRequest<Credential>(s,`/${encodeURIComponent(id)}/resume`,{method:'POST',body:'{}',signal})
export function integrationError(error:unknown){const e=error as {data?:{error?:{message?:string}};message?:string};return e.data?.error?.message||'No se pudo completar la operación. Si acababas de crear una clave, revisa la lista antes de volver a intentarlo.'}
