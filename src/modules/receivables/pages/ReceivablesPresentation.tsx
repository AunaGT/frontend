import { MetricStrip } from '@/components/shared/MetricStrip'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { formatMoney } from '@/utils/formatters'
import type { StatementSale } from '../api/receivablesService'

export const ReceivableStatus = ({ sale }: { sale: Pick<StatementSale, 'payment_status' | 'vencida'> }) => {
  const paid = sale.payment_status === 'PAID'
  const color = paid ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : sale.vencida ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${color}`}><span className="h-2 w-2 rounded-full bg-current" />{paid ? 'Pagada' : sale.vencida ? 'Vencida' : sale.payment_status === 'PARTIAL' ? 'Abonada' : 'Por vencer'}</span>
}

export const ReceivableMetrics = ({ balance, overdue, upcoming, customers, oldOverdue }: { balance: number; overdue: number; upcoming: number; customers?: number; oldOverdue?: number }) => {
  const { locale, currencyCode } = useSystemSettings()
  const money = (value: number) => formatMoney(value, locale, currencyCode)
  const cards = [
    { label: 'Saldo total por cobrar', value: money(balance) },
    { label: customers === undefined ? 'Por vencer' : 'Saldo vencido', value: money(customers === undefined ? upcoming : overdue), alert: customers !== undefined && overdue > 0 },
    { label: customers === undefined ? 'Vencido (1–30 días)' : 'Saldo por vencer', value: money(customers === undefined ? Math.max(0, overdue - (oldOverdue ?? 0)) : upcoming), alert: customers === undefined && overdue - (oldOverdue ?? 0) > 0 },
    { label: customers === undefined ? 'Vencido (+30 días)' : 'Clientes con saldo', value: customers === undefined ? money(oldOverdue ?? 0) : String(customers), alert: customers === undefined && (oldOverdue ?? 0) > 0 },
  ]
  return <MetricStrip label="Resumen de cartera" items={cards} />
}
