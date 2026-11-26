import { useDeferredValue, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, MoreHorizontal, Plus, Search, Undo2 } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Pagination } from '@/components/shared/Pagination'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingState, TableLoadingRows } from '@/components/shared/LoadingState'
import { fetchCashMovementCapabilities, listCashMovements, type CashMovementDirection, type CashMovementScope } from '@/services/cashMovementsService'
import { CashClosureTabs } from './components/CashClosureTabs'
import { CASH_MOVEMENTS_PATH } from './CashMovementFormPage'
import { formatCurrency, formatZonedDateTime } from './types'

const PAGE_SIZE = 20

export default function CashMovementsPage() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions()
  // Otra empresa, sucursal o persona remonta la lista y descarta respuestas en vuelo del alcance anterior.
  return <MovementsList key={JSON.stringify([company?.id, branch?.id, user?.id])} />
}

function MovementsList() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), { locale, currencyCode } = useSystemSettings(), navigate = useNavigate()
  const scope: CashMovementScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }
  const ready = !!(scope.companyId && scope.branchId && scope.actorId)
  const [view, setView] = useState<'own' | 'team'>('own'), [direction, setDirection] = useState<'' | CashMovementDirection>(''), [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const query = useDeferredValue(search.trim())
  usePageTrail([{ label: 'Movimientos de efectivo' }])
  const capabilities = useQuery({ queryKey: ['cash-movement-capabilities', scope.companyId, scope.branchId, scope.actorId], queryFn: ({ signal }) => fetchCashMovementCapabilities(scope, signal), enabled: ready })
  const caps = capabilities.data, canList = !!caps?.available && (caps.canViewOwn || caps.canViewTeam)
  const effectiveView = view === 'team' && caps?.canViewTeam ? 'team' : caps?.canViewOwn ? 'own' : 'team'
  const list = useQuery({
    queryKey: ['cash-movements', scope.companyId, scope.branchId, scope.actorId, effectiveView, direction, query, page],
    queryFn: ({ signal }) => listCashMovements({ view: effectiveView, page, pageSize: PAGE_SIZE, direction: direction || undefined, search: query }, scope, signal),
    enabled: ready && canList, placeholderData: (previous, previousQuery) => previousQuery?.queryKey.slice(0, 4).join() === ['cash-movements', scope.companyId, scope.branchId, scope.actorId].join() ? previous : undefined,
  })
  const canCreate = !!caps?.available && (caps.canCreateOwn || caps.canCreateTeam)
  const filters = [direction, view === 'team'].filter(Boolean).length
  const reset = () => { setDirection(''); setView('own'); setSearch(''); setPage(1) }
  const data = list.data, items = data?.items || [], money = (value?: string) => value === undefined ? '—' : formatCurrency(value, currencyCode, locale)
  const create = canCreate && <Button onClick={() => navigate(`${CASH_MOVEMENTS_PATH}/nuevo`)}><Plus className="h-4 w-4" aria-hidden />Registrar movimiento</Button>

  return <div className="auna-page-fluid mx-auto w-full min-w-0 space-y-5 p-4 sm:p-8">
    <h1 className="sr-only">Movimientos de efectivo</h1>
    <CashClosureTabs value="movements" />
    {capabilities.isLoading ? <LoadingState variant="cards" message="Verificando permisos…" />
      : capabilities.error ? <p role="alert" className="text-destructive">No se pudo verificar el acceso. <Button variant="outline" size="sm" onClick={() => void capabilities.refetch()}>Reintentar</Button></p>
      : !caps?.available ? <Card className="auna-surface"><CardContent className="p-4 text-sm"><p className="font-medium">Los movimientos de efectivo aún no están disponibles.</p><p className="mt-1 text-muted-foreground">Falta aplicar la actualización verificada. Los turnos, ventas y arqueos actuales siguen funcionando.</p></CardContent></Card>
      : !canList ? <p className="text-sm text-muted-foreground">No tienes permiso para consultar movimientos de efectivo.</p>
      : <>
        <MetricStrip label="Resumen de movimientos" loading={list.isLoading} items={[{ label: 'Ingresos de fondo', value: money(data?.summary?.inAmount) }, { label: 'Retiros de efectivo', value: money(data?.summary?.outAmount) }, { label: 'Movimientos', value: data?.totalItems ?? '—' }]} />
        <CompactFilterPanel title="Filtros de movimientos" actions={create} activeCount={filters} onClear={reset}
          appliedFilters={[...(direction ? [{ label: direction === 'IN' ? 'Solo ingresos' : 'Solo retiros', onRemove: () => { setDirection(''); setPage(1) } }] : []), ...(view === 'team' ? [{ label: 'Equipo de la sucursal', onRemove: () => { setView('own'); setPage(1) } }] : [])]}
          search={<div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input type="search" aria-label="Buscar movimientos" className="pl-9" maxLength={100} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar por motivo, procedencia o caja" /></div>}>
          <div className="space-y-1"><Label htmlFor="movement-filter-direction" className="text-xs">Tipo</Label><Select value={direction || 'all'} onValueChange={value => { setDirection(value === 'all' ? '' : value as CashMovementDirection); setPage(1) }}><SelectTrigger id="movement-filter-direction" className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="IN">Ingresos de fondo</SelectItem><SelectItem value="OUT">Retiros</SelectItem></SelectContent></Select></div>
          {caps.canViewTeam && caps.canViewOwn && <div className="space-y-1"><Label htmlFor="movement-filter-view" className="text-xs">Mostrar</Label><Select value={view} onValueChange={value => { setView(value as 'own' | 'team'); setPage(1) }}><SelectTrigger id="movement-filter-view" className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="own">Mis movimientos</SelectItem><SelectItem value="team">Equipo de la sucursal</SelectItem></SelectContent></Select></div>}
        </CompactFilterPanel>
        <Card className="auna-data-table-shell auna-surface"><CardContent className="p-0">
          {list.error ? <p role="alert" className="p-4 text-destructive">{(list.error as Error).message} <Button variant="outline" size="sm" onClick={() => void list.refetch()}>Reintentar</Button></p>
            : !list.isLoading && !items.length ? <CollectionEmptyState title="Sin movimientos de efectivo" description="Los ingresos de fondo y retiros registrados durante los turnos aparecerán aquí." filtered={filters > 0 || !!query} onReset={reset} />
            : <div className="overflow-x-auto"><Table><TableHeader><TableRow>
              <TableHead>Fecha</TableHead><TableHead>Movimiento</TableHead><TableHead className="hidden md:table-cell">Caja y responsable</TableHead><TableHead className="hidden lg:table-cell">Motivo</TableHead><TableHead className="text-right">Importe</TableHead><TableHead className="w-12 text-right"><span className="sr-only">Acciones</span></TableHead>
            </TableRow></TableHeader><TableBody>
              {list.isLoading && <TableLoadingRows columns={6} message="Cargando movimientos…" />}
              {items.map(m => <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`${CASH_MOVEMENTS_PATH}/${m.id}`)}>
                <TableCell className="whitespace-nowrap text-sm">{formatZonedDateTime(m.created_at, m.business_timezone, locale)}</TableCell>
                <TableCell><div className="flex flex-wrap items-center gap-1.5"><Badge variant={m.direction === 'IN' ? 'default' : 'secondary'}>{m.direction === 'IN' ? 'Ingreso' : 'Retiro'}</Badge>{m.corrects_movement_id && <Badge variant="outline">Compensación</Badge>}{m.correction_id && <Badge variant="outline">Compensado</Badge>}</div><span className="mt-1 block max-w-[16rem] truncate text-xs text-muted-foreground" title={m.counterparty_label}>{m.direction === 'IN' ? 'Desde' : 'Hacia'} {m.counterparty_label}</span></TableCell>
                <TableCell className="hidden text-sm md:table-cell">{m.register_name}<span className="block text-xs text-muted-foreground">{m.responsible_name}{m.actor_name !== m.responsible_name ? ` · registró ${m.actor_name}` : ''}</span></TableCell>
                <TableCell className="hidden max-w-[18rem] text-sm lg:table-cell"><span className="line-clamp-2" title={m.reason}>{m.reason}</span></TableCell>
                <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${m.direction === 'IN' ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{m.direction === 'IN' ? '+' : '−'}{formatCurrency(m.amount, m.currency_code, locale)}</TableCell>
                <TableCell className="text-right" onClick={e => e.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Acciones del movimiento de ${formatCurrency(m.amount, m.currency_code, locale)}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => navigate(`${CASH_MOVEMENTS_PATH}/${m.id}`)}><Eye className="mr-2 h-4 w-4" />Ver detalle</DropdownMenuItem>
                  {caps.canCorrect && !m.correction_id && !m.corrects_movement_id && <DropdownMenuItem onSelect={() => navigate(`${CASH_MOVEMENTS_PATH}/${m.id}/compensar`)}><Undo2 className="mr-2 h-4 w-4" />Compensar</DropdownMenuItem>}
                </DropdownMenuContent></DropdownMenu></TableCell>
              </TableRow>)}
            </TableBody></Table></div>}
        </CardContent></Card>
        {!list.error && !!data && data.totalItems > 0 && <div className="auna-pagination-outside"><Pagination currentPage={data.page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.totalItems} pageSize={data.pageSize} count={items.length} itemLabel="movimientos" loading={list.isFetching} /></div>}
      </>}
  </div>
}
