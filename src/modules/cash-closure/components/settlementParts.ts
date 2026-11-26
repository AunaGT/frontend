// Cuadre de una liquidación en centavos exactos: cobros − reembolsos − deducciones + recuperaciones = neto depositado.
export const CASH_SETTLEMENTS_PATH = '/cierre-caja/liquidaciones'
export const CASH_BANK_METHODS_PATH = '/cierre-caja/medios-bancarios'
const cents = (value: string) => { const m = /^(-?)(\d{1,10})(?:\.(\d{1,2}))?$/.exec(String(value ?? '').trim()); return m ? (m[1] ? -1 : 1) * (Number(m[2]) * 100 + Number((m[3] || '').padEnd(2, '0'))) : null }
const fmt = (c: number) => `${c < 0 ? '-' : ''}${Math.floor(Math.abs(c) / 100)}.${String(Math.abs(c) % 100).padStart(2, '0')}`
// Las recuperaciones de disputas que el proveedor suma al depósito aumentan el neto.
export function settlementBalance({ allocations, deductions, recoveries = [], net }: { allocations: { direction: 'IN' | 'OUT'; amount: string }[]; deductions: { amount: string }[]; recoveries?: { amount: string }[]; net: string }) {
  const sum = (list: { amount: string }[]) => list.reduce((s, x) => s + (cents(x.amount) ?? 0), 0)
  const gross = sum(allocations.filter(a => a.direction === 'IN')), refunds = sum(allocations.filter(a => a.direction === 'OUT')), deducted = sum(deductions), recovered = sum(recoveries)
  const expected = gross - refunds - deducted + recovered, netCents = cents(net)
  return { gross: fmt(gross), refunds: fmt(refunds), deductions: fmt(deducted), recoveries: fmt(recovered), expected: fmt(expected), difference: fmt(netCents == null ? -expected : netCents - expected),
    balanced: allocations.length > 0 && netCents != null && netCents > 0 && netCents === expected }
}
export const MODE_LABEL = { DIRECT: 'Directo al banco', DEFERRED: 'Lo liquida un proveedor' } as const
// Fecha operativa de hoy en la zona horaria de la empresa (YYYY-MM-DD), no la del navegador.
export const todayIn = (timezone?: string | null, now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
export const CASH_DAY_PATH = '/cierre-caja/dia'
