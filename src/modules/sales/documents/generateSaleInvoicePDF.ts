/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 */
import jsPDF from 'jspdf'
import autoTable, { type jsPDFDocument } from 'jspdf-autotable'
import type { Sale } from '@/types'
import { formatMoney, formatDateTime } from '@/utils/formatters'
import { addJsPdfCompanyHeader } from '@/utils/pdfBranding'

/** Color naranja/ámbar de la plataforma para encabezados en PDF (RGB) */
const PDF_HEADER_COLOR: [number, number, number] = [217, 119, 6] // amber / liquor-amber
const MARGIN = 18
const PAGE_WIDTH = 210 // A4
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

export interface SaleInvoicePDFOptions {
  companyName?: string
  logoDataUrl?: string
  locale?: string
  currencyCode?: string
}

export function generateSaleInvoicePDF(
  sale: Sale,
  options: SaleInvoicePDFOptions = {}
): void {
  const { companyName, logoDataUrl, locale = 'es-GT', currencyCode = 'GTQ' } = options
  const doc = new jsPDF() as jsPDFDocument
  const fmt = (n: number) => formatMoney(n, locale, currencyCode)
  let y = addJsPdfCompanyHeader(doc, { companyName, logoDataUrl, pageWidth: PAGE_WIDTH, startY: 20 })

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('FACTURA', PAGE_WIDTH / 2, y, { align: 'center' })
  y += 6

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const ref = sale.reference ?? sale.id.slice(0, 8)
  doc.text(`Venta #${ref}`, PAGE_WIDTH / 2, y, { align: 'center' })
  y += 6
  doc.text(formatDateTime(sale.date, undefined, locale), PAGE_WIDTH / 2, y, { align: 'center' })
  y += 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Cliente:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.text(sale.customer || '—', MARGIN + 22, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text('ID fiscal:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.text(sale.isFinalConsumer ? 'Consumidor Final' : (sale.customerNit || '—'), MARGIN + 22, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Método de pago:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.text(String(sale.payment || '—'), MARGIN + 35, y)
  y += 6
  if (sale.createdByName) {
    doc.setFont('helvetica', 'bold')
    doc.text('Registrada por:', MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.text(sale.createdByName, MARGIN + 32, y)
    y += 8
  } else {
    y += 4
  }

  const tableBody = sale.products.map((p) => [
    p.name,
    String(p.qty),
    fmt(p.price),
    fmt(p.price * p.qty),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Producto', 'Cantidad', 'P. unit.', 'Subtotal']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: PDF_HEADER_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 22, halign: 'right' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_WIDTH,
  })

  y = doc.lastAutoTable.finalY + 10

  if (Number(sale.discountTotal) > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Subtotal:', MARGIN, y)
    doc.text(fmt(sale.subtotal ?? sale.total + (sale.discountTotal ?? 0)), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 6
    doc.setTextColor(0, 128, 0)
    doc.text('(-) Descuentos:', MARGIN, y)
    doc.text(`-${fmt(sale.discountTotal!)}`, PAGE_WIDTH - MARGIN, y, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    y += 8
  }

  if (sale.hasReturns) {
    doc.text('(-) Devoluciones:', MARGIN, y)
    doc.text(`-${fmt(sale.totalReturned ?? 0)}`, PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Total neto:', MARGIN, y)
    doc.text(fmt(sale.adjustedTotal ?? sale.total), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += 10
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Total:', MARGIN, y)
    doc.text(fmt(sale.total), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    y += 10
  }

  if (sale.payment === 'Efectivo' && (Number(sale.amountReceived) > 0 || Number(sale.change) > 0)) {
    doc.text('Monto recibido:', MARGIN, y)
    doc.text(fmt(sale.amountReceived), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 6
    doc.text('Vuelto:', MARGIN, y)
    doc.text(fmt(sale.change), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 10
  }

  const dte = sale.sale_dtes?.[0]
  if (dte?.authorization) {
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text(`Autorización SAT: ${dte.authorization}`, PAGE_WIDTH / 2, y, { align: 'center' })
    y += 5
    doc.setTextColor(0, 0, 0)
  }

  const filename = `Factura-${ref}.pdf`
  doc.save(filename)
}
