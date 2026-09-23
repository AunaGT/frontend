import jsPDF from 'jspdf'
import autoTable, { type jsPDFDocument } from 'jspdf-autotable'
import type { Transfer } from '@/services/tenantService'
import { addJsPdfCompanyHeader } from '@/utils/pdfBranding'

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
  doc.text(`Folio: ${transfer.reference}`, 15, y)
  doc.text(`Estado: ${STATUS[transfer.status]}`, 110, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.text(`Fecha: ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(transfer.sent_at))}`, 15, y)
  y += 7
  doc.text(`Origen: ${transfer.fromBranch?.name ?? '—'}`, 15, y)
  doc.text(`Destino: ${transfer.toBranch?.name ?? '—'}`, 110, y)
  y += 10

  autoTable(doc, {
    startY: y,
    head: [['Producto', 'Código', 'Enviado', 'Recibido']],
    body: transfer.lines.map((line) => [
      line.product?.name ?? line.product_id,
      line.product?.barcode ?? '—',
      String(line.qty_sent),
      line.qty_received == null ? '—' : String(line.qty_received),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [255, 107, 0], textColor: 255 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
  })

  if (transfer.notes) {
    const notesY = doc.lastAutoTable.finalY + 10
    doc.setFont('helvetica', 'bold')
    doc.text('Notas:', 15, notesY)
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(transfer.notes, 170), 15, notesY + 6)
  }

  doc.save(`traslado-${transfer.reference}.pdf`)
}
