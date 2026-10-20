import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import {useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {Button} from '@/components/ui/button'
import {ModuleTabBar} from '@/components/shared/ModuleTabs'
import {LoadingState} from '@/components/shared/LoadingState'
import {useAgendaContext} from '../useAgendaContext'
import {appointmentQueryKey} from '../api'
import {getCommercialEngagement} from '../commercialApi'
import {EngagementOverview,operationLabels} from '../components/EngagementLines'
import {EngagementPayments} from '../components/EngagementPayments'
import {EngagementDocuments} from '../components/EngagementDocuments'
import {AgendaHistory} from '../components/AgendaHistory'
import {statusLabels} from '../viewModel'
import {venueLabels} from '../components/AgendaVenueFields'
import type {EngagementDetail,EngagementFinancialDetail} from '../commercialTypes'
import '../appointments.css'

export default function EngagementDetailPage(){
  const ctx=useAgendaContext(),{id}=useParams()
  return <EngagementWorkspace key={`${ctx.scope.companyId}:${ctx.scope.branchId}:${id}`} id={id||''}/>
}
function EngagementWorkspace({id}:{id:string}){
  const ctx=useAgendaContext(),qc=useQueryClient(),[tab,setTab]=useState('overview')
  usePageTrail([{label:'Agenda',to:'/agenda'},{label:'Contratación'}])
  const key=appointmentQueryKey(ctx.scope,'engagement',{id})
  const query=useQuery({queryKey:key,queryFn:({signal})=>getCommercialEngagement(ctx.scope,id,signal),enabled:ctx.ready&&!!id})
  const row=ctx.ready?query.data as EngagementFinancialDetail|undefined:undefined
  if(query.isLoading)return <main className="agenda-page"><LoadingState variant="detail" message="Cargando contratación…"/></main>
  if(!row)return <main className="agenda-page"><p role="alert">No se pudo acceder a esta contratación.</p><Button variant="outline" disabled={!ctx.ready} onClick={()=>void query.refetch()}>Reintentar</Button><Link to="/agenda">Volver a Agenda</Link></main>
  const saved=(value:EngagementDetail)=>qc.setQueryData(key,value)
  const refresh=async()=>{const result=await query.refetch();if(result.error)throw result.error;return result.data}
  const tabs=[{value:'overview',label:'Resumen'},{value:'schedules',label:'Programaciones'},...(row.money?[{value:'payments',label:'Cobros'}]:[]),{value:'documents',label:'Documentos'},{value:'history',label:'Historial'}]
  const selected=tabs.some(t=>t.value===tab)?tab:'overview'
  const canProgram=ctx.writable&&ctx.hasPermission('appointments.edit')&&!row.resolutionPending&&!row.correctionEngagementId&&row.lines.some(l=>l.itemKind==='SERVICE'&&Number(l.remainingQuantity)>0)
  return <main className="agenda-page"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="text-xl font-semibold">{row.customer.name}</h1><p className="text-sm text-muted-foreground">Contratación de servicios · {operationLabels[row.operationalState]}</p></div><div className="agenda-actions"><Button variant="outline" asChild><Link to="/agenda">Volver a Agenda</Link></Button>{canProgram&&<Button asChild><Link to={`/agenda/contrataciones/${row.id}/programar`}>Programar servicios</Link></Button>}</div></div>{query.isError&&<p role="alert" className="text-sm text-destructive">No se pudieron actualizar los datos. El borrador abierto se conserva.</p>}{row.resolutionPending&&<p role="status" className="border-y py-3 text-sm">Hay cancelaciones o cambios de alcance por resolver antes de nuevos cobros o de generar venta.</p>}<ModuleTabBar items={tabs} value={selected} onValueChange={setTab} ariaLabel="Secciones de la contratación"/><div role="region" aria-label={tabs.find(t=>t.value===selected)?.label}>{selected==='overview'&&<EngagementOverview engagement={row} hasPermission={ctx.hasPermission}/>} {selected==='schedules'&&<EngagementPrograms engagement={row}/>} {selected==='payments'&&row.money&&<EngagementPayments engagement={row} onSaved={saved} onRefresh={refresh}/>} {selected==='documents'&&<EngagementDocuments engagement={row} onSaved={saved} onRefresh={refresh}/>} {selected==='history'&&<AgendaHistory timezone={ctx.timezone} history={{items:row.history.map(h=>({...h,actor:'Usuario registrado'})),hasMore:row.history.length===100}}/>}</div></main>
}
export function EngagementPrograms({engagement}:{engagement:EngagementDetail}){
  const schedules=engagement.lines.flatMap(line=>line.schedules.map(schedule=>({line,schedule})))
  return <section className="agenda-panel"><h2>Programaciones del conjunto</h2>{!schedules.length?<CollectionEmptyState compact title="El horario de estos servicios está por definirse" description="Las programaciones de este conjunto aparecerán aquí. Los bienes no requieren horario." />:<ul className="divide-y">{schedules.map(({line,schedule:s})=><li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-semibold">{line.name} · {Number(s.quantity)} {line.unitLabel}</p><p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat('es-GT',{timeZone:s.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(s.startsAt))} · {statusLabels[s.operationalStatus]||s.operationalStatus}</p><p className="text-xs text-muted-foreground">{venueLabels[s.venue.kind]}{s.venue.name&&` · ${s.venue.name}`} {s.state==='RELEASED'&&'· Liberada para nueva programación'}</p></div><Button asChild variant="outline" size="sm"><Link to={s.kind==='BOOKING'?`/agenda/reservas/${s.bookingId}`:s.kind==='SESSION'?`/agenda/sesiones/${s.sessionId}`:`/agenda/actividades/${s.sessionId}`}>Ver programación</Link></Button></li>)}</ul>}<p className="mt-3 border-t pt-3 text-xs text-muted-foreground">Reprogramar o finalizar una atención no modifica el cobro de la contratación.</p></section>
}
