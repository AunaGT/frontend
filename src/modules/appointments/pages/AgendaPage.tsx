import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Settings } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { ModuleTabBar } from '@/components/shared/ModuleTabs'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAgendaContext } from '../useAgendaContext'
import { useAgenda } from '../hooks'
import { appointmentQueryKey, getAgenda } from '../api'
import { shiftAgendaDate, agendaRange, localDay, entryDestination, entryStatusText, statusLabels } from '../viewModel'
import { AgendaCalendar } from '../components/AgendaCalendar'
import { AgendaPicker } from '../components/AgendaPicker'
import type { AgendaFilter, AgendaService, Directory } from '../types'
import { editDestination } from '../creationDraft'
import { newActivity } from '../activityDraft'
import { venueLabels } from '../components/AgendaVenueFields'
import { purposeLabels } from '../components/ActivityFields'
import type { CalendarSelection } from '../calendarSelection'
import '../appointments.css'

export default function AgendaPage() {
  const ctx = useAgendaContext()
  return <AgendaWorkspace key={`${ctx.scope.companyId}:${ctx.scope.branchId}`} />
}
function AgendaWorkspace() {
  const ctx = useAgendaContext(), [params, setParams] = useSearchParams(), navigate = useNavigate(), mobile = useIsMobile()
  const createAt=(selection:CalendarSelection)=>navigate('/agenda/nueva',{state:{creationDraft:{scope:{...ctx.scope},value:{kind:ctx.canUseCatalog?'SERVICE':'ACTIVITY',activity:newActivity(ctx.user?.id||'',selection.timezone,{startsAt:selection.startsAt||`${selection.date}T`,endsAt:selection.endsAt||`${selection.date}T`})}}}})
  usePageTrail([{ label: 'Agenda' }])
  const rawView = params.get('vista'), view: 'day' | 'week' | 'month' | 'list' = ['day', 'week', 'month', 'list'].includes(rawView || '') ? rawView as 'day' | 'week' | 'month' | 'list' : mobile ? 'list' : 'week'
  const today = localDay(new Date(), ctx.timezone), rawDate = params.get('fecha') || today
  let date = rawDate
  try { agendaRange(date, view, ctx.timezone) } catch { date = today }
  const change = (values: Record<string, string>) => setParams(previous => { const next = new URLSearchParams(previous); for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key) } if (!('page' in values)) next.delete('page'); return next }, { replace: true })
  const page = Math.max(1, Number(params.get('page')) || 1)
  const filter: AgendaFilter = { ...agendaRange(date, view, ctx.timezone), page, pageSize: 10, q: params.get('q') || undefined, providerId: params.get('profesional') || undefined, resourceId: params.get('recurso') || undefined, productId: params.get('servicio') || undefined, status: params.get('estado') as AgendaFilter['status'] || undefined }
  const agenda = useAgenda(ctx.scope, filter, view, ctx.ready)
  const directory = useQuery({ queryKey: appointmentQueryKey(ctx.scope, 'directory'), queryFn: ({ signal }) => getAgenda<Directory>('/directory', ctx.scope, signal), enabled: ctx.ready })
  const selectedService = useQuery({ queryKey: appointmentQueryKey(ctx.scope, 'service', { id: params.get('servicio') }), queryFn: ({ signal }) => getAgenda<AgendaService>(`/services/${params.get('servicio')}`, ctx.scope, signal), enabled: ctx.canUseCatalog && !!params.get('servicio') })
  const create = ctx.writable && ctx.hasPermission('appointments.create'), edit = ctx.writable && ctx.hasPermission('appointments.edit')
  const counts = agenda.summary, bookings = agenda.bookings
  const activeCount = ['q', 'profesional', 'recurso', 'servicio', 'estado'].filter(k => params.get(k)).length
  const when = (value: string) => new Intl.DateTimeFormat('es-GT', { timeZone: ctx.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  const choices = (label: string, key: string, items: { id: string; name: string }[]) => <div><Label id={`agenda-${key}`}>{label}</Label><Select value={params.get(key) || 'all'} onValueChange={value => change({ [key]: value === 'all' ? '' : value })}><SelectTrigger aria-labelledby={`agenda-${key}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{items.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
  if (!ctx.ready) return <div className="agenda-page"><p>Selecciona una empresa con Agenda habilitada y acceso autorizado.</p></div>
  return <main className="agenda-page"><h1 className="sr-only">Agenda y servicios</h1>
    <MetricStrip loading={agenda.isLoading} items={[{ label: 'Actividades del período', value: counts?.activities ?? '—' }, { label: 'Programadas', value: counts?.scheduled ?? '—' }, { label: 'En curso', value: counts?.inProgress ?? '—' }, { label: 'Finalizadas', value: counts?.completed ?? '—' }, { label: 'Canceladas', value: counts?.cancelled ?? '—' }]} />
    <CompactFilterPanel activeCount={activeCount} onClear={() => change({ q: '', profesional: '', recurso: '', servicio: '', estado: '' })} search={<div><Label htmlFor="agenda-search">Buscar</Label><Input id="agenda-search" placeholder="Actividad, cliente o servicio…" value={params.get('q') || ''} onChange={e => change({ q: e.target.value })} /></div>} actions={<>{ctx.hasPermission('appointments.configure') && <Button variant="outline" asChild><Link to="/agenda/configuracion"><Settings aria-hidden="true" />Configuración</Link></Button>}{create && <Button onClick={()=>createAt({date,timezone:ctx.timezone})}><Plus aria-hidden="true"/>Agendar</Button>}</>}>
      {ctx.canUseCatalog !== false && <div><Label htmlFor="agenda-productId">Servicio</Label><AgendaPicker<AgendaService> scope={ctx.scope} kind="services" schedulableOnly={false} label={params.get('servicio') ? selectedService.data?.name || 'Servicio seleccionado' : 'Todos los servicios'} onSelect={row => change({ servicio: row.id })} />{params.get('servicio') && <Button size="sm" variant="ghost" onClick={() => change({ servicio: '' })}>Quitar servicio</Button>}</div>}{choices('Profesional', 'profesional', directory.data?.providers || [])}{choices('Sala o equipo', 'recurso', directory.data?.resources || [])}{choices('Estado', 'estado', Object.entries(statusLabels).filter(([key]) => ['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'].includes(key)).map(([id,name]) => ({id,name})))}
    </CompactFilterPanel>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => change({ fecha: shiftAgendaDate(date, view, -1) })}><ChevronLeft /></Button><Button variant="outline" onClick={() => change({ fecha: today })}>Hoy</Button><Input type="date" className="w-40" aria-label="Fecha de agenda" value={date} onChange={e => { if (e.target.value) change({ fecha: e.target.value }) }} /><Button variant="outline" size="icon" aria-label="Período siguiente" onClick={() => change({ fecha: shiftAgendaDate(date, view, 1) })}><ChevronRight /></Button><span className="text-xs text-muted-foreground">{ctx.timezone}</span></div><ModuleTabBar value={view} onValueChange={vista => change({ vista })} items={[{ value: 'day', label: 'Día' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' }, { value: 'list', label: 'Lista' }]} ariaLabel="Vista de Agenda" /></div>
    {!ctx.writable && <p className="text-sm text-muted-foreground">Consulta consolidada. Selecciona una sucursal para operar.</p>}
    {agenda.isError ? <div role="alert"><p>No se pudo cargar la agenda. {agenda.error instanceof Error ? agenda.error.message : ''}</p><Button variant="outline" onClick={agenda.refetch}>Reintentar</Button></div> : agenda.isLoading ? <LoadingState variant={view === 'list' ? 'table' : 'detail'} message="Cargando agenda…" /> : view === 'list' ? <>
      <div className="auna-data-table-shell overflow-x-auto"><table className="auna-data-table"><thead><tr><th>Actividad / responsable</th><th>Lugar</th><th>Horario</th><th>Estado</th><th>Revisión</th></tr></thead><tbody>{bookings?.items.map(row => <tr key={row.id}><td><Link className="font-medium hover:underline" to={entryDestination(row)}>{row.title}</Link><small className="block text-muted-foreground">{row.organizerName || row.contactName || (row.recordType==='ACTIVITY' ? purposeLabels[row.purpose||'MEETING'] : 'Servicio programado')}</small></td><td>{venueLabels[row.venue?.kind||'BRANCH']}</td><td>{when(row.startsAt)}</td><td>{entryStatusText(row)}</td><td>{row.conflicts.length ? <span className="text-destructive">{row.conflicts.join(' · ')}</span> : 'Sin conflictos'}</td></tr>)}{!bookings?.items.length && <tr><td colSpan={5}><EmptyState title="Sin actividades en este período" description="Prueba otra fecha o ajusta los filtros." /></td></tr>}</tbody></table></div><div className="auna-pagination-outside"><Pagination currentPage={page} totalPages={Math.max(1, Math.ceil((bookings?.totalItems || 0) / 10))} totalItems={bookings?.totalItems || 0} pageSize={10} count={bookings?.items.length || 0} onPageChange={p => change({ page: String(p) })} itemLabel="actividades" /></div>
    </> : <AgendaCalendar sessions={agenda.sessions} view={view} date={date} timezone={ctx.timezone} onDay={fecha => change({ fecha, vista: 'day' })} onOpen={id => { const s = agenda.sessions.find(s => s.id === id); if (s) navigate(entryDestination(s)) }} onSelect={create?createAt:undefined} onCreate={create?startsAt=>createAt({date:localDay(startsAt,ctx.timezone),startsAt,endsAt:new Date(new Date(startsAt).getTime()+1800000).toISOString(),timezone:ctx.timezone}):undefined} onMove={edit ? (id, startsAt, endsAt) => { const s = agenda.sessions.find(s => s.id === id); if (s) {const target=editDestination(s.recordType==='ACTIVITY'?'ACTIVITY':s.mode==='GROUP'?'SESSION':'BOOKING',s.recordType==='ACTIVITY'||s.mode==='GROUP'?s.id:s.bookingId||s.id,{startsAt,endsAt});navigate(target.pathname,{state:target.state})} } : undefined} onResize={edit?(id,startsAt,endsAt)=>{const target=editDestination('ACTIVITY',id,{startsAt,endsAt});navigate(target.pathname,{state:target.state})}:undefined} />}
  </main>
}
