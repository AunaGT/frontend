import {apiFetch} from '@/services/api'
import {authSessionIdentity} from '@/services/authSession'
import {assertTemplateScope,documentBlob} from '../../documentTemplates/api'
import type {TemplateScope,Artifact,PaperFormat} from '../../documentTemplates/types'
import type {HardwareScope} from './types'
export {assertTemplateScope as assertSaleDocumentScope}
export const saleDocumentScope=(scope:HardwareScope):TemplateScope=>({...scope,userId:scope.userId||'',sessionId:authSessionIdentity()})
async function request<T>(scope:TemplateScope,path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
  assertTemplateScope(scope,signal)
  const result=await apiFetch<T>(path,{signal,...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId||''}})
  assertTemplateScope(scope,signal);return result
}
export const requestSaleDocument=(scope:TemplateScope,saleId:string,format:PaperFormat|undefined,signal?:AbortSignal,useBase=false)=>request<Artifact>(scope,`/sales/${encodeURIComponent(saleId)}/documents`,{...(format?{format}:{}),useBase,requestKey:crypto.randomUUID()},signal)
export const saleDocumentStatus=(scope:TemplateScope,saleId:string,artifactId:string,signal?:AbortSignal)=>request<Artifact>(scope,`/sales/${encodeURIComponent(saleId)}/documents/${encodeURIComponent(artifactId)}`,undefined,signal)
export const retrySaleDocument=(scope:TemplateScope,saleId:string,artifactId:string,signal?:AbortSignal)=>request<Artifact>(scope,`/sales/${encodeURIComponent(saleId)}/documents/${encodeURIComponent(artifactId)}/retry`,{requestKey:crypto.randomUUID()},signal)
export const saleDocumentFile=(scope:TemplateScope,saleId:string,artifactId:string,signal?:AbortSignal)=>documentBlob(scope,`/sales/${encodeURIComponent(saleId)}/documents/${encodeURIComponent(artifactId)}/file`,signal)
export async function waitSaleDocument(scope:TemplateScope,saleId:string,initial:Artifact,signal?:AbortSignal){
  let artifact=initial
  for(let i=0;i<120;i++){
    assertTemplateScope(scope,signal)
    if(artifact.state==='READY')return artifact
    if(artifact.state==='FAILED')throw Object.assign(new Error(`El documento no se pudo generar (${artifact.errorCode||'error de diseño'}). La venta sigue registrada; reintenta solo el documento.`),{status:409,code:'DOCUMENT_RENDER_FAILED',artifactId:artifact.id})
    await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelado','AbortError'))};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},1000);signal?.addEventListener('abort',abort,{once:true})})
    artifact=await saleDocumentStatus(scope,saleId,artifact.id,signal)
  }
  throw Object.assign(new Error('El documento sigue en preparación. Comprueba el proceso de documentos y vuelve a consultar; no repitas el cobro.'),{status:409,code:'DOCUMENT_PENDING',artifactId:artifact.id})
}
export async function preparedSaleDocument(scope:HardwareScope,source:{saleId:string;artifactId:string},signal?:AbortSignal){
  const captured=saleDocumentScope(scope)
  let artifact=await saleDocumentStatus(captured,source.saleId,source.artifactId,signal)
  if(artifact.state==='FAILED')artifact=await retrySaleDocument(captured,source.saleId,source.artifactId,signal)
  const ready=await waitSaleDocument(captured,source.saleId,artifact,signal)
  return {blob:await saleDocumentFile(captured,source.saleId,ready.id,signal),filename:ready.filename||'comprobante-interno.pdf'}
}
