import { TABLE_PAGE_SIZES } from '@/utils/pagination'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { LoadingState } from '@/components/shared/LoadingState'
import { Link, Navigate, useNavigate,useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from './components/CashPageParts'
import { cashWorkspaceFallback,isCashWorkspaceDate } from './cashWorkspace'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ModuleTabBar } from '@/components/shared/ModuleTabs'
import { Plus, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/context/useAuth'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useMineClosureGate, canRegisterMineClosure, mineClosureBlockedHint } from './hooks'
import { ClosuresHistoryList } from './components'
import { CASH_CLOSURE_CREATE_PATH } from './CashClosureCreatePage'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { CASH_CLOSURE_READ_PERMISSIONS, fetchCashClosureReadCapabilities, fetchCashClosurePage, type CashClosureReadContext, type CashClosureReadScope } from '@/services/cashClosureReadService'
import './cash-closure-workflow.css'

// Remount private state on an identity or permission change; in-flight queries use their original context.
export default function CashClosureHistoryPanel() {
  const { user } = useAuth(), { company, branch, isConsolidated } = useTenant(), { hasPermission } = useAuthPermissions()
  const context = { companyId: company?.id || '', branchId: isConsolidated ? 'all' : branch?.id || '', actorId: user?.id || '' }
  const permissions = [...CASH_CLOSURE_READ_PERMISSIONS, 'cashclosure.create', 'cashclosure.create_day', 'cashclosure.create_own', 'cash.policies.manage']
    .filter(code => hasPermission(code)).join(',')
  return <CashClosureHistory key={[...Object.values(context), permissions].join(':')} context={context} permissions={permissions} />
}

function CashClosureHistory({ context, permissions }: { context: CashClosureReadContext; permissions: string }) {
  const navigate = useNavigate(), { hasPermission } = useAuthPermissions(), { timezone } = useSystemSettings()
  const canRead = hasPermission(...CASH_CLOSURE_READ_PERMISSIONS)
  const canCreateDay = hasPermission('cashclosure.create', 'cashclosure.create_day')
  const canCreateOwn = hasPermission('cashclosure.create', 'cashclosure.create_own')
  const canCreateClosure = canCreateDay || canCreateOwn
  const closureAccess = canRead || canCreateClosure
  const canPolicy = hasPermission('cash.policies.manage', 'cashclosure.approve', 'cashclosure.validate')
  const ready = !!context.companyId && !!context.branchId && !!context.actorId
  const capabilities = useQuery({ queryKey: ['cash-closure-read-capabilities', context.companyId, context.branchId, context.actorId, permissions],
    queryFn: ({ signal }) => fetchCashClosureReadCapabilities(context, signal), enabled: ready && canRead, retry: false, gcTime: 0 })
  const canViewHistory = canRead && capabilities.data?.viewOwn === true && !capabilities.isError
  const [params,setParams]=useSearchParams()
  const selectedScope=params.get('alcance')==='mine'?'mine':null
  const changeFilter=(key:string,value:string)=>{const next=new URLSearchParams(params);value?next.set(key,value):next.delete(key);next.set('vista','historial');setParams(next,{replace:true})}
  const setSelectedScope=(value:CashClosureReadScope)=>changeFilter('alcance',value)
  const scope: CashClosureReadScope = capabilities.data?.viewTeam && selectedScope !== 'mine' ? 'team' : 'mine'
  const rawStatus=params.get('estado')||'',rawFrom=params.get('desde')||'',rawTo=params.get('hasta')||''
  const historyStatus=['Pendiente','Aprobado','Rechazado','Reconteo','Sustituido'].includes(rawStatus)?rawStatus:''
  const historyStartDate=isCashWorkspaceDate(rawFrom)?rawFrom:'',historyEndDate=isCashWorkspaceDate(rawTo)?rawTo:''
  const setHistoryStatus=(value:string)=>changeFilter('estado',value),setHistoryStartDate=(value:string)=>changeFilter('desde',value),setHistoryEndDate=(value:string)=>changeFilter('hasta',value)
  const list = usePersistedListUiState(['cierre-caja/historial', ...Object.values(context), scope].join('/'))
  useResetPageOnFilterChange(list.setPage, [scope, historyStatus, historyStartDate, historyEndDate])
  const filters = { status: historyStatus || undefined, startDate: historyStartDate || undefined, endDate: historyEndDate || undefined }
  const query = useQuery({ queryKey: ['cash-closure-history', context.companyId, context.branchId, context.actorId, permissions, scope, list.page, list.pageSize, filters],
    queryFn: ({ signal }) => fetchCashClosurePage(context, { scope, page: list.page, pageSize: list.pageSize, ...filters }, signal),
    enabled: ready && canViewHistory, retry: false, gcTime: 0 })
  const data = canViewHistory && !query.isError ? query.data : undefined
  const activeHistoryFilters = [historyStatus, historyStartDate, historyEndDate].filter(Boolean).length
  const clearHistoryFilters=()=>{const next=new URLSearchParams(params);for(const key of ['estado','desde','hasta'])next.delete(key);next.set('vista','historial');setParams(next,{replace:true})}
  const { gate, refresh, isRefreshing } = useMineClosureGate({ enabled: ready && canCreateOwn, userId: context.actorId, timezone })
  const canOpenCreate = canCreateClosure && context.branchId !== 'all' && (canCreateDay && !canCreateOwn || canRegisterMineClosure(gate))
  const hint = canCreateOwn ? gate.loading ? 'Comprobando turno en caja…' : gate.reason === 'error' ? 'No se pudo verificar el turno. Reintenta la consulta.' : !canRegisterMineClosure(gate) ? mineClosureBlockedHint(gate.reason) : null : null
  const actions = <>{canCreateClosure && <div className="flex flex-col items-start gap-1">
    <Button asChild={canOpenCreate} disabled={!canOpenCreate}>{canOpenCreate ? <Link to={CASH_CLOSURE_CREATE_PATH}><Plus className="h-4 w-4" aria-hidden="true" />Registrar arqueo</Link> : <span>Registrar arqueo</span>}</Button>
    {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
    {gate.reason === 'error' && <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}><RotateCcw className="h-4 w-4" aria-hidden="true" />{isRefreshing ? 'Verificando turno…' : 'Reintentar'}</Button>}
  </div>}{canPolicy && <Button asChild variant="outline"><Link to="/cierre-caja/politica"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Política de diferencias</Link></Button>}</>

  if (!closureAccess) { const destination=cashWorkspaceFallback(hasPermission);return destination?<Navigate to={destination} replace/>:<Notice>No tienes acceso a los arqueos.</Notice> }
  return <div className="min-w-0 space-y-4">
    
    <div className="auna-page-toolbar">
      {capabilities.data?.viewTeam && canViewHistory ? <ModuleTabBar ariaLabel="Alcance de arqueos" value={scope} items={[{ value: 'mine', label: 'Mis arqueos' }, { value: 'team', label: 'Equipo' }]} onValueChange={value => { setSelectedScope(value as CashClosureReadScope); list.setPage(1) }} /> : <h2 className="text-sm font-semibold">Mis arqueos</h2>}
      {!canViewHistory && <div className="compact-filter-actions">{actions}</div>}
    </div>
    {canRead && capabilities.isPending && <LoadingState variant="table" message="Comprobando acceso…" />}
    {capabilities.isError && <p role="alert" className="text-sm text-destructive">No se pudo comprobar el acceso a los arqueos. <Button variant="link" onClick={() => capabilities.refetch()}>Reintentar</Button></p>}
    {canViewHistory && <section className="space-y-4" aria-label="Historial de arqueos">
      <MetricStrip label={scope === 'mine' ? 'Resumen de mis arqueos' : 'Resumen del equipo'} loading={query.isPending} items={([['total', 'Arqueos'], ['Pendiente', 'Pendientes'], ['Aprobado', 'Aprobados'], ['Rechazado', 'Rechazados']] as const).map(([key, label]) => ({ label, value: data?.summary?.[key] ?? '—' }))} />
      <CompactFilterPanel actions={actions} title="Filtros de arqueos" activeCount={activeHistoryFilters} onClear={clearHistoryFilters}
        appliedFilters={[...(historyStatus ? [{ label: 'Estado: ' + historyStatus, onRemove: () => setHistoryStatus('') }] : []), ...(historyStartDate ? [{ label: 'Desde: ' + historyStartDate, onRemove: () => setHistoryStartDate('') }] : []), ...(historyEndDate ? [{ label: 'Hasta: ' + historyEndDate, onRemove: () => setHistoryEndDate('') }] : [])]}
        search={<div className="flex items-center gap-2"><Label htmlFor="closure-page-size" className="text-sm text-muted-foreground">Por página</Label>
          <Select value={String(list.pageSize)} onValueChange={v => { list.setPageSize(Number(v)); list.setPage(1) }}><SelectTrigger id="closure-page-size" aria-label="Cierres por página" className="w-[72px]"><SelectValue /></SelectTrigger><SelectContent>{TABLE_PAGE_SIZES.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select>
        </div>}>
        <div className="space-y-1"><Label htmlFor="closure-status" className="text-xs">Estado</Label>
          <Select value={historyStatus || 'all'} onValueChange={v => setHistoryStatus(v === 'all' ? '' : v)}><SelectTrigger id="closure-status" className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="all">Todos</SelectItem><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Aprobado">Aprobado</SelectItem><SelectItem value="Rechazado">Rechazado</SelectItem><SelectItem value="Reconteo">Reconteo solicitado</SelectItem><SelectItem value="Sustituido">Sustituido por reconteo</SelectItem>
          </SelectContent></Select>
        </div>
        <div className="space-y-1"><Label htmlFor="closure-from" className="text-xs">Desde</Label><Input id="closure-from" type="date" className="w-[140px]" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="closure-to" className="text-xs">Hasta</Label><Input id="closure-to" type="date" className="w-[140px]" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} /></div>
      </CompactFilterPanel>
      {query.isError ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm"><span>No se pudieron consultar los arqueos. Revisa tus permisos o vuelve a intentar.</span><Button variant="outline" size="sm" onClick={() => query.refetch()}>Reintentar</Button></div> :
        <ClosuresHistoryList closures={data?.items || []} scope={scope} isLoading={query.isPending} currentPage={data?.page || list.page} totalPages={data?.totalPages || 1} filtered={activeHistoryFilters > 0} onReset={clearHistoryFilters} onViewClosure={id => navigate('/cierre-caja/' + id)} onPageChange={list.setPage} />}
    </section>}
  </div>
}
