import jsPDF from 'jspdf'
import autoTable, { type jsPDFDocument } from 'jspdf-autotable'
import type { Transfer } from '@/services/tenantService'
import { addJsPdfCompanyHeader, addDocumentFooter, addDocumentText, documentTableStyles, ensureDocumentSpace } from '@/utils/pdfBranding'

const STATUS = {
  EN_TRANSITO: 'En tránsito',
  RECIBIDA: 'Completada',
  CANCELADA: 'Cancelada',
} as const

export const generateTransferPDF = (
  transfer: Transfer,
  options: { companyName?: string; logoDataUrl?: string; locale?: string } = {},
) => {
  const doc = new jsPDF() as jsPDFDocument
  const pageWidth = doc.internal.pageSize.getWidth()
  const locale = options.locale ?? 'es-GT'
  let y = addJsPdfCompanyHeader(doc, {
    companyName: options.companyName,
    logoDataUrl: options.logoDataUrl,
    pageWidth,
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('COMPROBANTE DE TRASLADO', pageWidth / 2, y, { align: 'center' })
  y += 12

  doc.setFontSize(10)
  y = addDocumentText(doc, `Folio: ${transfer.reference}`, 18, y, pageWidth - 36) + 2
  y = addDocumentText(doc, `Estado: ${STATUS[transfer.status]}`, 18, y, pageWidth - 36) + 2
  doc.setFont('helvetica', 'normal')
  for (const text of [
    `Fecha: ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(transfer.sent_at))}`,
    `Origen: ${transfer.fromBranch?.name ?? '—'}`,
    `Destino: ${transfer.toBranch?.name ?? '—'}`,
  ]) y = addDocumentText(doc, text, 18, y, pageWidth - 36) + 2
  y += 4

  autoTable(doc, {
    startY: ensureDocumentSpace(doc, y, 18),
    head: [['Producto', 'Código', 'Enviado', 'Recibido']],
    body: transfer.lines.map((line) => [
      line.product?.name ?? line.product_id,
      line.product?.barcode ?? '—',
      String(line.qty_sent),
      line.qty_received == null ? '—' : String(line.qty_received),
    ]),
    theme: 'grid',
    ...documentTableStyles,
    margin: { left: 18, right: 18, top: 20, bottom: 20 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
  })

  if (transfer.notes) {
    const notesY = ensureDocumentSpace(doc, doc.lastAutoTable.finalY + 10, 12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Notas:', 18, notesY)
    doc.setFont('helvetica', 'normal')
    addDocumentText(doc, transfer.notes, 18, notesY + 6, pageWidth - 36)
  }

  addDocumentFooter(doc, `Folio: ${transfer.reference}`)
  doc.save(`traslado-${transfer.reference}.pdf`)
}
