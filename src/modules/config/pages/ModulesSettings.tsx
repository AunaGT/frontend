import { TableLoadingRows } from '@/components/shared/LoadingState'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { Pagination as ButtonsPagination } from '@/components/shared/Pagination'
import { useState } from 'react'
import { AlertCircle, Boxes, Info, Loader2, Search } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { appModules, MODULE_DESCRIPTIONS } from '@/config/appModules'
import { useModules } from '@/context/useModules'
import { useToast } from '@/hooks/use-toast'
import { updateCompanyModule } from '@/services/moduleService'

type Filter = 'all' | 'active' | 'inactive' | 'trial'

const statusOf = (module: { status: string; effectiveEnabled: boolean }): Filter => {
  if (!module.effectiveEnabled) return 'inactive'
  return module.status === 'TRIAL' ? 'trial' : 'active'
}

export const ModulesSettings = ({ canManage }: { canManage: boolean }) => {
  const { modules, isLoading, isError, refetch } = useModules()
  const { toast } = useToast()
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const toggle = async (code: string, enabled: boolean) => {
    setSavingCode(code)
    try {
      await updateCompanyModule(code, { status: enabled ? 'ACTIVE' : 'DISABLED' })
      await refetch()
      toast({ title: enabled ? 'Módulo activado' : 'Módulo desactivado' })
    } catch (error) {
      toast({ title: 'No se pudo cambiar el módulo', description: error instanceof Error ? error.message : 'Intente nuevamente', variant: 'destructive' })
    } finally {
      setSavingCode(null)
    }
  }

  if (isError) return <div className="config-note text-destructive"><AlertCircle className="h-5 w-5" /> No se pudo cargar el catálogo de módulos.</div>

  const counts = {
    all: modules.length,
    active: modules.filter((module) => statusOf(module) === 'active').length,
    inactive: modules.filter((module) => statusOf(module) === 'inactive').length,
    trial: modules.filter((module) => statusOf(module) === 'trial').length,
  }
  const filtered = modules.filter((module) => {
    const term = search.trim().toLocaleLowerCase('es')
    return (filter === 'all' || statusOf(module) === filter) && (!term || `${module.name} ${module.code} ${module.dependencies.join(' ')}`.toLocaleLowerCase('es').includes(term))
  }).sort((a, b) => (order === 'asc' ? 1 : -1) * a.name.localeCompare(b.name, 'es'))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8)

  return (
    <section className="config-modules" aria-label="Configuración de módulos">
      <MetricStrip loading={isLoading} label="Resumen de módulos" items={[{ label: 'Módulos', value: counts.all }, { label: 'Activos', value: counts.active }, { label: 'Inactivos', value: counts.inactive }, { label: 'En prueba', value: counts.trial }]} />
      <CompactFilterPanel title="Filtros de módulos" activeCount={Number(Boolean(search.trim())) + Number(filter !== 'all') + Number(order !== 'asc')} onClear={() => { setSearch(''); setFilter('all'); setOrder('asc'); setPage(1) }} appliedFilters={[
        ...(search.trim() ? [{ label: `Búsqueda: ${search}`, onRemove: () => { setSearch(''); setPage(1) } }] : []),
        ...(filter !== 'all' ? [{ label: `Estado: ${filter === 'active' ? 'Activos' : filter === 'trial' ? 'En prueba' : 'Inactivos'}`, onRemove: () => { setFilter('all'); setPage(1) } }] : []),
        ...(order !== 'asc' ? [{ label: 'Orden: Nombre (Z - A)', onRemove: () => { setOrder('asc'); setPage(1) } }] : []),
      ]} search={<label className="space-y-1 text-xs text-muted-foreground">Buscar<div className="relative"><Search className="absolute left-3 top-3 h-4 w-4" aria-hidden="true" /><Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Buscar módulo..." aria-label="Buscar módulo" /></div></label>}>
        <label className="space-y-1 text-xs text-muted-foreground">Estado<select className="auna-control auna-control-select w-full" value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setPage(1) }} aria-label="Filtrar módulos por estado"><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="trial">En prueba</option></select></label>
        <label className="space-y-1 text-xs text-muted-foreground">Ordenar por<select className="auna-control auna-control-select w-full" value={order} onChange={(event) => setOrder(event.target.value as 'asc' | 'desc')} aria-label="Ordenar módulos"><option value="asc">Nombre (A - Z)</option><option value="desc">Nombre (Z - A)</option></select></label>
      </CompactFilterPanel>
      <div className="auna-data-table-shell"><div className="overflow-x-auto"><table className="auna-data-table config-module-table" aria-label="Catálogo de módulos">
        <thead><tr><th>Módulo</th><th>Descripción</th><th>Estado</th><th>Dependencias</th><th>Activación</th></tr></thead>
        <tbody>
          {isLoading && <TableLoadingRows columns={5} message="Cargando módulos…" />}
          {visible.map((module) => {
            const ownEnabled = module.status === 'ACTIVE' || module.status === 'TRIAL'
            const status = statusOf(module)
            const appModule = appModules.find((item) => item.id === module.code)
            const Icon = appModule?.icon ?? Boxes
            return <tr key={module.code}>
              <td><div className="config-module-identity"><span className="config-module-icon" aria-hidden="true"><Icon className="h-full w-full" /></span><span><strong>{module.name}</strong><small>{module.code}{module.protected ? ' · Base' : ''}</small></span></div></td>
              <td className="config-module-description">{MODULE_DESCRIPTIONS[module.code] || 'Gestión del módulo'}{module.blockedBy.length ? <small className="config-module-warning">Requiere activar {module.blockedBy.join(', ')}.</small> : module.trialEndsAt && module.status === 'TRIAL' ? <small className="config-module-warning">Prueba hasta {new Date(module.trialEndsAt).toLocaleDateString('es-GT')}.</small> : null}</td>
              <td><span className={`config-module-status config-module-status--${status}`}><span className={`config-status-dot config-status-dot--${status}`} />{module.blockedBy.length ? 'Bloqueado' : status === 'trial' ? 'En prueba' : module.status === 'SUSPENDED' ? 'Suspendido' : status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
              <td><div className="config-dependencies">{module.dependencies.length ? module.dependencies.map((dependency) => <span key={dependency} className={module.blockedBy.includes(dependency) ? 'is-blocked' : ''}>{modules.find((item) => item.code === dependency)?.name ?? dependency}</span>) : <span>Ninguna</span>}</div></td>
              <td className={`config-module-toggle config-module-toggle--${status}`}>{savingCode === module.code ? <Loader2 className="h-4 w-4 animate-spin" /> : <Switch checked={ownEnabled} disabled={!canManage || module.protected || savingCode !== null} onCheckedChange={(checked) => toggle(module.code, checked)} aria-label={`${ownEnabled ? 'Desactivar' : 'Activar'} ${module.name}`} />}</td>
            </tr>
          })}
          {!isLoading && !visible.length && <tr><td colSpan={5} className="config-empty">No hay módulos que coincidan con estos filtros.</td></tr>}
        </tbody>
      </table></div></div>
      <div className="auna-pagination-outside"><ButtonsPagination currentPage={currentPage} totalPages={pageCount} onPageChange={setPage} loading={isLoading} totalItems={filtered.length} pageSize={8} count={visible.length} itemLabel="módulos" /></div>
      <div className="config-note"><Info className="h-5 w-5" /><span>Activar un módulo no concede permisos de usuario. Sus funciones se configuran dentro de cada módulo y los accesos se gestionan por separado.</span></div>
    </section>
  )
}

export default ModulesSettings
