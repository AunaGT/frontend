import jsPDF from 'jspdf'
import autoTable, { type jsPDFDocument } from 'jspdf-autotable'
import type { Order } from '@/services/orderService'
import { addJsPdfCompanyHeader, addDocumentFooter, addDocumentText, documentTableStyles, ensureDocumentSpace, PDF_DOCUMENT_COLORS } from '@/utils/pdfBranding'

export function generateOrderPDF(order: Order, options: {
  companyName?: string
  logoDataUrl?: string
  locale?: string
  currencyCode?: string
} = {}) {
  const doc = new jsPDF() as jsPDFDocument
  const locale = options.locale ?? 'es-GT'
  const currencyCode = options.currencyCode ?? 'GTQ'
  const money = (value: number | string | null | undefined) => new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(Number(value ?? 0))
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = addJsPdfCompanyHeader(doc, { companyName: options.companyName, logoDataUrl: options.logoDataUrl, pageWidth })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('PEDIDO', pageWidth / 2, y, { align: 'center' })
  y += 10
  doc.setFontSize(11)
  doc.text(order.reference ?? order.id, pageWidth / 2, y, { align: 'center' })
  y += 12

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  for (const text of [
    `Cliente: ${order.customer || order.customerContact?.name || '—'}`,
    `Fecha: ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(order.created_at))}`,
    `Sucursal: ${order.branch?.name ?? '—'}`,
    `NIT: ${order.customer_nit || order.customerContact?.tax_id || '—'}`,
  ]) y = addDocumentText(doc, text, 18, y, pageWidth - 36) + 2
  y += 4

  autoTable(doc, {
    startY: ensureDocumentSpace(doc, y, 18),
    head: [['Código', 'Producto', 'Cantidad', 'Entregado', 'Precio', 'Importe']],
    body: order.lines.map((line) => [
      line.product?.barcode ?? '—',
      line.item_name ?? line.product?.name ?? line.product_id,
      `${line.qty} ${line.unit_label || ''}`.trim(),
      `${line.qty_fulfilled ?? 0} ${line.unit_label || ''}`.trim(),
      money(line.unit_price),
      money(line.line_total),
    ]),
    theme: 'grid',
    ...documentTableStyles,
    margin: { left: 18, right: 18, top: 20, bottom: 20 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  })

  let totalsY = ensureDocumentSpace(doc, doc.lastAutoTable.finalY + 9, Number(order.discount_total ?? 0) > 0 ? 30 : 23)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...PDF_DOCUMENT_COLORS.navy)
  doc.text('Subtotal', 18, totalsY)
  doc.text(money(order.subtotal), pageWidth - 18, totalsY, { align: 'right' })
  if (Number(order.discount_total ?? 0) > 0) {
    totalsY += 7
    doc.text('Descuento', 18, totalsY)
    doc.text(`-${money(order.discount_total)}`, pageWidth - 18, totalsY, { align: 'right' })
  }
  totalsY += 8
  doc.setFillColor(...PDF_DOCUMENT_COLORS.total)
  doc.rect(18, totalsY - 5, pageWidth - 36, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Total', 18, totalsY)
  doc.text(money(order.total), pageWidth - 18, totalsY, { align: 'right' })

  if (order.notes) {
    totalsY += 14
    totalsY = ensureDocumentSpace(doc, totalsY, 12)
    doc.setFontSize(10)
    doc.text('Notas', 18, totalsY)
    doc.setFont('helvetica', 'normal')
    addDocumentText(doc, order.notes, 18, totalsY + 6, pageWidth - 36)
  }

  addDocumentFooter(doc, order.reference ?? order.id)
  doc.save(`pedido-${order.reference ?? order.id}.pdf`)
}
