import {apiFetch,getActiveCompanyId,getActiveBranchId} from '@/services/api'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import type {PackageScope,CommercialPackage,PackageDefinition,PackageSummary,PackageSelection,PackageGroup,PackageIssue} from './types'
export function assertPackageScope(scope:PackageScope,signal?:AbortSignal){
 if(signal?.aborted||getActiveCompanyId()!==scope.companyId||getActiveBranchId()!==scope.branchId||authSessionIdentity()!==scope.sessionId||!authSessionMatches(scope.userId))throw new DOMException('Cambió la empresa o sesión','AbortError')
}
export async function packageRequest<T>(scope:PackageScope,path:string,options:RequestInit={}):Promise<T>{
 assertPackageScope(scope,options.signal||undefined)
 try{
  const result=await apiFetch<T>(path,{...options,cache:'no-store',retryUnauthorized:false,headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}})
  assertPackageScope(scope,options.signal||undefined);return result
 }catch(error){assertPackageScope(scope,options.signal||undefined);throw error}
}
const base='/api/commercial-packages'
export const packageQueryKey=(scope:PackageScope)=>['commercial-packages',scope.companyId,scope.branchId,scope.userId,scope.sessionId]
export const fetchPackages=(s:PackageScope,query:{q?:string;cursor?:string;includeArchived?:boolean;activeOnly?:boolean}={},signal?:AbortSignal)=>packageRequest<{items:PackageSummary[];nextCursor:string|null}>(s,base+'?'+new URLSearchParams({limit:'25',...Object.fromEntries(Object.entries(query).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)]))}),{signal})
export const fetchPackage=(s:PackageScope,id:string,signal?:AbortSignal)=>packageRequest<CommercialPackage>(s,base+'/'+encodeURIComponent(id),{signal})
export const savePackage=(s:PackageScope,id:string|null,input:{expectedVersion:number;definition:PackageDefinition;branchIds:string[];idempotencyKey:string},signal?:AbortSignal)=>packageRequest<PackageSummary>(s,base+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:JSON.stringify(input),signal})
export const activatePackage=(s:PackageScope,id:string,expectedVersion:number,idempotencyKey:string,signal?:AbortSignal)=>packageRequest<PackageSummary>(s,base+'/'+encodeURIComponent(id)+'/activate',{method:'POST',body:JSON.stringify({expectedVersion,idempotencyKey}),signal})
export const archivePackage=(s:PackageScope,id:string,expectedVersion:number,idempotencyKey:string,signal?:AbortSignal)=>packageRequest<PackageSummary>(s,base+'/'+encodeURIComponent(id)+'/archive',{method:'POST',body:JSON.stringify({expectedVersion,idempotencyKey}),signal})
export const previewPackages=(s:PackageScope,packages:PackageSelection[],signal?:AbortSignal)=>packageRequest<{packageGroups:PackageGroup[];items:unknown[];subtotal:string;issues:PackageIssue[]}>(s,'/api/quotes/package-preview',{method:'POST',body:JSON.stringify({packages}),signal})
export function packageError(error:unknown){const e=error as {data?:{message?:string;fields?:Record<string,string>};message?:string};return e.data?.message||e.message||'No se pudo completar la operación'}
