import { useId, useState, type ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import './compactList.css'

type CompactFilterPanelProps = {
  children: ReactNode
  search?: ReactNode
  activeCount?: number
  title?: string
  summary?: string
  onClear?: () => void
  onApply?: () => void
  applyDisabled?: boolean
  className?: string
  contentClassName?: string
  appliedFilters?: { label: string; onRemove: () => void }[]
}

export function CompactFilterPanel({ children, search, activeCount = 0, title = 'Filtros', summary, onClear, onApply, applyDisabled, className, contentClassName, appliedFilters = [] }: CompactFilterPanelProps) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  return <section className={cn('compact-filter-toolbar', className)} aria-label={title}>
    <div className="flex flex-wrap items-end gap-2">
      {search && <div className="compact-filter-search min-w-0 flex-1">{search}</div>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 gap-2" aria-label={title}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Filtros{activeCount > 0 && <span className="tabular-nums text-brand-orange">· {activeCount}</span>}</Button></PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="compact-filter-popover" aria-labelledby={titleId}>
          <div className="mb-4 flex items-center justify-between gap-3"><h2 id={titleId} className="text-sm font-semibold">{title}</h2><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Cerrar filtros" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
          {summary && <p className="sr-only">{summary}</p>}
          <div className={cn('compact-filter-fields', contentClassName)}>{children}</div>
          <div className="mt-4 flex justify-end border-t pt-3"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cerrar</Button></div>
        </PopoverContent>
      </Popover>
      {onApply && <Button type="button" className="h-10 bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={onApply} disabled={applyDisabled}>Aplicar</Button>}
      {onClear && activeCount > 0 && <Button type="button" variant="ghost" className="h-10 text-muted-foreground" onClick={onClear}>Limpiar</Button>}
    </div>
    {!!appliedFilters.length && <div className="mt-2 flex flex-wrap gap-2" aria-label="Filtros aplicados">{appliedFilters.map(filter => <button key={filter.label} type="button" onClick={filter.onRemove} className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-md border px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Quitar ${filter.label}`}><span className="truncate">{filter.label}</span><X className="h-3 w-3 shrink-0" aria-hidden="true" /></button>)}</div>}
  </section>
}
