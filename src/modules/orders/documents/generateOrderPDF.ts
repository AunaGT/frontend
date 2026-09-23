import jsPDF from 'jspdf'
import autoTable, { type jsPDFDocument } from 'jspdf-autotable'
import type { Order } from '@/services/orderService'
import { addJsPdfCompanyHeader } from '@/utils/pdfBranding'

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
  doc.text(`Cliente: ${order.customer || order.customerContact?.name || '—'}`, 15, y)
  doc.text(`Fecha: ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(order.created_at))}`, 120, y)
  y += 7
  doc.text(`Sucursal: ${order.branch?.name ?? '—'}`, 15, y)
  doc.text(`NIT: ${order.customer_nit || order.customerContact?.tax_id || '—'}`, 120, y)
  y += 10

  autoTable(doc, {
    startY: y,
    head: [['Código', 'Producto', 'Cantidad', 'Entregado', 'Precio', 'Importe']],
    body: order.lines.map((line) => [
      line.product?.barcode ?? '—',
      line.product?.name ?? line.product_id,
      String(line.qty),
      String(line.qty_fulfilled ?? 0),
      money(line.unit_price),
      money(line.line_total),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [255, 107, 0], textColor: 255 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  })

  let totalsY = doc.lastAutoTable.finalY + 9
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal', 145, totalsY)
  doc.text(money(order.subtotal), 195, totalsY, { align: 'right' })
  if (Number(order.discount_total ?? 0) > 0) {
    totalsY += 7
    doc.text('Descuento', 145, totalsY)
    doc.text(`-${money(order.discount_total)}`, 195, totalsY, { align: 'right' })
  }
  totalsY += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Total', 145, totalsY)
  doc.text(money(order.total), 195, totalsY, { align: 'right' })

  if (order.notes) {
    totalsY += 14
    doc.setFontSize(10)
    doc.text('Notas', 15, totalsY)
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(order.notes, 180), 15, totalsY + 6)
  }

  doc.save(`pedido-${order.reference ?? order.id}.pdf`)
}
