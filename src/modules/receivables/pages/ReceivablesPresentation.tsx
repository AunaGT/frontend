import { AlertTriangle, CalendarClock, Coins, Users, Wallet } from 'lucide-react'
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
    { label: 'Saldo total por cobrar', value: money(balance), icon: Coins, color: 'text-brand-orange bg-brand-orange/10' },
    { label: customers === undefined ? 'Por vencer' : 'Saldo vencido', value: money(customers === undefined ? upcoming : overdue), icon: customers === undefined ? CalendarClock : AlertTriangle, color: customers === undefined ? 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/10' : 'text-rose-600 dark:text-rose-300 bg-rose-500/10' },
    { label: customers === undefined ? 'Vencido (1–30 días)' : 'Saldo por vencer', value: money(customers === undefined ? Math.max(0, overdue - (oldOverdue ?? 0)) : upcoming), icon: Wallet, color: 'text-amber-600 dark:text-amber-300 bg-amber-500/10' },
    { label: customers === undefined ? 'Vencido (+30 días)' : 'Clientes con saldo', value: customers === undefined ? money(oldOverdue ?? 0) : String(customers), icon: customers === undefined ? AlertTriangle : Users, color: customers === undefined ? 'text-rose-600 dark:text-rose-300 bg-rose-500/10' : 'text-blue-600 dark:text-blue-300 bg-blue-500/10' },
  ]
  return <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de cartera">{cards.map(({ label, value, icon: Icon, color }) => <div key={label} className="flex min-w-0 items-center gap-4 rounded-2xl border bg-card p-5"><span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${color}`}><Icon className="h-6 w-6" /></span><div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 break-words text-2xl font-bold tabular-nums">{value}</p></div></div>)}</section>
}
