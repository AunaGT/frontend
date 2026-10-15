import {ServiceBillingAction} from '../components/ServiceBillingAction'
import {CommercialPreparationNotice} from '../components/CommercialPreparationNotice'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {LoadingState} from '@/components/shared/LoadingState'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {useAgendaContext} from '../useAgendaContext'
import {appointmentQueryKey,getAgenda} from '../api'
import {statusLabels,entryStatusText} from '../viewModel'
import {AgendaHistory} from '../components/AgendaHistory'
import {EngagementOrigin} from '../components/EngagementOrigin'
import {AgendaActions} from '../components/AgendaActions'
import {editDestination} from '../creationDraft'
import {purposeLabels} from '../components/ActivityFields'
import {venueLabels} from '../components/AgendaVenueFields'
import type {ActivityDto} from '../types'
import '../appointments.css'
export default function ActivityDetailPage() {
  const ctx=useAgendaContext(),{id}=useParams(),[params]=useSearchParams()
  usePageTrail([{label:'Agenda',to:'/agenda'},{label:'Actividad'}])
  const query=useQuery({queryKey:appointmentQueryKey(ctx.scope,'activity',{id}),queryFn:({signal})=>getAgenda<ActivityDto>(`/activities/${id}`,ctx.scope,signal),enabled:ctx.ready&&!!id})
  const row=ctx.ready?query.data:undefined
  if(query.isLoading)return <main className="agenda-page"><LoadingState variant="detail" message="Cargando actividad…"/></main>
  if(!row)return <main className="agenda-page"><p role="alert">No se pudo acceder a esta actividad.</p><Button variant="outline" disabled={!ctx.ready} onClick={()=>void query.refetch()}>Reintentar</Button><Link to="/agenda">Volver a Agenda</Link></main>
  const when=(value:string)=>new Intl.DateTimeFormat('es-GT',{timeZone:row.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
  const edit=ctx.writable&&ctx.hasPermission('appointments.edit')&&row.status==='SCHEDULED'

  const start=params.get('inicio'),end=params.get('fin'),proposed=start&&Number.isFinite(new Date(start).getTime())?{startsAt:start,endsAt:end&&Number.isFinite(new Date(end).getTime())?end:undefined}:undefined
  const destination=editDestination('ACTIVITY',row.id,proposed)
  if(edit&&params.get('editar')==='1')return <Navigate to={destination.pathname} state={destination.state} replace/>
  return <main className="agenda-page"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">{row.title}</h1><p className="text-sm text-muted-foreground">{purposeLabels[row.purpose]} · {entryStatusText(row)}</p></div><div className="agenda-actions"><Button variant="outline" asChild><Link to="/agenda">Volver</Link></Button>{edit&&<Button variant="outline" asChild><Link to={destination.pathname}>Editar / reprogramar</Link></Button>}{!row.engagementId&&<ServiceBillingAction origin={{kind:'ACTIVITY',id:row.id}} eligible={row.serviceScheduling==='CONFIGURED'&&!!row.productId&&row.status!=='CANCELLED'}/>}{ctx.writable&&<AgendaActions scope={ctx.scope} kind="activities" row={row} has={ctx.hasPermission}/>}</div></div>
    <EngagementOrigin engagementId={row.engagementId}/><CommercialPreparationNotice state={row.commercialPreparation} reason={row.commercialPreparationReason}/>{row.actualCompletedAt&&<div className="flex flex-wrap items-start justify-between gap-3 border-y py-3 text-sm"><p>Cierre real: <strong>{when(row.actualCompletedAt)}</strong> · {row.commercialCompletionConfirmedAt?`Realización confirmada: ${when(row.commercialCompletionConfirmedAt)}`:'Realización comercial pendiente de confirmación humana.'}</p><p className="text-muted-foreground">El cierre de horario no registra pagos ni entregas.</p></div>}<div className="agenda-detail-grid"><section className="agenda-panel"><h2>Horario y lugar</h2><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Inicio</dt><dd>{when(row.startsAt)}</dd></div><div><dt className="text-muted-foreground">Fin</dt><dd>{when(row.endsAt)}</dd></div><div className="sm:col-span-2 border-t pt-3"><dt className="text-muted-foreground">Personal y equipo ocupados</dt><dd className="font-medium">{when(row.occupiedFrom)} – {when(row.occupiedUntil)}</dd><dd className="mt-1 text-xs text-muted-foreground">Ida {row.outboundMinutes} min · Montaje {row.setupMinutes} min · Cierre {row.teardownMinutes} min · Regreso {row.returnMinutes} min</dd></div><div><dt className="text-muted-foreground">Lugar</dt><dd>{venueLabels[row.venue.kind]}{row.venue.name&&` · ${row.venue.name}`}</dd>{row.venue.address&&<dd>{row.venue.address}</dd>}{row.venue.references&&<dd className="mt-1 text-muted-foreground">{row.venue.references}</dd>}{row.venue.url?.startsWith('https://')&&<dd><a className="underline" href={row.venue.url} target="_blank" rel="noopener noreferrer">Abrir enlace de reunión</a></dd>}</div><div><dt className="text-muted-foreground">Responsable</dt><dd>{row.organizer?.name||'Responsable asignado'}</dd></div>{row.estimatedAttendance!=null&&<div><dt className="text-muted-foreground">Asistentes estimados</dt><dd>{row.estimatedAttendance} · informativo, sin inscripciones</dd></div>}<div><dt className="text-muted-foreground">Asignaciones</dt><dd>{[...(row.participants||[]),...(row.providers||[]),...(row.resources||[])].map(p=>p.name).join(', ')||'Sin otras asignaciones'}</dd></div></dl>{!!row.guests.length&&<div className="mt-4 border-t pt-3"><h3 className="text-sm font-medium">Invitados externos</h3><p className="text-sm">{row.guests.map(g=>g.name).join(', ')}</p></div>}{row.notes&&<div className="mt-4 border-t pt-3"><h3 className="text-sm font-medium">Observaciones internas</h3><p className="whitespace-pre-wrap text-sm">{row.notes}</p></div>}<p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Esta actividad no crea ventas ni cobros. {row.status==='COMPLETED'&&'Su intervalo de ocupación se conserva hasta terminar el regreso.'}</p></section><AgendaHistory timezone={row.timezone} history={{items:row.history.map(h=>({id:h.id,action:h.action,at:h.at,actor:h.actorId?'Usuario registrado':'Sistema',reason:h.reason})),hasMore:row.history.length===100}}/></div>
    </main>
}
