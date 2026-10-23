import { CollectionEmptyState } from './CollectionEmptyState'
import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronsUpDown, Loader2, Package, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { adaptApiProduct, fetchProducts } from '@/services/productService'
import type { Product } from '@/types/product'
import { LoadingIndicator, LoadingState } from './LoadingState'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import {exactProductValues,formatUnitDecimal,formatUnitMoney} from '@/modules/inventory/units/public'
export function ProductPicker({ companyId,branchId, onPick, money = String, supplierId, purchase = false, inventory = false, locationId, excludedIds = [] }: { companyId?:string;branchId?: string; onPick: (product: Product) => void; money?: (value: number) => string; supplierId?: string; purchase?: boolean; inventory?: boolean; locationId?: string; excludedIds?: string[] }) {
  const {inventoryServicesEnabled,locale,currencyCode}=useSystemSettings()
  const catalogType = !purchase && !inventory && inventoryServicesEnabled ? 'all' : 'goods'
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
    queryKey: ['document-product-picker', branchId, supplierId, purchase, inventory, locationId, debouncedSearch, catalogType,companyId],
    queryFn: ({ pageParam,signal }) => fetchProducts({
      page: pageParam,
      catalogType,
      pageSize: 24,
      search: debouncedSearch || undefined,
      forSaleOnly: !purchase && !inventory,
      inBranchOnly: !purchase,
      supplier: supplierId,
      branchId,
      locationId,
    },{signal,...(companyId?{headers:{'X-Company-Id':companyId,'X-Branch-Id':branchId??''}}:{})}),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
    enabled: open && Boolean(branchId),
    staleTime: 30_000,
  })
  const products = useMemo(() => {
    const unique = new Map<string, Product>()
    query.data?.pages.forEach((page) => page.items.map(adaptApiProduct).forEach((product) => unique.set(product.id, product)))
    return [...unique.values()]
  }, [query.data])

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-12 w-full justify-between rounded-xl font-normal" disabled={!branchId}>
        <span className="flex items-center gap-2 text-muted-foreground"><Search className="h-4 w-4" />Buscar por nombre o código…</span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,620px)] p-0" align="start">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Buscar producto…" value={search} onValueChange={setSearch} />
        <CommandList>
          {query.isFetching && !query.isFetchingNextPage && products.length > 0 && <LoadingIndicator message="Actualizando productos…" />}
          {query.isFetching && !query.isFetchingNextPage && !products.length
            ? <LoadingState size="sm" message="Buscando productos…" />
            : query.isError
              ? <div className="p-6 text-center text-sm text-destructive">No se pudieron cargar los productos.</div>
              : <>{!products.length && <CollectionEmptyState compact title="Tu catálogo tendrá su lugar aquí" description="Los productos disponibles para esta selección aparecerán aquí." filtered={!!search.trim() || !!debouncedSearch} onReset={() => {setSearch('');setDebouncedSearch('')}} />}<CommandGroup>
                <ScrollArea className={products.length ? "h-[min(55vh,390px)]" : ""}><div className="space-y-1 p-1">
                  {products.map((product) => <CommandItem key={product.id} value={product.id} disabled={excludedIds.includes(product.id)} className="gap-3 py-2" onSelect={() => { onPick(product); setOpen(false) }}>
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-12 w-12 rounded-xl border object-cover" />
                      : <img src="/placeholder.svg" alt={'Sin imagen de '+product.name} loading="lazy" className="h-12 w-12 shrink-0 rounded-xl border object-contain" />}
                    <span className="min-w-0 flex-1"><strong className="block truncate">{product.name}</strong><small className="block truncate text-muted-foreground">{product.barcode || 'Sin código'} · {product.kind === 'SERVICE' ? `${product.serviceUnitLabel} · Sin control de existencias` : product.unitConfiguration?`Stock: ${formatUnitDecimal(exactProductValues(product).stock,locale)} ${product.unitConfiguration.base_unit?.label??'unidades'}`:`Stock: ${product.stock}`}</small></span>
                    <strong className="tabular-nums">{excludedIds.includes(product.id) ? 'Agregado' : product.unitConfiguration?inventory?`${formatUnitDecimal(exactProductValues(product).stock,locale)} ${product.unitConfiguration.base_unit?.label??''}`:`${formatUnitMoney(purchase?exactProductValues(product).cost:exactProductValues(product).price,locale,currencyCode)} / ${product.unitConfiguration.base_unit?.label??'unidad'}`:inventory ? `${product.stock} unidades` : money(purchase ? product.cost ?? 0 : product.price)}</strong>
                  </CommandItem>)}
                  {query.hasNextPage ? <Button type="button" variant="secondary" size="sm" className="mt-2 w-full" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Cargar más resultados</Button> : null}
                </div></ScrollArea>
              </CommandGroup></>}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
}
