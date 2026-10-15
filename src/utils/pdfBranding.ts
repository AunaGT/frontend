/**
 * Branding compartido para PDFs (jsPDF): logo + nombre de empresa.
 */
import type jsPDF from 'jspdf'
import type { UserOptions } from 'jspdf-autotable'
import { getApiBaseUrl } from '@/services/api'

export const PDF_DOCUMENT_COLORS = {
  navy: [12, 32, 58] as [number, number, number],
  orange: [255, 111, 0] as [number, number, number],
  muted: [99, 117, 139] as [number, number, number],
  border: [216, 225, 235] as [number, number, number],
  alternate: [247, 249, 252] as [number, number, number],
  total: [232, 238, 245] as [number, number, number],
}

export const documentTableStyles: Pick<UserOptions, 'styles' | 'headStyles' | 'alternateRowStyles' | 'footStyles'> = {
  styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.1, overflow: 'linebreak', textColor: PDF_DOCUMENT_COLORS.navy, lineColor: PDF_DOCUMENT_COLORS.border, lineWidth: .1 },
  headStyles: { fillColor: PDF_DOCUMENT_COLORS.navy, textColor: [255, 255, 255], fontStyle: 'bold', lineColor: PDF_DOCUMENT_COLORS.navy },
  alternateRowStyles: { fillColor: PDF_DOCUMENT_COLORS.alternate },
  footStyles: { fillColor: PDF_DOCUMENT_COLORS.total, textColor: PDF_DOCUMENT_COLORS.navy, fontStyle: 'bold' },
}

export function ensureDocumentSpace(doc: jsPDF, y: number, requiredHeight = 30): number {
  if (y + requiredHeight > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage()
    return 20
  }
  return y
}

/** Texto envuelto que continúa en otra página sin invadir el pie. */
export function addDocumentText(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 4.5): number {
  const lines: string[] = doc.splitTextToSize(text, width)
  for (const line of lines) {
    y = ensureDocumentSpace(doc, y, lineHeight)
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

export function addDocumentFooter(doc: jsPDF, label = '', font = 'helvetica'): void {
  const pages = doc.getNumberOfPages(), width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setDrawColor(...PDF_DOCUMENT_COLORS.border)
    doc.setLineWidth(.2)
    doc.line(18, height - 16, width - 18, height - 16)
    doc.setFont(font, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...PDF_DOCUMENT_COLORS.muted)
    if (label) doc.text(label, 18, height - 10)
    doc.text(`Página ${page} de ${pages}`, width - 18, height - 10, { align: 'right' })
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(blob)
  })
}

/** Carga el logo vía proxy del backend (evita CORS y rasteriza SVG/WebP). */
async function loadLogoFromProxy(): Promise<string | undefined> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/settings/company-logo`, { credentials: 'include' })
    if (!res.ok) return undefined
    const blob = await res.blob()
    if (!blob.size) return undefined
    return blobToDataUrl(blob)
  } catch {
    return undefined
  }
}

export async function loadImageAsDataUrl(url: string): Promise<string | undefined> {
  const proxy = await loadLogoFromProxy()
  if (proxy) return proxy

  const trimmed = url?.trim()
  if (!trimmed) return undefined

  try {
    const res = await fetch(trimmed, { mode: 'cors' })
    if (!res.ok) return undefined
    const blob = await res.blob()
    if (!blob.size) return undefined
    return blobToDataUrl(blob)
  } catch {
    return undefined
  }
}

export function detectImageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.includes('image/png')) return 'PNG'
  if (dataUrl.includes('image/webp')) return 'WEBP'
  return 'JPEG'
}

/** Escala la imagen dentro de un rectángulo máximo sin deformar. */
export function fitImageToBox(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (!naturalWidth || !naturalHeight) {
    return { width: maxWidth, height: maxHeight }
  }
  const aspect = naturalWidth / naturalHeight
  let width = maxWidth
  let height = width / aspect
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspect
  }
  return { width, height }
}

function getJsPdfImageDimensions(doc: jsPDF, dataUrl: string): { width: number; height: number } {
  try {
    const props = doc.getImageProperties(dataUrl)
    return { width: props.width, height: props.height }
  } catch {
    return { width: 1, height: 1 }
  }
}

/** Logo centrado respetando proporción. Devuelve alto renderizado. */
export function addJsPdfLogoCentered(
  doc: jsPDF,
  dataUrl: string,
  centerX: number,
  y: number,
  maxWidth: number,
  maxHeight: number
): number {
  const fmt = detectImageFormat(dataUrl)
  const natural = getJsPdfImageDimensions(doc, dataUrl)
  const { width, height } = fitImageToBox(natural.width, natural.height, maxWidth, maxHeight)
  doc.addImage(dataUrl, fmt, centerX - width / 2, y, width, height)
  return height
}

export interface JsPdfBrandingOptions {
  font?: string
  companyName?: string
  logoDataUrl?: string
  pageWidth?: number
  startY?: number
  logoMaxWidth?: number
  logoMaxHeight?: number
}

/** Encabezado centrado con logo opcional. Devuelve la Y siguiente. */
export function addJsPdfCompanyHeader(doc: jsPDF, opts: JsPdfBrandingOptions = {}): number {
  const pageWidth = opts.pageWidth ?? doc.internal.pageSize.getWidth()
  let y = opts.startY ?? 20
  const centerX = pageWidth / 2

  if (opts.logoDataUrl) {
    try {
      const maxW = opts.logoMaxWidth ?? 32
      const maxH = opts.logoMaxHeight ?? 16
      const h = addJsPdfLogoCentered(doc, opts.logoDataUrl, centerX, y - 2, maxW, maxH)
      y += h + 4
    } catch {
      /* sin logo */
    }
  }

  if (opts.companyName?.trim()) {
    doc.setFontSize(18)
    doc.setFont(opts.font || 'helvetica', 'bold')
    doc.setTextColor(...PDF_DOCUMENT_COLORS.navy)
    const lines: string[] = doc.splitTextToSize(opts.companyName.trim(), pageWidth - 36)
    for (const line of lines) {
      y = ensureDocumentSpace(doc, y, 8)
      doc.text(line, centerX, y, { align: 'center' })
      y += 8
    }
  }

  doc.setDrawColor(...PDF_DOCUMENT_COLORS.orange)
  doc.setLineWidth(.8)
  doc.line(18, y - 3, pageWidth - 18, y - 3)
  doc.setTextColor(...PDF_DOCUMENT_COLORS.navy)
  return y + 7
}

export async function resolvePdfLogoDataUrl(logoUrl?: string | null): Promise<string | undefined> {
  return loadImageAsDataUrl(logoUrl ?? '')
}
