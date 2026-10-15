import {useEffect,useRef} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {useAgendaContext} from '../useAgendaContext'
import {appointmentQueryKey,getAgenda} from '../api'
import {useAvailability} from '../hooks'
import {emptyDirectory} from '../useServiceScheduleDraft'
import {useCreationDraft,selectCreationService,serviceStyle,fixedServiceEnd,readableCreationTime,creationDuration,withCreationTimezone,type CreationDraft,type CreationResult} from '../creationDraft'
import {agendaRange,localDay} from '../viewModel'
import {AgendaPicker} from './AgendaPicker'
import {ActivityFields,ActivityDateTime} from './ActivityFields'
import {AssignmentChoices,schedulingLabels} from './ServiceScheduleFields'
import {AgendaVenueFields} from './AgendaVenueFields'
import {SlotPicker,slotKey} from './BookingFields'
import {FormFeedback} from './FormFeedback'
import {useDraftGuard} from './DraftGuard'
import type {AgendaService,Directory} from '../types'

export function AgendaCreateForm({initial,onClose,onSaved,compact=false,onCloseReady}:{initial?:Partial<CreationDraft>;onClose:()=>void;onSaved:(row:CreationResult,kind:'ACTIVITY'|'BOOKING'|'SESSION')=>void;compact?:boolean;onCloseReady?:(close:()=>void)=>void}){
  const ctx=useAgendaContext(),navigate=useNavigate()
  const draft=useCreationDraft({scope:ctx.scope,userId:ctx.user?.id||'',timezone:ctx.timezone,initial,onSaved:(row,kind)=>guard.proceed(()=>onSaved(row,kind))})
  const guard=useDraftGuard(draft.dirty),v=draft.value,a=v.activity,s=v.service,style=s?serviceStyle(s):null
  const allowed=ctx.writable&&ctx.hasPermission('appointments.create'),serviceMode=v.kind==='SERVICE',work=serviceMode&&style==='WORK'
  const directory=useQuery({queryKey:appointmentQueryKey(ctx.scope,'directory'),queryFn:({signal})=>getAgenda<Directory>('/directory',ctx.scope,signal),enabled:allowed})
  const d=directory.data||emptyDirectory
  const appliedZone=useRef('')
  useEffect(()=>{
    const marker=v.kind+':'+(d.timezone||'')
    if(appliedZone.current===marker)return
    appliedZone.current=marker
    if(v.kind==='SERVICE'&&d.timezone)draft.change(withCreationTimezone(v,d.timezone))
  },[v,d.timezone,draft])
  const changeActivity=(activity:CreationDraft['activity'])=>draft.change({...v,activity})
  const manual=!!s&&s.requiresProvider===false&&s.requiresResource===false&&!a.providerIds.length&&!a.resourceIds.length
  let date=localDay(new Date(),a.timezone),duration:number|undefined
  try{if(a.startsAt)date=/(Z|[+-]\d\d:\d\d)$/.test(a.startsAt)?localDay(a.startsAt,a.timezone):a.startsAt.slice(0,10)
    if(s?.durationPolicy==='EDITABLE'){const m=creationDuration(a);if(m&&m<=1440)duration=m}}catch{/* The form keeps partial date input until it is complete. */}
  let range=agendaRange(localDay(new Date(),a.timezone),'day',a.timezone)
  try{range=agendaRange(date,'day',a.timezone)}catch{/* Month/date inputs can be temporarily incomplete. */}
  const availability=useAvailability(ctx.scope,{productId:s?.id||'',...range,providerIds:a.providerIds,resourceIds:a.resourceIds,venue:a.venue,outboundMinutes:a.outboundMinutes,returnMinutes:a.returnMinutes,...(duration?{durationMinutes:duration}:{})},allowed&&serviceMode&&!!s&&!work&&!manual,style==='CLASS'?'/session-availability':'/availability')
  useEffect(()=>{onCloseReady?.(()=>{if(!draft.pending)guard.request(onClose)})})
  const proposed=fixedServiceEnd(v),fixed=serviceMode&&!!s&&s.durationPolicy!=='EDITABLE'
  const incompatible=!!s&&(!!s.allowedVenueKinds&&!s.allowedVenueKinds.includes(a.venue.kind)||a.providerIds.some(id=>s.providerIds&&!s.providerIds.includes(id))||a.resourceIds.some(id=>s.resourceIds&&!s.resourceIds.includes(id)))
  const ready=allowed&&(!serviceMode||directory.isSuccess&&!!s&&ctx.canUseCatalog&&!incompatible&&(style!=='APPOINTMENT'||ctx.canUseContacts&&!!v.contactId))
  if(!allowed)return <p>Selecciona una sucursal con permiso para agendar.</p>
  return <form className="agenda-editor-grid" aria-busy={draft.pending} onSubmit={e=>{e.preventDefault();if(ready)void draft.save()}}>{guard.dialog}<section className="agenda-panel space-y-4">
    <fieldset disabled={draft.pending}><legend className="mb-2 text-sm font-medium">¿Qué quieres agendar?</legend><div className="flex flex-wrap gap-2">{ctx.canUseCatalog&&<Button type="button" variant={serviceMode?'default':'outline'} aria-pressed={serviceMode} onClick={()=>draft.change({...v,kind:'SERVICE'})}>Servicio del catálogo</Button>}<Button type="button" variant={!serviceMode?'default':'outline'} aria-pressed={!serviceMode} onClick={()=>draft.change({...v,kind:'ACTIVITY'})}>Reunión u otra actividad</Button></div></fieldset>
    <FormFeedback error={draft.error||(directory.isError?'No se pudo cargar el personal y equipo.':null)} fields={draft.fields}/>
    {serviceMode&&<div className="space-y-2"><Label htmlFor="agenda-productId">Servicio *</Label><AgendaPicker<AgendaService> scope={ctx.scope} kind="services" label={s?.name||'Selecciona un servicio'} canConfigure={ctx.hasPermission('appointments.configure')} disabled={draft.pending||!ctx.canUseCatalog} onSelect={row=>draft.change(selectCreationService(v,row))}/>{s&&<p className="text-sm text-muted-foreground">{schedulingLabels[style!]} · {s.durationMinutes} min {s.durationPolicy==='EDITABLE'?'sugeridos; puedes ajustar el fin':'de duración fija'}{work?' · Un trabajo completo, sin inscripciones.':''}</p>}
      {style==='APPOINTMENT'&&<div><Label htmlFor="agenda-contactId">Cliente *</Label>{ctx.canUseContacts?<AgendaPicker scope={ctx.scope} kind="contacts" label={v.contactName||'Selecciona el cliente'} disabled={draft.pending} onSelect={c=>draft.change({...v,contactId:c.id,contactName:c.name})}/>:<p role="alert">Esta atención necesita Contactos habilitado y permiso para consultar clientes. Puedes agendar una reunión o actividad sin cliente.</p>}</div>}
      {style==='APPOINTMENT'&&<div className="max-w-sm"><Label htmlFor="agenda-quantity">Cantidad ({s?.unit})</Label><Input id="agenda-quantity" type="text" inputMode="decimal" value={v.quantity} disabled={draft.pending} onChange={e=>draft.change({...v,quantity:e.target.value})}/><p className="mt-1 text-xs text-muted-foreground">La duración no cambia la cantidad ni crea un cobro.</p></div>}
      {style==='CLASS'&&<div className="max-w-sm"><Label htmlFor="agenda-capacity">Cupos de esta sesión</Label><Input id="agenda-capacity" type="number" min={1} max={s?.capacity} value={v.capacity} disabled={draft.pending} onChange={e=>draft.change({...v,capacity:Number(e.target.value)})}/><p className="mt-1 text-xs text-muted-foreground">Las personas se inscriben desde el detalle de la sesión.</p></div>}
    </div>}
    {(!serviceMode||work)?<ActivityFields scope={ctx.scope} value={a} onChange={changeActivity} pending={draft.pending} errors={draft.fields} directory={work&&s?{...d,providers:d.providers.filter(p=>s.providerIds?.includes(p.id)||a.providerIds.includes(p.id)),resources:d.resources.filter(r=>s.resourceIds?.includes(r.id)||a.resourceIds.includes(r.id))}:d} organizerName={ctx.user?.name} policy={work&&s?{...s,durationMinutes:s.durationMinutes||undefined}:undefined} capabilities={{catalog:false,contacts:!!ctx.canUseContacts,notes:ctx.hasPermission('appointments.attend')||ctx.hasPermission('appointments.configure')}}/>:
      <fieldset disabled={draft.pending} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><ActivityDateTime id="creation-start" label="Inicio *" value={a.startsAt} zone={a.timezone} disabled={draft.pending} onChange={startsAt=>changeActivity({...a,startsAt})}/><ActivityDateTime id="creation-end" label="Fin *" value={a.endsAt} zone={a.timezone} disabled={draft.pending||fixed} onChange={endsAt=>changeActivity({...a,endsAt})}/></div><AgendaVenueFields value={a} onChange={next=>changeActivity({...a,...next,venue:next.venue||a.venue})} disabled={draft.pending}/>
        <details><summary className="cursor-pointer text-sm font-medium">Profesionales y equipo {s?.requiresProvider||s?.requiresResource?'requeridos':'opcionales'}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><AssignmentChoices label="Profesionales" items={d.providers.filter(p=>p.active&&(s?.providerIds?.includes(p.id)||a.providerIds.includes(p.id)))} value={a.providerIds} onChange={providerIds=>changeActivity({...a,providerIds})} disabled={draft.pending}/><AssignmentChoices label="Salas y equipos" items={d.resources.filter(r=>a.resourceIds.includes(r.id)||r.active&&!!s?.resourceIds?.includes(r.id)&&(a.venue.kind==='BRANCH'||r.type==='EQUIPMENT'&&r.portable))} value={a.resourceIds} onChange={resourceIds=>changeActivity({...a,resourceIds})} disabled={draft.pending}/></div><p className="mt-2 text-xs text-muted-foreground">Si un requisito está marcado y no eliges una asignación, se propone una disponible. Las elegidas también se validan.</p></details>
        {manual?<p className="text-sm text-muted-foreground">Indica el horario manualmente. Este servicio no requiere personal ni equipo; no se afirma disponibilidad de personas.</p>:s&&<details><summary className="cursor-pointer text-sm font-medium">Consultar horarios disponibles</summary><div className="mt-3"><Button type="button" variant="ghost" disabled={draft.pending||availability.isFetching} onClick={()=>void availability.refetch()}>Actualizar horarios</Button>{availability.isError?<p role="alert">No se pudo consultar la disponibilidad. Reintenta.</p>:<SlotPicker slots={availability.data||[]} value={slotKey(a)} onSelect={slot=>changeActivity({...a,startsAt:slot.startsAt,endsAt:slot.endsAt,timezone:slot.timezone,providerIds:slot.providerIds,resourceIds:slot.resourceIds})} pending={draft.pending}/>}</div></details>}
        {(ctx.hasPermission('appointments.attend')||ctx.hasPermission('appointments.configure'))&&<details><summary className="cursor-pointer text-sm font-medium">Observaciones internas</summary><Label htmlFor="creation-notes" className="sr-only">Observaciones</Label><Textarea id="creation-notes" rows={2} maxLength={2000} value={a.notes} onChange={e=>changeActivity({...a,notes:e.target.value})}/></details>}
      </fieldset>}
    {fixed&&proposed&&<div className="border-y py-3 text-sm" role="status">Fin según duración fija: {readableCreationTime(proposed,a.timezone)}.<Button type="button" variant="ghost" size="sm" disabled={draft.pending} onClick={()=>changeActivity({...a,endsAt:proposed})}>Usar este fin</Button></div>}
    {incompatible&&<p role="alert" className="text-sm text-destructive">El lugar o alguna asignación no es compatible con el servicio seleccionado. Revísalos; tus datos no se han borrado.</p>}
    <div className="agenda-actions">{compact&&<Button type="button" variant="ghost" disabled={draft.pending} onClick={()=>guard.proceed(()=>navigate('/agenda/nueva',{state:{creationDraft:draft.handoff()}}))}>Abrir formulario completo</Button>}<Button type="button" variant="outline" disabled={draft.pending} onClick={()=>guard.request(onClose)}>Cancelar</Button><Button type="submit" disabled={draft.pending||!ready}>{draft.pending?'Guardando…':'Agendar'}</Button></div>
  </section><aside className="agenda-panel agenda-editor-summary space-y-4"><h2>Resumen</h2><p className="font-medium">{serviceMode?s?.name||'Selecciona un servicio':a.title||'Nueva actividad'}</p><div className="space-y-1 text-sm"><p>{v.contactName||(!serviceMode?'Reunión o actividad libre':'Cliente según el tipo de atención')}</p><p>{a.startsAt?readableCreationTime(a.startsAt,a.timezone):'Inicio por definir'}</p><p>{a.endsAt?readableCreationTime(a.endsAt,a.timezone):'Fin por definir'}</p><p className="text-xs text-muted-foreground">{a.timezone}</p></div><p className="border-t pt-3 text-xs text-muted-foreground">Agendar no registra un pago ni genera una venta. Se comprobarán las reglas y disponibilidad al guardar.</p></aside></form>
}
