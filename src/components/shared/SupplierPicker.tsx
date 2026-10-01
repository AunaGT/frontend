import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronsUpDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandItem, CommandGroup } from '@/components/ui/command'
import { fetchSuppliers } from '@/services/supplierService'
import type { Supplier } from '@/types'

export function SupplierPicker({ label, onSelect, allowAll = false }: { label: string; onSelect: (supplier: Supplier | null) => void; allowAll?: boolean }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [queryText, setQueryText] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setQueryText(search.trim()), 280)
    return () => window.clearTimeout(timer)
  }, [search])
  const query = useInfiniteQuery({
    queryKey: ['supplier-picker', queryText],
    queryFn: ({ pageParam }) => fetchSuppliers({ party_type: 'SUPPLIER', page: pageParam, pageSize: 24, search: queryText || undefined }),
    initialPageParam: 1,
    getNextPageParam: page => page.nextPage ?? undefined,
    enabled: open,
    staleTime: 30_000,
  })
  const suppliers = query.data?.pages.flatMap(page => page.items) ?? []
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal"><span className="truncate">{label}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
      <Command shouldFilter={false}><CommandInput placeholder="Buscar proveedor…" value={search} onValueChange={setSearch} /><CommandList>
        <CommandGroup>
          {allowAll && <CommandItem value="all" onSelect={() => { onSelect(null); setOpen(false) }}>Todos los proveedores</CommandItem>}
          {suppliers.map(supplier => <CommandItem key={supplier.id} value={supplier.id} onSelect={() => { onSelect(supplier); setOpen(false) }}><span><strong className="block">{supplier.name}</strong><small className="text-muted-foreground">{supplier.phone || supplier.email || supplier.contact}</small></span></CommandItem>)}
        </CommandGroup>
        {query.isFetching && <div role="status" className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>}
        {query.isError && <p role="alert" className="p-4 text-sm text-destructive">No se pudieron cargar los proveedores.</p>}
        {!query.isFetching && !query.isError && !suppliers.length && <p className="p-4 text-sm text-muted-foreground">Sin proveedores para esta búsqueda.</p>}
        {query.hasNextPage && <Button type="button" variant="ghost" className="w-full" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Cargar más resultados</Button>}
      </CommandList></Command>
    </PopoverContent>
  </Popover>
}
