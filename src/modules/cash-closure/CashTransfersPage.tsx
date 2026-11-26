import { useDeferredValue, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRightLeft, Eye, MoreHorizontal, PackageCheck, Plus, Search, Vault } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Pagination } from '@/components/shared/Pagination'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingState, TableLoadingRows } from '@/components/shared/LoadingState'
import { fetchCustodyCapabilities, fetchPendingHandovers, listTransfers, type CustodyScope, type TransferStatus } from '@/services/cashCustodyService'
import { CashClosureTabs } from './components/CashClosureTabs'
import { CASH_TRANSFERS_PATH, destinationLabel, differenceText, handoverPath, originLabel, TransferStatusBadge } from './components/transferParts'
import { formatCurrency, formatZonedDateTime } from './types'

const PAGE_SIZE = 20
export default function CashTransfersPage() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions()
  return <TransfersList key={JSON.stringify([company?.id, branch?.id, user?.id])} />
}

function TransfersList() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), { locale, currencyCode, timezone } = useSystemSettings(), navigate = useNavigate()
  const scope: CustodyScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }, ready = !!(scope.companyId && scope.branchId && scope.actorId)
  const [status, setStatus] = useState<'' | TransferStatus>(''), [toReceive, setToReceive] = useState(false), [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const query = useDeferredValue(search.trim())
  usePageTrail([{ label: 'Traslados de efectivo' }])
  const key = [scope.companyId, scope.branchId, scope.actorId]
  const capabilities = useQuery({ queryKey: ['cash-custody-capabilities', ...key], queryFn: ({ signal }) => fetchCustodyCapabilities(scope, signal), enabled: ready })
  const caps = capabilities.data, available = !!caps?.available
  const list = useQuery({ queryKey: ['cash-transfers', ...key, status, toReceive, query, page], queryFn: ({ signal }) => listTransfers({ page, pageSize: PAGE_SIZE, status: status || undefined, toReceive, search: query }, scope, signal),
    enabled: ready && available, placeholderData: (previous, previousQuery) => previousQuery?.queryKey.slice(1, 4).join() === key.join() ? previous : undefined })
  const handovers = useQuery({ queryKey: ['cash-handovers-pending', ...key], queryFn: ({ signal }) => fetchPendingHandovers(scope, signal), enabled: ready && available && (caps?.canOperateOwn || caps?.canOperateTeam) })
  const money = (v: string) => formatCurrency(v, currencyCode, locale), data = list.data, items = data?.items || []
  const filters = [status, toReceive].filter(Boolean).length, reset = () => { setStatus(''); setToReceive(false); setSearch(''); setPage(1) }
  const actions = <div className="flex flex-wrap gap-2">
    {(caps?.canView || caps?.canManage) && <Button variant="outline" onClick={() => navigate('/cierre-caja/custodias')}><Vault className="h-4 w-4" aria-hidden />Custodias</Button>}
    {(caps?.canOperateOwn || caps?.canOperateTeam) && <Button onClick={() => navigate(`${CASH_TRANSFERS_PATH}/nuevo`)}><Plus className="h-4 w-4" aria-hidden />Nuevo traslado</Button>}
  </div>
  return <div className="auna-page-fluid mx-auto w-full min-w-0 space-y-5 p-4 sm:p-8">
    <h1 className="sr-only">Traslados de efectivo</h1>
    <CashClosureTabs value="transfers" />
    {capabilities.isLoading ? <LoadingState variant="cards" message="Verificando permisos…" />
      : capabilities.error ? <p role="alert" className="text-destructive">No se pudo verificar el acceso. <Button variant="outline" size="sm" onClick={() => void capabilities.refetch()}>Reintentar</Button></p>
      : !available ? <Card className="auna-surface"><CardContent className="p-4 text-sm"><p className="font-medium">Los traslados de efectivo aún no están disponibles.</p><p className="mt-1 text-muted-foreground">Falta aplicar la actualización verificada. Los turnos, ventas y arqueos actuales siguen funcionando.</p></CardContent></Card>
      : <>
        {!!handovers.data?.length && <section className="auna-surface rounded-xl border p-4" aria-labelledby="pending-handovers">
          <h2 id="pending-handovers" className="flex items-center gap-2 text-sm font-semibold"><PackageCheck className="h-4 w-4 text-primary" aria-hidden />Turnos por entregar</h2>
          <ul className="mt-2 divide-y">{handovers.data.map(s => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>{s.register_name} · {s.responsible_name}{s.closed_at ? ` · terminó ${formatZonedDateTime(s.closed_at, s.business_timezone, locale)}` : ''}</span>
            <Button size="sm" variant="outline" onClick={() => navigate(handoverPath(s.id))}>Entregar turno</Button></li>)}</ul>
        </section>}
        <MetricStrip label="Resumen de traslados" loading={list.isLoading} items={[
          { label: 'Por recibir', value: data?.summary.toReceive ?? '—', onClick: () => { setToReceive(!toReceive); setPage(1) }, active: toReceive },
          { label: 'Pendientes en la sucursal', value: data?.summary.pending ?? '—' },
          { label: 'Faltante en tránsito', value: data ? money(data.summary.shortage) : '—', alert: !!data && data.summary.shortage !== '0.00' }]} />
        <CompactFilterPanel title="Filtros de traslados" actions={actions} activeCount={filters} onClear={reset}
          appliedFilters={[...(status ? [{ label: { PENDING: 'Por recibir', RECEIVED: 'Recibidos', REJECTED: 'Rechazados' }[status], onRemove: () => { setStatus(''); setPage(1) } }] : []), ...(toReceive ? [{ label: 'Para que yo reciba', onRemove: () => { setToReceive(false); setPage(1) } }] : [])]}
          search={<div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input type="search" aria-label="Buscar traslados" className="pl-9" maxLength={100} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar por motivo, custodia, caja o persona" /></div>}>
          <div className="space-y-1"><Label htmlFor="transfer-filter-status" className="text-xs">Estado</Label><Select value={status || 'all'} onValueChange={v => { setStatus(v === 'all' ? '' : v as TransferStatus); setPage(1) }}><SelectTrigger id="transfer-filter-status" className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="PENDING">Por recibir</SelectItem><SelectItem value="RECEIVED">Recibidos</SelectItem><SelectItem value="REJECTED">Rechazados</SelectItem></SelectContent></Select></div>
          <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={toReceive} onCheckedChange={v => { setToReceive(v === true); setPage(1) }} />Solo los que me toca recibir</label>
        </CompactFilterPanel>
        <Card className="auna-data-table-shell auna-surface"><CardContent className="p-0">
          {list.error ? <p role="alert" className="p-4 text-destructive">{(list.error as Error).message}</p>
            : !list.isLoading && !items.length ? <CollectionEmptyState title="Sin traslados de efectivo" description="Las entregas a caja fuerte, cambios entre cajas y entregas de turno aparecerán aquí." filtered={filters > 0 || !!query} onReset={reset} />
            : <div className="overflow-x-auto"><Table><TableHeader><TableRow>
              <TableHead>Fecha</TableHead><TableHead>Traslado</TableHead><TableHead className="hidden md:table-cell">Envió</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Importe</TableHead><TableHead className="w-12 text-right"><span className="sr-only">Acciones</span></TableHead>
            </TableRow></TableHeader><TableBody>
              {list.isLoading && <TableLoadingRows columns={6} message="Cargando traslados…" />}
              {items.map(t => <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`${CASH_TRANSFERS_PATH}/${t.id}`)}>
                <TableCell className="whitespace-nowrap text-sm">{formatZonedDateTime(t.created_at, timezone, locale)}</TableCell>
                <TableCell className="text-sm"><span className="flex items-center gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /><span className="max-w-[22rem] truncate" title={`${originLabel(t)} → ${destinationLabel(t)}`}>{originLabel(t)} → {destinationLabel(t)}</span></span><span className="mt-0.5 block max-w-[22rem] truncate text-xs text-muted-foreground">{t.reason}</span></TableCell>
                <TableCell className="hidden text-sm md:table-cell">{t.sender_name}{t.receiver_name ? <span className="block text-xs text-muted-foreground">{t.status === 'REJECTED' ? 'rechazó' : 'recibió'} {t.receiver_name}</span> : null}</TableCell>
                <TableCell><TransferStatusBadge status={t.status} /></TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{money(t.amount)}{t.difference && t.difference !== '0.00' ? <span className="block text-xs font-normal text-destructive">{differenceText(t.difference, money)}</span> : null}</TableCell>
                <TableCell className="text-right" onClick={e => e.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Acciones del traslado de ${money(t.amount)}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => navigate(`${CASH_TRANSFERS_PATH}/${t.id}`)}><Eye className="mr-2 h-4 w-4" />{t.status === 'PENDING' && caps?.canReceive && t.sender_id !== scope.actorId ? 'Recibir o rechazar' : 'Ver detalle'}</DropdownMenuItem>
                </DropdownMenuContent></DropdownMenu></TableCell>
              </TableRow>)}
            </TableBody></Table></div>}
        </CardContent></Card>
        {!list.error && !!data && data.totalItems > 0 && <div className="auna-pagination-outside"><Pagination currentPage={data.page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.totalItems} pageSize={data.pageSize} count={items.length} itemLabel="traslados" loading={list.isFetching} /></div>}
      </>}
  </div>
}
