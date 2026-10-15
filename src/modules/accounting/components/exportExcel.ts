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
 * Exportación a Excel de los reportes contables (client-side con ExcelJS).
 * Los montos se escriben como números para que el contador pueda operar sobre ellos.
 */

import type {
  JournalEntry, LedgerResponse, TrialBalanceResponse,
  IncomeStatementResponse, BalanceSheetResponse, StatementRow, TaxesReportResponse,
} from '@/services/accountingService'
import { SOURCE_LABELS, TYPE_LABELS, MONTH_LABELS } from './format'

type Cell = string | number | Date | null
type Sheet = { name: string; rows: Cell[][]; colWidths: number[]; statement?: boolean; scopeLabel?: string }
type Branding = { companyName: string; scopeLabel?: string; timezone?: string }

const num = (v: string | number) => Math.round((Number(v) || 0) * 100) / 100
const dateCell = (value: string, timezone = 'America/Guatemala') => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`)
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).map(part => [part.type, part.value]))
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)))
}

/** Evita inyección de fórmulas (CWE-1236): set completo OWASP (=, +, -, @, tab, CR). */
const sanitizeCell = (cell: Cell): Cell =>
  typeof cell === 'string' && /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell

async function download(filename: string, sheets: Sheet[], branding?: Branding) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const generatedAt = new Date()
  wb.creator = branding?.companyName || 'Empresa'
  wb.created = generatedAt
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31))
    const width = sheet.colWidths.length
    ws.columns = sheet.colWidths.map(colWidth => ({ width: colWidth }))
    const rows = [sheet.rows[0], [wb.creator], sheet.rows[1], [`${sheet.scopeLabel || branding?.scopeLabel || 'Toda la empresa'} · Moneda GTQ · Generado ${generatedAt.toLocaleString('es-GT')}`], ...sheet.rows.slice(3)]
    rows.forEach((values, index) => {
      const rowNumber = index + 1, row = ws.getRow(rowNumber)
      const section = sheet.statement && rowNumber >= 5 && values.length === 1 && values[0] != null
      const heading = rowNumber === 5 || section
      const total = rowNumber > 5 && (sheet.statement
        ? typeof values[0] === 'string' && /^(?:Total |= |Pasivo \+ Capital)/.test(values[0])
        : rowNumber === rows.length)
      if (rowNumber <= 4 || section) ws.mergeCells(rowNumber, 1, rowNumber, width)
      const cells = rowNumber <= 4 || section ? 1 : width
      for (let column = 1; column <= cells; column++) {
        const cell = row.getCell(column), value = values[column - 1] ?? null
        cell.value = sanitizeCell(value)
        cell.font = { name: 'Calibri', size: rowNumber === 1 ? 18 : 11, bold: rowNumber <= 2 || heading || total, color: { argb: rowNumber <= 2 || heading ? 'FFFFFFFF' : 'FF112844' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber <= 2 ? 'FF112844' : heading ? 'FFFF6F00' : rowNumber <= 4 ? 'FFF1F5F9' : total ? 'FFE2E8F0' : rowNumber % 2 ? 'FFF5F8FC' : 'FFFFFFFF' } }
        cell.alignment = { vertical: rowNumber <= 5 || section ? 'middle' : 'top', horizontal: typeof value === 'number' ? 'right' : 'left', wrapText: true }
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD8E1EB' } } }
        cell.numFmt = value instanceof Date ? 'dd/mm/yyyy' : typeof value === 'number' ? '"GTQ" #,##0.00;[Red]("GTQ" #,##0.00)' : '@'
      }
      const lineCount = Math.max(1, ...values.map((value, column) => {
        const text = value instanceof Date ? 'dd/mm/yyyy' : String(value ?? '')
        const cellWidth = rowNumber <= 4 || section ? sheet.colWidths.reduce((sum, size) => sum + size, 0) : sheet.colWidths[column]
        return Math.max(text.split('\n').length, Math.ceil(text.length / Math.max(1, cellWidth - 2)))
      }))
      row.height = Math.max(rowNumber === 1 ? 32 : heading ? 30 : 22, lineCount * 15)
    })
    ws.views = [{ state: 'frozen', ySplit: 5 }]
    if (!sheet.statement) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, rows.length - 2), column: width } }
    ws.pageSetup = { paperSize: 9, orientation: width > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:5', printArea: `A1:${ws.getColumn(width).letter}${rows.length}` }
  }
  const bytes = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename
  try { document.body.appendChild(anchor); anchor.click() }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000) }
}

const rangeLabel = (from?: string, to?: string) =>
  from || to ? `Del ${from || 'inicio'} al ${to || 'hoy'}` : 'Todos los movimientos'

const stamp = () => new Date().toISOString().slice(0, 10)

export async function exportJournal(entries: JournalEntry[], filters: { from?: string; to?: string; source?: string; branch_id?: string }, fileName = `libro-diario-${stamp()}.xlsx`, branding?: Branding) {
  const rows: Cell[][] = [
    ['Libro Diario'],
    [rangeLabel(filters.from, filters.to) + (filters.source ? ` · Origen: ${SOURCE_LABELS[filters.source as keyof typeof SOURCE_LABELS] ?? filters.source}` : '')],
    [],
    ['Número', 'Fecha', 'Descripción', 'Sucursal', 'Origen', 'Cuenta', 'Debe', 'Haber'],
  ]
  let totalDebit = 0
  let totalCredit = 0
  for (const entry of entries) {
    for (const [i, line] of entry.lines.entries()) {
      const debit = num(line.debit)
      const credit = num(line.credit)
      totalDebit += debit
      totalCredit += credit
      rows.push([
        i === 0 ? entry.entry_number : null,
        i === 0 ? dateCell(entry.date, branding?.timezone) : null,
        i === 0 ? entry.description : null,
        i === 0 ? (entry.branch?.name ?? 'Empresa') : null,
        i === 0 ? SOURCE_LABELS[entry.source_type] : null,
        line.account ? `${line.account.code} — ${line.account.name}` : String(line.account_id),
        debit > 0 ? debit : null,
        credit > 0 ? credit : null,
      ])
    }
  }
  rows.push([])
  rows.push([null, null, null, null, null, 'Totales', num(totalDebit), num(totalCredit)])
  await download(fileName, [
    { name: 'Diario', rows, colWidths: [12, 12, 40, 16, 10, 38, 14, 14] },
  ], branding)
}

export async function exportLedger(data: LedgerResponse, filters: { from?: string; to?: string }, fileName = `libro-mayor-${data.account.code}-${stamp()}.xlsx`, branding?: Branding) {
  const rows: Cell[][] = [
    [`Libro Mayor — ${data.account.code} ${data.account.name}`],
    [rangeLabel(filters.from, filters.to)],
    [],
    ['Fecha', 'Asiento', 'Descripción', 'Debe', 'Haber', 'Saldo'],
    [null, null, 'Saldo inicial', null, null, num(data.initialBalance)],
  ]
  for (const m of data.movements) {
    rows.push([
      dateCell(m.date, branding?.timezone), m.entry_number, m.description,
      m.debit > 0 ? num(m.debit) : null,
      m.credit > 0 ? num(m.credit) : null,
      num(m.balance),
    ])
  }
  rows.push([])
  rows.push([null, null, 'Totales', num(data.totals.debit), num(data.totals.credit), num(data.finalBalance)])
  await download(fileName, [
    { name: 'Mayor', rows, colWidths: [12, 12, 44, 14, 14, 14] },
  ], branding)
}

export async function exportTrialBalance(data: TrialBalanceResponse, filters: { from?: string; to?: string }, fileName = `balanza-comprobacion-${stamp()}.xlsx`, branding?: Branding) {
  const rows: Cell[][] = [
    ['Balanza de Comprobación'],
    [rangeLabel(filters.from, filters.to)],
    [],
    ['Código', 'Cuenta', 'Tipo', 'Saldo inicial', 'Debe', 'Haber', 'Saldo final'],
  ]
  for (const r of data.rows) {
    rows.push([
      r.code, r.name, TYPE_LABELS[r.type],
      num(r.initialBalance),
      r.debit > 0 ? num(r.debit) : null,
      r.credit > 0 ? num(r.credit) : null,
      num(r.finalBalance),
    ])
  }
  rows.push([])
  rows.push([null, 'Totales del período', null, null, num(data.totals.debit), num(data.totals.credit), null])
  await download(fileName, [
    { name: 'Balanza', rows, colWidths: [10, 38, 10, 14, 14, 14, 14] },
  ], branding)
}

const statementRows = (rows: StatementRow[]): Cell[][] =>
  rows.map((r) => [`${r.code} — ${r.name}`, num(r.amount)])

export async function exportStatements(
  pnl: IncomeStatementResponse,
  bs: BalanceSheetResponse,
  filters: { from?: string; to?: string; asOf?: string },
  fileName = `estados-financieros-${stamp()}.xlsx`,
  branding?: Branding,
) {
  const pnlRows: Cell[][] = [
    ['Estado de Resultados'],
    [rangeLabel(filters.from, filters.to)],
    [],
    ['Ingresos'],
    ...statementRows(pnl.income),
    ['Total ingresos', num(pnl.totalIncome)],
    [],
    ['(−) Costos'],
    ...statementRows(pnl.costs),
    ['Total costos', num(pnl.totalCosts)],
    ['= Utilidad bruta', num(pnl.grossProfit)],
    [],
    ['(−) Gastos'],
    ...statementRows(pnl.expenses),
    ['Total gastos', num(pnl.totalExpenses)],
    [],
    ['= Utilidad neta del período', num(pnl.netIncome)],
  ]
  const bsRows: Cell[][] = [
    ['Balance General'],
    [`Al ${filters.asOf || stamp()}`],
    [],
    ['Activo'],
    ...statementRows(bs.assets),
    ['Total activo', num(bs.totalAssets)],
    [],
    ['Pasivo'],
    ...statementRows(bs.liabilities),
    ['Total pasivo', num(bs.totalLiabilities)],
    [],
    ['Capital'],
    ...statementRows(bs.equity),
    ['Resultado del ejercicio (no cerrado)', num(bs.currentResult)],
    ['Total capital', num(bs.totalEquity)],
    [],
    ['Pasivo + Capital', num(bs.totalLiabilities + bs.totalEquity)],
  ]
  await download(fileName, [
    { name: 'Estado de Resultados', rows: pnlRows, colWidths: [44, 16], statement: true },
    { name: 'Balance General', rows: bsRows, colWidths: [44, 16], statement: true, scopeLabel: 'Toda la empresa' },
  ], branding)
}

export async function exportTaxes(data: TaxesReportResponse, fileName = `impuestos-${data.year}.xlsx`, branding?: Branding) {
  const regimeLabel = data.regime === 'PEQUENO'
    ? `Pequeño contribuyente — tarifa ${Math.round(data.pequenoRate * 100)}% sobre ventas brutas`
    : `Régimen general — IVA ${Math.round(data.ivaRate * 100)}%`
  const rows: Cell[][] = [
    [`Impuestos ${data.year}`],
    [`${regimeLabel} · Calculado sobre asientos automáticos (ventas, devoluciones y compras)`],
    [],
    ['Mes', 'Ventas netas', 'IVA débito (ventas)', 'IVA crédito (compras)', 'IVA pequeño contribuyente', 'Impuesto a pagar'],
  ]
  for (const m of data.months) {
    rows.push([MONTH_LABELS[m.month - 1], num(m.netSales), num(m.ivaDebit), num(m.ivaCredit), num(m.pequenoTax), num(m.toPay)])
  }
  rows.push([])
  rows.push(['Totales', num(data.totals.netSales), num(data.totals.ivaDebit), num(data.totals.ivaCredit), num(data.totals.pequenoTax), num(data.totals.toPay)])
  await download(fileName, [
    { name: 'Impuestos', rows, colWidths: [14, 14, 18, 20, 24, 16] },
  ], branding)
}
