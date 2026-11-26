import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, Plus } from 'lucide-react'
import { CatalogFilters } from './CatalogFilters'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { Pagination } from '@/components/shared/Pagination'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { listCashRegisters, fetchCashMoneyCapabilities } from '@/services/cashSessionsService'

export function CashRegistersTab() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions()
  return <RegisterList key={JSON.stringify([company?.id, branch?.id, user?.id])} />
}
function RegisterList() {
  const { company, branch } = useTenant(), { user, hasPermission } = useAuthPermissions(), navigate = useNavigate()
  const scope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }
  const identity = JSON.stringify([scope.companyId, scope.branchId, scope.actorId])
  const canView = hasPermission('cash.registers.view', 'cash.registers.manage'), canManage = hasPermission('cash.registers.manage')
  const filtersKey = 'auna:cash-register-filters:' + identity
  const [filters, setFilters] = useState(() => { try { return JSON.parse(sessionStorage.getItem(filtersKey) || 'null') || { search: '', order: 'asc', status: 'all' } } catch { return { search: '', order: 'asc', status: 'all' } } })
  const { search, order, status } = filters as { search: string; order: 'asc' | 'desc'; status: string }
  const patch = (value: Partial<typeof filters>) => setFilters((prev: typeof filters) => ({ ...prev, ...value }))
  useEffect(() => { try { sessionStorage.setItem(filtersKey, JSON.stringify(filters)) } catch { /* UI preference only. */ } }, [filtersKey, filters])
  const { page, setPage, pageSize, setPageSize } = usePersistedListUiState('catalogos/cajas/' + identity)
  useResetPageOnFilterChange(setPage, [search, order, status])
  const ready = !!company && !!branch && !!user
  const registers = useQuery({ queryKey: ['cash-registers', 'manage', scope.companyId, scope.branchId, scope.actorId], queryFn: () => listCashRegisters(true, scope), enabled: ready && hasPermission('cash.registers.view', 'cash.registers.manage', 'settings.manage') })
  const capabilities = useQuery({ queryKey: ['cash-register-capabilities', scope.companyId, scope.branchId, scope.actorId], queryFn: () => fetchCashMoneyCapabilities(scope), enabled: ready && hasPermission('cash.registers.view', 'cash.registers.manage', 'settings.manage') })
  const available = capabilities.data?.register_configuration_available === true
  const rows = (registers.data || []).filter(r => (r.name + ' ' + r.code).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) && (status === 'all' || r.active === (status === 'active'))).sort((a,b) => a.name.localeCompare(b.name, 'es') * (order === 'asc' ? 1 : -1))
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages), visible = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const create = () => navigate('/configuracion/cajas/nueva')
  return <div className="space-y-4">
    <MetricStrip label="Resumen de cajas" loading={registers.isLoading} items={[
      { label: 'Cajas', value: registers.error ? '—' : rows.length },
      { label: 'Activas', value: registers.error ? '—' : rows.filter(r => r.active).length },
      { label: 'Inactivas', value: registers.error ? '—' : rows.filter(r => !r.active).length },
    ]} />
    <CatalogFilters search={search} onSearch={value => patch({ search: value })} order={order} onOrder={value => patch({ order: value })} onClearExtra={() => patch({ status: 'all' })} extraFilters={status !== 'all' ? [{ label: status === 'active' ? 'Activas' : 'Inactivas', onRemove: () => patch({ status: 'all' }) }] : []} actions={canManage && <Button disabled={!available} onClick={create}><Plus aria-hidden size={16} className="mr-2" />Nueva caja</Button>}>
      <label className="space-y-1 text-xs">Estado<select aria-label="Estado de las cajas" value={status} onChange={e => patch({ status: e.target.value })} className="auna-control auna-control-select px-3"><option value="all">Todos los estados</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></label>
    </CatalogFilters>
    {!capabilities.isLoading && !capabilities.error && !available && <p className="text-sm text-muted-foreground">Las cajas anteriores siguen funcionando. La configuración avanzada requiere aplicar la actualización de cajas.</p>}
    {!canView && <p role="status" className="text-sm text-muted-foreground">Consulta básica. Para abrir la nueva ficha necesitas el permiso de consultar cajas; los ajustes generales no conceden acceso avanzado.</p>}
    {capabilities.error && <p role="alert" className="text-sm text-destructive">No se pudo verificar la configuración. <button type="button" className="underline" onClick={() => void capabilities.refetch()}>Reintentar</button></p>}
    <Card className="auna-data-table-shell auna-surface"><CardContent className="catalog-content">
      {registers.isFetching && !registers.isLoading && <LoadingIndicator message="Actualizando cajas…" />}
      {registers.error ? <p role="alert" className="p-4 text-destructive">{registers.error.message}</p> : !registers.isLoading && !visible.length ? <CollectionEmptyState title="Organiza tus puntos de cobro" description="Crea una caja y prepara quiénes pueden abrir sus turnos." filtered={!!search.trim() || status !== 'all'} onReset={() => { patch({ search: '', status: 'all' }); setPage(1) }} action={canManage && available && <Button onClick={create}>Nueva caja</Button>} /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Caja</TableHead><TableHead>Tipo</TableHead><TableHead>Estado</TableHead><TableHead>Acceso</TableHead><TableHead>Personas</TableHead><TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>
        {registers.isLoading && <TableLoadingRows columns={6} message="Cargando cajas…" />}
        {visible.map(reg => <TableRow key={reg.id}><TableCell><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{reg.name}</span>{reg.is_default && <Badge variant="secondary">Predeterminada</Badge>}</div><span className="text-xs text-muted-foreground">{reg.code}</span></TableCell><TableCell className="text-sm">{reg.kind === 'VIRTUAL' ? 'Virtual' : 'Física'}<span className="block text-xs text-muted-foreground">{reg.operation_mode === 'SHARED' ? 'Compartida' : 'Individual'}</span></TableCell><TableCell><Badge variant={reg.active ? 'outline' : 'secondary'}>{reg.active ? 'Activa' : 'Inactiva'}</Badge></TableCell><TableCell className="text-sm">{reg.access_control_version === 1 ? 'Explícito' : 'Anterior'}</TableCell><TableCell>{reg.authorized_user_count ?? '—'}</TableCell><TableCell className="text-right">{canView && available && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={'Acciones de ' + reg.name}><MoreHorizontal aria-hidden size={18} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => navigate('/configuracion/cajas/' + reg.id)}>Ver configuración</DropdownMenuItem>{canManage && <DropdownMenuItem onSelect={() => navigate('/configuracion/cajas/' + reg.id + '/editar')}>Editar caja y accesos</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>}</TableCell></TableRow>)}
      </TableBody></Table></div>}
    </CardContent></Card>
    {!registers.error && !registers.isLoading && <div className="auna-pagination-outside"><Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={rows.length} pageSize={pageSize} onPageSizeChange={setPageSize} count={visible.length} itemLabel="cajas" /></div>}
  </div>
}
