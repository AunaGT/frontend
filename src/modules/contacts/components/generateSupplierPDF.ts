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
import { addJsPdfCompanyHeader, addDocumentFooter, documentTableStyles, ensureDocumentSpace } from '@/utils/pdfBranding'

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

const defaultOptions: SupplierPDFOptions = {
  includeBasic: true,
  includeMetrics: true,
  includeProducts: true,
  includeMerchandiseEntries: false,
}

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

    const lastActivityLabel = isCustomer
      ? opts.customerMetrics?.lastSaleDate
        ? formatDateForPDF(opts.customerMetrics.lastSaleDate)
        : 'N/A'
      : supplier.lastOrder || 'N/A'
    autoTable(doc, {
      ...documentTableStyles,
      startY: yPos,
      head: [['Dato', 'Información']],
      body: [
        [isPerson ? 'Nombre completo' : 'Nombre de la empresa', supplier.name || 'N/A'],
        ...(!isPerson ? [['Persona de contacto', supplier.contact || 'N/A']] : []),
        ['Teléfono', supplier.phone || 'N/A'], ['Email', supplier.email || 'N/A'],
        ['Dirección', supplier.address || 'N/A'],
        ['Categorías', supplier.categoriesLabel || String(supplier.category || 'N/A')],
        ['Estado', supplier.estado === 0 ? 'Inactivo' : 'Activo'],
        ['Términos de pago', supplier.paymentTerms || 'N/A'],
        [isCustomer ? 'Última compra' : 'Último pedido', lastActivityLabel],
      ],
      columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } },
      margin: { left: margin, right: margin, top: 20, bottom: 20 },
    })
    yPos = doc.lastAutoTable.finalY + 10
  }

  // Métricas
  if (opts.includeMetrics) {
    yPos = ensureDocumentSpace(doc, yPos, 35)
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
      ...documentTableStyles,
      startY: yPos,
      head: [['Concepto', 'Valor']],
      body: metricsData,
      theme: 'grid',
      margin: { left: margin, right: margin, top: 20, bottom: 20 },
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
      ...documentTableStyles,
      startY: yPos,
      head: [['Producto', 'Stock', 'Precio']],
      body: productsData,
      theme: 'grid',
      margin: { left: margin, right: margin, top: 20, bottom: 20 },
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
      ...documentTableStyles,
      startY: yPos,
      head: [['Fecha', 'Registrado por', 'Productos', 'Total']],
      body: merchData,
      theme: 'grid',
      margin: { left: margin, right: margin, top: 20, bottom: 20 },
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

  addDocumentFooter(doc, isCustomer ? 'Ficha de cliente' : 'Ficha de proveedor')

  // Save PDF
  const safeName = supplier.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const prefix = isCustomer ? 'Cliente' : 'Proveedor'
  doc.save(`${prefix}_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`)
}
