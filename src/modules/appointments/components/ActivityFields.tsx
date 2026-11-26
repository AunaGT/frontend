import {useState} from 'react'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {Button} from '@/components/ui/button'
import {AgendaVenueFields} from './AgendaVenueFields'
import {ActivityParticipants,ActivityUserPicker} from './ActivityParticipants'
import {AssignmentChoices} from './ServiceScheduleFields'
import {AssignmentRequirementsStatus} from './AssignmentRequirementsFields'
import {CompletionPolicyField} from './CompletionPolicyField'
export {CompletionPolicyField}
import {AgendaPicker} from './AgendaPicker'
import {ActivityDateTime} from './ActivityDateTime'
import {OperationalTimelineFields} from './OperationalTimelineFields'
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group'
export {ActivityDateTime} from './ActivityDateTime'
import {localDateTime,type ActivityDraft} from '../activityDraft'
import {localInstant} from '../viewModel'
import type {AgendaScope,Directory,AgendaService,ProfileInput,VenueKind} from '../types'
export const purposeLabels={MEETING:'Reunión',SERVICE_VISIT:'Servicio / visita',EVENT:'Evento / show'}
const meetingModes=[{id:'PRESENCIAL',title:'Presencial'},{id:'VIRTUAL',title:'Virtual'}]
export function ActivityFields({scope,value,onChange,pending,errors,directory,capabilities,organizerName,initialDate,assigned,policy}: {scope:AgendaScope;value:ActivityDraft;onChange:(v:ActivityDraft)=>void;pending:boolean;errors:Record<string,string>;directory:Directory;capabilities:{catalog:boolean;contacts:boolean;notes:boolean};organizerName?:string;initialDate?:string;policy?:Partial<ProfileInput>;assigned?:{providers:{id:string;name:string}[];resources:{id:string;name:string}[]}}) {
  const [personName,setPersonName]=useState(organizerName||''),[serviceName,setServiceName]=useState('')
  const virtualMeeting=value.purpose==='MEETING'&&value.venue.kind==='ONLINE'
  const meetingVenueKinds:VenueKind[]=['BRANCH','HOME','EVENT_VENUE']
  const set=<K extends keyof ActivityDraft>(key:K,next:ActivityDraft[K])=>{
    const updated={...value,[key]:next}
    if(key==='startsAt'&&policy?.durationPolicy==='FIXED'&&policy.durationMinutes)try{
      const start=localInstant(localDateTime(String(next),value.timezone),value.timezone)
      updated.endsAt=new Date(new Date(start).getTime()+policy.durationMinutes*60000).toISOString()
    }catch{/* Partial date/time remains in the draft, never becomes a saved interval. */}
    onChange(updated)
  }
  const selectMeetingMode=(mode:string)=>{
    const venue=value.venue||{kind:'BRANCH' as const}
    onChange({...value,venue:{...venue,kind:mode==='VIRTUAL'?'ONLINE':venue.kind==='ONLINE'?'BRANCH':venue.kind},...(mode==='VIRTUAL'?{outboundMinutes:0,returnMinutes:0}:{})})
  }
  const field=(key:'title'|'startsAt'|'endsAt',label:string,type='text')=><div><Label htmlFor={`activity-${key}`}>{label}</Label><Input id={`activity-${key}`} type={type} required value={key==='title'?value[key]:localDateTime(value[key],value.timezone)} maxLength={key==='title'?200:undefined} disabled={pending} onChange={e=>set(key,e.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`activity-error-${key}`:undefined}/>{errors[key]&&<p id={`activity-error-${key}`} className="mt-1 text-sm text-destructive">{errors[key]}</p>}</div>
  return <fieldset disabled={pending} className="agenda-activity-fields space-y-3"><AssignmentRequirementsStatus requirements={policy?.assignmentRequirements} providerIds={value.providerIds} resourceIds={value.resourceIds} directory={directory} session={value} timeline={value.operationalTimeline} venueKind={value.venue.kind} providerOptionIds={policy?.providerIds} resourceOptionIds={policy?.resourceIds}/><div className="agenda-activity-basics"><div><Label id="activity-purpose-label">Tipo de actividad</Label><Select value={value.purpose} onValueChange={v=>set('purpose',v as ActivityDraft['purpose'])} disabled={pending}><SelectTrigger aria-labelledby="activity-purpose-label"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(purposeLabels).map(([id,label])=><SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div>{field('title','Título *')}<div className="agenda-activity-organizer"><Label>Responsable interno *</Label><ActivityUserPicker scope={scope} label={personName||'Selecciona un responsable'} disabled={pending} onSelect={p=>{setPersonName(p.name);set('organizerId',p.id)}}/></div></div>
    <div className={value.purpose==='MEETING'?'agenda-activity-primary':'space-y-3'}>
    {value.purpose==='MEETING'&&<section className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <h3 className="text-sm font-semibold">¿Cómo será la reunión?</h3>
      <RadioGroup aria-label="Modalidad de la reunión" required value={virtualMeeting?'VIRTUAL':'PRESENCIAL'} onValueChange={selectMeetingMode} className="grid gap-2 sm:grid-cols-2">
        {meetingModes.map(option=><label key={option.id} htmlFor={`activity-meeting-${option.id}`} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-ring has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"><RadioGroupItem id={`activity-meeting-${option.id}`} value={option.id}/><span className="text-sm font-medium">{option.title}</span></label>)}
      </RadioGroup>
      <div className="border-t pt-3">
        <AgendaVenueFields value={value} onChange={next=>onChange({...value,...next,venue:next.venue||value.venue})} disabled={pending} allowedKinds={virtualMeeting?['ONLINE']:meetingVenueKinds} showTravel={false} idPrefix="activity-meeting"/>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">{virtualMeeting?'Preparación y cierre':'Traslados y preparación'} · opcional</summary><div className="mt-3 grid grid-cols-2 gap-3">{!virtualMeeting&&([['outboundMinutes','Traslado de ida (min)'],['returnMinutes','Regreso (min)']] as const).map(([key,label])=><div key={key}><Label htmlFor={`activity-${key}`}>{label}</Label><Input id={`activity-${key}`} type="number" min={0} max={1440} step={5} value={value[key]} disabled={pending} onChange={e=>set(key,Number(e.target.value))}/></div>)}{([['setupMinutes','Preparación (min)'],['teardownMinutes','Cierre (min)']] as const).map(([key,label])=><div key={key}><Label htmlFor={`activity-${key}`}>{label}</Label><Input id={`activity-${key}`} type="number" min={0} max={1440} step={5} value={value[key]} disabled={pending||!!policy} onChange={e=>set(key,Number(e.target.value))}/></div>)}</div></details>
      </div>
    </section>}
    <section className="space-y-3 rounded-xl border p-3"><h3 className="text-sm font-semibold">Día y horario</h3><div className="agenda-activity-dates"><ActivityDateTime id="activity-startsAt" label="Inicio *" value={value.startsAt} zone={value.timezone} date={initialDate} disabled={pending} onChange={v=>set('startsAt',v)}/><ActivityDateTime id="activity-endsAt" label="Fin *" value={value.endsAt} zone={value.timezone} date={initialDate} disabled={pending||policy?.durationPolicy==='FIXED'} onChange={v=>set('endsAt',v)}/></div><p className="text-xs text-muted-foreground">{value.timezone}{policy?.durationPolicy==='FIXED'?' · Duración fija del servicio.':''}</p></section>
    </div>
    {value.purpose==='EVENT'&&<div className="max-w-sm"><Label htmlFor="activity-estimated">Asistentes estimados (opcional)</Label><Input id="activity-estimated" type="number" min={1} max={1000000} value={value.estimatedAttendance??''} onChange={e=>set('estimatedAttendance',e.target.value?Number(e.target.value):null)}/><p className="mt-1 text-xs text-muted-foreground">Informativo. No genera inscripciones ni cobros.</p></div>}
    {value.purpose!=='MEETING'&&<details><summary className="cursor-pointer text-sm font-medium">Lugar, traslado y montaje</summary><div className="mt-3 space-y-3"><AgendaVenueFields value={value} onChange={next=>onChange({...value,...next,venue:next.venue||value.venue})} disabled={pending}/><div className="grid grid-cols-2 gap-3">{([['setupMinutes','Preparación / montaje (min)'],['teardownMinutes','Desmontaje / cierre (min)']] as const).map(([key,label])=><div key={key}><Label htmlFor={`activity-${key}`}>{label}</Label><Input id={`activity-${key}`} type="number" min={0} max={1440} step={5} value={value[key]} disabled={!!policy} onChange={e=>set(key,Number(e.target.value))}/></div>)}</div><p className="text-xs text-muted-foreground">La disponibilidad se bloquea desde el traslado de ida hasta terminar el regreso.{policy&&' Preparación y cierre conservan las reglas del servicio.'}</p></div></details>}
    <details open={!!policy?.assignmentRequirements?.length}><summary className="cursor-pointer text-sm font-medium">Personas, invitados y equipo</summary><div className="mt-3 space-y-4"><ActivityParticipants scope={scope} value={value} onChange={onChange} disabled={pending} canUseContacts={capabilities.contacts}/><div className="grid gap-3 sm:grid-cols-2"><AssignmentChoices label="Profesionales" items={[...directory.providers.filter(p=>p.active||value.providerIds.includes(p.id)),...(assigned?.providers||[]).filter(p=>value.providerIds.includes(p.id)&&!directory.providers.some(d=>d.id===p.id))]} value={value.providerIds} onChange={v=>set('providerIds',v)} disabled={pending}/><AssignmentChoices label="Salas y equipos" items={[...directory.resources.filter(r=>value.resourceIds.includes(r.id)||r.active&&(value.venue.kind==='BRANCH'||r.portable)).map(r=>({...r,name:r.name+(!r.active||value.venue.kind!=='BRANCH'&&!r.portable?' · no disponible aquí':'')})),...(assigned?.resources||[]).filter(r=>value.resourceIds.includes(r.id)&&!directory.resources.some(d=>d.id===r.id))]} value={value.resourceIds} onChange={v=>set('resourceIds',v)} disabled={pending}/></div></div></details>
    <OperationalTimelineFields value={value.operationalTimeline} onChange={operationalTimeline=>set('operationalTimeline',operationalTimeline)} session={value} directory={directory} disabled={pending} errors={errors} requirements={policy?.assignmentRequirements} participants={value.userIds.map(id=>({id,name:value.userNames?.[id]||'Persona asignada'}))} assigned={assigned}/>
    {capabilities.catalog&&<details><summary className="cursor-pointer text-sm font-medium">Vincular servicio del catálogo (opcional)</summary><div className="mt-3"><AgendaPicker<AgendaService> scope={scope} kind="services" label={serviceName|| (value.productId?'Servicio vinculado':'Sin servicio vinculado')} schedulableOnly={false} disabled={pending} onSelect={s=>{setServiceName(s.name);set('productId',s.id)}}/>{value.productId&&<Button type="button" variant="ghost" size="sm" onClick={()=>set('productId',null)}>Quitar vínculo</Button>}<p className="mt-1 text-xs text-muted-foreground">Es una referencia: no cambia el horario, no aplica sus reglas ni crea una venta.</p></div></details>}
    <details><summary className="cursor-pointer text-sm font-medium">Cierre del horario</summary><div className="mt-3"><CompletionPolicyField id="activity-completion" value={policy?.completionPolicy||value.completionPolicy||'MANUAL'} onChange={v=>set('completionPolicy',v)} disabled={pending||!!policy}/>{policy&&<p className="mt-2 text-xs text-muted-foreground">Esta programación conserva la política del servicio con la que fue creada.</p>}</div></details>
    {capabilities.notes&&<details><summary className="cursor-pointer text-sm font-medium">Observaciones internas</summary><Label htmlFor="activity-notes" className="sr-only">Observaciones</Label><Textarea id="activity-notes" rows={2} maxLength={2000} value={value.notes} onChange={e=>set('notes',e.target.value)}/></details>}
  </fieldset>
}
