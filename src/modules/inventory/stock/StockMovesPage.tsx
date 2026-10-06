/** Copyright (c) 2026 Diego Patzán. All Rights Reserved. Proprietary License. */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, MoveRight, PackageSearch, Scale, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { Pagination } from '@/components/shared/Pagination'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useTenant } from '@/context/useTenant'
import { fetchWarehouses } from '@/services/warehouseService'
import { fetchMovementPage, fetchReplenishment, REASON_LABELS, type ReplenishmentRow, type StockMovementReason } from '@/services/stockMoveService'
import { StockOperationDialog } from './StockOperationDialog'

function StockMovesWorkspace() {
  const { branch } = useTenant()
  const { hasPermission } = useAuthPermissions()
  const { locale, timezone } = useSystemSettings()
  const canMove = hasPermission('stock_moves.create')
  const canAdjust = hasPermission('stock_moves.adjust')
  const [tab, setTab] = useState('history')
  const [operation, setOperation] = useState<'move' | 'adjust' | null>(null)
  const [suggestion, setSuggestion] = useState<ReplenishmentRow>()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [locationId, setLocationId] = useState('all')
  const [reason, setReason] = useState<StockMovementReason | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [replenishmentPage, setReplenishmentPage] = useState(1)
  const [replenishmentSearch, setReplenishmentSearch] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1) }, 280)
    return () => window.clearTimeout(timer)
  }, [search])

  const warehouseQuery = useQuery({ queryKey: ['warehouses', branch?.id], queryFn: () => fetchWarehouses(), enabled: Boolean(branch) })
  const locations = useMemo(() => (warehouseQuery.data ?? []).filter(w => w.active).flatMap(w => w.locations.filter(l => l.active).map(l => ({ id: l.id, label: `${w.name} · ${l.code}` }))), [warehouseQuery.data])
  const replenishmentQuery = useQuery({ queryKey: ['stock-replenishment', branch?.id], queryFn: fetchReplenishment, enabled: Boolean(branch) && tab === 'replenishment' })
  const invalidRange = Boolean(from && to && from > to)
  const movementQuery = useQuery({
    queryKey: ['stock-moves', branch?.id, page, pageSize, debouncedSearch, locationId, reason, from, to],
    queryFn: () => fetchMovementPage({ page, pageSize, search: debouncedSearch || undefined, location_id: locationId === 'all' ? undefined : locationId, reason: reason === 'all' ? undefined : reason, from: from || undefined, to: to || undefined }),
    enabled: Boolean(branch) && tab === 'history' && !invalidRange,
  })
  const data = movementQuery.data
  const movements = data?.items ?? []
  const replenishments = (replenishmentQuery.data ?? []).filter(r => `${r.product_name} ${r.barcode ?? ''} ${r.warehouse_name} ${r.location_code}`.toLocaleLowerCase().includes(replenishmentSearch.trim().toLocaleLowerCase()))
  const replenishmentPages = Math.max(1, Math.ceil(replenishments.length / 8))
  const safeReplenishmentPage = Math.min(replenishmentPage, replenishmentPages)
  const openOperation = (task: 'move' | 'adjust', row?: ReplenishmentRow) => { setSuggestion(row); setOperation(task) }
  const resetFilter = (setter: (value: string) => void, value = '') => { setter(value); setPage(1) }
  const appliedFilters = [
    ...(debouncedSearch ? [{ label: `Búsqueda: ${debouncedSearch}`, onRemove: () => { setSearch(''); setDebouncedSearch(''); setPage(1) } }] : []),
    ...(locationId !== 'all' ? [{ label: `Ubicación: ${locations.find(l => l.id === locationId)?.label ?? locationId}`, onRemove: () => resetFilter(setLocationId, 'all') }] : []),
    ...(reason !== 'all' ? [{ label: `Motivo: ${REASON_LABELS[reason]}`, onRemove: () => { setReason('all'); setPage(1) } }] : []),
    ...(from ? [{ label: `Desde: ${from}`, onRemove: () => resetFilter(setFrom) }] : []),
    ...(to ? [{ label: `Hasta: ${to}`, onRemove: () => resetFilter(setTo) }] : []),
  ]

  return <div className="min-h-full bg-brand-surface dark:bg-brand-navy"><div className="mx-auto w-full max-w-[1560px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
    <header className="auna-module-heading"><div><p className="auna-module-eyebrow">Inventario</p><h1>Existencias y movimientos</h1><p className="auna-module-description">{branch ? `Consulta el historial y gestiona las ubicaciones de ${branch.name}.` : 'Selecciona una sucursal para consultar y gestionar sus existencias.'}</p></div>
      {branch && <div className="flex flex-wrap gap-2">{canAdjust && <Button variant="outline" disabled={!locations.length} onClick={() => openOperation('adjust')}><Scale className="h-4 w-4" aria-hidden="true" />Ajustar existencias</Button>}{canMove && <Button className="bg-brand-orange text-white hover:bg-brand-orange/90" disabled={locations.length < 2} onClick={() => openOperation('move')}><MoveRight className="h-4 w-4" aria-hidden="true" />Mover mercancía</Button>}</div>}
    </header>
    {!branch ? <EmptyState icon={PackageSearch} title="Selecciona una sucursal" description="Los movimientos y ajustes pertenecen a una sucursal concreta. Elígela en el selector superior." /> : <>
      {warehouseQuery.isError ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"><p>No se pudieron cargar las ubicaciones.</p><Button variant="outline" size="sm" onClick={() => warehouseQuery.refetch()}>Reintentar</Button></div> : !warehouseQuery.isLoading && (canMove || canAdjust) && locations.length < 2 ? <p className="text-sm text-muted-foreground">{locations.length === 0 ? 'Para operar necesitas una ubicación activa.' : 'Para mover mercancía necesitas dos ubicaciones activas.'} Configúralas en Sucursales → Almacenes.</p> : null}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto"><TabsList variant="detail"><TabsTrigger value="history"><History className="mr-2 h-4 w-4" aria-hidden="true" />Movimientos</TabsTrigger><TabsTrigger value="replenishment"><PackageSearch className="mr-2 h-4 w-4" aria-hidden="true" />Reposición</TabsTrigger></TabsList></div>
        <TabsContent value="history" className="space-y-3 pt-2">
          <CompactFilterPanel title="Filtros de movimientos" activeCount={appliedFilters.length} appliedFilters={appliedFilters} onClear={() => { setSearch(''); setDebouncedSearch(''); setLocationId('all'); setReason('all'); setFrom(''); setTo(''); setPage(1) }} search={<div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input aria-label="Buscar movimientos" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Producto, código o nota…" /></div>}>
            <div className="space-y-2"><Label htmlFor="stock-location-filter">Ubicación</Label><select id="stock-location-filter" className="auna-control auna-control-select auna-receipt-select" value={locationId} onChange={e => resetFilter(setLocationId, e.target.value)}><option value="all">Todas las ubicaciones</option>{locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="stock-reason-filter">Motivo</Label><select id="stock-reason-filter" className="auna-control auna-control-select auna-receipt-select" value={reason} onChange={e => { setReason(e.target.value as typeof reason); setPage(1) }}><option value="all">Todos los motivos</option>{Object.entries(REASON_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="stock-from">Desde</Label><Input id="stock-from" type="date" value={from} max={to || undefined} onChange={e => resetFilter(setFrom, e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="stock-to">Hasta</Label><Input id="stock-to" type="date" value={to} min={from || undefined} onChange={e => resetFilter(setTo, e.target.value)} /></div>
          </CompactFilterPanel>
          <section className="auna-data-table-shell" aria-label="Historial de movimientos" aria-busy={movementQuery.isFetching}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"><h2 className="font-semibold">Movimientos{data && !invalidRange ? ` (${data.totalItems})` : ''}</h2><label className="flex items-center gap-2 text-xs text-muted-foreground">Por página<select className="auna-control auna-control-select auna-receipt-select !w-20" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>{[8, 16, 32].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div>
            {movementQuery.isFetching && !movementQuery.isLoading && <LoadingIndicator message="Actualizando movimientos…" className="px-4 py-2" />}
            {invalidRange ? <p role="alert" className="p-8 text-center">La fecha inicial no puede ser posterior a la final.</p> : movementQuery.isLoading ? <LoadingState columns={['Fecha', 'Producto', 'Ubicación', 'Cantidad', 'Saldo', 'Motivo / nota', 'Responsable']} message="Cargando movimientos…" /> : movementQuery.isError ? <div role="alert" className="p-8 text-center"><p>No se pudieron cargar los movimientos.</p><Button variant="outline" className="mt-3" onClick={() => movementQuery.refetch()}>Reintentar</Button></div> : !movements.length ? <EmptyState icon={History} title={appliedFilters.length ? 'Sin coincidencias' : 'Todavía no hay movimientos'} description={appliedFilters.length ? 'Prueba otra búsqueda o limpia los filtros.' : 'Aquí aparecerán las entradas, salidas y ajustes de esta sucursal.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead><tr><th>Fecha</th><th>Producto</th><th>Ubicación</th><th className="!text-right">Cantidad</th><th className="!text-right">Saldo</th><th>Motivo / nota</th><th>Responsable</th></tr></thead><tbody>{movements.map(m => <tr key={m.id}>
              <td className="whitespace-nowrap">{new Date(m.created_at).toLocaleString(locale, { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' })}</td><td><strong className="block font-medium">{m.product.name}</strong><small className="text-muted-foreground">{m.product.barcode || 'Sin código'}</small></td><td><span className="block">{m.location.warehouse.name}</span><small className="text-muted-foreground">{m.location.code}</small></td>
              <td className={`text-right font-semibold tabular-nums ${m.qty < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td><td className="text-right tabular-nums">{m.balance}</td><td><Badge variant="outline">{REASON_LABELS[m.reason]}</Badge>{m.notes && <p className="mt-1 max-w-xs break-words text-xs text-muted-foreground">{m.notes}</p>}</td><td>{m.createdBy?.name ?? 'Sistema'}</td>
            </tr>)}</tbody></table></div>}
            {!invalidRange && !movementQuery.isError && <Pagination currentPage={data?.page ?? page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} loading={movementQuery.isFetching} totalItems={data?.totalItems ?? 0} pageSize={pageSize} count={movements.length} itemLabel="movimientos" />}
          </section>
          <p className="text-xs text-muted-foreground">El saldo corresponde al producto en esa ubicación después del movimiento. Mover entre ubicaciones no cambia el total de la sucursal.</p>
        </TabsContent>
        <TabsContent value="replenishment" className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input aria-label="Buscar reposiciones" className="pl-9" value={replenishmentSearch} onChange={e => { setReplenishmentSearch(e.target.value); setReplenishmentPage(1) }} placeholder="Producto, código o ubicación…" /></div><p className="text-sm text-muted-foreground">Reubica mercancía disponible; no genera una compra.</p></div>
          <section className="auna-data-table-shell" aria-busy={replenishmentQuery.isFetching}>
            {replenishmentQuery.isFetching && !replenishmentQuery.isLoading && <LoadingIndicator message="Actualizando reposiciones…" className="px-4 py-2" />}
            {replenishmentQuery.isLoading ? <LoadingState columns={['Producto', 'Destino', 'Existencia / mínimo', 'Faltante', 'Origen sugerido', 'Acción']} message="Cargando reposiciones…" /> : replenishmentQuery.isError ? <div role="alert" className="p-8 text-center"><p>No se pudieron cargar las sugerencias.</p><Button variant="outline" className="mt-3" onClick={() => replenishmentQuery.refetch()}>Reintentar</Button></div> : !replenishments.length ? <EmptyState icon={PackageSearch} title={replenishmentSearch ? 'Sin coincidencias' : 'Sin reposiciones pendientes'} description="Las sugerencias aparecen cuando una ubicación queda por debajo de su mínimo interno." /> : <div className="overflow-x-auto"><table className="w-full min-w-[850px]"><thead><tr><th>Producto</th><th>Destino</th><th className="!text-right">Existencia / mínimo</th><th className="!text-right">Faltante</th><th>Origen sugerido</th><th>Acción</th></tr></thead><tbody>{replenishments.slice((safeReplenishmentPage - 1) * 8, safeReplenishmentPage * 8).map(r => <tr key={`${r.product_id}-${r.location_id}`}><td><strong className="block font-medium">{r.product_name}</strong><small className="text-muted-foreground">{r.barcode || 'Sin código'}</small></td><td>{r.warehouse_name}<small className="block text-muted-foreground">{r.location_code}</small></td><td className="text-right tabular-nums">{r.stock} / {r.min_stock}</td><td className="text-right font-semibold tabular-nums text-amber-700 dark:text-amber-400">{r.missing}</td><td>{r.from_location_id ? <>{r.from_warehouse_name}<small className="block text-muted-foreground">{r.from_location_code} · {r.from_stock} disponibles</small></> : <span className="text-muted-foreground">Sin existencia en otra ubicación</span>}</td><td>{canMove && r.from_location_id && r.suggested_qty > 0 && <Button size="sm" variant="outline" onClick={() => openOperation('move', r)}><MoveRight className="h-4 w-4" aria-hidden="true" />Reponer {r.suggested_qty}</Button>}</td></tr>)}</tbody></table></div>}
            {!replenishmentQuery.isError && <Pagination currentPage={safeReplenishmentPage} totalPages={replenishmentPages} onPageChange={setReplenishmentPage} loading={replenishmentQuery.isFetching} totalItems={replenishments.length} pageSize={8} count={Math.min(8, Math.max(0, replenishments.length - (safeReplenishmentPage - 1) * 8))} itemLabel="reposiciones" />}
          </section>
        </TabsContent>
      </Tabs>
      {operation && ((operation === 'move' && canMove) || (operation === 'adjust' && canAdjust)) && <StockOperationDialog key={`${operation}-${suggestion?.product_id ?? 'new'}-${suggestion?.location_id ?? ''}`} task={operation} branchId={branch.id} locations={locations} suggestion={suggestion} onClose={() => setOperation(null)} />}
    </>}
  </div></div>
}

export const StockMovesPage = () => {
  const { branch } = useTenant()
  // Changing branch discards filters and drafts rather than sending them to another branch.
  return <StockMovesWorkspace key={branch?.id ?? 'none'} />
}
export default StockMovesPage
