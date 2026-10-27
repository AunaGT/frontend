import type {ActivityDto} from '../types'
import {timelineSpanInstant} from '../operationalTimeline'
export function OperationalTimelineSummary({row}:{row:ActivityDto}){
 const t=row.operationalTimeline
 if(!t||!t.milestones.length&&!t.attendanceWindows.length)return null
 const when=(value:string)=>new Intl.DateTimeFormat('es-GT',{timeZone:row.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
 const assigned=[{kind:'USER',id:row.organizerId,name:row.organizer?.name||'Responsable interno'},...row.participants.map(p=>({...p,kind:'USER'})),...row.providers.map(p=>({...p,kind:'PROVIDER'})),...row.resources.map(p=>({...p,kind:'RESOURCE'}))]
 return <section className="mt-4 border-t pt-4 space-y-3" aria-label="Cronograma del evento"><h3 className="text-sm font-semibold">Cronograma del evento</h3>
  {!!t.milestones.length&&<ul className="divide-y text-sm">{t.milestones.map(m=><li key={m.id} className="py-2"><p className="font-medium">{m.name}</p><p className="text-muted-foreground">{when(timelineSpanInstant(m,'start',row))} – {when(timelineSpanInstant(m,'end',row))}</p></li>)}</ul>}
  <details><summary className="cursor-pointer py-1 text-sm font-medium">Reservas por persona y equipo</summary><ul className="mt-2 divide-y text-sm">{assigned.map(a=><li key={`${a.kind}:${a.id}`} className="py-2"><p className="font-medium">{a.name}</p>{(row.attendanceReservations||[]).filter(r=>r.kind===a.kind&&r.entityId===a.id).map((r,i)=><p key={i} className="text-muted-foreground">Se reserva de {when(r.from)} a {when(r.to)}.</p>)}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">Las asignaciones de una misma persona se suman. El responsable conserva el horario completo, incluso si también figura como profesional.</p></details>
 </section>
}
