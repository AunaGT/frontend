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
 * generatePromotionTicketsPDF - Generate PDF with printable promotion code tickets
 * Improved design with bold title, description, and proper cut lines
 */
import jsPDF from 'jspdf'
import { addJsPdfLogoCentered } from '@/utils/pdfBranding'

interface PromotionCode {
    id: number
    code: string
    current_uses: number
    active: boolean
}

interface Promotion {
    name: string
    description?: string
    discount_value?: string
    discount_percentage?: string
    buy_quantity?: number
    get_quantity?: number
    min_quantity?: number
    end_date?: string
    type?: {
        name: string
    }
}

interface TicketOptions {
    codes: PromotionCode[]
    promotion: Promotion
    terms: string
    logoBase64?: string
    locale?: string
    currencyCode?: string
}

/**
 * Format promotion value for display
 */
const formatPromoValue = (promo: Promotion, locale?: string, currencyCode?: string): string => {
    const typeName = promo.type?.name
    if (typeName === 'PERCENTAGE') return `${promo.discount_percentage}% OFF`
    if (typeName === 'FIXED_AMOUNT') {
        const n = Number(promo.discount_value)
        const formatted = Number.isFinite(n)
            ? new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
            : `${promo.discount_value}`
        return `${formatted} OFF`
    }
    if (typeName === 'BUY_X_GET_Y') return `${promo.buy_quantity}x${(promo.buy_quantity || 0) - (promo.get_quantity || 0)}`
    if (typeName === 'MIN_QTY_DISCOUNT') return `${promo.min_quantity}+ = ${promo.discount_percentage}%`
    if (typeName === 'FREE_GIFT') return '🎁 REGALO'
    if (typeName === 'COMBO_DISCOUNT') return 'COMBO'
    return 'DESCUENTO'
}

/**
 * Format date for display
 */
const formatDate = (dateStr?: string, locale?: string): string => {
    if (!dateStr) return 'Sin fecha de expiración'
    return new Date(dateStr).toLocaleDateString(locale || 'es-GT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}

/**
 * Draw a single ticket on the PDF
 */
const drawTicket = (
    doc: jsPDF,
    x: number,
    y: number,
    width: number,
    height: number,
    code: string,
    promotion: Promotion,
    terms: string,
    logoBase64?: string,
    locale?: string,
    currencyCode?: string
) => {
    const padding = 10
    const innerWidth = width - (padding * 2)

    // OUTER cut line (dashed) - This is where to cut
    doc.setDrawColor(150, 150, 150)
    doc.setLineWidth(0.3)
    doc.setLineDashPattern([3, 3], 0)
    doc.roundedRect(x, y, width, height, 4, 4)
    doc.setLineDashPattern([], 0)

    // Inner solid border for the ticket content
    const innerMargin = 4
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.roundedRect(x + innerMargin, y + innerMargin, width - (innerMargin * 2), height - (innerMargin * 2), 3, 3)

    let currentY = y + padding + innerMargin + 2

    // Header area with logo placeholder and promo value
    if (logoBase64) {
        try {
            const logoH = addJsPdfLogoCentered(doc, logoBase64, x + padding + 12.5, currentY - 3, 25, 15)
            currentY += logoH + 2
        } catch {
            // Draw placeholder
            doc.setDrawColor(180, 180, 180)
            doc.setFillColor(250, 250, 250)
            doc.roundedRect(x + padding, currentY - 3, 25, 15, 2, 2, 'FD')
            doc.setFontSize(5)
            doc.setTextColor(150, 150, 150)
            doc.text('LOGO DE LA EMPRESA', x + padding + 12.5, currentY + 4, { align: 'center' })
        }
    } else {
        // Draw placeholder
        doc.setDrawColor(180, 180, 180)
        doc.setFillColor(250, 250, 250)
        doc.roundedRect(x + padding, currentY - 3, 25, 15, 2, 2, 'FD')
        doc.setFontSize(5)
        doc.setTextColor(150, 150, 150)
        doc.text('LOGO DE LA EMPRESA', x + padding + 12.5, currentY + 4, { align: 'center' })
    }

    // Promo value on the right (bold)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(211, 84, 0) // Orange color
    const promoValue = formatPromoValue(promotion, locale, currencyCode)
    doc.text(promoValue, x + width - padding - innerMargin, currentY + 5, { align: 'right' })

    currentY += 20

    // Divider line
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.3)
    doc.line(x + padding, currentY, x + width - padding, currentY)

    currentY += 6

    // Promotion name (BOLD)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(50, 50, 50)
    const nameLines = doc.splitTextToSize(promotion.name, innerWidth - 10)
    doc.text(nameLines.slice(0, 2), x + width / 2, currentY, { align: 'center' })
    currentY += (Math.min(nameLines.length, 2) * 4) + 2

    // Description (normal, smaller) - limited to 30 words
    if (promotion.description) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        // Truncate to 30 words max
        const words = promotion.description.split(/\s+/)
        const truncatedDesc = words.length > 30
            ? words.slice(0, 30).join(' ') + '...'
            : promotion.description
        const descLines = doc.splitTextToSize(truncatedDesc, innerWidth - 6)
        doc.text(descLines.slice(0, 4), x + width / 2, currentY, { align: 'center' })
        currentY += (Math.min(descLines.length, 4) * 3) + 4
    } else {
        currentY += 4
    }

    // Code container (dark background)
    const codeBoxHeight = 22
    const codeBoxY = currentY

    doc.setFillColor(45, 45, 45)
    doc.roundedRect(x + padding, codeBoxY, innerWidth, codeBoxHeight, 3, 3, 'F')

    // Code label
    doc.setFontSize(6)
    doc.setTextColor(170, 170, 170)
    doc.text('CÓDIGO DE DESCUENTO', x + width / 2, codeBoxY + 6, { align: 'center' })

    // Code text (large, centered, bold)
    doc.setFontSize(16)
    doc.setFont('courier', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(code, x + width / 2, codeBoxY + 16, { align: 'center' })

    currentY = codeBoxY + codeBoxHeight + 8

    // Divider line
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.3)
    doc.line(x + padding, currentY, x + width - padding, currentY)

    currentY += 5

    // Expiration date
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    const expiryText = promotion.end_date
        ? `Válido hasta: ${formatDate(promotion.end_date, locale)}`
        : 'Sin fecha de expiración'
    doc.text(expiryText, x + width / 2, currentY, { align: 'center' })

    currentY += 5

    // Terms and conditions
    doc.setFontSize(5)
    doc.setTextColor(140, 140, 140)
    const termsLines = doc.splitTextToSize(terms, innerWidth - 5)
    doc.text(termsLines.slice(0, 3), x + width / 2, currentY, { align: 'center' })
}

/**
 * Generate PDF with promotion tickets
 * Tickets are arranged in a 2-column grid
 */
export const generatePromotionTicketsPDF = (options: TicketOptions) => {
    const { codes, promotion, terms, logoBase64, locale = 'es-GT', currencyCode = 'GTQ' } = options

    if (codes.length === 0) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    const margin = 10
    const ticketWidth = (pageWidth - (margin * 3)) / 2  // 2 columns with gap
    const ticketHeight = 125  // Height to fit full description (up to 4 lines)
    const gapX = margin
    const gapY = 8

    const ticketsPerRow = 2
    const ticketsPerCol = Math.floor((pageHeight - (margin * 2)) / (ticketHeight + gapY))
    const ticketsPerPage = ticketsPerRow * ticketsPerCol

    codes.forEach((codeObj, index) => {
        // Add new page if needed
        if (index > 0 && index % ticketsPerPage === 0) {
            doc.addPage()
        }

        const pageIndex = index % ticketsPerPage
        const row = Math.floor(pageIndex / ticketsPerRow)
        const col = pageIndex % ticketsPerRow

        const x = margin + (col * (ticketWidth + gapX))
        const y = margin + (row * (ticketHeight + gapY))

        drawTicket(doc, x, y, ticketWidth, ticketHeight, codeObj.code, promotion, terms, logoBase64, locale, currencyCode)
    })

    // Save the PDF
    const safeName = promotion.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
    doc.save(`Tickets_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`)
}
