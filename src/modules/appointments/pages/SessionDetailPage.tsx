import { usePersistedListUiState } from '@/hooks/usePersistedListUiState'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { Button } from '@/components/ui/button'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { LoadingState } from '@/components/shared/LoadingState'
import { useAgendaContext } from '../useAgendaContext'
import { appointmentQueryKey, getAgenda, agendaParams } from '../api'
import { emptyDirectory } from '../useServiceScheduleDraft'
import { statusLabels } from '../viewModel'
import { AgendaActions } from '../components/AgendaActions'
import { AgendaHistory } from '../components/AgendaHistory'
import {EngagementOrigin} from '../components/EngagementOrigin'
import {editDestination} from '../creationDraft'
import { SessionParticipants } from '../components/SessionParticipants'
import type { AgendaService, Directory, SessionDetail } from '../types'
import '../appointments.css'
export default function SessionDetailPage() {
  const ctx=useAgendaContext(),{id}=useParams()
  return <SessionWorkspace key={`${ctx.scope.companyId}:${ctx.scope.branchId}:${id}`} id={id||''} />
}
function SessionWorkspace({id}:{id:string}) {
  const ctx=useAgendaContext(),[params,setParams]=useSearchParams(),page=Math.max(1,Number(params.get('page'))||1),waitPage=Math.max(1,Number(params.get('waitPage'))||1),q=params.get('q')||''
  const {pageSize,setPageSize}=usePersistedListUiState('agenda/sesion/participantes', {defaultPageSize:10})
  usePageTrail([{label:'Agenda',to:'/agenda'},{label:'Sesión'}])
  const query=useQuery({queryKey:appointmentQueryKey(ctx.scope,'session',{id,page,waitPage,q,pageSize}),queryFn:({signal})=>getAgenda<SessionDetail>(`/sessions/${id}?${agendaParams({page,waitPage,q,pageSize})}`,ctx.scope,signal),enabled:ctx.ready&&!!id})
  const directory=useQuery({queryKey:appointmentQueryKey(ctx.scope,'directory'),queryFn:({signal})=>getAgenda<Directory>('/directory',ctx.scope,signal),enabled:ctx.ready})
  const row=ctx.ready?query.data:undefined
  const service=useQuery({queryKey:appointmentQueryKey(ctx.scope,'service',{id:row?.productId}),queryFn:({signal})=>getAgenda<AgendaService>(`/services/${row!.productId}`,ctx.scope,signal),enabled:!!row&&ctx.ready})
  const change=(values:Record<string,string>)=>setParams(previous=>{const next=new URLSearchParams(previous);for(const [key,value]of Object.entries(values)){if(value)next.set(key,value);else next.delete(key)}return next},{replace:true})
  if(query.isLoading)return <main className="agenda-page"><LoadingState variant="detail" message="Cargando sesión…" /></main>
  if(!row)return <main className="agenda-page"><p role="alert">No se pudo acceder a esta sesión.</p><Button variant="outline" disabled={!ctx.ready} onClick={()=>void query.refetch()}>Reintentar</Button><Link to="/agenda">Volver</Link></main>
  const data=directory.data||emptyDirectory,canMove=ctx.writable&&ctx.hasPermission('appointments.edit')&&row.mode==='GROUP'&&row.status==='SCHEDULED'&&new Date(row.startsAt)>new Date()
  const destination=editDestination('SESSION',row.id,params.get('inicio')?{startsAt:params.get('inicio')!}:undefined)
  if(canMove&&params.get('editar')==='1')return <Navigate to={destination.pathname} state={destination.state} replace/>
  return <main className="agenda-page"><h1 className="sr-only">{row.serviceName}</h1><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{row.serviceName}</p><p className="text-sm text-muted-foreground">{statusLabels[row.status]} · {new Intl.DateTimeFormat('es-GT',{timeZone:row.timezone,dateStyle:'full',timeStyle:'short'}).format(new Date(row.startsAt))}</p></div><div className="agenda-actions"><Button variant="outline" asChild><Link to="/agenda">Volver</Link></Button>{canMove&&<Button variant="outline" asChild><Link to={destination.pathname}>Reprogramar grupo</Link></Button>}{ctx.writable&&<AgendaActions scope={ctx.scope} row={row} kind="sessions" has={ctx.hasPermission} />}</div></div><EngagementOrigin engagementId={row.engagementId}/><MetricStrip items={[{label:'Cupos',value:row.capacity},{label:'Ocupados',value:row.occupied},{label:'Disponibles',value:Math.max(0,row.capacity-row.occupied)},{label:'En espera',value:row.waitlist.totalItems}]} />{!!row.conflicts.length&&<p role="status" className="text-sm text-destructive">{row.conflicts.join(' · ')}. Revisa la sesión; no se ha cancelado automáticamente.</p>}<div className="agenda-detail-grid"><section className="agenda-panel"><h2>Profesionales y recursos</h2><p className="text-sm">{row.providerIds.map(id=>data.providers.find(p=>p.id===id)?.name||'Profesional asignado').join(', ')||'No requiere profesional'}</p><p className="mt-2 text-sm text-muted-foreground">{row.resourceIds.map(id=>data.resources.find(r=>r.id===id)?.name||'Recurso asignado').join(', ')||'No requiere recurso'} · {row.timezone}</p></section><AgendaHistory history={row.history} timezone={row.timezone} /></div>{row.mode==='GROUP'?<SessionParticipants scope={ctx.scope} session={row} service={service.data} has={ctx.hasPermission} writable={ctx.writable} page={page} waitPage={waitPage} pageSize={pageSize} onPageSizeChange={size=>{setPageSize(size);change({page:'1',waitPage:'1'})}} onPage={p=>change({page:String(p)})} onWaitPage={p=>change({waitPage:String(p)})} search={q} onSearch={q=>change({q,page:'1'})} />:<div className="agenda-panel"><p className="text-sm">Esta sesión corresponde a una reserva individual. Consulta su reserva para ver el historial o las acciones disponibles.</p>{row.bookings.items.map(b=><Button key={b.id} variant="outline" asChild className="mt-3"><Link to={`/agenda/reservas/${b.id}`}>{b.contactName} · {statusLabels[b.status]}</Link></Button>)}</div>}</main>
}
