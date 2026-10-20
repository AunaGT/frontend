import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { usePersistedListUiState } from '@/hooks/usePersistedListUiState'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { ModuleTabBar } from '@/components/shared/ModuleTabs'
import { Pagination } from '@/components/shared/Pagination'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAgendaContext } from '../useAgendaContext'
import { useAgendaMutation } from '../hooks'
import { appointmentQueryKey, getAgenda, agendaParams } from '../api'
import { useServiceScheduleDraft, emptyDirectory } from '../useServiceScheduleDraft'
import { ServiceScheduleFields } from '../components/ServiceScheduleFields'
import { ScheduleDirectory } from '../components/ScheduleDirectory'
import { AvailabilityEditor } from '../components/AvailabilityEditor'
import { FormFeedback } from '../components/FormFeedback'
import { useDraftGuard } from '../components/DraftGuard'
import type { AgendaScope, AgendaService, Directory, Page, CalendarInput } from '../types'
import '../appointments.css'

function ServiceEditor({ service, onClose }: { service: AgendaService; onClose: () => void }) {
  const draft = useServiceScheduleDraft(true, service.id), ctx = useAgendaContext(), mutation = useAgendaMutation(ctx.scope)
  const guard = useDraftGuard(draft.dirty)
  return <section className="agenda-panel space-y-5">{guard.dialog}<div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{service.name}</h2><p className="text-sm text-muted-foreground">{service.price == null ? 'Precio restringido' : service.price} por {service.unit} · La duración no cambia este precio.</p></div><Button variant="outline" onClick={() => guard.request(onClose)}>Cerrar configuración</Button></div>
    <FormFeedback error={mutation.error || (draft.error ? 'No se pudo cargar el servicio' : null)} fields={mutation.fields} />
    {!draft.ready ? <LoadingState message="Cargando configuración…" variant="detail" /> : <ServiceScheduleFields value={draft.value} onChange={draft.change} disabled={mutation.pending} directory={draft.directory} errors={mutation.fields} />}
    <div className="agenda-actions"><Button disabled={!draft.ready || !draft.dirty || mutation.pending} onClick={async () => { if (await mutation.submit(`/services/${service.id}/profile`, draft.value, 'PUT')) { await draft.reload(); onClose() } }}>{mutation.pending ? 'Guardando…' : 'Guardar configuración'}</Button></div>
  </section>
}
function CalendarForm({ scope, target, timezone, onDirty }: { scope: AgendaScope; target: string; timezone: string; onDirty: (dirty: boolean) => void }) {
  const [type, id] = target.split(':'), mutation = useAgendaMutation(scope)
  const query = useQuery({ queryKey: appointmentQueryKey(scope, 'calendar', { target }), queryFn: ({ signal }) => getAgenda<CalendarInput | null>(`/calendars/${type}/${id}`, scope, signal) })
  const [draft, setDraft] = useState<CalendarInput | null>(null)
  useEffect(() => { onDirty(!!draft); return () => onDirty(false) }, [draft, onDirty])
  const guard = useDraftGuard(!!draft)
  const value = draft || query.data || { timezone, expectedVersion: 0, weekly: [], exceptions: [], inheritBranch: false }
  if (query.isLoading) return <LoadingState message="Cargando horario…" variant="detail" />
  if (query.isError) return <div role="alert"><p>No se pudo cargar el horario.</p><Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div>
  return <section className="agenda-panel space-y-5" aria-busy={mutation.pending}>{guard.dialog}<FormFeedback error={mutation.error} fields={mutation.fields} /><AvailabilityEditor value={value} onChange={setDraft} disabled={mutation.pending} errors={mutation.fields} canInherit={type !== 'branch'} /><div className="agenda-actions"><Button variant="outline" disabled={!draft || mutation.pending} onClick={() => guard.request(() => setDraft(null))}>Descartar</Button><Button disabled={!draft || mutation.pending} onClick={async () => { if (await mutation.submit(`/calendars/${type}/${id}`, value, 'PUT')) { await query.refetch(); setDraft(null) } }}>{mutation.pending ? 'Guardando…' : 'Guardar horario'}</Button></div></section>
}
export default function AgendaSettingsPage() {
  const ctx = useAgendaContext()
  return <SettingsWorkspace key={`${ctx.scope.companyId}:${ctx.scope.branchId}`} />
}
function SettingsWorkspace() {
  const ctx = useAgendaContext(), [tab, setTab] = useState<'services' | 'providers' | 'resources' | 'calendars'>(ctx.canUseCatalog===false?'providers':'services'), [q, setQ] = useState(''), [selected, setSelected] = useState<AgendaService | null>(null), [target, setTarget] = useState('')
  const {page,setPage,pageSize,setPageSize}=usePersistedListUiState('agenda/servicios', {defaultPageSize:10})
  const allowed = ctx.ready && ctx.hasPermission('appointments.configure')
  const [childDirty, setChildDirty] = useState(false), guard = useDraftGuard(childDirty || !!selected)
  usePageTrail([{ label: 'Agenda', to: '/agenda' }, { label: 'Configuración' }])
  const directory = useQuery({ queryKey: appointmentQueryKey(ctx.scope, 'directory'), queryFn: ({ signal }) => getAgenda<Directory>('/directory', ctx.scope, signal), enabled: allowed })
  const services = useQuery({ queryKey: appointmentQueryKey(ctx.scope, 'services', { q, page, pageSize }), queryFn: ({ signal }) => getAgenda<Page<AgendaService>>(`/services?${agendaParams({ q, page, pageSize })}`, ctx.scope, signal), enabled: allowed && ctx.canUseCatalog!==false && tab === 'services' })
  const data = directory.data || emptyDirectory, activeTarget = target || (ctx.scope.branchId !== 'all' ? `branch:${ctx.scope.branchId}` : '')
  if (!allowed) return <div className="agenda-page"><p>Selecciona una empresa con Agenda habilitada y permiso de configuración.</p></div>
  return <main className="agenda-page" key={`${ctx.scope.companyId}:${ctx.scope.branchId}`}>{guard.dialog}<h1 className="sr-only">Configuración de Agenda y servicios</h1><div className="flex flex-wrap items-center justify-between gap-3"><ModuleTabBar value={tab} onValueChange={v => guard.request(() => { setTab(v); setSelected(null) })} items={[...(ctx.canUseCatalog!==false?[{ value: 'services' as const, label: 'Servicios' }]:[]), { value: 'providers', label: 'Profesionales' }, { value: 'resources', label: 'Salas y equipos' }, { value: 'calendars', label: 'Horarios' }]} ariaLabel="Configuración de Agenda" /><Button variant="outline" asChild><Link to="/agenda">Volver a Agenda</Link></Button></div>
    {ctx.scope.branchId === 'all' && <p role="status" className="text-sm text-muted-foreground">La configuración consolidada es de consulta. Selecciona una sucursal para guardar.</p>}
    {directory.isError ? <div role="alert"><p>No se pudo cargar el directorio.</p><Button variant="outline" onClick={() => void directory.refetch()}>Reintentar</Button></div> : directory.isLoading ? <LoadingState message="Cargando directorio…" variant="table" /> : tab === 'services' ? <>
      <div className="flex flex-wrap items-end justify-between gap-3"><div className="w-full max-w-md"><Label htmlFor="service-search">Buscar servicio</Label><Input id="service-search" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} /></div>{ctx.hasPermission('products.create') && <Button asChild disabled={!ctx.writable}><Link to="/inventario/nuevo?tipo=services">Nuevo servicio</Link></Button>}</div>
      {selected ? <ServiceEditor key={`${ctx.scope.companyId}:${ctx.scope.branchId}:${selected.id}`} service={selected} onClose={() => setSelected(null)} /> : services.isLoading ? <LoadingState message="Cargando servicios…" variant="table" /> : services.isError ? <div role="alert"><p>No se pudieron cargar los servicios.</p><Button variant="outline" onClick={() => void services.refetch()}>Reintentar</Button></div> : <><div className="overflow-x-auto rounded-xl border"><table className="auna-data-table"><thead><tr><th>Servicio</th><th>Atención</th><th>Duración</th><th>Agenda</th><th>Acciones</th></tr></thead><tbody>{services.data?.items.map(s => <tr key={s.id}><td className="font-medium">{s.name}</td><td>{s.mode === 'GROUP' ? `${s.capacity} cupos` : 'Individual'}</td><td>{s.durationMinutes ? `${s.durationMinutes} min` : 'Sin configurar'}</td><td>{s.schedulable ? 'Habilitada' : 'Pendiente de configurar'}</td><td><Button variant="outline" disabled={!ctx.writable} onClick={() => setSelected(s)}>Configurar</Button></td></tr>)}{!services.data?.items.length && <tr><td colSpan={5}><CollectionEmptyState title="Tu catálogo puede ofrecer mucho más" description="Crea los servicios del negocio en Inventario y configura aquí cómo recibirán citas." filtered={!!q.trim()} onReset={() => { setQ(''); setPage(1) }} action={ctx.writable && ctx.hasPermission('products.create') && <Button asChild><Link to="/inventario/nuevo?tipo=services">Nuevo servicio</Link></Button>} /></td></tr>}</tbody></table></div><Pagination currentPage={page} totalPages={Math.max(1, Math.ceil((services.data?.totalItems || 0) / pageSize))} totalItems={services.data?.totalItems || 0} pageSize={pageSize} onPageSizeChange={setPageSize} count={services.data?.items.length || 0} onPageChange={setPage} itemLabel="servicios" /></>}
    </> : tab === 'providers' || tab === 'resources' ? <ScheduleDirectory key={`${ctx.scope.companyId}:${ctx.scope.branchId}:${tab}`} scope={ctx.scope} directory={data} kind={tab} onDirty={setChildDirty} /> : <><div className="max-w-lg"><Label id="calendar-target">¿De quién es el horario?</Label><Select value={activeTarget} onValueChange={value => guard.request(() => setTarget(value))} disabled={!ctx.writable}><SelectTrigger aria-labelledby="calendar-target"><SelectValue placeholder="Selecciona sucursal, profesional o recurso" /></SelectTrigger><SelectContent>{data.branches.map(b => <SelectItem key={b.id} value={`branch:${b.id}`}>Sucursal · {b.name}</SelectItem>)}{data.providers.map(p => <SelectItem key={p.id} value={`provider:${p.id}`}>Profesional · {p.name}</SelectItem>)}{data.resources.map(r => <SelectItem key={r.id} value={`resource:${r.id}`}>Recurso · {r.name}</SelectItem>)}</SelectContent></Select></div>{activeTarget && ctx.writable && <CalendarForm key={`${ctx.scope.companyId}:${ctx.scope.branchId}:${activeTarget}`} scope={ctx.scope} target={activeTarget} timezone={ctx.timezone} onDirty={setChildDirty} />}</>}
  </main>
}
