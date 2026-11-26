import jsPDF from 'jspdf'
import autoTable, { type jsPDFDocument } from 'jspdf-autotable'
import { addJsPdfCompanyHeader, addDocumentFooter, addDocumentText, documentTableStyles, ensureDocumentSpace } from '@/utils/pdfBranding'
import { disputeStatus, disputeEventLabel, type DisputeDocument } from '@/services/cashDisputeService'

export type DisputePdfOptions = { companyName?: string; logoDataUrl?: string; locale?: string; timezone?: string }
const MONEY_KINDS = ['BANK_DEBIT', 'PROVIDER_WITHHOLDING', 'LEGACY_WITHHOLDING', 'BANK_RECOVERY', 'PROVIDER_RECOVERY', 'COMPENSATION']
const ACCOUNTING: Record<string, string> = { DEFERRED: 'Pendiente de contabilizar', POSTED: 'Contabilizado', INTEGRATED: 'En el asiento de la liquidación', ZERO: '—' }
const PROPOSAL: Record<string, string> = { SUBMIT: 'Presentar respuesta', RESULT: 'Resultado del proveedor', CANCEL: 'Cancelar expediente', REOPEN: 'Reabrir', DISPOSITION: 'Resolución de la pérdida', FORGIVE: 'Condonación de cargo', CORRECT: 'Corrección', COMPENSATE: 'Compensación' }
const DECISION: Record<string, string> = { PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada', CANCELLED: 'Cancelada' }

/** Expediente interno de una disputa: no es factura, comprobante fiscal ni constancia bancaria. */
export function buildDisputePdf(d: DisputeDocument, o: DisputePdfOptions = {}) {
  const locale = o.locale || 'es-GT', timezone = o.timezone || 'America/Guatemala'
  const money = (v: string | number) => new Intl.NumberFormat(locale, { style: 'currency', currency: d.currencyCode || 'GTQ' }).format(Number(v) || 0)
  const civil = (v: string | null) => v ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(v.slice(0, 10) + 'T00:00:00Z')) : '—'
  const moment = (v: string | null) => v ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(v)) : '—'
  const doc = new jsPDF() as jsPDFDocument, pageWidth = doc.internal.pageSize.getWidth(), margin = 15
  let y = addJsPdfCompanyHeader(doc, { companyName: o.companyName, logoDataUrl: o.logoDataUrl, pageWidth, startY: 18 })
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text('EXPEDIENTE DE DISPUTA', pageWidth / 2, y, { align: 'center' }); y += 7
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
  y = addDocumentText(doc, 'Documento interno de seguimiento. No es una factura ni un comprobante fiscal, y no constituye verificación automática con el banco.', margin, y, pageWidth - 2 * margin) + 6
  doc.setTextColor(0, 0, 0)
  const table = (head: string[], body: (string | number)[][], rightColumns: number[] = [], space = 30) => {
    autoTable(doc, { ...documentTableStyles, startY: y, head: [head], body, theme: 'striped', margin: { left: margin, right: margin, top: 20, bottom: 20 },
      columnStyles: Object.fromEntries(rightColumns.map(i => [i, { halign: 'right' as const }])) })
    y = ensureDocumentSpace(doc, (doc.lastAutoTable?.finalY ?? y) + 8, space)
  }
  table(['Dato', 'Valor'], [['Referencia del proveedor', d.providerReference], ['Estado', disputeStatus[d.status]], ['Cliente', d.customerName || 'Sin cliente identificado'],
    ['Registrado por', `${d.createdByName} · ${moment(d.createdAt)}`], ['Plazo de respuesta', civil(d.deadline)], ['Motivo', d.reason]])
  table(['Importe', 'Valor'], [['Principal reclamado', money(d.claimed)], ['Ganado', money(d.won)], ['Perdido', money(d.lost)], ['Retirado por el proveedor', money(d.withdrawn)],
    ['Recuperado', money(d.recovered)], ['Comisiones', money(d.fees)], ['Pérdida resuelta', money(d.disposed)], ['Cargo al cliente', money(d.charged)],
    ['Crédito al cliente', money(d.customerCredit)], ['Pendiente de resolver', money(d.unresolved)]], [1])
  const movements = d.history.filter(e => MONEY_KINDS.includes(e.kind))
  table(['Fecha efectiva', 'Movimiento', 'Principal', 'Comisión', 'Referencia', 'Registrado por', 'Contabilidad'],
    movements.length ? movements.map(e => [civil(e.economic_on), disputeEventLabel[e.kind] || e.kind, money(e.principal), money(e.fee), e.reference || '—', e.actor_name, ACCOUNTING[e.accounting_status] || e.accounting_status])
      : [['Sin movimientos de dinero registrados', '', '', '', '', '', '']], [2, 3])
  table(['Acción', 'Estado', 'Propuesta', 'Decisión', 'Motivo'],
    d.proposals.length ? d.proposals.map(p => [PROPOSAL[p.kind] || p.kind, DECISION[p.status] || p.status, `${p.proposed_by_name} · ${moment(p.proposed_at)}`,
      p.decided_by_name ? `${p.decided_by_name} · ${moment(p.decided_at)}` : '—', p.decision_reason || p.payload?.reason || '—'])
      : [['Sin propuestas registradas', '', '', '', '']], [], 9)
  doc.setFontSize(8); doc.setTextColor(100, 100, 100)
  addDocumentText(doc, 'Reclamado, retirado, recuperado, pérdida, cargo y crédito son importes distintos y no se suman entre sí. «Ganada» indica la decisión del proveedor, no que el dinero haya regresado.', margin, y, pageWidth - 2 * margin)
  addDocumentFooter(doc, 'Expediente de disputa')
  return doc
}
export function downloadDisputePdf(d: DisputeDocument, o: DisputePdfOptions = {}) {
  buildDisputePdf(d, o).save(`disputa-${d.providerReference.replace(/[^\w-]+/g, '-').toLowerCase()}.pdf`)
}
