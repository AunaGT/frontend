import {apiFetch,getApiBaseUrl,getActiveCompanyId,getActiveBranchId,ApiError} from '@/services/api'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import type {TemplateScope,Design,TemplateRow,Schema,Artifact,Appearance} from './types'
export function assertTemplateScope(scope:TemplateScope,signal?:AbortSignal){
  if(signal?.aborted||!scope.companyId||!scope.userId||getActiveCompanyId()!==scope.companyId||(scope.branchId||null)!==(getActiveBranchId()||null)||authSessionIdentity()!==scope.sessionId||!authSessionMatches(scope.userId))throw new DOMException('Cambió la empresa o sesión','AbortError')
}
export async function templateRequest<T>(scope:TemplateScope,path:string,options:RequestInit={}):Promise<T>{
  assertTemplateScope(scope,options.signal||undefined)
  const result=await apiFetch<T>(`/settings/document-templates${path}`,{...options,headers:{'X-Company-Id':scope.companyId,...(scope.branchId?{'X-Branch-Id':scope.branchId}:{})}})
  assertTemplateScope(scope,options.signal||undefined);return result
}
const write=(body:unknown,method='POST',signal?:AbortSignal)=>({method,body:JSON.stringify(body),signal})
export const templateSchema=(scope:TemplateScope,signal?:AbortSignal)=>templateRequest<Schema>(scope,'/schema',{signal})
export const listTemplates=(scope:TemplateScope,page=1,pageSize=25,status='ACTIVE',signal?:AbortSignal)=>templateRequest<{rows:TemplateRow[];total:number}>(scope,`?page=${page}&pageSize=${pageSize}&status=${status}`,{signal})
export const getTemplate=(scope:TemplateScope,id:string,signal?:AbortSignal)=>templateRequest<TemplateRow>(scope,`/${encodeURIComponent(id)}`,{signal})
export async function exportTemplateXml(scope:TemplateScope,id:string,signal?:AbortSignal){
  assertTemplateScope(scope,signal)
  const response=await fetch(`${getApiBaseUrl()}/settings/document-templates/${encodeURIComponent(id)}/export`,{credentials:'include',cache:'no-store',signal,headers:{'X-Company-Id':scope.companyId,...(scope.branchId?{'X-Branch-Id':scope.branchId}:{})}})
  assertTemplateScope(scope,signal)
  if(!response.ok)throw new ApiError('No se pudo exportar el diseño',response.status)
  const mime=response.headers.get('Content-Type')?.split(';')[0].trim()
  if(!['application/xml','text/xml'].includes(mime||''))throw new Error('El servidor no devolvió XML de diseño')
  const source=await response.text();assertTemplateScope(scope,signal)
  if(new TextEncoder().encode(source).length>262144)throw new Error('El XML supera 256 KiB')
  return source
}
export const compileTemplate=(scope:TemplateScope,input:{design:Design}|{source:string},signal?:AbortSignal)=>templateRequest<{design:Design;source:string}>(scope,'/compile',write(input,'POST',signal))
export const saveTemplate=(scope:TemplateScope,input:{id?:string;name:string;design:Design;expectedVersion:number;requestKey:string},signal?:AbortSignal)=>{const {id,...body}=input;return templateRequest<TemplateRow>(scope,id?`/${encodeURIComponent(id)}`:'',write(body,id?'PUT':'POST',signal))}
export const duplicateTemplate=(scope:TemplateScope,input:{baseId?:string;templateId?:string;format?:string;name:string},signal?:AbortSignal)=>templateRequest<TemplateRow>(scope,'/duplicate',write({...input,requestKey:crypto.randomUUID()},'POST',signal))
export const templateAction=(scope:TemplateScope,id:string,action:'reset'|'archive'|'publish',input:Record<string,unknown>,signal?:AbortSignal)=>templateRequest<TemplateRow>(scope,`/${encodeURIComponent(id)}/${action}`,write({...input,requestKey:crypto.randomUUID()},'POST',signal))
export const readAppearance=(scope:TemplateScope,signal?:AbortSignal)=>templateRequest<{values:Appearance;revision:number}>(scope,'/appearance',{signal})
export const saveAppearance=(scope:TemplateScope,values:Appearance,expectedRevision:number,signal?:AbortSignal)=>templateRequest<{values:Appearance;revision:number}>(scope,'/appearance',write({values,expectedRevision,requestKey:crypto.randomUUID()},'PUT',signal))
export const startPreview=(scope:TemplateScope,input:Record<string,unknown>,signal?:AbortSignal)=>templateRequest<Artifact>(scope,'/preview-jobs',write({...input,requestKey:crypto.randomUUID()},'POST',signal))
export const previewStatus=(scope:TemplateScope,id:string,signal?:AbortSignal)=>templateRequest<Artifact>(scope,`/preview-jobs/${encodeURIComponent(id)}`,{signal})
export async function documentBlob(scope:TemplateScope,path:string,signal?:AbortSignal):Promise<Blob>{
  assertTemplateScope(scope,signal)
  const response=await fetch(`${getApiBaseUrl()}${path}`,{credentials:'include',cache:'no-store',signal,headers:{'X-Company-Id':scope.companyId,...(scope.branchId?{'X-Branch-Id':scope.branchId}:{})}})
  assertTemplateScope(scope,signal)
  if(!response.ok)throw new ApiError('No se pudo descargar el documento',response.status)
  const blob=await response.blob();assertTemplateScope(scope,signal)
  if(blob.size>33554432||blob.type!=='application/pdf')throw new Error('El servidor no devolvió un PDF válido')
  return blob
}
export const previewBlob=(scope:TemplateScope,id:string,signal?:AbortSignal)=>documentBlob(scope,`/settings/document-templates/preview-jobs/${encodeURIComponent(id)}/file`,signal)
export async function waitPreview(scope:TemplateScope,artifact:Artifact,signal?:AbortSignal):Promise<Artifact>{
  for(let i=0;i<120;i++){
    assertTemplateScope(scope,signal)
    if(artifact.state==='READY')return artifact
    if(artifact.state==='FAILED')throw new Error(`No se pudo generar la muestra (${artifact.errorCode||'error de documento'}). Revisa el diseño y vuelve a probar.`)
    await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelado','AbortError'))};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},1000);signal?.addEventListener('abort',abort,{once:true})})
    artifact=await previewStatus(scope,artifact.id,signal)
  }
  throw new Error('El documento sigue pendiente. Comprueba que el proceso de documentos esté iniciado; puedes volver a intentarlo.')
}
export async function uploadTemplateImage(scope:TemplateScope,input:{versionId:string;expectedVersion:number;slot:string;file:File},signal?:AbortSignal){
  const body=new FormData();body.set('versionId',input.versionId);body.set('expectedVersion',String(input.expectedVersion));body.set('slot',input.slot);body.set('image',input.file)
  assertTemplateScope(scope,signal)
  const response=await fetch(`${getApiBaseUrl()}/settings/document-templates/assets`,{method:'POST',credentials:'include',body,signal,headers:{'X-Company-Id':scope.companyId,...(scope.branchId?{'X-Branch-Id':scope.branchId}:{})}})
  assertTemplateScope(scope,signal)
  const result=await response.json();assertTemplateScope(scope,signal)
  if(!response.ok)throw new ApiError(result.message||'No se pudo cargar la imagen',response.status,result)
  return result as {id:string;version:number}
}
