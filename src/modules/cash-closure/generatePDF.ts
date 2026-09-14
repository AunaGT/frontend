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
 * generateClosurePDF - Generate PDF for a cash closure
 */
import jsPDF from 'jspdf'
import autoTable, { type jsPDFDocument } from 'jspdf-autotable'
import type { CashClosure } from './types'
import { formatCurrency, formatDateTime, toNumber, closureOpeningFloat } from './types'
import { addJsPdfCompanyHeader } from '@/utils/pdfBranding'

/** Color naranja/ámbar de la plataforma para encabezados en PDF (RGB) */
const PDF_HEADER_COLOR: [number, number, number] = [217, 119, 6] // amber / liquor-amber

export const generateClosurePDF = (
  closure: CashClosure,
  companyName?: string,
  currencyCode?: string,
  locale?: string,
  logoDataUrl?: string
) => {
    const fmt = (amount: number | string) => formatCurrency(amount, currencyCode, locale)
    const doc = new jsPDF() as jsPDFDocument
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    let yPos = addJsPdfCompanyHeader(doc, { companyName, logoDataUrl, pageWidth, startY: 20 })
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('CIERRE DE CAJA', pageWidth / 2, yPos, { align: 'center' })

    yPos += 10
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Cierre #${closure.closure_number}`, pageWidth / 2, yPos, { align: 'center' })

    yPos += 15

    // Date and Period Info
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Fecha:', margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(formatDateTime(closure.date), margin + 30, yPos)

    yPos += 7
    doc.setFont('helvetica', 'bold')
    doc.text('Período:', margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(`${formatDateTime(closure.start_date)} - ${formatDateTime(closure.end_date)}`, margin + 30, yPos)

    yPos += 7
    doc.setFont('helvetica', 'bold')
    doc.text('Cajero:', margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(closure.cashier_name, margin + 30, yPos)

    if (closure.supervisor_name) {
        yPos += 7
        doc.setFont('helvetica', 'bold')
        doc.text('Encargado:', margin, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(closure.supervisor_name, margin + 30, yPos)
    }

    yPos += 15

    // Summary Section
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMEN GENERAL', margin, yPos)
    yPos += 10

    const openingFloat = closureOpeningFloat(closure)

    const summaryData = [
        ...(openingFloat > 0 ? [['Fondo inicial del turno', fmt(openingFloat)]] : []),
        ['Total Teórico', fmt(closure.theoretical_total)],
        ['Ventas Brutas', fmt(closure.theoretical_sales)],
        ['Devoluciones', fmt(closure.theoretical_returns)],
        ['Total Contado', fmt(closure.actual_total)],
        ['Diferencia', `${toNumber(closure.difference) >= 0 ? '+' : ''}${fmt(closure.difference)} (${toNumber(closure.difference_percentage).toFixed(2)}%)`],
        ['Transacciones', closure.total_transactions.toString()],
        ['Clientes', closure.total_customers.toString()],
        ['Ticket Promedio', fmt(closure.average_ticket)]
    ]

    autoTable(doc, {
        startY: yPos,
        head: [['Concepto', 'Valor']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: PDF_HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 80, fontStyle: 'bold' },
            1: { cellWidth: 'auto', halign: 'right' }
        }
    })

    yPos = doc.lastAutoTable.finalY + 15

    // Payment Methods Breakdown
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('DESGLOSE POR MÉTODO DE PAGO', margin, yPos)
    yPos += 10

    const paymentData = (closure.payment_breakdowns || []).map(item => [
        item.payment_method?.name || item.payment_method_name || 'N/A',
        fmt(item.theoretical_amount),
        fmt(item.actual_amount),
        `${toNumber(item.difference) >= 0 ? '+' : ''}${fmt(item.difference)}`,
        item.notes || '-'
    ])

    autoTable(doc, {
        startY: yPos,
        head: [['Método', 'Teórico', 'Contado', 'Diferencia', 'Notas']],
        body: paymentData,
        theme: 'grid',
        headStyles: { fillColor: PDF_HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' }
        }
    })

    yPos = doc.lastAutoTable.finalY + 15

    // Denominations
    if (closure.denominations && closure.denominations.length > 0) {
        if (yPos > 230) {
            doc.addPage()
            yPos = 20
        }

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('CONTEO DE EFECTIVO', margin, yPos)
        yPos += 10

        const denominationData = (closure.denominations || []).map(denom => [
            `Q ${toNumber(denom.denomination).toFixed(2)}`,
            denom.type,
            denom.quantity.toString(),
            fmt(denom.subtotal)
        ])

        autoTable(doc, {
            startY: yPos,
            head: [['Denominación', 'Tipo', 'Cantidad', 'Subtotal']],
            body: denominationData,
            theme: 'grid',
            headStyles: { fillColor: PDF_HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                2: { halign: 'center' },
                3: { halign: 'right' }
            }
        })

        yPos = doc.lastAutoTable.finalY + 5
    }

    // Notes
    if (closure.notes) {
        if (yPos > 240) {
            doc.addPage()
            yPos = 20
        }

        yPos += 10
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('NOTAS:', margin, yPos)
        yPos += 7
        doc.setFont('helvetica', 'normal')
        const splitNotes = doc.splitTextToSize(closure.notes, pageWidth - 2 * margin)
        doc.text(splitNotes, margin, yPos)
        yPos += splitNotes.length * 5 + 10
    }

    // Signatures
    const signaturesHeight = 70
    const pageHeight = doc.internal.pageSize.getHeight()

    if (yPos + signaturesHeight > pageHeight - 20) {
        doc.addPage()
        yPos = 20
    } else {
        yPos += 10
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('FIRMAS', pageWidth / 2, yPos, { align: 'center' })
    yPos += 15

    // Cashier signature
    if (closure.cashier_signature) {
        try {
            doc.addImage(closure.cashier_signature, 'PNG', margin, yPos, 80, 30)
        } catch (e) {
            console.error('Error adding cashier signature:', e)
        }
    }
    doc.line(margin, yPos + 35, margin + 80, yPos + 35)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Cajero:', margin, yPos + 40)
    doc.setFont('helvetica', 'normal')
    doc.text(closure.cashier_name, margin, yPos + 45)

    // Supervisor signature
    const supervisorX = pageWidth - margin - 80
    if (closure.supervisor_signature) {
        try {
            doc.addImage(closure.supervisor_signature, 'PNG', supervisorX, yPos, 80, 30)
        } catch (e) {
            console.error('Error adding supervisor signature:', e)
        }
    }
    doc.line(supervisorX, yPos + 35, supervisorX + 80, yPos + 35)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Firma de Encargado:', supervisorX, yPos + 40)
    doc.setFont('helvetica', 'normal')
    if (closure.supervisor_name) {
        doc.text(closure.supervisor_name, supervisorX, yPos + 45)
    }

    // Save PDF
    doc.save(`Cierre-Caja-${closure.closure_number}-${new Date().toISOString().split('T')[0]}.pdf`)
}
