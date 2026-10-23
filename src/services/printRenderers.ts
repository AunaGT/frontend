import {printJobLogo,mayUseUntrackedPdf,preparedSaleDocument} from '@/modules/config/hardware/public'
import type {Sale} from './saleService'
import type {SaleTicketOptions} from '@/modules/sales/documents/generateSaleTicket'
import type {PreparedLabels} from '@/modules/inventory/barcodeLabels/types'
export async function renderPrintSource(raw:unknown,document:'MAIN'|'GUIDE',options:{allowMissingLogo?:boolean;notice?:(message:string)=>void}={}){
 const snapshot=raw as {version:number;renderer:string;saleId?:string;artifactId?:string;format?:string;sale?:Sale;options?:SaleTicketOptions&{logoUrl?:string};prepared?:PreparedLabels;branding?:{jobId:string;companyId:string;branchId:string;userId?:string}}
 if(snapshot.version===2&&snapshot.renderer==='SALE_DOCUMENT_V2'&&snapshot.saleId&&snapshot.artifactId&&snapshot.branding&&snapshot.format==='RECEIPT_80'&&document==='MAIN')return preparedSaleDocument(snapshot.branding,{saleId:snapshot.saleId,artifactId:snapshot.artifactId})
 if(snapshot.version!==1)throw Error('Esta versión del documento necesita un generador compatible')
 if(snapshot.renderer==='SALE_TICKET_V1'&&snapshot.sale&&document==='MAIN'){
  const {buildSaleTicketPdf}=await import('@/modules/sales/documents/generateSaleTicket')
  let logoDataUrl:string|undefined
  if(typeof snapshot.options?.logoDataUrl==='string'){
   logoDataUrl=snapshot.options.logoDataUrl||undefined
   if(!logoDataUrl&&snapshot.options.logoUrl)options.notice?.('El ticket se descargará sin logo porque no está disponible en este momento.')
  }else if(snapshot.options?.logoUrl&&snapshot.branding){
   try{logoDataUrl=await printJobLogo(snapshot.branding,snapshot.branding.jobId)}
   catch(error){if(!options.allowMissingLogo||(error as Error).name==='AbortError'||!mayUseUntrackedPdf(error))throw error;options.notice?.('El ticket se descargará sin logo porque no está disponible en este momento.')}
  }
  return buildSaleTicketPdf(snapshot.sale,{...snapshot.options,logoDataUrl})
 }
 if(snapshot.renderer==='LABELS_V1'&&snapshot.prepared){
  const {generateBarcodeLabelPdf}=await import('@/modules/inventory/barcodeLabels/labelPdf')
  const result=await generateBarcodeLabelPdf(snapshot.prepared,{separateGuide:true})
  const blob=document==='GUIDE'?result.guide:result.labels
  if(!blob)throw Error('Este documento no tiene guía separada')
  return{blob,filename:document==='GUIDE'?'guia-etiquetas.pdf':'etiquetas.pdf'}
 }
 throw Error('No existe un generador compatible para este documento')
}
