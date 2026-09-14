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
 * generateSupplierPDF - Generate PDF report for a supplier
 */
import jsPDF from 'jspdf'
import autoTable, { type jsPDFDocument } from 'jspdf-autotable'
import type { Supplier } from '@/types'
import { addJsPdfCompanyHeader } from '@/utils/pdfBranding'

export interface CustomerPDFMetrics {
  totalPurchases: number
  lastSaleDate: string | null
  salesCount?: number
}

export interface SupplierPDFOptions {
  includeBasic?: boolean
  includeMetrics?: boolean
  includeProducts?: boolean
  includeMerchandiseEntries?: boolean
  companyName?: string
  logoDataUrl?: string
  /** Métricas de compras (solo clientes); si no se pasan, el PDF muestra 0. */
  customerMetrics?: CustomerPDFMetrics
}

/** Entrada de mercancía para incluir en el PDF (resumen por registro) */
export interface SupplierPDFMerchandiseEntry {
  date: string
  registeredBy: { name: string }
  itemsCount: number
  totalValue: number
}

const defaultOptions: Required<Omit<SupplierPDFOptions, 'includeMerchandiseEntries'>> & Pick<SupplierPDFOptions, 'includeMerchandiseEntries'> = {
  includeBasic: true,
  includeMetrics: true,
  includeProducts: true,
  includeMerchandiseEntries: false,
}

/** Color naranja/ámbar de la plataforma para encabezados en PDF (RGB) */
const PDF_HEADER_COLOR: [number, number, number] = [217, 119, 6] // amber-600 / liquor-amber

const formatCurrency = (value: number | string | null | undefined): string => {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) || 0 : 0
  return `Q ${num.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatDateForPDF = (dateStr: string): string => {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('es-GT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return dateStr
  }
}

export const generateSupplierPDF = (
  supplier: Supplier,
  options?: SupplierPDFOptions,
  merchandiseEntries?: SupplierPDFMerchandiseEntry[]
) => {
  const opts = { ...defaultOptions, ...options }
  const isPerson = supplier.entityKind === 'PERSON'
  const isCustomer = supplier.party_type === 'CUSTOMER'
  const doc = new jsPDF() as jsPDFDocument
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let yPos = addJsPdfCompanyHeader(doc, {
    companyName: opts.companyName,
    logoDataUrl: opts.logoDataUrl,
    pageWidth,
    startY: 20,
  })

  const reportTitle = isCustomer ? 'INFORMACIÓN DEL CLIENTE' : 'INFORMACIÓN DEL PROVEEDOR'

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(reportTitle, pageWidth / 2, yPos, { align: 'center' })

  yPos += 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado el ${new Date().toLocaleDateString('es-GT', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, pageWidth / 2, yPos, { align: 'center' })

  yPos += 15

  // Información Básica
  if (opts.includeBasic) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('INFORMACIÓN BÁSICA', margin, yPos)
    yPos += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    
    const leftCol = margin
    const rightCol = pageWidth / 2 + 10
    let leftY = yPos
    let rightY = yPos

    doc.setFont('helvetica', 'bold')
    doc.text(isPerson ? 'Nombre completo:' : 'Nombre de la empresa:', leftCol, leftY)
    doc.setFont('helvetica', 'normal')
    doc.text(supplier.name || 'N/A', leftCol + 50, leftY)
    leftY += 7

    if (!isPerson) {
      doc.setFont('helvetica', 'bold')
      doc.text('Persona de contacto:', leftCol, leftY)
      doc.setFont('helvetica', 'normal')
      doc.text(supplier.contact || 'N/A', leftCol + 50, leftY)
      leftY += 7
    }

    doc.setFont('helvetica', 'bold')
    doc.text('Teléfono:', leftCol, leftY)
    doc.setFont('helvetica', 'normal')
    doc.text(supplier.phone || 'N/A', leftCol + 50, leftY)
    leftY += 7

    doc.setFont('helvetica', 'bold')
    doc.text('Email:', leftCol, leftY)
    doc.setFont('helvetica', 'normal')
    doc.text(supplier.email || 'N/A', leftCol + 50, leftY)
    leftY += 7

    doc.setFont('helvetica', 'bold')
    doc.text('Dirección:', leftCol, leftY)
    doc.setFont('helvetica', 'normal')
    const addressLines = doc.splitTextToSize(supplier.address || 'N/A', pageWidth / 2 - margin - 10)
    doc.text(addressLines, leftCol + 50, leftY)
    leftY += addressLines.length * 5 + 3

    doc.setFont('helvetica', 'bold')
    doc.text('Categorías:', rightCol, rightY)
    doc.setFont('helvetica', 'normal')
    const categoriesLabel = supplier.categoriesLabel || String(supplier.category || 'N/A')
    const categoriesMaxWidth = pageWidth - (rightCol + 30) - margin
    const categoriesLines = doc.splitTextToSize(categoriesLabel, categoriesMaxWidth > 0 ? categoriesMaxWidth : 80)
    doc.text(categoriesLines, rightCol + 30, rightY)
    rightY += categoriesLines.length * 5 + 3

    doc.setFont('helvetica', 'bold')
    doc.text('Estado:', rightCol, rightY)
    doc.setFont('helvetica', 'normal')
    const estadoLabel = supplier.estado === 0 ? 'Inactivo' : 'Activo'
    doc.text(estadoLabel, rightCol + 30, rightY)
    rightY += 7

    doc.setFont('helvetica', 'bold')
    doc.text('Términos de Pago:', rightCol, rightY)
    doc.setFont('helvetica', 'normal')
    doc.text(supplier.paymentTerms || 'N/A', rightCol + 30, rightY)
    rightY += 7

    doc.setFont('helvetica', 'bold')
    doc.text(isCustomer ? 'Última compra:' : 'Último Pedido:', rightCol, rightY)
    doc.setFont('helvetica', 'normal')
    const lastActivityLabel = isCustomer
      ? opts.customerMetrics?.lastSaleDate
        ? formatDateForPDF(opts.customerMetrics.lastSaleDate)
        : 'N/A'
      : supplier.lastOrder || 'N/A'
    doc.text(lastActivityLabel, rightCol + 30, rightY)

    yPos = Math.max(leftY, rightY) + 15
  }

  // Métricas
  if (opts.includeMetrics) {
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('MÉTRICAS', margin, yPos)
    yPos += 10

    const metricsData = isCustomer
      ? [
          [
            'Ventas registradas',
            String(opts.customerMetrics?.salesCount ?? 0),
          ],
          [
            'Total comprado',
            formatCurrency(opts.customerMetrics?.totalPurchases ?? 0),
          ],
          [
            'Última compra',
            opts.customerMetrics?.lastSaleDate
              ? formatDateForPDF(opts.customerMetrics.lastSaleDate)
              : 'N/A',
          ],
        ]
      : [
          [
            'Total de Productos',
            String((supplier.productsList?.length ?? supplier.products) ?? 0),
          ],
          ['Total de Compras', formatCurrency(supplier.totalPurchases ?? 0)],
          ['Último Pedido', supplier.lastOrder ?? 'N/A'],
        ]

    autoTable(doc, {
      startY: yPos,
      head: [['Concepto', 'Valor']],
      body: metricsData,
      theme: 'grid',
      headStyles: { fillColor: PDF_HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 100, fontStyle: 'bold' },
        1: { cellWidth: 'auto', halign: 'left' }
      }
    })

    yPos = doc.lastAutoTable.finalY + 15
  }

  // Productos que Suministra
  if (opts.includeProducts && supplier.productsList && supplier.productsList.length > 0) {
    if (yPos > 230) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('PRODUCTOS QUE SUMINISTRA', margin, yPos)
    yPos += 10

    const productsData = supplier.productsList.map(product => [
      product.name || 'N/A',
      (product.stock || 0).toString(),
      formatCurrency(product.price || 0)
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Producto', 'Stock', 'Precio']],
      body: productsData,
      theme: 'grid',
      headStyles: { fillColor: PDF_HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 50, halign: 'right' }
      }
    })

    yPos = doc.lastAutoTable.finalY + 10
  } else if (opts.includeProducts) {
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('No hay productos asociados a este proveedor.', margin, yPos)
    yPos += 10
  }

  // Entradas de mercancía
  if (opts.includeMerchandiseEntries && merchandiseEntries && merchandiseEntries.length > 0) {
    if (yPos > 230) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('ENTRADAS DE MERCANCÍA', margin, yPos)
    yPos += 10

    const merchData = merchandiseEntries.map((entry) => [
      formatDateForPDF(entry.date),
      entry.registeredBy?.name ?? 'N/A',
      entry.itemsCount.toString(),
      formatCurrency(entry.totalValue),
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Fecha', 'Registrado por', 'Productos', 'Total']],
      body: merchData,
      theme: 'grid',
      headStyles: { fillColor: PDF_HEADER_COLOR, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'center' },
        3: { cellWidth: 45, halign: 'right' },
      },
    })

    yPos = doc.lastAutoTable.finalY + 10
  } else if (opts.includeMerchandiseEntries) {
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('No hay entradas de mercancía para este proveedor.', margin, yPos)
    yPos += 10
  }

  // Footer con información adicional
  const pageHeight = doc.internal.pageSize.getHeight()
  if (yPos < pageHeight - 30) {
    yPos = pageHeight - 20
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(128, 128, 128)
    doc.text(
      `Reporte generado automáticamente - ${supplier.name}`,
      pageWidth / 2,
      yPos,
      { align: 'center' }
    )
  }

  // Save PDF
  const safeName = supplier.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const prefix = isCustomer ? 'Cliente' : 'Proveedor'
  doc.save(`${prefix}_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`)
}
