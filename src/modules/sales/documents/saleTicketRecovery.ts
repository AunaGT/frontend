import type {SaleTicketOptions} from './generateSaleTicket'
import {authSessionIdentity} from '@/services/authSession'
import type {HardwareScope,PrintOptions} from '@/modules/config/hardware/public'
import {downloadReportBlob} from '@/modules/reports/documents/reportDownload'

export async function downloadSavedSaleTicket(saleId:string,_options:SaleTicketOptions & {logoUrl?:string},isCurrent:()=>boolean=()=>true,_request?:RequestInit,tracking?:{scope:HardwareScope;options?:PrintOptions;notice?:(message:string)=>void}):Promise<void>{
  const started=import.meta.env.DEV&&import.meta.env.VITE_PERFORMANCE_TIMING==='true'&&typeof performance!=='undefined'?performance.now():undefined
  try{
  const session=authSessionIdentity()
  const check=()=>{if(!isCurrent()||authSessionIdentity()!==session)throw new DOMException('Cambió la sesión o sucursal','AbortError')}
  check()
  if(!tracking)throw new Error('Selecciona una empresa y sucursal para preparar el ticket.')
  if(tracking){
    const {createPrintJobWithDocument,requestPreparedDownload,printEvent,mayUseUntrackedPdf}=await import('@/modules/config/hardware/public');check()
    let prepared
    try{prepared=await createPrintJobWithDocument(tracking.scope,{kind:'SALE_TICKET',id:saleId},tracking.options||{});check()}
    catch(error){check();throw error}
    if(prepared){
      const {job,document:snapshot}=prepared
      let rendered
      try{
        const {renderPrintSource}=await import('@/services/printRenderers');check()
        rendered=await renderPrintSource(snapshot,'MAIN',{allowMissingLogo:true,notice:tracking.notice});check()
      }catch(error){check();if((error as Error).name!=='AbortError'&&mayUseUntrackedPdf(error))await printEvent(tracking.scope,job.id,'FAILED','RENDER_FAILED').catch(()=>{});throw error}
      try{await requestPreparedDownload(tracking.scope,job.id,{preparedRequestKey:crypto.randomUUID(),downloadRequestKey:crypto.randomUUID()});check()}
      catch(error){check();if((error as Error).name==='AbortError'||!mayUseUntrackedPdf(error))throw error;tracking.notice?.('Ticket disponible. No se pudo registrar el seguimiento de la descarga; la venta sigue guardada.')}
      check();downloadReportBlob(rendered.blob,rendered.filename);return
    }
  }
  throw new Error('No se pudo preparar el documento de esta venta. Vuelve a intentarlo; no es necesario cobrar otra vez.')
  }finally{if(started!==undefined)console.debug('[performance]',{phase:'ticket_document',durationMs:performance.now()-started})}
}
