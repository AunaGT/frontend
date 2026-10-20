import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RankingRow } from '../analyticsViewModel'
import { SERIES, percent } from './chartTheme'

export function Empty({ children }: { children: ReactNode }) {
  return <CollectionEmptyState compact title="Los datos contarán la historia" description={typeof children === 'string' ? children : 'Los resultados de este alcance aparecerán aquí cuando estén disponibles.'} />
}

export function ChartCard({ title, description, aside, children, className, bodyClassName }: {
  title: string
  description?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card className={cn('auna-surface flex flex-col rounded-2xl', className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-6">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {aside}
      </div>
      <div className={cn('flex-1 px-5 pb-5 pt-4', bodyClassName)}>{children}</div>
    </Card>
  )
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string; line?: boolean }> }) {
  return (
    <ul className="analytics-legend" aria-label="Leyenda">
      {items.map((item) => <li key={item.label}><i className={item.line ? 'is-line' : undefined} style={{ background: item.color }} aria-hidden />{item.label}</li>)}
    </ul>
  )
}

type TooltipEntry = { name?: string | number; value?: unknown; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }

export function ChartTooltip({ active, payload, label, format, footer }: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: ReactNode
  format: (value: number) => string
  footer?: (row: Record<string, unknown>) => [string, string] | null
}) {
  const rows = payload?.filter((entry) => entry.value != null) ?? []
  if (!active || !rows.length) return null
  const extra = footer?.(rows[0].payload ?? {})
  return (
    <div className="analytics-tooltip">
      {label != null ? <p className="analytics-tooltip-label">{label}</p> : null}
      {rows.map((entry) => (
        <div key={String(entry.dataKey ?? entry.name)} className="analytics-tooltip-row">
          <i style={{ background: entry.color }} aria-hidden />
          <span>{entry.name}</span>
          <strong>{format(Number(entry.value))}</strong>
        </div>
      ))}
      {extra ? <div className="analytics-tooltip-footer"><span>{extra[0]}</span><strong>{extra[1]}</strong></div> : null}
    </div>
  )
}

export function RankedBars({ label, rows, format, color = SERIES.sales }: {
  label: string
  rows: RankingRow[]
  format: (value: number) => string
  color?: string
}) {
  if (!rows.length) return <Empty>Este período todavía no tiene datos para esta consulta. Prueba otro rango de fechas.</Empty>
  const max = Math.max(0, ...rows.map((row) => row.value))
  return (
    <ol className="analytics-ranking" aria-label={label}>
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="min-w-0 [overflow-wrap:anywhere]">{row.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {format(row.value)}
              {row.share != null ? <span className="ml-2 inline-block w-12 text-right text-xs font-normal text-muted-foreground">{percent(row.share)}</span> : null}
            </span>
          </div>
          <div className="analytics-track mt-1.5" aria-hidden>
            <span style={{ width: `${max > 0 ? (Math.max(0, row.value) / max) * 100 : 0}%`, background: row.isOther ? 'var(--analytics-other)' : color }} />
          </div>
          {row.detail ? <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p> : null}
        </li>
      ))}
    </ol>
  )
}

export function StockHealth({ segments, formatNumber, inline = false }: {
  segments: Array<{ key: string; label: string; value: number }>
  formatNumber: (value: number) => string
  inline?: boolean
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const share = (value: number) => percent(total > 0 ? value / total : 0)
  return (
    <div className={cn('grid gap-5', inline && 'lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-10')}>
      <p className="flex items-baseline gap-2">
        <strong className="text-3xl font-semibold leading-none">{formatNumber(total)}</strong>
        <span className="text-sm text-muted-foreground">productos</span>
      </p>
      <div className="space-y-4">
        <div className="analytics-meter" role="img" aria-label={segments.map((segment) => `${segment.label}: ${formatNumber(segment.value)} (${share(segment.value)})`).join(', ')}>
          {segments.filter((segment) => segment.value > 0).map((segment) => (
            <span key={segment.key} style={{ flexGrow: segment.value, background: `var(--analytics-stock-${segment.key})` }} />
          ))}
        </div>
        <ul className={cn('grid gap-2.5 text-sm', inline && 'sm:flex sm:flex-wrap sm:gap-x-10')}>
          {segments.map((segment) => (
            <li key={segment.key} className={cn('flex items-center justify-between gap-3', inline && 'sm:justify-start sm:gap-4')}>
              <span className="flex items-center gap-2">
                <i className="h-2.5 w-2.5 rounded-sm" style={{ background: `var(--analytics-stock-${segment.key})` }} aria-hidden />
                {segment.label}
              </span>
              <span className="tabular-nums">
                <strong className="font-semibold">{formatNumber(segment.value)}</strong>
                <span className="ml-3 inline-block w-12 text-right text-muted-foreground">{share(segment.value)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function ShareBar({ ratio, scale, color = SERIES.sales }: { ratio: number; scale: number; color?: string }) {
  return (
    <span className="analytics-share">
      <span className="analytics-track" aria-hidden><span style={{ width: `${Math.max(0, scale) * 100}%`, background: color }} /></span>
      {percent(ratio)}
    </span>
  )
}

// Muestra las primeras filas y despliega el resto en la misma tabla, sin scroll interno.
export function ExpandableTable({ label, columns, rows, limit = 8 }: {
  label: string
  columns: Array<{ label: string; numeric?: boolean }>
  rows: Array<{ key: string; cells: ReactNode[] }>
  limit?: number
}) {
  const [expanded, setExpanded] = useState(false)
  if (!rows.length) return <Empty>Este período todavía no tiene datos para esta consulta. Prueba otro rango de fechas.</Empty>
  const visible = expanded ? rows : rows.slice(0, limit)
  return (
    <>
      <div className="auna-data-table-shell auna-table-embedded overflow-x-auto">
        <table aria-label={label}>
          <thead>
            <tr>{columns.map((column) => <th key={column.label} className={column.numeric ? 'text-right' : undefined}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, index) => <td key={columns[index].label} className={columns[index].numeric ? 'text-right tabular-nums' : undefined}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit ? (
        <div className="analytics-table-footer">
          <Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Ver menos' : `Ver las ${rows.length} categorías`}
            <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
          </Button>
        </div>
      ) : null}
    </>
  )
}
