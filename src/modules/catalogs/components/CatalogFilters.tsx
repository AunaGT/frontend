import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function CatalogFilters({ search, onSearch, order, onOrder }: {
  search: string
  onSearch: (value: string) => void
  order: 'asc' | 'desc'
  onOrder: (value: 'asc' | 'desc') => void
}) {
  return <div className="catalog-filters">
    <div className="relative min-w-0 flex-1">
      <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="Buscar en el catálogo" placeholder="Buscar por nombre…" value={search} onChange={e => onSearch(e.target.value)} className="h-11 pl-10" />
    </div>
    <select aria-label="Ordenar por nombre" className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground [color-scheme:light] dark:[color-scheme:dark]" value={order} onChange={e => onOrder(e.target.value as 'asc' | 'desc')}>
      <option value="asc">Nombre (A–Z)</option><option value="desc">Nombre (Z–A)</option>
    </select>
    <Button variant="outline" className="h-11" onClick={() => { onSearch(''); onOrder('asc') }}>Limpiar</Button>
  </div>
}
