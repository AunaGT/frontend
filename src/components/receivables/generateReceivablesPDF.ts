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
 * PDFs de cartera: estado de cuenta del cliente y recibo de un cobro.
 * Mismo patrón que el resto de documentos (jsPDF + autotable + encabezado
 * compartido), para que salgan con el logo y el nombre de la empresa.
 */
import jsPDF from 'jspdf'
import autoTable, { type jsPDFDocument } from 'jspdf-autotable'
import { addJsPdfCompanyHeader } from '@/utils/pdfBranding'
import {
  PAYMENT_KIND_LABELS, SALE_PAYMENT_STATUS_LABELS,
  type CustomerStatement, type PaymentReceipt,
} from '@/services/receivablesService'

const HEADER_COLOR: [number, number, number] = [13, 148, 136] // teal del módulo

interface PdfOptions {
  companyName?: string
  logoDataUrl?: string
  currencyCode?: string
  locale?: string
}

const makeMoney = (o: PdfOptions) => {
  const fmt = new Intl.NumberFormat(o.locale || 'es-GT', {
    style: 'currency',
    currency: o.currencyCode || 'GTQ',
  })
  return (v: number | null | undefined) => fmt.format(Number(v) || 0)
}

const fecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

/** Estado de cuenta completo: facturas abiertas, cobros y resumen. */
export const generateStatementPDF = (data: CustomerStatement, o: PdfOptions = {}) => {
  const money = makeMoney(o)
  const doc = new jsPDF() as jsPDFDocument
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = addJsPdfCompanyHeader(doc, {
    companyName: o.companyName,
    logoDataUrl: o.logoDataUrl,
    pageWidth,
    startY: 18,
  })

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('ESTADO DE CUENTA', pageWidth / 2, y, { align: 'center' })
  y += 9

  doc.setFontSize(11)
  doc.text(data.customer.name, margin, y)
  y += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  const datos = [
    data.customer.tax_id && `NIT ${data.customer.tax_id}`,
    data.customer.phone,
    data.customer.address,
  ].filter(Boolean)
  if (datos.length) {
    doc.text(datos.join('  ·  '), margin, y)
    y += 5
  }
  doc.text(`Emitido el ${fecha(new Date().toISOString())}`, margin, y)
  doc.setTextColor(0, 0, 0)
  y += 8

  const resumen: [string, string][] = [
    ['Saldo pendiente', money(data.resumen.saldo)],
    ['Vencido', money(data.resumen.vencido)],
  ]
  if (data.resumen.credito_disponible > 0) {
    resumen.push(['Saldo a favor', money(data.resumen.credito_disponible)])
    resumen.push(['Saldo neto', money(data.resumen.saldo_neto)])
  }
  if (data.customer.credit_limit != null) {
    resumen.push(['Límite de crédito', money(data.customer.credit_limit)])
    resumen.push(['Disponible', money(data.resumen.disponible ?? 0)])
  }
  autoTable(doc, {
    startY: y,
    body: resumen,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 1: { halign: 'right', cellWidth: 35 } },
    margin: { left: margin },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 8

  const abiertas = data.ventas.filter((v) => v.saldo > 0.005)
  autoTable(doc, {
    startY: y,
    head: [['Factura', 'Fecha', 'Vence', 'Total', 'Abonado', 'Saldo', 'Estado']],
    body: abiertas.length
      ? abiertas.map((v) => [
          v.reference || v.id.slice(0, 8),
          fecha(v.date),
          v.vencida ? `${fecha(v.due_date)} (${v.dias_vencida}d)` : fecha(v.due_date),
          money(v.total),
          money(v.abonado),
          money(v.saldo),
          SALE_PAYMENT_STATUS_LABELS[v.payment_status],
        ])
      : [['Sin facturas pendientes', '', '', '', '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: HEADER_COLOR, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 8

  if (data.cobros.length) {
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Tipo', 'Monto', 'Forma', 'Referencia', 'Aplicado a']],
      body: data.cobros.slice(0, 60).map((c) => [
        fecha(c.paid_at),
        PAYMENT_KIND_LABELS[c.kind],
        money(c.amount),
        c.payment_method?.name || '—',
        c.reference || '—',
        c.aplicaciones.map((a) => a.reference || a.sale_id?.slice(0, 8)).join(', ') || 'Sin aplicar',
      ]),
      theme: 'striped',
      headStyles: { fillColor: HEADER_COLOR, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 2: { halign: 'right' } },
      margin: { left: margin, right: margin },
    })
  }

  doc.save(`estado-cuenta-${data.customer.name.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}

/** Recibo de un cobro: el comprobante que se lleva el cliente. */
export const generateReceiptPDF = (r: PaymentReceipt, o: PdfOptions = {}) => {
  const money = makeMoney(o)
  const doc = new jsPDF() as jsPDFDocument
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = addJsPdfCompanyHeader(doc, {
    companyName: o.companyName,
    logoDataUrl: o.logoDataUrl,
    pageWidth,
    startY: 18,
  })

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(
    r.kind === 'PAYMENT' ? 'RECIBO DE COBRO' : PAYMENT_KIND_LABELS[r.kind].toUpperCase(),
    pageWidth / 2,
    y,
    { align: 'center' }
  )
  y += 7
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`No. ${r.id.slice(0, 8).toUpperCase()}`, pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 10

  autoTable(doc, {
    startY: y,
    body: [
      ['Cliente', r.customer.name],
      ...(r.customer.tax_id ? [['NIT', r.customer.tax_id]] : []),
      ['Fecha', fecha(r.paid_at)],
      ...(r.payment_method ? [['Forma de pago', r.payment_method.name]] : []),
      ...(r.reference ? [['Referencia', r.reference]] : []),
      ...(r.branch ? [['Sucursal', r.branch.name]] : []),
      ...(r.registered_by ? [['Recibido por', r.registered_by.name]] : []),
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
    margin: { left: margin },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 6

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`Monto recibido: ${money(r.amount)}`, margin, y)
  y += 8

  autoTable(doc, {
    startY: y,
    head: [['Factura', 'Fecha', 'Vence', 'Total', 'Aplicado']],
    body: r.aplicaciones.length
      ? r.aplicaciones.map((a) => [
          a.reference || a.sale_id?.slice(0, 8) || '—',
          fecha(a.date),
          fecha(a.due_date),
          money(a.total),
          money(a.amount),
        ])
      : [['Sin aplicar (queda como saldo a favor)', '', '', '', money(r.amount)]],
    theme: 'striped',
    headStyles: { fillColor: HEADER_COLOR, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 6

  if (r.no_aplicado > 0.005) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Queda como saldo a favor del cliente: ${money(r.no_aplicado)}`, margin, y)
    y += 6
  }
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`Saldo pendiente después de este movimiento: ${money(r.resumen.saldo)}`, margin, y)

  if (r.notes) {
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(doc.splitTextToSize(`Nota: ${r.notes}`, pageWidth - margin * 2), margin, y)
    doc.setTextColor(0, 0, 0)
  }

  doc.save(`recibo-${r.id.slice(0, 8)}.pdf`)
}
