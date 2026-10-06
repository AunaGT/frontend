import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'

export function CatalogFilters({ search, onSearch, order, onOrder, children, extraFilters = [], onClearExtra }: {
  search: string
  onSearch: (value: string) => void
  order: 'asc' | 'desc'
  onOrder: (value: 'asc' | 'desc') => void
  children?: ReactNode
  extraFilters?: { label: string; onRemove: () => void }[]
  onClearExtra?: () => void
}) {
  const appliedFilters = [
    ...(search.trim() ? [{ label: `Búsqueda: ${search}`, onRemove: () => onSearch('') }] : []),
    ...(order !== 'asc' ? [{ label: 'Orden: Z–A', onRemove: () => onOrder('asc') }] : []),
    ...extraFilters,
  ]
  return <CompactFilterPanel className="px-4 pb-4 sm:px-6" title="Filtros del catálogo" activeCount={appliedFilters.length} appliedFilters={appliedFilters} onClear={() => { onSearch(''); onOrder('asc'); onClearExtra?.() }} search={
    <div className="relative min-w-0"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar en el catálogo" placeholder="Buscar por nombre…" value={search} onChange={e => onSearch(e.target.value)} className="pl-10" /></div>
  }>
    <label className="space-y-1 text-xs">Ordenar por nombre<select className="auna-control auna-control-select" aria-label="Ordenar por nombre" value={order} onChange={e => onOrder(e.target.value as 'asc' | 'desc')}><option value="asc">Nombre (A–Z)</option><option value="desc">Nombre (Z–A)</option></select></label>
    {children}
  </CompactFilterPanel>
}
