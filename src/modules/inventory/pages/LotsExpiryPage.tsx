/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Pagination } from '@/components/shared/Pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
import { usePersistedListUiState } from '@/hooks/usePersistedListUiState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Eye, PackageOpen, Search, Trash2 } from 'lucide-react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'

type LotStatusFilter = 'all' | 'expiring' | 'expired'

interface ExpiringLot {
  id: string
  lot_code: string | null
  expiry_date: string
  qty_remaining: number
  days_to_expiry: number
  received_at: string
  branch?: { id: string; name: string; code: string } | null
  location?: { id: string; code: string; name: string | null } | null
  product: {
    id: string
    name: string
    brand?: string | null
    size?: string | null
    barcode?: string | null
    image_url?: string | null
    stock: number
    lotted: number
    unlotted: number
  }
}

interface LotsExpiringResponse {
  days: number
  status: string
  lots: ExpiringLot[]
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })

export const LotsExpiryPage = () => {
  const [status, setStatus] = useState<LotStatusFilter>('all')
  const [days, setDays] = useState('30')
  const [search, setSearch] = useState('')
  const [locationId, setLocationId] = useState('all')
  const { page, pageSize, setPage } = usePersistedListUiState('inventario/lotes', { defaultPageSize: 10 })

  const effectiveDays = Math.min(365, Math.max(1, Number(days) || 30))
  const { data, isLoading, isFetching, isError, refetch } = useQuery<LotsExpiringResponse, Error>({
    queryKey: ['lots-expiring', effectiveDays, status],
    queryFn: () =>
      apiFetch<LotsExpiringResponse>(`/api/products/lots/expiring?days=${effectiveDays}&status=${status}`),
    staleTime: 60 * 1000,
  })

  const loadedLots = data?.lots ?? []
  const locations = [...new Map(loadedLots.filter(l => l.location).map(l => [l.location!.id, l.location!])).values()]
  // ponytail: el endpoint actual devuelve toda la ventana; paginar en servidor si crece el volumen.
  const term = search.trim().toLocaleLowerCase('es-GT')
  const lots = loadedLots.filter(lot =>
    (locationId === 'all' || lot.location?.id === locationId) &&
    (!term || [lot.product.name, lot.product.brand, lot.product.size, lot.product.barcode, lot.lot_code, lot.location?.code, lot.location?.name].some(value => value?.toLocaleLowerCase('es-GT').includes(term)))
  )
  const totalPages = Math.max(1, Math.ceil(lots.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const visibleLots = lots.slice((safePage - 1) * pageSize, safePage * pageSize)
  const expired = lots.filter((l) => l.days_to_expiry < 0)
  const expiredCount = expired.length
  const expiringCount = lots.length - expiredCount

  // Dar de baja saca del anaquel lo que quede del lote: destruye existencias,
  // así que va con el mismo permiso que un ajuste manual.
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthPermissions()
  const canWriteOff = hasPermission('stock_moves.adjust')
  const [confirming, setConfirming] = useState<ExpiringLot[] | null>(null)

  const writeOffMutation = useMutation({
    mutationFn: (lotIds: string[]) =>
      apiFetch<{ lots: number; units: number }>('/api/products/lots/write-off', {
        method: 'POST',
        body: JSON.stringify({ lot_ids: lotIds, reason: 'Lote vencido' }),
      }),
    onSuccess: (r) => {
      toast({
        title: 'Lotes dados de baja',
        description: `${r.units} unidad(es) salieron del inventario en ${r.lots} lote(s).`,
      })
      setConfirming(null)
      void queryClient.invalidateQueries({ queryKey: ['lots-expiring'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-by-location'] })
    },
    onError: (e: Error) =>
      toast({ title: 'No se pudo dar de baja', description: e.message, variant: 'destructive' }),
  })

  const unitsToWriteOff = (confirming ?? []).reduce((s, l) => s + l.qty_remaining, 0)

  const appliedFilters = [
    ...(search.trim() ? [{ label: `Búsqueda: ${search}`, onRemove: () => { setSearch(''); setPage(1) } }] : []),
    ...(status !== 'all' ? [{ label: `Estado: ${status === 'expired' ? 'Vencidos' : 'Por vencer'}`, onRemove: () => { setStatus('all'); setPage(1) } }] : []),
    ...(effectiveDays !== 30 ? [{ label: `Ventana: ${effectiveDays} días`, onRemove: () => { setDays('30'); setPage(1) } }] : []),
    ...(locationId !== 'all' ? [{ label: `Ubicación: ${locations.find(l => l.id === locationId)?.code || 'Seleccionada'}`, onRemove: () => { setLocationId('all'); setPage(1) } }] : []),
  ]

  return (
    <div className="mx-auto grid w-full max-w-[1560px] min-w-0 gap-5 px-4 py-6 sm:px-8">

      <h1 className="sr-only">Lotes y caducidades</h1>

      <CompactFilterPanel actions={<>{canWriteOff && !isError && !isLoading && expiredCount > 0 && (
          <Button variant="destructive" disabled={isFetching || writeOffMutation.isPending} onClick={() => setConfirming(expired)}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Dar de baja {expiredCount} {expiredCount === 1 ? 'vencido' : 'vencidos'}
          </Button>
        )}</>}
        title="Filtros de lotes"
        activeCount={appliedFilters.length}
        appliedFilters={appliedFilters}
        onClear={() => { setSearch(''); setStatus('all'); setDays('30'); setLocationId('all'); setPage(1) }}
        search={<div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Buscar productos o lotes" placeholder="Buscar producto, código de barras o lote…" className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>}
      >
        <div className="space-y-1">
          <Label htmlFor="lots-days">Ventana (días)</Label>
          <Input id="lots-days" type="number" min={1} max={365} value={days} onChange={e => { setDays(e.target.value); setPage(1) }} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lots-status">Estado de vencimiento</Label>
          <Select value={status} onValueChange={(value: LotStatusFilter) => { setStatus(value); setPage(1) }}>
            <SelectTrigger id="lots-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos en la ventana</SelectItem>
              <SelectItem value="expiring">Por vencer</SelectItem>
              <SelectItem value="expired">Vencidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="lots-location">Ubicación</Label>
          <Select value={locationId} onValueChange={value => { setLocationId(value); setPage(1) }}>
            <SelectTrigger id="lots-location"><SelectValue placeholder="Todas las ubicaciones" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ubicaciones</SelectItem>
              {locations.map(location => <SelectItem key={location.id} value={location.id}>{location.code}{location.name ? ` · ${location.name}` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CompactFilterPanel>

      <p className="text-xs text-muted-foreground">Ventana de {effectiveDays} días · Solo lotes con existencia vencidos o próximos a vencer. La búsqueda y la ubicación se aplican a esta consulta.</p>
      {!isError && <MetricStrip loading={isLoading} label="Resumen de los lotes consultados" items={[
        { label: 'Lotes consultados', value: isLoading ? '—' : lots.length },
        { label: 'Vencidos', value: isLoading ? '—' : expiredCount, alert: expiredCount > 0 },
        { label: 'Por vencer', value: isLoading ? '—' : expiringCount },
      ]} />}

      <><section className="auna-data-table-shell min-w-0" aria-label="Lotes con existencia" aria-busy={isFetching}>
        {isFetching && !isLoading && <LoadingIndicator message="Actualizando lotes…" className="px-4 py-2" />}
        {isLoading ? <LoadingState columns={['Producto', 'Código de barras', 'Lote', 'Vencimiento', 'Días restantes', 'Existencia del lote', 'Stock (sin lote)', 'Estado', 'Ubicación', 'Acciones']} message="Cargando lotes…" /> : isError ? <div role="alert" className="p-8 text-center">
          <p>No se pudieron cargar los lotes.</p>
          <Button variant="outline" className="mt-3" onClick={() => void refetch()}>Reintentar</Button>
        </div> : !lots.length ? <EmptyState
          icon={PackageOpen}
          title="No hay lotes para esta consulta."
          description="Revisa los filtros. Los lotes se crean al registrar ingresos de mercancía con fecha de caducidad."
        /> : <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Código de barras</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Días restantes</TableHead>
                <TableHead className="text-right">Existencia del lote</TableHead>
                <TableHead className="text-right">Stock (sin lote)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>{visibleLots.map(lot => {
                const isExpired = lot.days_to_expiry < 0
                return <TableRow key={lot.id}>
                  <TableCell>
                    <div className="flex min-w-48 items-center gap-3">
                      {lot.product.image_url
                        ? <img src={lot.product.image_url} alt="" loading="lazy" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg border bg-background object-contain" />
                        : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border bg-muted"><PackageOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></span>}
                      <div>
                        <Link to={`/inventario/${lot.product.id}`} className="font-semibold hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{lot.product.name}</Link>
                        <p className="mt-1 text-xs text-muted-foreground">{[lot.product.brand, lot.product.size].filter(Boolean).join(' · ')}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{lot.product.barcode || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{lot.lot_code || 'Sin código'}</TableCell>
                  <TableCell className={isExpired ? 'whitespace-nowrap text-red-600 dark:text-red-400' : 'whitespace-nowrap'}>{formatDate(lot.expiry_date)}</TableCell>
                  <TableCell className={isExpired ? 'text-right tabular-nums text-red-600 dark:text-red-400' : 'text-right tabular-nums'}>{isExpired ? `Hace ${Math.abs(lot.days_to_expiry)} días` : lot.days_to_expiry === 0 ? 'Vence hoy' : `${lot.days_to_expiry} días`}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{lot.qty_remaining}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{lot.product.stock} ({lot.product.unlotted})</TableCell>
                  <TableCell><Badge className={isExpired ? 'border-0 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/10' : 'border-0 bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/15'}>{isExpired ? 'Vencido' : 'Por vencer'}</Badge></TableCell>
                  <TableCell><span>{lot.location?.code || 'Sin ubicación'}</span>{lot.branch && <p className="mt-1 text-xs text-muted-foreground">{lot.branch.name}</p>}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="icon"><Link to={`/inventario/${lot.product.id}`} aria-label={`Ver producto ${lot.product.name}`}><Eye className="h-4 w-4" aria-hidden="true" /></Link></Button>
                      {canWriteOff && isExpired && <Button variant="outline" size="icon" className="text-destructive" aria-label={`Dar de baja lote ${lot.lot_code || lot.id}`} disabled={isFetching || writeOffMutation.isPending} onClick={() => setConfirming([lot])}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              })}</TableBody>
            </Table>
          </div>

        </>}
      </section>
      {!isLoading && !isError && lots.length > 0 && <div className="auna-pagination-outside"><Pagination currentPage={safePage} totalPages={totalPages} totalItems={lots.length} pageSize={pageSize} count={visibleLots.length} itemLabel="lotes" onPageChange={setPage} loading={isFetching} /></div>}</>

      <ConfirmDialog
        appearance="auna"
        variant="destructive"
        open={confirming !== null}
        onOpenChange={open => { if (!open && !writeOffMutation.isPending) setConfirming(null) }}
        title={`¿Dar de baja ${confirming?.length === 1 ? 'este lote' : `${confirming?.length ?? 0} lotes`}?`}
        description={`Salen ${unitsToWriteOff} unidad(es) del inventario de la ubicación de cada lote. Esta acción abarca los lotes indicados, aunque estén en otras páginas. Queda registrado como ajuste por lote vencido y no puede deshacerse con un botón: habría que volver a ingresar las unidades.`}
        confirmText="Dar de baja"
        loading={writeOffMutation.isPending}
        onConfirm={() => writeOffMutation.mutate((confirming ?? []).map(l => l.id))}
      />
    </div>
  )
}

export default LotsExpiryPage
