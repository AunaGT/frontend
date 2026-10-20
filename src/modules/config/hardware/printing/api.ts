import {apiFetch,getApiBaseUrl,ApiError} from '@/services/api'
import {authSessionIdentity} from '@/services/authSession'
import {assertHardwareScope} from '../api'
import type {HardwareScope,PrintSource,PrintOptions,PrintJob,PrintRoute} from './types'
export async function printRequest<T>(scope:HardwareScope,path:string,options:RequestInit={}):Promise<T>{
 assertHardwareScope(scope,options.signal||undefined)
 const data=await apiFetch<T>(`/settings/hardware${path}`,{...options,headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}})
 assertHardwareScope(scope,options.signal||undefined);return data
}
const post=(body:unknown,signal?:AbortSignal)=>({method:'POST',body:JSON.stringify(body),signal})
export const operationalWorkstation=(scope:HardwareScope,query:Record<string,string>,signal?:AbortSignal)=>printRequest<PrintRoute|null>(scope,`/operations/workstation?${new URLSearchParams(query)}`,{signal})
export const createPrintJob=(scope:HardwareScope,source:PrintSource,options:PrintOptions,signal?:AbortSignal)=>printRequest<PrintJob>(scope,'/operations/print-jobs',post({requestKey:crypto.randomUUID(),source,document:'MAIN',...options},signal))
export const printDocument=(scope:HardwareScope,id:string,signal?:AbortSignal)=>printRequest<unknown>(scope,`/operations/print-jobs/${encodeURIComponent(id)}/document`,{signal})
export const printEvent=(scope:HardwareScope,id:string,event:string,errorCode?:string,signal?:AbortSignal)=>printRequest<PrintJob>(scope,`/operations/print-jobs/${encodeURIComponent(id)}/events`,post({requestKey:crypto.randomUUID(),event,...(errorCode?{errorCode}:{})},signal))
export const reprintJob=(scope:HardwareScope,id:string,reason:string,pdfOnly=false,signal?:AbortSignal)=>printRequest<PrintJob>(scope,`/operations/print-jobs/${encodeURIComponent(id)}/reprints`,post({requestKey:crypto.randomUUID(),reason,pdfOnly},signal))
export async function printJobLogo(scope:HardwareScope,id:string):Promise<string|undefined>{
 const session=authSessionIdentity(),check=()=>{assertHardwareScope(scope);if(authSessionIdentity()!==session)throw new DOMException('Cambió la sesión','AbortError')}
 check()
 const response=await fetch(`${getApiBaseUrl()}/settings/hardware/operations/print-jobs/${encodeURIComponent(id)}/logo`,{credentials:'include',headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}})
 check();if(response.status===404)return undefined;if(!response.ok)throw new ApiError('No se pudo obtener el logo original',response.status)
 const blob=await response.blob();check()
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('No se pudo leer el logo original'));reader.readAsDataURL(blob)})
 check();return data
}
