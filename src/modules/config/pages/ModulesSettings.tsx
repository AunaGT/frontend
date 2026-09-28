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

  if (isLoading) return <div className="flex min-h-[180px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
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
      <div className="config-module-toolbar">
        <label className="config-search"><Search className="h-4 w-4" aria-hidden="true" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Buscar módulo..." aria-label="Buscar módulo" /></label>
        <div className="config-filter-list" role="group" aria-label="Filtrar módulos por estado">
          {([['all', 'Todos'], ['active', 'Activos'], ['inactive', 'Inactivos'], ['trial', 'En prueba']] as const).map(([value, label]) => (
            <button key={value} type="button" className="config-filter" data-active={filter === value} onClick={() => { setFilter(value); setPage(1) }} aria-pressed={filter === value}>
              {value !== 'all' && <span className={`config-status-dot config-status-dot--${value}`} />}{label} ({counts[value]})
            </button>
          ))}
        </div>
        <label className="config-sort"><span>Ordenar por</span><select value={order} onChange={(event) => setOrder(event.target.value as 'asc' | 'desc')} aria-label="Ordenar módulos"><option value="asc">Nombre (A - Z)</option><option value="desc">Nombre (Z - A)</option></select></label>
      </div>
      <div className="config-module-table-wrap"><table className="config-module-table">
        <thead><tr><th>Módulo</th><th>Descripción</th><th>Estado</th><th>Dependencias</th><th>Activación</th></tr></thead>
        <tbody>
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
          {!visible.length && <tr><td colSpan={5} className="config-empty">No hay módulos que coincidan con estos filtros.</td></tr>}
        </tbody>
      </table></div>
      <div className="config-module-footer"><span>Mostrando {visible.length ? (currentPage - 1) * 8 + 1 : 0}–{Math.min(currentPage * 8, filtered.length)} de {filtered.length} {filtered.length === 1 ? 'módulo' : 'módulos'}</span>{pageCount > 1 && <div className="config-pages" aria-label="Paginación de módulos"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Página anterior">‹</button>{Array.from({ length: pageCount }, (_, index) => <button type="button" key={index} data-active={currentPage === index + 1} onClick={() => setPage(index + 1)} aria-label={`Página ${index + 1}`} aria-current={currentPage === index + 1 ? 'page' : undefined}>{index + 1}</button>)}<button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Página siguiente">›</button></div>}</div>
      <div className="config-note"><Info className="h-5 w-5" /><span>Activar un módulo no concede permisos de usuario. Sus funciones se configuran dentro de cada módulo y los accesos se gestionan por separado.</span></div>
    </section>
  )
}

export default ModulesSettings
