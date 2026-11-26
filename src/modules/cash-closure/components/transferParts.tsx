import { Badge } from '@/components/ui/badge'
import type { CashTransfer, TransferStatus } from '@/services/cashCustodyService'

export const CASH_TRANSFERS_PATH = '/cierre-caja/traslados'
export const handoverPath = (sessionId: string) => `/cierre-caja/turnos/${encodeURIComponent(sessionId)}/entregar`
// Centavos exactos a partir del texto del importe: solo para mostrar diferencias, nunca para enviar dinero.
export const cents = (value: string) => { const m = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim()); return m ? Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0')) : null }
export const fromCents = (value: number) => (value / 100).toFixed(2)
export const AMOUNT = /^\d{1,10}(\.\d{1,2})?$/
export const exactAmount = (value: string) => { const [whole, part = ''] = value.trim().split('.'); return `${whole.replace(/^0+(?=\d)/, '')}.${part.padEnd(2, '0')}` }
export function originLabel(t: CashTransfer) {
  return t.origin_kind === 'CUSTODY' ? t.origin_custody_name || 'Custodia' : t.origin_kind === 'FLOAT' ? `Fondo retenido · ${t.origin_register_name}`
    : t.origin_kind === 'HANDOVER' ? `Entrega de turno · ${t.origin_register_name}` : t.origin_kind === 'RETURN' ? 'Devolución' : `Turno · ${t.origin_register_name}`
}
export const destinationLabel = (t: CashTransfer) => t.destination_kind === 'CUSTODY' ? t.destination_custody_name || 'Custodia' : `Caja · ${t.destination_register_name}`
const STATUS: Record<TransferStatus, [string, 'default' | 'secondary' | 'outline' | 'destructive']> = { PENDING: ['Por recibir', 'secondary'], RECEIVED: ['Recibido', 'default'], REJECTED: ['Rechazado', 'destructive'] }
export const TransferStatusBadge = ({ status }: { status: TransferStatus }) => <Badge variant={STATUS[status][1]}>{STATUS[status][0]}</Badge>
// Diferencia con signo y en palabras: el color no es la única señal.
export function differenceText(value: string | null, money: (amount: string) => string = amount => amount) {
  if (value === null) return null
  const n = cents(value.replace('-', '')) ?? 0
  return n === 0 ? 'Sin diferencia' : value.startsWith('-') ? `Faltante ${money(fromCents(n))}` : `Sobrante ${money(fromCents(n))}`
}
