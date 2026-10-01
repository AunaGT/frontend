/** Cargos netos de devoluciones y todos los abonos, incluidos anticipos. */
export function statementMovements(statement) {
  const movements = [
    ...statement.ventas.map(sale => ({ id: sale.id, date: sale.date, reference: sale.reference || sale.id.slice(0, 8), kind: 'SALE', charge: sale.total, credit: 0, sale })),
    ...statement.cobros.map(payment => ({ id: payment.id, date: payment.paid_at, reference: payment.reference || payment.id.slice(0, 8), kind: payment.kind, charge: 0, credit: payment.amount, payment })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date) || Number(b.kind === 'SALE') - Number(a.kind === 'SALE') || a.id.localeCompare(b.id))
  const closing = statement.resumen.saldo - statement.resumen.credito_disponible
  let balance = closing - movements.reduce((sum, row) => sum + row.charge - row.credit, 0)
  return movements.map(row => {
    balance = Math.round((balance + row.charge - row.credit) * 100) / 100
    return { ...row, balance }
  })
}

export function statementDate(iso, timezone = 'America/Guatemala') {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))
  const part = type => parts.find(p => p.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function matchesStatementRow(row, filters, timezone = 'America/Guatemala') {
  const day = statementDate(row.date, timezone)
  if (filters.from && day < filters.from || filters.to && day > filters.to) return false
  if (filters.kind !== 'ALL' && row.kind !== filters.kind) return false
  if (filters.state === 'ALL') return true
  if (!row.sale) return false
  if (filters.state === 'OVERDUE') return row.sale.vencida
  return row.sale.payment_status === filters.state
}

export function receivablesCsvText(rows) {
  const escape = value => {
    let text = String(value ?? '')
    if (typeof value === 'string' && (/^\s*[=+@-]/.test(text) || /^[\t\r]/.test(text))) text = `'${text}`
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return '\uFEFF' + rows.map(row => row.map(escape).join(';')).join('\n')
}

export function downloadReceivablesCsv(name, rows) {
  const url = URL.createObjectURL(new Blob([receivablesCsvText(rows)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
