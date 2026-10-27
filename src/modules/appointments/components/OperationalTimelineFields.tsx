import {useEffect,useRef,useState} from 'react'
import {Plus,Trash2,Clock3} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Checkbox} from '@/components/ui/checkbox'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {ActivityDateTime} from './ActivityDateTime'
import {emptyTimeline,timelineInstant,timelineSpanInstant,updateTimelineSpan,spanError,type TimelineSession} from '../operationalTimeline'
import type {AssignmentRequirement,AttendanceWindow,Directory,OperationalTimeline,TimelineSpan} from '../types'
type Named={id:string;name:string}
type Props={value?:OperationalTimeline;onChange:(value:OperationalTimeline)=>void;session:TimelineSession;directory:Directory;disabled:boolean;errors?:Record<string,string>;requirements?:AssignmentRequirement[];participants?:Named[];assigned?:{providers:Named[];resources:Named[]}}
const margins=[['outboundMinutes','Ida (min)'],['setupMinutes','Preparación (min)'],['teardownMinutes','Cierre (min)'],['returnMinutes','Regreso (min)']] as const
export function OperationalTimelineFields({value=emptyTimeline(),onChange,session,directory,disabled,errors={},requirements=[],participants=[],assigned}:Props){
 const [focusId,setFocusId]=useState<string|null>(null),root=useRef<HTMLDivElement>(null)
 useEffect(()=>{if(focusId){root.current?.querySelector<HTMLInputElement>(`[id="moment-${focusId}-name"]`)?.focus();setFocusId(null)}},[focusId,value.milestones.length])
 const messages=Object.entries(errors).filter(([key])=>key.startsWith('operationalTimeline'))
 const hasValue=value.milestones.length+value.attendanceWindows.length+value.requirementWindows.length>0
 let duration=0;try{duration=(Date.parse(timelineInstant(session.endsAt,session.timezone))-Date.parse(timelineInstant(session.startsAt,session.timezone)))/60000}catch{/* Dates are completed in the parent form. */}
 const validInterval=Number.isInteger(duration)&&duration>0
 const locked=disabled||directory.operationalTimelineEnabled!==true
 const people=[...new Set(session.userIds||[])].filter(id=>id!==session.organizerId).map(id=>({kind:'USER' as const,id,name:participants.find(p=>p.id===id)?.name||'Persona asignada'}))
 const items=[...people,...(session.providerIds||[]).map(id=>({kind:'PROVIDER' as const,id,name:[...directory.providers,...assigned?.providers||[]].find(p=>p.id===id)?.name||'Profesional asignado'})),...(session.resourceIds||[]).map(id=>({kind:'RESOURCE' as const,id,name:[...directory.resources,...assigned?.resources||[]].find(r=>r.id===id)?.name||'Equipo asignado'}))]
 const orphan=value.attendanceWindows.filter(w=>!items.some(i=>i.kind===w.kind&&i.id===w.entityId))
 const staleRequirements=value.requirementWindows.filter(w=>!requirements.some(r=>r.id===w.requirementId&&r.attendanceMode==='INTERVENTION'))
 const changeWindow=(kind:AttendanceWindow['kind'],id:string,patch:Partial<AttendanceWindow>)=>onChange({...value,attendanceWindows:value.attendanceWindows.map(w=>w.kind===kind&&w.entityId===id?{...w,...patch}:w)})
 const dateFields=(span:TimelineSpan,id:string,change:(next:TimelineSpan)=>void,startLabel='Inicio',endLabel='Fin')=>{
  let message:string|null=null;try{message=spanError(span,session)}catch{message='Completa primero el inicio y fin del evento.'}
  return <><div className="grid gap-3 lg:grid-cols-2"><ActivityDateTime id={`${id}-start`} label={startLabel} value={timelineSpanInstant(span,'start',session)} zone={session.timezone} disabled={locked||!validInterval} onChange={next=>change(updateTimelineSpan(span,'start',next,session))}/><ActivityDateTime id={`${id}-end`} label={endLabel} value={timelineSpanInstant(span,'end',session)} zone={session.timezone} disabled={locked||!validInterval} onChange={next=>change(updateTimelineSpan(span,'end',next,session))}/></div>{message&&<p role="alert" className="text-sm text-destructive">{message}</p>}</>
 }
 const reserved=(span:AttendanceWindow)=>{
  try{if(spanError(span,session))return null
   const start=Date.parse(timelineSpanInstant(span,'start',session))-(span.outboundMinutes+span.setupMinutes)*60000,end=Date.parse(timelineSpanInstant(span,'end',session))+(span.teardownMinutes+span.returnMinutes)*60000
   const format=(n:number)=>new Intl.DateTimeFormat('es-GT',{timeZone:session.timezone,dateStyle:'medium',timeStyle:'short'}).format(n)
   return `Se reserva de ${format(start)} a ${format(end)}.`
  }catch{return null}
 }
 return <div ref={root} className="min-w-0 space-y-3">
  {directory.operationalTimelineEnabled!==true&&<p role="status" className="text-xs text-muted-foreground">Los momentos y horarios propios estarán disponibles cuando el administrador termine la actualización de Agenda. Puedes seguir usando el horario completo.</p>}
  <details className="rounded-lg border p-3" open={value.milestones.length>0||requirements.some(r=>r.attendanceMode==='INTERVENTION')||messages.length>0}><summary className="cursor-pointer py-1 font-medium text-sm">Momentos del evento{value.milestones.length?` · ${value.milestones.length}`:' · opcional'}</summary><div className="mt-3 space-y-3"><p className="text-xs text-muted-foreground">Divide el evento en momentos, como bienvenida, atención o show. No crean otra reserva ni cobran por separado.</p>
   {!validInterval&&<p className="text-sm text-muted-foreground">Completa primero el inicio y fin del evento.</p>}
   {value.milestones.map((m,index)=><fieldset disabled={locked} key={m.id} className="min-w-0 rounded-md border p-3 space-y-3"><legend className="px-1 text-xs text-muted-foreground">Momento {index+1}</legend><div className="flex items-end gap-2"><div className="min-w-0 flex-1 max-w-lg"><Label htmlFor={`moment-${m.id}-name`}>Nombre del momento *</Label><Input id={`moment-${m.id}-name`} value={m.name} maxLength={150} placeholder="Ej. Bienvenida" onChange={e=>onChange({...value,milestones:value.milestones.map(item=>item.id===m.id?{...m,name:e.target.value}:item)})}/></div><Button type="button" variant="ghost" size="icon" disabled={locked} aria-label={`Quitar momento ${m.name||index+1}`} onClick={()=>onChange({...value,milestones:value.milestones.filter(item=>item.id!==m.id)})}><Trash2 className="h-4 w-4" aria-hidden/></Button></div>
    {dateFields(m,`moment-${m.id}`,next=>onChange({...value,milestones:value.milestones.map(item=>item.id===m.id?{...m,...next}:item)}))}
   </fieldset>)}
   <Button type="button" size="sm" variant="outline" disabled={locked||!validInterval||value.milestones.length>=32} onClick={()=>{const id=crypto.randomUUID();onChange({...value,milestones:[...value.milestones,{id,name:'',startOffsetMinutes:0,endOffsetMinutes:duration}]});setFocusId(id)}}><Plus className="mr-2 h-4 w-4" aria-hidden/>Agregar momento</Button>
   {requirements.filter(r=>r.attendanceMode==='INTERVENTION').map(r=>{
  const selected=value.requirementWindows.find(w=>w.requirementId===r.id)?.milestoneId,missing=selected&&!value.milestones.some(m=>m.id===selected)
    return <div key={r.id} className="max-w-lg"><Label id={`moment-requirement-${r.id}`}>¿En qué momento se necesita {r.name}?</Label><Select value={missing?'':selected||''} disabled={locked} onValueChange={milestoneId=>onChange({...value,requirementWindows:[...value.requirementWindows.filter(w=>w.requirementId!==r.id),{requirementId:r.id,milestoneId}]})}><SelectTrigger aria-labelledby={`moment-requirement-${r.id}`}><SelectValue placeholder="Selecciona un momento"/></SelectTrigger><SelectContent>{value.milestones.map((m,index)=><SelectItem key={m.id} value={m.id}>{m.name||`Momento ${index+1}`}</SelectItem>)}</SelectContent></Select>{(!selected||missing)&&<p className="mt-1 text-sm text-destructive">Relaciona este requisito con un momento del evento.</p>}<p className="mt-1 text-xs text-muted-foreground">{r.quantity===1?'La asignación debe cubrir este momento completo.':`Las ${r.quantity} asignaciones deben cubrir este momento completo.`}</p></div>
   })}
   {!!staleRequirements.length&&<div role="alert" className="text-sm text-destructive"><p>Hay relaciones con requisitos que ya no corresponden a este servicio.</p><Button type="button" variant="outline" size="sm" disabled={locked} onClick={()=>onChange({...value,requirementWindows:value.requirementWindows.filter(w=>!staleRequirements.includes(w))})}>Quitar relaciones anteriores</Button></div>}
  </div></details>
  <details className="rounded-lg border p-3" open={value.attendanceWindows.length>0}><summary className="cursor-pointer py-1 text-sm font-medium">Horarios del personal y equipo{value.attendanceWindows.length?` · ${value.attendanceWindows.length} propios`:''}</summary><div className="mt-3 space-y-3"><p className="text-xs text-muted-foreground">Por defecto, todos quedan reservados durante el evento, el traslado y la preparación. El responsable interno siempre permanece durante todo el evento. Los invitados no reservan disponibilidad.</p>
   {!items.length&&<p className="text-sm text-muted-foreground">Agrega personal o equipo en las asignaciones para revisar sus horarios.</p>}
   {items.map(item=>{const w=value.attendanceWindows.find(w=>w.kind===item.kind&&w.entityId===item.id),requiredFull=requirements.some(r=>r.kind===item.kind&&r.optionIds.includes(item.id)&&r.attendanceMode!=='INTERVENTION')
    return <fieldset disabled={locked} key={`${item.kind}:${item.id}`} className="min-w-0 rounded-md border p-3 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words text-sm font-medium">{item.name}</p><Select aria-label={`Horario de ${item.name}`} value={w?'CUSTOM':'FULL'} disabled={locked||!validInterval} onValueChange={mode=>{
     const rest=value.attendanceWindows.filter(w=>w.kind!==item.kind||w.entityId!==item.id)
     onChange({...value,attendanceWindows:mode==='FULL'?rest:[...rest,{kind:item.kind,entityId:item.id,startOffsetMinutes:0,endOffsetMinutes:duration,outboundMinutes:session.outboundMinutes||0,setupMinutes:session.setupMinutes||0,teardownMinutes:session.teardownMinutes||0,returnMinutes:session.returnMinutes||0,marginsReviewed:false}]})
    }}><SelectTrigger className="w-full sm:w-44" aria-label={`Horario de ${item.name}`}><SelectValue>{w?'Horario propio':'Todo el evento'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="FULL">Todo el evento</SelectItem><SelectItem value="CUSTOM" disabled={value.attendanceWindows.length>=100}>Horario propio</SelectItem></SelectContent></Select></div>
    {requiredFull&&<p className="text-xs text-muted-foreground">Este servicio exige cobertura durante todo el evento. Un horario corto no cubre ese requisito; asigna otra persona o equipo completo si corresponde.</p>}
    {w&&<>{dateFields(w,`presence-${item.kind}-${item.id}`,next=>changeWindow(item.kind,item.id,next),'Llegada','Salida')}<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{margins.map(([key,label])=><div key={key}><Label htmlFor={`presence-${item.id}-${key}`}>{label}</Label><Input id={`presence-${item.id}-${key}`} type="number" min={0} max={1440} value={Number.isFinite(w[key])?w[key]:''} onChange={e=>changeWindow(item.kind,item.id,{[key]:e.target.value===''?NaN:Number(e.target.value),marginsReviewed:false})}/></div>)}</div><label className="flex items-start gap-2 text-sm"><Checkbox disabled={locked} checked={w.marginsReviewed!==false} onCheckedChange={checked=>changeWindow(item.kind,item.id,{marginsReviewed:checked===true})}/>Revisé el traslado y la preparación de este horario</label><p className="text-xs text-muted-foreground">Se copiaron los tiempos generales como punto de partida. Revisa cada uno; no generan cargos.</p>{reserved(w)&&<p className="flex items-start gap-2 text-xs text-muted-foreground"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden/>{reserved(w)}</p>}</>}
   </fieldset>})}
   {orphan.map(w=><div key={`${w.kind}:${w.entityId}`} role="alert" className="text-sm text-destructive"><p>Hay un horario propio cuya persona o equipo ya no está asignado.</p><Button disabled={locked} type="button" size="sm" variant="outline" onClick={()=>onChange({...value,attendanceWindows:value.attendanceWindows.filter(item=>item!==w)})}>Quitar horario sin asignación</Button></div>)}
  </div></details>
  {hasValue&&<p className="text-xs text-muted-foreground">Zona horaria: {session.timezone}. Al mover el evento, los horarios completos se desplazan con él. Si lo acortas, revisa que todos queden dentro.</p>}
  {messages.map(([key,message])=><p key={key} role="alert" className="text-sm text-destructive">{message}</p>)}
 </div>
}
