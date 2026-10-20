import { TABLE_PAGE_SIZES } from '@/utils/pagination'
/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useState } from 'react'
import { Link,useSearchParams } from 'react-router-dom'
import { ArrowLeft, PackageOpen, RotateCcw, Search } from 'lucide-react'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Pagination } from '@/components/shared/Pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useCategories } from '@/hooks/useCategories'
import { useDeletedProducts, useRestoreProduct } from '@/hooks/useProducts'
import { usePersistedListUiState } from '@/hooks/usePersistedListUiState'
import { useToast } from '@/hooks/use-toast'
import { adaptApiProduct } from '@/services/productService'
import type { Product } from '@/types'

export default function DeletedProductsPage() {
  const [searchParams]=useSearchParams()
  const serviceCatalog=searchParams.get('tipo')==='services'
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const canRestore = hasPermission('products.register_incoming', 'products.edit')
  const { page, setPage, pageSize, setPageSize } = usePersistedListUiState('inventario/productos-eliminados', { defaultPageSize: 50 })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [restoreConfirmProduct, setRestoreConfirmProduct] = useState<Product | null>(null)
  const { data: categories = [] } = useCategories({ includeDeleted: true, allPages: true })
  const effectivePageSize = Math.min(100, pageSize)
  const { data, isLoading, isFetching, isError, refetch } = useDeletedProducts({ ...(serviceCatalog ? {catalogType:'services' as const} : {}),page, pageSize: effectivePageSize, search: debouncedSearch, category, includeSummary: true })
  const restoreMutation = useRestoreProduct()
  const products = (data?.items ?? []).map(adaptApiProduct)
  const summary = data?.summary

  useEffect(() => {
    if (search.trim() === debouncedSearch) return
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, debouncedSearch, setPage])

  useEffect(() => {
    if (data && data.page !== page) setPage(data.page)
  }, [data, page, setPage])

  const clearFilters = () => { setSearch(''); setDebouncedSearch(''); setCategory('all'); setPage(1) }
  const appliedFilters = [
    ...(search.trim() ? [{ label: `Búsqueda: ${search.trim()}`, onRemove: () => { setSearch(''); setDebouncedSearch(''); setPage(1) } }] : []),
    ...(category !== 'all' ? [{ label: `Categoría: ${category}`, onRemove: () => { setCategory('all'); setPage(1) } }] : []),
  ]

  const confirmRestoreDeletedProduct = async () => {
    if (!restoreConfirmProduct || !canRestore || restoreMutation.isPending) return
    try {
      await restoreMutation.mutateAsync(restoreConfirmProduct.id)
      setRestoreConfirmProduct(null)
      toast({ title: 'Producto restaurado', description: `El producto «${restoreConfirmProduct.name}» volvió al inventario.` })
    } catch (error) {
      toast({ title: 'No se pudo restaurar', description: error instanceof Error ? error.message : 'No se pudo restaurar el producto', variant: 'destructive' })
    }
  }

  return (
    <div className="auna-page-fluid mx-auto grid w-full min-w-0 gap-5 px-4 py-6 sm:px-8">
      <h1 className="sr-only">Productos eliminados</h1>
      {!isError && <MetricStrip loading={isLoading} label="Resumen de productos eliminados consultados" items={[
        { label: 'Productos eliminados', value: data?.totalItems ?? '—' },
        ...(serviceCatalog ? [{label:'Con cantidades fraccionadas',value:summary?.fractional ?? '—'}] : [
        { label: 'Productos estándar', value: summary ? summary.total - summary.kits : '—' },
        { label: 'Kits', value: summary?.kits ?? '—' },
        { label: 'Control de caducidad', value: summary?.tracksExpiry ?? '—' }]),
      ]} />}

      <CompactFilterPanel title="Filtros de productos eliminados" activeCount={appliedFilters.length} appliedFilters={appliedFilters} onClear={clearFilters}
        search={<div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input aria-label="Buscar productos eliminados" placeholder="Buscar por producto, marca o código de barras…" className="pl-10" value={search} onChange={event => setSearch(event.target.value)} /></div>}
        actions={<Button asChild variant="outline"><Link to="/inventario"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Inventario</Link></Button>}
      >
        <div className="space-y-1"><Label htmlFor="deleted-category">Categoría</Label>
          <Select value={category} onValueChange={value => { setCategory(value); setPage(1) }}>
            <SelectTrigger id="deleted-category"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas las categorías</SelectItem>{categories.map(item => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label htmlFor="deleted-page-size">Filas por página</Label>
          <Select value={String(effectivePageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1) }}>
            <SelectTrigger id="deleted-page-size"><SelectValue /></SelectTrigger>
            <SelectContent>{TABLE_PAGE_SIZES.map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CompactFilterPanel>

      <section className="auna-data-table-shell min-w-0" aria-label="Productos eliminados" aria-busy={isFetching}>
        {isFetching && !isLoading && !isError && <LoadingIndicator message="Actualizando productos eliminados…" className="px-4 py-2" />}
        {isLoading ? <LoadingState columns={['Producto', 'Categoría', 'Existencia', 'Proveedor', 'Eliminado el', 'Acciones']} message="Cargando productos eliminados…" /> : isError ? <div role="alert" className="p-8 text-center"><p>No se pudieron cargar los productos eliminados.</p><Button variant="outline" className="mt-3" onClick={() => void refetch()}>Reintentar</Button></div>
          : !products.length ? <CollectionEmptyState title="El archivo sigue en blanco" description="No hay productos eliminados. Los artículos que elimines aparecerán aquí para poder restaurarlos." filtered={appliedFilters.length > 0 || Boolean(search.trim())} onReset={clearFilters} />
          : <div className="overflow-x-auto"><Table><TableHeader><TableRow>
            <TableHead>Producto</TableHead><TableHead>Categoría</TableHead><TableHead className="text-right">Existencia</TableHead><TableHead>Proveedor</TableHead><TableHead>Eliminado el</TableHead>{canRestore && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow></TableHeader><TableBody>{products.map(product => <TableRow key={product.id}>
            <TableCell><div className="flex min-w-48 items-center gap-3">
              {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg border bg-background object-contain" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border bg-muted"><PackageOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></span>}
              <div><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-muted-foreground">{[product.brand, product.size, product.barcode].filter(Boolean).join(' · ') || 'Sin código de barras'}</p></div>
            </div></TableCell>
            <TableCell>{String(product.category || 'Sin categoría')}</TableCell><TableCell className="text-right tabular-nums">{product.kind==='SERVICE' ? 'No aplica' : product.stock}</TableCell><TableCell>{String(product.supplier || '—')}</TableCell>
            <TableCell className="whitespace-nowrap">{product.deleted_at ? new Date(product.deleted_at).toLocaleDateString('es-GT') : 'Sin registro'}</TableCell>
            {canRestore && <TableCell className="text-right"><Button size="sm" variant="outline" aria-label={`Restaurar ${product.name}`} disabled={restoreMutation.isPending} onClick={() => setRestoreConfirmProduct(product)}><RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />Restaurar</Button></TableCell>}
          </TableRow>)}</TableBody></Table></div>}
      </section>
      {!isLoading && !isError && data && data.totalItems > 0 && <div className="auna-pagination-outside"><Pagination currentPage={data.page} totalPages={data.totalPages} totalItems={data.totalItems} pageSize={data.pageSize} count={products.length} itemLabel="productos eliminados" onPageChange={setPage} hasNextPage={data.nextPage !== null} hasPrevPage={data.prevPage !== null} loading={isFetching} /></div>}

      <ConfirmDialog open={!!restoreConfirmProduct && canRestore} onOpenChange={open => { if (!open && !restoreMutation.isPending) setRestoreConfirmProduct(null) }} title="¿Restaurar producto?" description={restoreConfirmProduct ? `«${restoreConfirmProduct.name}» volverá al listado principal conservando sus datos y existencias.` : ''} confirmText="Restaurar" onConfirm={confirmRestoreDeletedProduct} loading={restoreMutation.isPending} variant="info" appearance="auna" />
    </div>
  )
}
