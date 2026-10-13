import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import './compactList.css'

type Metric = { label: string; value: ReactNode; hint?: string; alert?: boolean; onClick?: () => void; active?: boolean }
export function MetricStrip({ items, label = 'Resumen', className, loading = false }: { items: Metric[]; label?: string; className?: string; loading?: boolean }) {
  return <section aria-label={label} aria-busy={loading || undefined} className={cn('metric-strip', className)}>{items.map(item => {
    const content = <><span className="metric-strip-label">{item.label}</span><strong className={cn('metric-strip-value', item.alert && 'text-destructive')}>{loading ? <Skeleton className="mt-1 h-5 w-20" /> : item.value}</strong>{!loading && item.hint && <small className="text-muted-foreground">{item.hint}</small>}</>
    return item.onClick ? <button type="button" disabled={loading} key={item.label} className="metric-strip-item metric-strip-action" onClick={item.onClick} aria-pressed={item.active}>{content}</button> : <div key={item.label} className="metric-strip-item">{content}</div>
  })}</section>
}
