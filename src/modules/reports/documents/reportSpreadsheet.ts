import { formatReportCell, type CellValue, type SpreadsheetDocument, type PreparedReport, type ReportColumn } from '../reportModel'
import type { Worksheet } from 'exceljs'

function localDate(value: string, report: SpreadsheetDocument | PreparedReport) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`)
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: report.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map(p => [p.type, p.value]))
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)))
}
function typedCell(value: CellValue, column: Pick<ReportColumn, 'type' | 'quantityDecimals'>, report: SpreadsheetDocument | PreparedReport) {
  if (value == null) return null
  if (column.type === 'percent') return Number(value) / 100
  if (column.type==='decimal' && column.quantityDecimals!=null) {const number=Number(value);return Number.isFinite(number) && Math.abs(number)*10**column.quantityDecimals<=Number.MAX_SAFE_INTEGER ? number : String(value)}
  if (column.type === 'date' || column.type === 'datetime') return localDate(String(value), report)
  return value
}
function numberFormat(type: ReportColumn['type'], currency: string,quantityDecimals?:number) {
  if (type === 'money') return `"${currency}" #,##0.00;[Red]("${currency}" #,##0.00)`
  if (type === 'percent') return '0.0%'
  if (type === 'date') return 'dd/mm/yyyy'
  if (type === 'datetime') return 'dd/mm/yyyy hh:mm'
  if (type === 'integer') return '#,##0'
  if (type === 'decimal') return quantityDecimals==null ? '#,##0.00' : `#,##0${quantityDecimals ? '.'+'#'.repeat(quantityDecimals) : ''}`
  return '@'
}
export async function generateReportWorkbook(report: SpreadsheetDocument | PreparedReport): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = report.generatedBy || report.branding.companyName; workbook.created = new Date(report.generatedAt)
  const names = new Set<string>()
  const sheetName = (title: string) => {
    const base = title.replace(/[\[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Datos'
    let name = base, i = 2
    while (names.has(name.toLocaleLowerCase())) { const suffix = ` (${i++})`; name = base.slice(0, 31 - suffix.length) + suffix }
    names.add(name.toLocaleLowerCase()); return name
  }
  const header = (ws: Worksheet, title: string, columns: ReportColumn[]) => {
    const width = Math.max(2, columns.length)
    for (const [row, value] of [[1, title], [2, report.branding.companyName], [3, `${report.period.label} · Moneda ${report.currency}`], [4, `${report.scope.label} · ${formatReportCell(report.generatedAt, { type: 'datetime' }, report)} · ${report.timezone}`]] as const) {
      ws.mergeCells(row, 1, row, width); const cell = ws.getCell(row, 1); cell.value = value
      cell.font = { name: 'Calibri', size: row === 1 ? 18 : 11, bold: row <= 2, color: { argb: row <= 2 ? 'FFFFFFFF' : 'FF334155' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row <= 2 ? 'FF112844' : 'FFF1F5F9' } }; cell.alignment = { vertical: 'middle', wrapText: true }; ws.getRow(row).height = row === 1 ? 32 : 24
    }
    ws.getRow(5).values = columns.map(c => c.label); ws.getRow(5).height = 30
    ws.getRow(5).eachCell(cell => { cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6F00' } }; cell.alignment = { wrapText: true, vertical: 'middle' } })
    ws.views = [{ state: 'frozen', ySplit: 5 }]
    ws.columns = columns.map(c => ({ width: ['text'].includes(c.type) ? Math.max(22, Math.min(42, c.label.length + 8)) : c.type === 'datetime' ? 24 : 21 }))
    ws.pageSetup = { paperSize: 9, orientation: columns.length > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:5' }
  }
  const writeRow = (ws: Worksheet, rowNumber: number, values: CellValue[], columns: Pick<ReportColumn, 'type' | 'align' | 'quantityDecimals'>[], total = false) => {
    const row = ws.getRow(rowNumber)
    values.forEach((value, i) => {
      const cell = row.getCell(i + 1); cell.value = typedCell(value, columns[i], report); cell.numFmt = numberFormat(columns[i].type, report.currency,columns[i].quantityDecimals)
      cell.font = { name: 'Calibri', size: 11, bold: total, color: { argb: 'FF112844' } }; cell.alignment = { vertical: 'top', horizontal: columns[i].align, wrapText: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: total ? 'FFE2E8F0' : rowNumber % 2 ? 'FFF5F8FC' : 'FFFFFFFF' } }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD8E1EB' } } }
    })
    const lines = values.map((v, i) => Math.max(String(v ?? '').split('\n').length, Math.ceil(String(v ?? '').length / Math.max(1, (ws.getColumn(i + 1).width || 22) - 2))))
    row.height = Math.max(22, Math.max(...lines) * 15)
  }
  const summary = workbook.addWorksheet(sheetName('Resumen')), summaryCols: ReportColumn[] = [{ id: 'label', label: 'Indicador', type: 'text', align: 'left' }, { id: 'value', label: 'Valor', type: 'decimal', align: 'right' }]
  header(summary, report.title, summaryCols); summary.getColumn(1).width = 44; summary.getColumn(2).width = 30
  report.summary.forEach((metric, i) => writeRow(summary, i + 6, [metric.label, metric.value], [summaryCols[0], { type: metric.type, align: 'right' }]))
  report.notes.forEach((note, i) => { const row = report.summary.length + 8 + i; summary.mergeCells(row, 1, row, 2); summary.getCell(row, 1).value = note; summary.getCell(row, 1).alignment = { wrapText: true }; summary.getRow(row).height = Math.max(30, Math.ceil(note.length / 70) * 15) })
  for (const section of report.sections) {
    const ws = workbook.addWorksheet(sheetName(section.title)); header(ws, section.title, section.columns)
    section.rows.forEach((row, i) => writeRow(ws, i + 6, section.columns.map(c => row[c.id]), section.columns))
    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, section.rows.length + 5), column: section.columns.length } }
    if (section.totals && Object.keys(section.totals).length) {
      const totalColumns = section.columns.map((c, i) => i === 0 && section.totals![c.id] == null ? { ...c, type: 'text' as const, align: 'left' as const } : c)
      writeRow(ws, section.rows.length + 6, section.columns.map((c, i) => section.totals![c.id] ?? (i === 0 ? 'Total del reporte' : null)), totalColumns, true)
    }
  }
  const bytes = await workbook.xlsx.writeBuffer()
  return new Uint8Array(bytes).buffer
}
export function generateReportCsv(report: SpreadsheetDocument | PreparedReport, sectionId: string): string {
  const section = report.sections.find(s => s.id === sectionId)
  if (!section) throw new Error('Selecciona una sección válida para CSV.')
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const csvCell = (value: CellValue, column: ReportColumn) => {
    if (value == null) return ''
    if (typeof value === 'number') return String(value)
    if (['integer','decimal','money','percent'].includes(column.type) && /^-?\d+(?:\.\d+)?$/.test(String(value))) return String(value)
    const formatted = column.type === 'date' || column.type === 'datetime' ? formatReportCell(value, column, report) : String(value)
    return /^[\s\u0000-\u001f]*[=+\-@]/u.test(formatted) ? `'${formatted}` : formatted
  }
  const header = section.columns.map(c => escape(c.type === 'money' ? `${c.label} (${report.currency})` : c.type === 'percent' && !c.label.includes('%') ? `${c.label} (%)` : c.label)).join(',')
  return '\uFEFF' + [header, ...section.rows.map(row => section.columns.map(c => escape(csvCell(row[c.id], c))).join(','))].join('\r\n') + '\r\n'
}
