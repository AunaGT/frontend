import {printJobLogo} from '@/modules/config/hardware/public'
import type {Sale} from './saleService'
import type {SaleTicketOptions} from '@/modules/sales/documents/generateSaleTicket'
import type {PreparedLabels} from '@/modules/inventory/barcodeLabels/types'
export async function renderPrintSource(raw:unknown,document:'MAIN'|'GUIDE'){
 const snapshot=raw as {version:number;renderer:string;sale?:Sale;options?:SaleTicketOptions&{logoUrl?:string};prepared?:PreparedLabels;branding?:{jobId:string;companyId:string;branchId:string}}
 if(snapshot.version!==1)throw Error('Esta versión del documento necesita un generador compatible')
 if(snapshot.renderer==='SALE_TICKET_V1'&&snapshot.sale&&document==='MAIN'){
  const {buildSaleTicketPdf}=await import('@/modules/sales/documents/generateSaleTicket')
  const logoDataUrl=snapshot.options?.logoUrl&&snapshot.branding?await printJobLogo(snapshot.branding,snapshot.branding.jobId):undefined
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
