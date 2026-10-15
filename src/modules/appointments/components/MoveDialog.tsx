import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDraftGuard } from './DraftGuard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LoadingIndicator } from '@/components/shared/LoadingState'
import { useAgendaMutation, useAvailability } from '../hooks'
import { agendaRange, localDay, localInstant, agendaTime } from '../viewModel'
import { AssignmentChoices } from './ServiceScheduleFields'
import { FormFeedback } from './FormFeedback'
import { SlotPicker, slotKey } from './BookingFields'
import type { AgendaScope, BookingDto, Directory, SessionDto, Slot } from '../types'
import { localDateTime } from '../activityDraft'
import { AgendaVenueFields } from './AgendaVenueFields'

export function MoveForm({ scope, row, kind, proposed, directory, onClose }: { scope: AgendaScope; row: BookingDto | SessionDto; kind: 'bookings' | 'sessions'; proposed?: string | null; directory: Directory; onClose: () => void }) {
  const [date, setDate] = useState(() => localDay(proposed && Number.isFinite(new Date(proposed).getTime()) ? proposed : row.startsAt, row.timezone))
  const [location,setLocation]=useState({venue:row.venue||{kind:'BRANCH' as const},outboundMinutes:row.outboundMinutes||0,returnMinutes:row.returnMinutes||0})
  const [providerIds, setProviders] = useState(row.providerIds), [resourceIds, setResources] = useState(row.resourceIds), [selection, setSelection] = useState<Slot | null>(null), [reason, setReason] = useState(''), [key, setKey] = useState(() => crypto.randomUUID()), [version] = useState(row.version)
  const policy=row.schedulingPolicy,editable=policy?.durationPolicy==='EDITABLE'
  const [clock,setClock]=useState(()=>localDateTime(proposed||row.startsAt,row.timezone).split('T')[1]?.slice(0,5)||'')
  const [duration,setDuration]=useState(()=>policy?.durationMinutes||(new Date(row.endsAt).getTime()-new Date(row.startsAt).getTime())/60000||45)
  const manual=policy?.requiresProvider===false&&policy?.requiresResource===false&&!providerIds.length&&!resourceIds.length
  const mutation = useAgendaMutation(scope), availability = useAvailability(scope, { productId: row.productId, ...agendaRange(date, 'day', row.timezone), providerIds, resourceIds,...location,...(editable?{durationMinutes:duration}:{}) }, !manual, `/${kind}/${row.id}/availability`)
  let manualSlot:Slot|null=null
  if(manual&&Number.isInteger(duration)&&duration>0&&duration<=1440)try{
    const startsAt=localInstant(date+'T'+clock,row.timezone)
    manualSlot={startsAt,endsAt:new Date(new Date(startsAt).getTime()+duration*60000).toISOString(),timezone:row.timezone,providerIds,resourceIds,sessionId:null,remaining:row.schedulingPolicy?.capacity||1}
  }catch{/* Incomplete or ambiguous local time is not confirmable. */}
  const selected = manual?manualSlot:selection || availability.data?.find(s => s.startsAt === proposed) || null
  const [dirty,setDirty]=useState(!!proposed),[confirm,setConfirm]=useState(false)
  const guard=useDraftGuard(dirty||mutation.pending)
  const change = () => {setDirty(true);setSelection(null);setKey(crypto.randomUUID())}
  const canSave=!!selected&&!!reason.trim()&&!mutation.pending&&(manual||!!availability.data?.some(s=>slotKey(s)===slotKey(selected)))
  const save=async()=>{
    if(!canSave||!selected)return
    setConfirm(false)
    if(await mutation.submit(`/${kind}/${row.id}/move`,{...location,startsAt:selected.startsAt,endsAt:selected.endsAt,timezone:selected.timezone,providerIds:selected.providerIds,resourceIds:selected.resourceIds,reason,expectedVersion:version,idempotencyKey:key}))guard.proceed(onClose)
  }
  return <form className="agenda-editor-grid" aria-busy={mutation.pending} onSubmit={e=>{e.preventDefault();if(canSave)setConfirm(true)}}>
    {guard.dialog}
    <section className="agenda-panel space-y-4"><h2>Horario y asignaciones</h2>
      <FormFeedback error={mutation.error||(availability.isError?'No se pudo consultar la disponibilidad. Reintenta para actualizarla.':null)} fields={mutation.fields}/>
      <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="move-date">Nueva fecha</Label><Input id="move-date" type="date" value={date} disabled={mutation.pending} onChange={e=>{if(e.target.value){setDate(e.target.value);change()}}}/></div>
        {manual&&<div><Label htmlFor="move-clock">Hora de inicio *</Label><Input id="move-clock" type="time" value={clock} disabled={mutation.pending} onChange={e=>{setClock(e.target.value);change()}}/></div>}
        {editable&&<div><Label htmlFor="move-duration">Duración (minutos)</Label><Input id="move-duration" type="number" min={1} max={1440} value={duration} disabled={mutation.pending} onChange={e=>{setDuration(Number(e.target.value));change()}}/></div>}
      </div>
      <AgendaVenueFields value={location} onChange={next=>{setLocation({venue:next.venue||{kind:'BRANCH'},outboundMinutes:next.outboundMinutes||0,returnMinutes:next.returnMinutes||0});change()}} disabled={mutation.pending}/>
      <div className="grid gap-3 sm:grid-cols-2"><AssignmentChoices label="Profesionales" items={directory.providers.filter(p=>p.active)} value={providerIds} onChange={v=>{setProviders(v);change()}} disabled={mutation.pending}/><AssignmentChoices label="Salas y equipos" items={directory.resources.filter(r=>r.active)} value={resourceIds} onChange={v=>{setResources(v);change()}} disabled={mutation.pending}/></div>
      {!manual&&<><Button type="button" variant="ghost" disabled={availability.isFetching||mutation.pending} onClick={()=>void availability.refetch()}>Actualizar horarios</Button>{availability.isLoading?<LoadingIndicator message="Buscando nuevo horario…"/>:<SlotPicker slots={availability.data||[]} value={selected?slotKey(selected):''} onSelect={s=>{setSelection(s);setDirty(true);setKey(crypto.randomUUID())}} pending={mutation.pending}/>}</>}
      <div><Label htmlFor="agenda-reason">Motivo de reprogramación *</Label><Textarea id="agenda-reason" required value={reason} maxLength={1000} disabled={mutation.pending} onChange={e=>{setReason(e.target.value);setDirty(true);setKey(crypto.randomUUID())}}/></div>
      <div className="agenda-actions"><Button type="button" variant="outline" disabled={mutation.pending} onClick={()=>guard.request(onClose)}>Cancelar</Button><Button type="submit" disabled={!canSave}>Revisar cambio</Button></div>
    </section>
    <aside className="agenda-panel agenda-editor-summary space-y-4"><h2>{row.serviceName}</h2><div><p className="text-xs text-muted-foreground">Horario actual</p><p className="text-sm">{localDateTime(row.startsAt,row.timezone).replace('T',' ')} – {agendaTime(row.endsAt,row.timezone)}</p></div>
      {selected&&<div role="status"><p className="text-xs text-muted-foreground">Nuevo horario</p><p className="text-sm">{localDateTime(selected.startsAt,row.timezone).replace('T',' ')} – {agendaTime(selected.endsAt,row.timezone)}</p></div>}
      {'commercial' in row&&row.commercial&&<div className="border-t pt-3 text-sm"><p>{row.commercial.quantity} {row.commercial.unit}</p><strong>{row.commercial.currencyCode} {row.commercial.total}</strong></div>}
      <p className="border-t pt-3 text-xs text-muted-foreground">Se conservan el servicio, precio y participantes. Preparación, traslados y disponibilidad se verificarán al guardar.</p>
    </aside>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} appearance="auna" title="Confirmar nuevo horario" description={selected?`Antes: ${localDateTime(row.startsAt,row.timezone).replace('T',' ')}. Nuevo: ${localDateTime(selected.startsAt,row.timezone).replace('T',' ')} – ${agendaTime(selected.endsAt,row.timezone)}. Motivo: ${reason}`:''} confirmText="Confirmar nuevo horario" cancelText="Seguir editando" loading={mutation.pending} onConfirm={save}/>
  </form>
}
