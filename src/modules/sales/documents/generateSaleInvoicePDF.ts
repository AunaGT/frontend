/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 */
import jsPDF from 'jspdf'
import autoTable, { type jsPDFDocument } from 'jspdf-autotable'
import type { Sale } from '@/types'
import { formatMoney, formatDateTime } from '@/utils/formatters'
import { previewLineTotal } from '@/lib/commercialQuantity'
import {formatUnitDecimal,unitLineTotal} from '@/modules/inventory/units/public'
import { addJsPdfCompanyHeader, addDocumentFooter, addDocumentText, documentTableStyles, ensureDocumentSpace, PDF_DOCUMENT_COLORS } from '@/utils/pdfBranding'
import {internalSaleDocumentTitle,saleCommercialState,salePaymentLabel} from '../commercialPresentation'

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
  doc.setTextColor(...PDF_DOCUMENT_COLORS.navy)
  doc.text(internalSaleDocumentTitle(saleCommercialState(sale)), PAGE_WIDTH / 2, y, { align: 'center' })
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
  y = addDocumentText(doc, sale.customer || '—', MARGIN + 22, y, CONTENT_WIDTH - 22) + 2
  y = ensureDocumentSpace(doc, y, 6)
  doc.setFont('helvetica', 'bold')
  doc.text('ID fiscal:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  y = addDocumentText(doc, sale.isFinalConsumer ? 'Consumidor Final' : (sale.customerNit || '—'), MARGIN + 22, y, CONTENT_WIDTH - 22) + 2
  y = ensureDocumentSpace(doc, y, 6)
  doc.setFont('helvetica', 'bold')
  doc.text('Método de pago:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  y = addDocumentText(doc, salePaymentLabel(sale), MARGIN + 35, y, CONTENT_WIDTH - 35) + 2
  if (sale.createdByName) {
    y = ensureDocumentSpace(doc, y, 6)
    doc.setFont('helvetica', 'bold')
    doc.text('Registrada por:', MARGIN, y)
    doc.setFont('helvetica', 'normal')
    y = addDocumentText(doc, sale.createdByName, MARGIN + 32, y, CONTENT_WIDTH - 32) + 4
  } else {
    y += 4
  }

  const tableBody = sale.products.map((p) => [
    p.name,
    `${p.qty} ${p.unitLabel || ''}`.trim(),
    p.unitMetadataVersion===2?`${currencyCode} ${formatUnitDecimal(p.priceExact!,locale)}`:fmt(p.price),
    fmt(p.unitMetadataVersion===2?Number(p.lineTotalExact??unitLineTotal(String(p.qty),p.priceExact!)):p.lineTotal ?? Number(previewLineTotal(String(p.qty), String(p.price)))),
  ])

  autoTable(doc, {
    startY: ensureDocumentSpace(doc, y, 18),
    head: [['Producto', 'Cantidad', 'P. unit.', 'Subtotal']],
    body: tableBody,
    theme: 'grid',
    ...documentTableStyles,
    columnStyles: {
      0: { cellWidth: 88 },
      1: { cellWidth: 22, halign: 'right' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: MARGIN, right: MARGIN, top: 20, bottom: 20 },
    tableWidth: CONTENT_WIDTH,
  })

  y = ensureDocumentSpace(doc, doc.lastAutoTable.finalY + 10, 26 + (Number(sale.discountTotal) > 0 ? 14 : 0) + (sale.hasReturns ? 6 : 0))
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...PDF_DOCUMENT_COLORS.navy)

  if (Number(sale.discountTotal) > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Subtotal:', MARGIN, y)
    doc.text(fmt(sale.subtotal ?? sale.total + (sale.discountTotal ?? 0)), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 6
    doc.setTextColor(0, 128, 0)
    doc.text('(-) Descuentos:', MARGIN, y)
    doc.text(`-${fmt(sale.discountTotal!)}`, PAGE_WIDTH - MARGIN, y, { align: 'right' })
    doc.setTextColor(...PDF_DOCUMENT_COLORS.navy)
    y += 8
  }

  if (sale.hasReturns) {
    doc.text('(-) Devoluciones:', MARGIN, y)
    doc.text(`-${fmt(sale.totalReturned ?? 0)}`, PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 6
    doc.setFillColor(...PDF_DOCUMENT_COLORS.total)
    doc.rect(MARGIN, y - 5, CONTENT_WIDTH, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.text('Total neto:', MARGIN, y)
    doc.text(fmt(sale.adjustedTotal ?? sale.total), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += 10
  } else {
    doc.setFillColor(...PDF_DOCUMENT_COLORS.total)
    doc.rect(MARGIN, y - 5, CONTENT_WIDTH, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Total:', MARGIN, y)
    doc.text(fmt(sale.total), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    y += 10
  }

  if (sale.payment === 'Efectivo' && (Number(sale.amountReceived) > 0 || Number(sale.change) > 0)) {
    y = ensureDocumentSpace(doc, y, 18)
    doc.text('Monto recibido:', MARGIN, y)
    doc.text(fmt(sale.amountReceived), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 6
    doc.text('Vuelto:', MARGIN, y)
    doc.text(fmt(sale.change), PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 10
  }

  const dte = sale.sale_dtes?.[0]
  if (sale.isCredit) {
    y = ensureDocumentSpace(doc, y, 24)
    doc.text('Venta a crédito', MARGIN, y); y += 6
    y = addDocumentText(doc, `Abonos: ${fmt(sale.creditPaid ?? 0)} · Saldo pendiente: ${fmt(sale.creditBalance ?? 0)}`, MARGIN, y, CONTENT_WIDTH) + 2
    if (sale.dueDate) y = addDocumentText(doc, `Vencimiento: ${formatDateTime(sale.dueDate, { hour: undefined, minute: undefined }, locale)}`, MARGIN, y, CONTENT_WIDTH) + 4
  }
  if (dte?.authorization) {
    doc.setFontSize(8)
    doc.setTextColor(...PDF_DOCUMENT_COLORS.muted)
      for (const line of doc.splitTextToSize(`${dte.provider==='EXTERNAL'?'Documento externo · sin verificación automática':'Documento fiscal vinculado'} · ID: ${dte.authorization}`, CONTENT_WIDTH)) {
      y = ensureDocumentSpace(doc, y, 5)
      doc.text(line, PAGE_WIDTH / 2, y, { align: 'center' })
      y += 5
    }
  }

  const filename = `Comprobante-interno-${ref}.pdf`
  addDocumentFooter(doc, `Venta #${ref} · No constituye factura fiscal`)
  doc.save(filename)
}
