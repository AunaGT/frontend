import {fetchSaleById} from '@/services/saleService'
import {resolvePdfLogoDataUrl} from '@/utils/pdfBranding'
import {generateSaleTicket,type SaleTicketOptions} from './generateSaleTicket'
import {authSessionIdentity} from '@/services/authSession'
import type {HardwareScope,PrintOptions} from '@/modules/config/hardware/public'
import {downloadReportBlob} from '@/modules/reports/documents/reportDownload'

export async function downloadSavedSaleTicket(saleId:string,options:SaleTicketOptions & {logoUrl?:string},isCurrent:()=>boolean=()=>true,request?:RequestInit,tracking?:{scope:HardwareScope;options?:PrintOptions;notice?:(message:string)=>void}):Promise<void>{
  const session=authSessionIdentity()
  const check=()=>{if(!isCurrent()||authSessionIdentity()!==session)throw new DOMException('Cambió la sesión o sucursal','AbortError')}
  check()
  if(tracking){
    const {createPrintJob,printDocument,printEvent,mayUseUntrackedPdf}=await import('@/modules/config/hardware/public');check()
    let job
    try{job=await createPrintJob(tracking.scope,{kind:'SALE_TICKET',id:saleId},tracking.options||{});check()}
    catch(error){check();if(!mayUseUntrackedPdf(error))throw error;tracking.notice?.('Descarga sin registro de impresión. La venta sigue guardada.')}
    if(job){
      try{
        const snapshot=await printDocument(tracking.scope,job.id);check()
        const {renderPrintSource}=await import('@/services/printRenderers');check()
        const rendered=await renderPrintSource(snapshot,'MAIN');check()
        await printEvent(tracking.scope,job.id,'PREPARED');check()
        await printEvent(tracking.scope,job.id,'DOWNLOAD_REQUESTED');check()
        downloadReportBlob(rendered.blob,rendered.filename);return
      }catch(error){if(isCurrent())await printEvent(tracking.scope,job.id,'FAILED','RENDER_FAILED').catch(()=>{});throw error}
    }
  }
  const sale=await fetchSaleById(saleId,request)
  check()
  const logoDataUrl=await resolvePdfLogoDataUrl(options.logoUrl).catch(()=>undefined)
  check()
  generateSaleTicket(sale,{...options,logoDataUrl})
}
