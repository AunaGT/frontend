import { Ban, Box, CheckCircle2, Clock3, Truck } from 'lucide-react'
import type { OrderStatus } from '@/services/orderService'
import { orderVisualState, type DeliveryState, type PreparationState } from '../ordersViewModel'

const PREPARATION = {
  pending: { label: 'Pendiente', style: 'bg-slate-500/15 text-slate-600 dark:text-slate-300', icon: Clock3 },
  preparing: { label: 'En preparación', style: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', icon: Box },
  ready: { label: 'Listo', style: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  delayed: { label: 'Retrasado', style: 'bg-red-500/15 text-red-700 dark:text-red-300', icon: Clock3 },
  cancelled: { label: 'Cancelado', style: 'bg-red-500/15 text-red-700 dark:text-red-300', icon: Ban },
} as const

const DELIVERY = {
  pending: { label: 'Pendiente', style: 'bg-slate-500/15 text-slate-600 dark:text-slate-300', icon: Clock3 },
  transit: { label: 'En tránsito', style: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', icon: Truck },
  delivered: { label: 'Entregado', style: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', style: 'bg-red-500/15 text-red-700 dark:text-red-300', icon: Ban },
} as const

function Badge({ config, showIcon = false }: { config: { label: string; style: string; icon: typeof Clock3 }; showIcon?: boolean }) {
  const Icon = config.icon
  return <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${config.style}`}>{showIcon ? <Icon className="h-4 w-4" /> : <i className="h-2.5 w-2.5 rounded-full bg-current" />}{config.label}</span>
}

export const PreparationBadge = ({ state }: { state: PreparationState }) => <Badge config={PREPARATION[state]} />
export const DeliveryBadge = ({ state, showIcon = false }: { state: DeliveryState; showIcon?: boolean }) => <Badge config={DELIVERY[state]} showIcon={showIcon} />

export function OrderStatusBadge({ status, showIcon = true }: { status: OrderStatus; showIcon?: boolean }) {
  const visual = orderVisualState(status)
  return status === 'PARTIALLY_FULFILLED' || status === 'FULFILLED'
    ? <DeliveryBadge state={visual.delivery} showIcon={showIcon} />
    : <Badge config={PREPARATION[visual.preparation]} showIcon={showIcon} />
}
