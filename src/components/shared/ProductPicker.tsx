import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronsUpDown, Loader2, Package, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { adaptApiProduct, fetchProducts } from '@/services/productService'
import type { Product } from '@/types/product'
export function ProductPicker({ branchId, onPick, money, supplierId, purchase = false, excludedIds = [] }: { branchId?: string; onPick: (product: Product) => void; money: (value: number) => string; supplierId?: string; purchase?: boolean; excludedIds?: string[] }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!open) { setSearch(''); setDebouncedSearch('') }
  }, [open])

  const query = useInfiniteQuery({
    queryKey: ['document-product-picker', branchId, supplierId, purchase, debouncedSearch],
    queryFn: ({ pageParam }) => fetchProducts({
      page: pageParam,
      pageSize: 24,
      search: debouncedSearch || undefined,
      forSaleOnly: !purchase,
      inBranchOnly: !purchase,
      supplier: supplierId,
      branchId,
    }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
    enabled: open && (purchase ? Boolean(supplierId) : Boolean(branchId)),
    staleTime: 30_000,
  })
  const products = useMemo(() => {
    const unique = new Map<string, Product>()
    query.data?.pages.forEach((page) => page.items.map(adaptApiProduct).forEach((product) => unique.set(product.id, product)))
    return [...unique.values()]
  }, [query.data])

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-12 w-full justify-between rounded-xl font-normal" disabled={purchase ? !supplierId : !branchId}>
        <span className="flex items-center gap-2 text-muted-foreground"><Search className="h-4 w-4" />Buscar por nombre o código…</span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,620px)] p-0" align="start">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Buscar producto…" value={search} onValueChange={setSearch} />
        <CommandList>
          {query.isFetching && !query.isFetchingNextPage && !products.length
            ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando…</div>
            : query.isError
              ? <div className="p-6 text-center text-sm text-destructive">No se pudieron cargar los productos.</div>
              : <><CommandEmpty>Sin productos disponibles para esta búsqueda.</CommandEmpty><CommandGroup>
                <ScrollArea className="h-[min(55vh,390px)]"><div className="space-y-1 p-1">
                  {products.map((product) => <CommandItem key={product.id} value={product.id} disabled={excludedIds.includes(product.id)} className="gap-3 py-2" onSelect={() => { onPick(product); setOpen(false) }}>
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-12 w-12 rounded-xl border object-cover" />
                      : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10"><Package className="h-5 w-5 text-brand-orange" /></span>}
                    <span className="min-w-0 flex-1"><strong className="block truncate">{product.name}</strong><small className="block truncate text-muted-foreground">{product.barcode || 'Sin código'} · Stock: {product.stock}</small></span>
                    <strong className="tabular-nums">{excludedIds.includes(product.id) ? 'Agregado' : money(purchase ? product.cost ?? 0 : product.price)}</strong>
                  </CommandItem>)}
                  {query.hasNextPage ? <Button type="button" variant="secondary" size="sm" className="mt-2 w-full" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Cargar más resultados</Button> : null}
                </div></ScrollArea>
              </CommandGroup></>}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
}
