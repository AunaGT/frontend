/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * generateSaleTicket - Genera el único documento de la venta: ticket/comprobante 80 mm.
 * Diseño tipo recibo térmico: separadores, columnas alineadas, bloque DTE opcional.
 */
import jsPDF from 'jspdf'
import type { Sale, SaleDte } from '@/services/saleService'
import { formatMoney, formatDateTime } from '@/utils/formatters'
import { addJsPdfLogoCentered } from '@/utils/pdfBranding'

const WIDTH_MM = 80
const MARGIN_MM = 4
const BODY_FONT = 8
const TITLE_FONT = 10
const LINE_HEIGHT = 4
const ITEM_ROW_MM = LINE_HEIGHT + 0.5
const BOTTOM_MARGIN_MM = 6

// Columnas para detalle de ítems (en mm). La descripción no debe invadir P.U. ni IMPORTE.
const X_LEFT = MARGIN_MM
const X_QTY_END = 10       // cantidad (derecha de esta columna)
const X_DESC = 11          // inicio descripción
const X_DESC_END = 44      // fin máximo descripción (deja hueco antes de P.U.)
const X_PU_END = 58        // precio unitario (alineado derecha)
const X_IMPORTE_END = WIDTH_MM - MARGIN_MM  // importe línea (alineado derecha)
const DESC_MAX_MM = X_DESC_END - X_DESC     // ancho máximo descripción en mm

export interface SaleTicketOptions {
  companyName?: string
  companyNit?: string
  logoDataUrl?: string
  locale?: string
  currencyCode?: string
}

function getPrincipalDte(sale: Sale): SaleDte | null {
  const list = sale.sale_dtes
  if (!list?.length) return null
  const authorized = list.find((d) => d.status?.toLowerCase() === 'autorizado')
  return authorized ?? list[0]
}

function drawDashedLine(doc: jsPDF, y: number): void {
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
  doc.setLineDashPattern([2, 2], 0)
  doc.line(X_LEFT, y, WIDTH_MM - MARGIN_MM, y)
  doc.setLineDashPattern([], 0)
}

function drawSolidLine(doc: jsPDF, y: number): void {
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern([], 0)
  doc.line(X_LEFT, y, WIDTH_MM - MARGIN_MM, y)
}

/** Trunca descripción por ancho real (mm) para que no se traslape con P.U. */
function truncateDescToWidth(doc: jsPDF, str: string, maxWidthMm: number): string {
  const suffix = '...'
  if (doc.getTextWidth(str) <= maxWidthMm) return str
  let s = str
  while (s.length > 0 && doc.getTextWidth(s + suffix) > maxWidthMm) {
    s = s.slice(0, -1)
  }
  return (s || str.slice(0, 1)) + (s.length < str.length ? suffix : '')
}

/** Calcula la altura total del ticket en mm para evitar espacio en blanco. */
function computeTicketHeightMm(sale: Sale, options: SaleTicketOptions): number {
  const { companyName, companyNit } = options
  const dte = getPrincipalDte(sale)
  const items = sale.sale_items ?? []
  const discount = Number(sale.discount_total) || 0
  const hasPaymentDetails = sale.amount_received != null && Number(sale.amount_received) > 0
  const hasChange = hasPaymentDetails && sale.change != null && Number(sale.change) >= 0
  const hasCajero = !!sale.createdBy?.name
  const hasCustomerNit = !sale.is_final_consumer && !!sale.customer_nit

  let h = MARGIN_MM + 2
  if (companyName?.trim()) h += LINE_HEIGHT
  if (companyNit?.trim()) h += LINE_HEIGHT
  h += LINE_HEIGHT + 1 + LINE_HEIGHT + LINE_HEIGHT + LINE_HEIGHT + 1 // título, dashed, fecha, ticket
  if (dte) h += LINE_HEIGHT + (dte.authorization ? LINE_HEIGHT : 0) + (dte.series || dte.number ? LINE_HEIGHT : 0) + (dte.emission_date ? LINE_HEIGHT : 0) + 1
  h += LINE_HEIGHT + LINE_HEIGHT + (hasCustomerNit ? LINE_HEIGHT : 0) + 1 + LINE_HEIGHT + LINE_HEIGHT + LINE_HEIGHT // cliente, dashed, cols
  h += items.length * ITEM_ROW_MM
  h += LINE_HEIGHT + LINE_HEIGHT + (discount > 0 ? LINE_HEIGHT : 0) + LINE_HEIGHT + LINE_HEIGHT + 1 + LINE_HEIGHT // totales
  h += LINE_HEIGHT + LINE_HEIGHT + (hasPaymentDetails ? LINE_HEIGHT : 0) + (hasChange ? LINE_HEIGHT : 0) + 1 + LINE_HEIGHT // pago
  if (hasCajero) h += LINE_HEIGHT + 1
  h += LINE_HEIGHT + LINE_HEIGHT + LINE_HEIGHT + (dte ? LINE_HEIGHT : 0) // pie
  h += BOTTOM_MARGIN_MM
  return Math.ceil(h)
}

export function generateSaleTicket(sale: Sale, options: SaleTicketOptions = {}): void {
  const { companyName, companyNit, logoDataUrl, locale = 'es-GT', currencyCode = 'GTQ' } = options
  const fmt = (n: number) => formatMoney(n, locale, currencyCode)
  const heightMm = computeTicketHeightMm(sale, options)
  const doc = new jsPDF({
    unit: 'mm',
    format: [WIDTH_MM, heightMm],
  })
  let y = MARGIN_MM + 2

  // ----- Encabezado -----
  if (logoDataUrl) {
    try {
      const logoH = addJsPdfLogoCentered(doc, logoDataUrl, WIDTH_MM / 2, y - 1, 28, 14)
      y += logoH + 2
    } catch {
      /* sin logo */
    }
  }
  if (companyName?.trim()) {
    doc.setFontSize(TITLE_FONT + 1)
    doc.setFont('helvetica', 'bold')
    doc.text(companyName.trim(), WIDTH_MM / 2, y, { align: 'center' })
    y += LINE_HEIGHT
  }
  if (companyNit?.trim()) {
    doc.setFontSize(BODY_FONT - 1)
    doc.setFont('helvetica', 'normal')
    doc.text(`ID fiscal: ${companyNit.trim()}`, WIDTH_MM / 2, y, { align: 'center' })
    y += LINE_HEIGHT
  }
  doc.setFontSize(BODY_FONT)
  doc.setFont('helvetica', 'bold')
  doc.text('COMPROBANTE DE VENTA', WIDTH_MM / 2, y, { align: 'center' })
  y += LINE_HEIGHT + 1

  drawDashedLine(doc, y)
  y += LINE_HEIGHT

  // ----- Fecha y número de ticket -----
  doc.setFont('helvetica', 'normal')
  doc.text(`Fecha: ${formatDateTime(sale.date, undefined, locale)}`, WIDTH_MM / 2, y, { align: 'center' })
  y += LINE_HEIGHT
  const ticketRef = sale.reference ?? sale.id.slice(0, 8).toUpperCase()
  doc.text(`Ticket No. ${ticketRef}`, WIDTH_MM / 2, y, { align: 'center' })
  y += LINE_HEIGHT + 1

  // ----- Bloque DTE (opcional) -----
  const dte = getPrincipalDte(sale)
  if (dte) {
    drawDashedLine(doc, y)
    y += LINE_HEIGHT
    doc.setFontSize(BODY_FONT - 1)
    if (dte.authorization) {
      doc.text(`Autorizacion SAT: ${dte.authorization}`, X_LEFT, y, { maxWidth: WIDTH_MM - 2 * MARGIN_MM })
      y += LINE_HEIGHT
    }
    if (dte.series || dte.number) {
      const ser = dte.series ? `Serie: ${dte.series}` : ''
      const num = dte.number ? `  No. ${dte.number}` : ''
      doc.text(ser + num, X_LEFT, y)
      y += LINE_HEIGHT
    }
    if (dte.emission_date) {
      doc.text(`Fecha emision: ${formatDateTime(dte.emission_date, undefined, locale)}`, X_LEFT, y)
      y += LINE_HEIGHT
    }
    doc.setFontSize(BODY_FONT)
    y += 1
  }

  drawDashedLine(doc, y)
  y += LINE_HEIGHT

  // ----- Cliente -----
  const customerLabel = sale.is_final_consumer ? 'Consumidor final' : (sale.customer || 'Cliente')
  doc.text(`Cliente: ${customerLabel}`, X_LEFT, y)
  y += LINE_HEIGHT
  if (!sale.is_final_consumer && sale.customer_nit) {
    doc.text(`ID fiscal: ${sale.customer_nit}`, X_LEFT, y)
    y += LINE_HEIGHT
  }
  y += 1

  drawDashedLine(doc, y)
  y += LINE_HEIGHT

  // ----- Encabezado columnas ítems -----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(BODY_FONT - 1)
  doc.text('CANT', X_QTY_END, y, { align: 'right' })
  doc.text('DESCRIPCION', X_DESC + 2, y)
  doc.text('P.U.', X_PU_END, y, { align: 'right' })
  doc.text('IMPORTE', X_IMPORTE_END, y, { align: 'right' })
  y += LINE_HEIGHT

  drawDashedLine(doc, y)
  y += LINE_HEIGHT

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(BODY_FONT)

  // ----- Ítems -----
  const items = sale.sale_items ?? []
  for (const item of items) {
    const name = item.product?.name ?? 'Producto'
    const qty = Number(item.qty) || 0
    const price = Number(item.price) || 0
    const lineTotal = qty * price
    const desc = truncateDescToWidth(doc, name, DESC_MAX_MM)
    doc.text(String(qty), X_QTY_END, y, { align: 'right' })
    doc.text(desc, X_DESC, y)
    doc.text(fmt(price), X_PU_END, y, { align: 'right' })
    doc.text(fmt(lineTotal), X_IMPORTE_END, y, { align: 'right' })
    y += LINE_HEIGHT + 0.5
  }

  drawDashedLine(doc, y)
  y += LINE_HEIGHT

  // ----- Totales -----
  const subtotal = sale.subtotal ?? items.reduce((acc, i) => acc + Number(i.qty) * Number(i.price), 0)
  const discount = Number(sale.discount_total) || 0
  doc.text('Subtotal:', X_LEFT, y)
  doc.text(fmt(subtotal), X_IMPORTE_END, y, { align: 'right' })
  y += LINE_HEIGHT
  if (discount > 0) {
    doc.text('Descuento:', X_LEFT, y)
    doc.text(`-${fmt(discount)}`, X_IMPORTE_END, y, { align: 'right' })
    y += LINE_HEIGHT
  }

  drawSolidLine(doc, y)
  y += LINE_HEIGHT
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL:', X_LEFT, y)
  doc.text(fmt(Number(sale.total)), X_IMPORTE_END, y, { align: 'right' })
  y += LINE_HEIGHT + 1
  doc.setFont('helvetica', 'normal')

  drawDashedLine(doc, y)
  y += LINE_HEIGHT

  // ----- Pago -----
  doc.text(`Pago: ${sale.payment_method?.name ?? 'N/A'}`, X_LEFT, y)
  y += LINE_HEIGHT
  if (sale.amount_received != null && Number(sale.amount_received) > 0) {
    doc.text('Recibido:', X_LEFT, y)
    doc.text(fmt(Number(sale.amount_received)), X_IMPORTE_END, y, { align: 'right' })
    y += LINE_HEIGHT
    if (sale.change != null && Number(sale.change) >= 0) {
      doc.text('Cambio:', X_LEFT, y)
      doc.text(fmt(Number(sale.change)), X_IMPORTE_END, y, { align: 'right' })
      y += LINE_HEIGHT
    }
  }
  y += 1

  drawDashedLine(doc, y)
  y += LINE_HEIGHT

  // ----- Cajero -----
  if (sale.createdBy?.name) {
    doc.text(`Cajero: ${sale.createdBy.name}`, WIDTH_MM / 2, y, { align: 'center' })
    y += LINE_HEIGHT + 1
  }

  // ----- Pie -----
  drawDashedLine(doc, y)
  y += LINE_HEIGHT
  doc.setFont('helvetica', 'bold')
  doc.text('--- Gracias por su compra ---', WIDTH_MM / 2, y, { align: 'center' })
  y += LINE_HEIGHT
  doc.setFont('helvetica', 'normal')
  if (dte) {
    doc.setFontSize(BODY_FONT - 1)
    doc.text('Documento tributario electronico autorizado por SAT', WIDTH_MM / 2, y, { align: 'center' })
  }

  const fileRef = sale.reference ?? sale.id.slice(0, 8)
  const filename = dte?.number ? `Ticket-Venta-${dte.series ?? ''}-${dte.number}.pdf` : `Ticket-Venta-${fileRef}.pdf`
  doc.save(filename)
}
