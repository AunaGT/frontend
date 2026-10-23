import {useEffect,useRef,useState} from 'react'
import {saleDocumentScope,assertSaleDocumentScope,requestSaleDocument,waitSaleDocument,saleDocumentFile,retrySaleDocument,type HardwareScope} from '@/modules/config/hardware/public'
import {authSessionIdentity} from '@/services/authSession'
import {downloadReportBlob} from '@/modules/reports/documents/reportDownload'
type Format='LETTER'|'A4'|'RECEIPT_80'
type Saved={id:string;snapshotId?:string;state:string;format:Format;filename?:string}
export function useSaleDocument({scope,saleId,format}:{scope:HardwareScope;saleId:string;format?:Format}){
  const [,refresh]=useState(0)
  const session=authSessionIdentity(),key=JSON.stringify([scope,saleId,format,session]),live=useRef({key,active:true,controller:new AbortController(),busy:false})
  if(live.current.key!==key){live.current.active=false;live.current.controller.abort();live.current={key,active:true,controller:new AbortController(),busy:false}}
  const owner=live.current,current=()=>owner.active&&owner===live.current&&!owner.controller.signal.aborted&&authSessionIdentity()===session
  const [state,setState]=useState<{owner:typeof owner;pdf:Blob|null;artifact:Saved|null;pending:boolean;error:string;legacy:boolean;fallback:boolean}>({owner,pdf:null,artifact:null,pending:false,error:'',legacy:false,fallback:false})
  const visible=state.owner===owner?state:{owner,pdf:null,artifact:null,pending:false,error:'',legacy:false,fallback:false}
  const update=(patch:Partial<typeof state>)=>{if(current())setState(old=>({...old.owner===owner?old:{owner,pdf:null,artifact:null,pending:false,error:'',legacy:false,fallback:false},...patch,owner}))}
  useEffect(()=>{owner.active=true;return()=>{owner.active=false;owner.controller.abort()}},[key])
  useEffect(()=>{
    if(typeof window==='undefined')return
    const changed=()=>{if(authSessionIdentity()!==session){owner.active=false;owner.controller.abort();refresh(n=>n+1)}}
    window.addEventListener('storage',changed);window.addEventListener('auth:unauthorized',changed)
    return()=>{window.removeEventListener('storage',changed);window.removeEventListener('auth:unauthorized',changed)}
  },[key])
  async function prepare({retry=false,useBase=false}:{retry?:boolean;useBase?:boolean}={}){
    if(!current()||owner.busy||!saleId)return null
    owner.busy=true;update({pending:true,error:'',legacy:false,pdf:null})
    const captured=saleDocumentScope(scope),signal=owner.controller.signal
    try{
      const artifact=retry&&visible.artifact?.state==='FAILED'?await retrySaleDocument(captured,saleId,visible.artifact.id,signal):await requestSaleDocument(captured,saleId,format,signal,useBase)
      update({artifact})
      const ready=await waitSaleDocument(captured,saleId,artifact,signal),pdf=await saleDocumentFile(captured,saleId,ready.id,signal)
      if(!current())return null;update({artifact:ready,pdf,fallback:useBase});return {kind:'V2' as const,pdf}
    }catch(error){
      if(!current())return null
      const e=error as Error&{code?:string;data?:{code?:string};artifactId?:string},code=e.code||e.data?.code
      if(e.name!=='AbortError')update({error:e.message,...(e.artifactId&&code==='DOCUMENT_RENDER_FAILED'?{artifact:{id:e.artifactId,state:'FAILED',format:format||'LETTER'}}:{})})
      return null
    }finally{owner.busy=false;update({pending:false})}
  }
  function download(){if(current()&&visible.pdf&&authSessionIdentity()===session){try{assertSaleDocumentScope({...scope,userId:scope.userId||'',sessionId:session});downloadReportBlob(visible.pdf,visible.artifact?.filename||'comprobante-interno.pdf')}catch{/* Old context must never trigger a download. */}}}
  return {...visible,prepare,download,canAccess:current}
}
