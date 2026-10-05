import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

type CompactFilterPanelProps = {
  children: ReactNode
  activeCount?: number
  title?: string
  summary?: string
  defaultOpen?: boolean
  onClear?: () => void
  className?: string
  contentClassName?: string
}

export function CompactFilterPanel({
  children,
  activeCount = 0,
  title = 'Filtros',
  summary = 'Acota los resultados del listado',
  defaultOpen = false,
  onClear,
  className,
  contentClassName,
}: CompactFilterPanelProps) {
  const [open, setOpen] = useState(defaultOpen || activeCount > 0)

  useEffect(() => {
    if (activeCount > 0) setOpen(true)
  }, [activeCount])

  return <Collapsible open={open} onOpenChange={setOpen} className={cn('rounded-2xl border border-border/70 bg-card shadow-sm dark:bg-[#101f34]', className)}>
    <div className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-2">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-orange/10 text-brand-orange"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /></span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">{title}{activeCount > 0 && <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[11px] font-bold text-white">{activeCount}</span>}</span>
            <span className="block truncate text-xs text-muted-foreground">{activeCount > 0 ? `${activeCount} ${activeCount === 1 ? 'filtro activo' : 'filtros activos'}` : summary}</span>
          </span>
          <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </CollapsibleTrigger>
      {onClear && activeCount > 0 && <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onClear}><X className="mr-1 h-4 w-4" />Limpiar</Button>}
    </div>
    <CollapsibleContent>
      <div className={cn('border-t border-border/70 p-4', contentClassName)}>{children}</div>
    </CollapsibleContent>
  </Collapsible>
}
