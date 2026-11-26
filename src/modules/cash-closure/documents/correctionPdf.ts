import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {addJsPdfCompanyHeader,addDocumentFooter,addDocumentText,documentTableStyles,ensureDocumentSpace} from '@/utils/pdfBranding'
import {correctionStatus,correctionAccountingStatus,type CorrectionDocument} from '@/services/cashCorrectionService'
import {formatCurrency,civilDate,formatZonedDateTime} from '../types'
export async function downloadCorrectionPdf(c:CorrectionDocument,companyName:string,locale:string,timezone:string){
  const doc=new jsPDF(),margin=15,width=180,fmt=(v:string)=>formatCurrency(v,c.currency,locale)
  let y=addJsPdfCompanyHeader(doc,{companyName,pageWidth:210,startY:18})
  doc.setFontSize(15);doc.text(`Corrección de arqueo #${c.closureNumber}`,margin,y);y+=8
  doc.setFontSize(10)
  for(const line of [`Documento ${c.id}`,`${correctionStatus[c.status]} · ${correctionAccountingStatus[c.accountingStatus]}`,`Propuesta: ${c.proposedByName} · ${formatZonedDateTime(c.proposedAt,timezone,locale)}`,`Fecha contable: ${civilDate(c.accountingDate,locale)}`,`Motivo: ${c.reason}`])y=addDocumentText(doc,line,margin,y,width)+3
  autoTable(doc,{startY:y,head:[['Medio','Esperado original','Anterior','Correcto','Cambio']],body:c.lines.map(l=>[l.name,fmt(l.originalExpected),fmt(l.previousActual),fmt(l.correctedActual||l.previousActual),fmt(l.delta||'0')]),...documentTableStyles,margin:{left:margin,right:margin}})
  y=(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+9
  for(const line of [`Diferencia corregida: ${fmt(c.correctedDifference)}`,`Cambio en efectivo: ${fmt(c.cashDelta)}`,...(c.decidedByName?[`Decisión: ${c.decidedByName} · ${c.decidedAt?formatZonedDateTime(c.decidedAt,timezone,locale):''}`,`Motivo de decisión: ${c.decisionReason||'Sin observaciones'}`]:[]),...(c.selfReview?['Autorrevisión mediante excepción explícita del dueño.']:[]),...(c.entryNumber?[`Asiento: ${c.entryNumber}`]:[]),'El arqueo original se conserva. Este documento no registra dinero físico ni modifica entregas o liquidaciones.']){
    y=ensureDocumentSpace(doc,y,20);y=addDocumentText(doc,line,margin,y,width)+3
  }
  addDocumentFooter(doc,`Arqueo #${c.closureNumber} · Corrección ${c.sequence||'pendiente'}`)
  doc.save(`correccion-arqueo-${c.closureNumber}-${c.id.slice(0,8)}.pdf`)
}
