import { z } from 'zod'

export const REPORT_IDS = ['sales', 'inventory', 'financial', 'alerts', 'merchandise', 'suppliers', 'products', 'inventory-counts', 'stock-by-location', 'kardex', 'internal-moves', 'replenishment', 'occupancy'] as const
export type ReportId = typeof REPORT_IDS[number]
const cell = z.union([z.string(), z.number().finite(), z.boolean(), z.null()])
const cellType = z.enum(['text', 'integer', 'decimal', 'money', 'percent', 'date', 'datetime', 'boolean'])
const columnSchema = z.object({ id: z.string(), label: z.string(), type: cellType, align: z.enum(['left', 'right']),quantityDecimals:z.number().int().min(0).max(4).optional() })
const sectionSchema = z.object({ id: z.string(), title: z.string(), columns: z.array(columnSchema).min(1), rows: z.array(z.record(cell)), totals: z.record(cell).nullable() })
const namedId = z.object({ id: z.string(), name: z.string() })
export const preparedReportSchema = z.object({
  id: z.enum(REPORT_IDS), title: z.string(), generatedAt: z.string().datetime(), timezone: z.string(), currency: z.string(), generatedBy: z.string().nullable(),
  scope: z.object({ companyId: z.string(), label: z.string(), branches: z.array(namedId), warehouse: namedId.nullable(), location: namedId.nullable() }),
  period: z.object({ mode: z.enum(['current', 'period']), start: z.string().nullable(), endExclusive: z.string().nullable(), label: z.string() }),
  branding: z.object({ companyName: z.string(), logoDataUrl: z.string().regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/).nullable() }),
  summary: z.array(z.object({ id: z.string(), label: z.string(), value: cell, type: cellType })), sections: z.array(sectionSchema).min(1),
  charts: z.array(z.object({ id: z.string(), sectionId: z.string(), title: z.string(), kind: z.enum(['bar', 'line', 'donut']), valueType: z.enum(['integer', 'money', 'percent']), points: z.array(z.object({ label: z.string(), value: z.number().finite() })) })), notes: z.array(z.string()),
}).superRefine((report, ctx) => {
  const unique = (ids: string[]) => new Set(ids).size === ids.length
  if (!unique(report.sections.map(s => s.id)) || report.sections.some(s => !unique(s.columns.map(c => c.id))) || !unique(report.charts.map(c => c.id)) || report.charts.some(c => !report.sections.some(s => s.id === c.sectionId))) ctx.addIssue({ code: 'custom', message: 'Estructura de reporte inconsistente' })
  if (report.sections.reduce((n, s) => n + s.rows.length, 0) > 10_000) ctx.addIssue({ code: 'custom', message: 'Reporte demasiado grande' })
})
export type PreparedReport = z.infer<typeof preparedReportSchema>
export type SpreadsheetDocument = Omit<PreparedReport,'id'> & {id:string}
export type ReportMeta = Pick<PreparedReport, 'generatedAt' | 'timezone' | 'currency' | 'generatedBy' | 'scope' | 'period' | 'branding'>
export type ReportColumn = z.infer<typeof columnSchema>
export type ReportSection = z.infer<typeof sectionSchema>
export type CellValue = z.infer<typeof cell>
export type ReportSelection = { sections: string[]; columns: Record<string, string[]> }
export type ReportFilters = { branchId: string; period: 'week' | 'month' | 'quarter' | 'semester' | 'year' | 'all'; year?: number; month?: number; quarter?: number; semester?: number; warehouseId?: string; locationId?: string; productId?: string;catalogType?: 'goods' | 'services' }

export function allReportColumns(report: PreparedReport): ReportSelection {
  return { sections: report.sections.map(s => s.id), columns: Object.fromEntries(report.sections.map(s => [s.id, s.columns.map(c => c.id)])) }
}
export function projectReport(report: PreparedReport, selection: ReportSelection): PreparedReport {
  if (!selection.sections.length || selection.sections.some(id => !report.sections.some(s => s.id === id))) throw new Error('Selecciona al menos una sección válida.')
  const sections = report.sections.filter(s => selection.sections.includes(s.id)).map(s => {
    const ids = selection.columns[s.id] ?? s.columns.map(c => c.id)
    if (!ids.length || ids.some(id => !s.columns.some(c => c.id === id))) throw new Error(`Selecciona al menos una columna de ${s.title}.`)
    const columns = s.columns.filter(c => ids.includes(c.id))
    const pick = (row: Record<string, CellValue>) => Object.fromEntries(columns.filter(c => Object.prototype.hasOwnProperty.call(row, c.id)).map(c => [c.id, row[c.id]]))
    return { ...s, columns, rows: s.rows.map(pick), totals: s.totals ? pick(s.totals) : null }
  })
  return { ...report, sections, charts: report.charts.filter(c => selection.sections.includes(c.sectionId)) }
}
export function formatReportCell(value: CellValue, column: Pick<ReportColumn, 'type' | 'quantityDecimals'>, meta: ReportMeta): string {
  if (value == null) return '—'
  if (column.type === 'money') return new Intl.NumberFormat('es-GT', { style: 'currency', currency: meta.currency }).format(Number(value))
  if (column.type === 'percent') return `${new Intl.NumberFormat('es-GT', { maximumFractionDigits: 2 }).format(Number(value))}%`
  if (column.type === 'integer' || column.type === 'decimal') return new Intl.NumberFormat('es-GT', { maximumFractionDigits: column.type === 'integer' ? 0 : column.quantityDecimals ?? 2 }).format(Number(value))
  if (column.type === 'boolean') return value ? 'Sí' : 'No'
  if (column.type === 'date' || column.type === 'datetime') {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    return new Intl.DateTimeFormat('es-GT', { timeZone: dateOnly ? 'UTC' : meta.timezone, day: '2-digit', month: '2-digit', year: 'numeric', ...(column.type === 'datetime' ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(dateOnly ? `${value}T12:00:00Z` : String(value)))
  }
  return String(value)
}
