import { Badge } from '@/components/ui/badge'
import type { MerchandisePaymentStatus } from '../api/incomingMerchandiseService'

export function PaymentStatusBadge({ status = 'PENDING' }: { status?: MerchandisePaymentStatus }) {
  const color = status === 'PAID' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : status === 'PARTIAL' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
  return <Badge variant="outline" className={`border-0 ${color}`}><span aria-hidden="true" className="mr-1.5">●</span>{status === 'PAID' ? 'Pagado' : status === 'PARTIAL' ? 'Parcial' : 'Pendiente'}</Badge>
}
