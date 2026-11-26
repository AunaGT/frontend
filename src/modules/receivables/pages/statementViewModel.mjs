/** Cartera: cargos netos y abonos aplicados o libres; el recibo conserva su importe original. */
export function paymentAllocationLabel(payment){
  if(Number(payment.retenido)>0)return 'En revisión'
  if(Number(payment.comprometido)>0)return 'Comprometido'
  if(Number(payment.no_aplicado)>0)return 'Saldo a favor'
  if(Number(payment.saldo_cancelado)>0)return 'Saldo ajustado'
  if(Number(payment.devuelto)>0)return 'Con devolución'
  return 'Aplicado'
}
export const CHARGE_KIND = 'DISPUTE_CHARGE'
export function documentKindLabel(kind, paymentLabels = {}) {
  if (kind === 'SALE') return 'Factura'
  if (kind === CHARGE_KIND) return 'Cargo por contracargo'
  if (kind === 'RECOVERY_CREDIT') return 'Crédito por recuperación'
  return paymentLabels[kind] || kind
}
/** Cargo por contracargo con la forma de una factura: tabla, filtros, estados y cobro manual lo reutilizan. */
export function chargeDocuments(statement) {
  return (statement.cargos || []).map(charge => {
    const total = Math.round((charge.total - charge.recuperado) * 100) / 100
    return { id: charge.id, documentType: CHARGE_KIND, reference: charge.reference, date: charge.date, due_date: charge.due_date, total, abonado: charge.abonado, saldo: charge.saldo,
      payment_status: charge.saldo <= 0.005 ? 'PAID' : charge.abonado > 0.005 ? 'PARTIAL' : 'PENDING', vencida: charge.vencido, dias_vencida: charge.dias_vencido, charge }
  })
}
export function statementMovements(statement) {
  const movements = [
    ...statement.ventas.map(sale => ({ id: sale.id, date: sale.date, reference: sale.reference || sale.id.slice(0, 8), kind: 'SALE', charge: sale.total, credit: 0, sale })),
    // El cargo entra neto de lo recuperado o condonado, como la factura entra neta de devoluciones.
    ...chargeDocuments(statement).map(doc => ({ id: doc.id, date: doc.date, reference: doc.reference, kind: CHARGE_KIND, charge: doc.total, credit: 0, sale: doc })),
    ...(statement.creditos_recuperacion || []).map(credit => ({ id: credit.id, date: credit.created_at, reference: 'Recuperación', kind: 'RECOVERY_CREDIT', charge: 0, credit: credit.disponible })),
    ...statement.cobros.map(payment => {
      const unavailable=Number(payment.comprometido||0)+Number(payment.devuelto||0)+Number(payment.retenido||0)+Number(payment.saldo_cancelado||0)
      const credit=Math.round(Math.max(0,payment.amount-unavailable)*100)/100
      return { id: payment.id, date: payment.paid_at, reference: payment.reference || payment.id.slice(0, 8), kind: payment.kind, charge: 0, credit, documentAmount:payment.amount, payment }
    }),
  ].sort((a, b) => new Date(a.date) - new Date(b.date) || Number(b.kind === 'SALE') - Number(a.kind === 'SALE') || a.id.localeCompare(b.id))
  const closing = statement.resumen.saldo - statement.resumen.credito_disponible - (statement.resumen.credito_recuperacion || 0)
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
