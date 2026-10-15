import {ServiceBillingAction} from '../components/ServiceBillingAction'
import {CommercialPreparationNotice} from '../components/CommercialPreparationNotice'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { Button } from '@/components/ui/button'
import { ContactImage } from '@/components/shared/ContactImage'
import { LoadingState } from '@/components/shared/LoadingState'
import { useAgendaContext } from '../useAgendaContext'
import { appointmentQueryKey, getAgenda } from '../api'
import { statusLabels } from '../viewModel'
import { emptyDirectory } from '../useServiceScheduleDraft'
import { AgendaActions } from '../components/AgendaActions'
import { AgendaHistory } from '../components/AgendaHistory'
import {EngagementOrigin} from '../components/EngagementOrigin'
import {editDestination} from '../creationDraft'
import type { BookingDetail, Directory } from '../types'
import '../appointments.css'
export default function AppointmentDetailPage() {
  const ctx = useAgendaContext(), {id} = useParams()
  return <BookingWorkspace key={`${ctx.scope.companyId}:${ctx.scope.branchId}:${id}`} id={id || ''} />
}
export function BookingWorkspace({ id }: { id: string }) {
  const ctx = useAgendaContext(), [params] = useSearchParams()
  usePageTrail([{label:'Agenda',to:'/agenda'},{label:'Reserva'}])
  const query = useQuery({queryKey:appointmentQueryKey(ctx.scope,'booking',{id}),queryFn:({signal})=>getAgenda<BookingDetail>(`/bookings/${id}`,ctx.scope,signal),enabled:ctx.ready && !!id})
  const directory = useQuery({queryKey:appointmentQueryKey(ctx.scope,'directory'),queryFn:({signal})=>getAgenda<Directory>('/directory',ctx.scope,signal),enabled:ctx.ready})
  const row = ctx.ready ? query.data : undefined, data = directory.data || emptyDirectory
  if (query.isLoading) return <main className="agenda-page"><LoadingState variant="detail" message="Cargando reserva…" /></main>
  if (!row) return <main className="agenda-page"><p role="alert">No se pudo acceder a esta reserva.</p><Button variant="outline" onClick={()=>void query.refetch()} disabled={!ctx.ready}>Reintentar</Button><Link to="/agenda">Volver a Agenda</Link></main>
  const canMove = ctx.writable && ctx.hasPermission('appointments.edit') && ['HELD','PENDING','CONFIRMED'].includes(row.status) && new Date(row.startsAt)>new Date()
  const destination=editDestination('BOOKING',row.id,params.get('inicio')?{startsAt:params.get('inicio')!}:undefined)
  if(canMove&&params.get('editar')==='1')return <Navigate to={destination.pathname} state={destination.state} replace/>
  const when = (s:string)=>new Intl.DateTimeFormat('es-GT',{timeZone:row.timezone,dateStyle:'full',timeStyle:'short'}).format(new Date(s))
  return <main className="agenda-page"><h1 className="sr-only">Reserva de {row.contactName}</h1><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{row.serviceName}</p><p className="text-sm text-muted-foreground">{statusLabels[row.status]}</p></div><div className="agenda-actions"><Button variant="outline" asChild><Link to="/agenda">Volver</Link></Button>{canMove && <Button variant="outline" asChild><Link to={destination.pathname}>Reprogramar</Link></Button>}{!row.engagementId && <ServiceBillingAction origin={{kind:'BOOKING',id:row.id}} eligible={!row.includedInEngagement && !['CANCELLED','EXPIRED','NO_SHOW'].includes(row.status)} />}{ctx.writable && <AgendaActions scope={ctx.scope} kind="bookings" row={row} has={ctx.hasPermission} />}</div></div>
    <EngagementOrigin engagementId={row.engagementId}/>
    <CommercialPreparationNotice state={row.commercialPreparation} reason={row.commercialPreparationReason}/>
    {!!row.conflicts.length && <div role="status" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{row.conflicts.join(' · ')}. Revisa la reserva; no se ha cancelado automáticamente.</div>}
    <div className="agenda-detail-grid"><section className="agenda-panel"><h2>Servicio y horario</h2><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Inicio</dt><dd className="mt-1 font-medium">{when(row.startsAt)}</dd></div><div><dt className="text-muted-foreground">Finalización</dt><dd className="mt-1">{when(row.endsAt)}</dd></div><div><dt className="text-muted-foreground">Profesionales</dt><dd>{row.providerIds.map(id=>data.providers.find(p=>p.id===id)?.name||'Profesional asignado').join(', ')||'No requiere'}</dd></div><div><dt className="text-muted-foreground">Salas o equipos</dt><dd>{row.resourceIds.map(id=>data.resources.find(r=>r.id===id)?.name||'Recurso asignado').join(', ')||'No requiere'}</dd></div></dl>{row.notes && <div className="mt-4 border-t pt-3"><p className="text-xs text-muted-foreground">Observaciones internas</p><p className="whitespace-pre-wrap text-sm">{row.notes}</p></div>}{row.commercial && <div className="mt-4 border-t pt-3"><h3 className="mb-2 text-sm font-semibold">Importe acordado</h3><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{row.commercial.quantity} {row.commercial.unit} × {row.commercial.unitPrice}</span><strong>{row.commercial.currencyCode} {row.commercial.total}</strong></div><p className="mt-1 text-xs text-muted-foreground">Reserva de servicio. No es un comprobante de pago.</p></div>}</section><div className="space-y-5"><section className="agenda-panel"><h2>Cliente</h2><div className="flex items-start gap-4"><ContactImage src={row.contactImageUrl} name={row.contactName} className="h-20 w-20" /><div className="min-w-0"><p className="font-medium">{row.contactName}</p><p className="mt-1 text-sm text-muted-foreground">{statusLabels[row.status]}</p>{ctx.hasPermission('contacts.clients.view') && <Button variant="outline" size="sm" asChild className="mt-3"><Link to={`/contactos/${row.contactId}`}>Ver contacto</Link></Button>}</div></div></section><AgendaHistory history={row.history} timezone={row.timezone} /></div></div>

  </main>
}
