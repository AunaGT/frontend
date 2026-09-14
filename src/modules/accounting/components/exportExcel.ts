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
 * Exportación a Excel de los reportes contables (client-side con xlsx).
 * Los montos se escriben como números para que el contador pueda operar sobre ellos.
 */

import * as XLSX from 'xlsx'
import type {
  JournalEntry, LedgerResponse, TrialBalanceResponse,
  IncomeStatementResponse, BalanceSheetResponse, StatementRow, TaxesReportResponse,
} from '@/services/accountingService'
import { SOURCE_LABELS, TYPE_LABELS, MONTH_LABELS, fmtDate } from './format'

type Cell = string | number | null
type Sheet = { name: string; rows: Cell[][]; colWidths?: number[] }

const num = (v: string | number) => Math.round((Number(v) || 0) * 100) / 100

/** Evita inyección de fórmulas (CWE-1236): set completo OWASP (=, +, -, @, tab, CR). */
const sanitizeCell = (cell: Cell): Cell =>
  typeof cell === 'string' && /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell

function download(filename: string, sheets: Sheet[]) {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows.map((row) => row.map(sanitizeCell)))
    if (sheet.colWidths) ws['!cols'] = sheet.colWidths.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename)
}

const rangeLabel = (from?: string, to?: string) =>
  from || to ? `Del ${from || 'inicio'} al ${to || 'hoy'}` : 'Todos los movimientos'

const stamp = () => new Date().toISOString().slice(0, 10)

export function exportJournal(entries: JournalEntry[], filters: { from?: string; to?: string; source?: string; branch_id?: string }) {
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
        i === 0 ? fmtDate(entry.date) : null,
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
  download(`libro-diario-${stamp()}.xlsx`, [
    { name: 'Diario', rows, colWidths: [12, 12, 40, 16, 10, 38, 14, 14] },
  ])
}

export function exportLedger(data: LedgerResponse, filters: { from?: string; to?: string }) {
  const rows: Cell[][] = [
    [`Libro Mayor — ${data.account.code} ${data.account.name}`],
    [rangeLabel(filters.from, filters.to)],
    [],
    ['Fecha', 'Asiento', 'Descripción', 'Debe', 'Haber', 'Saldo'],
    [null, null, 'Saldo inicial', null, null, num(data.initialBalance)],
  ]
  for (const m of data.movements) {
    rows.push([
      fmtDate(m.date), m.entry_number, m.description,
      m.debit > 0 ? num(m.debit) : null,
      m.credit > 0 ? num(m.credit) : null,
      num(m.balance),
    ])
  }
  rows.push([])
  rows.push([null, null, 'Totales', num(data.totals.debit), num(data.totals.credit), num(data.finalBalance)])
  download(`libro-mayor-${data.account.code}-${stamp()}.xlsx`, [
    { name: 'Mayor', rows, colWidths: [12, 12, 44, 14, 14, 14] },
  ])
}

export function exportTrialBalance(data: TrialBalanceResponse, filters: { from?: string; to?: string }) {
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
  download(`balanza-comprobacion-${stamp()}.xlsx`, [
    { name: 'Balanza', rows, colWidths: [10, 38, 10, 14, 14, 14, 14] },
  ])
}

const statementRows = (rows: StatementRow[]): Cell[][] =>
  rows.map((r) => [`${r.code} — ${r.name}`, num(r.amount)])

export function exportStatements(
  pnl: IncomeStatementResponse,
  bs: BalanceSheetResponse,
  filters: { from?: string; to?: string; asOf?: string },
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
  download(`estados-financieros-${stamp()}.xlsx`, [
    { name: 'Estado de Resultados', rows: pnlRows, colWidths: [44, 16] },
    { name: 'Balance General', rows: bsRows, colWidths: [44, 16] },
  ])
}

export function exportTaxes(data: TaxesReportResponse) {
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
  download(`impuestos-${data.year}.xlsx`, [
    { name: 'Impuestos', rows, colWidths: [14, 14, 18, 20, 24, 16] },
  ])
}
