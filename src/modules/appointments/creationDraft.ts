import {useRef,useState} from 'react'
import {useAgendaMutation} from './hooks'
import {activityPayload,newActivity,localDateTime,type ActivityDraft} from './activityDraft'
import {localInstant} from './viewModel'
import type {AgendaService,AgendaScope,ActivityDto,BookingDto,SessionDto} from './types'
export type CreationDraft={kind:'SERVICE'|'ACTIVITY';activity:ActivityDraft;productId:string;contactId:string;contactName:string;quantity:string;capacity:number;service?:AgendaService|null}
export type CreationHandoff={scope:AgendaScope;value:CreationDraft}
export type CreationResult=ActivityDto|BookingDto|SessionDto
export function creationDestination(kind:'ACTIVITY'|'BOOKING'|'SESSION',id:string){return `/agenda/${kind==='ACTIVITY'?'actividades':kind==='SESSION'?'sesiones':'reservas'}/${id}`}
export function editDestination(kind:'ACTIVITY'|'BOOKING'|'SESSION',id:string,proposed?:{startsAt:string;endsAt?:string}){
  return {pathname:creationDestination(kind,id)+'/editar',state:{proposed}}
}
export function serviceStyle(service:AgendaService){return service.schedulingStyle||(service.mode==='GROUP'?'CLASS':'APPOINTMENT')}
export function selectCreationService(value:CreationDraft,service:AgendaService):CreationDraft{
  return {...value,kind:'SERVICE',service,productId:service.id,capacity:service.capacity||1,activity:{...value.activity,
    title:value.activity.title||service.name,completionPolicy:service.completionPolicy||'MANUAL',setupMinutes:service.beforeMinutes||0,teardownMinutes:service.afterMinutes||0}}
}
function instant(value:string,zone:string){return /(Z|[+-]\d\d:\d\d)$/.test(value)?new Date(value).toISOString():localInstant(value,zone)}
export function withCreationTimezone(value:CreationDraft,timezone:string):CreationDraft{
  if(value.activity.timezone===timezone)return value
  const normalize=(at:string)=>{
    if(!at)return at
    try{return instant(at,value.activity.timezone)}catch{return at}
  }
  return {...value,activity:{...value.activity,startsAt:normalize(value.activity.startsAt),endsAt:normalize(value.activity.endsAt),timezone}}
}
export function creationDuration(activity:ActivityDraft){
  if(!activity.startsAt||!activity.endsAt)return null
  try{
    const minutes=(new Date(instant(activity.endsAt,activity.timezone)).getTime()-new Date(instant(activity.startsAt,activity.timezone)).getTime())/60000
    return Number.isInteger(minutes)&&minutes>0?minutes:null
  }catch{return null}
}
export function creationCommand(draft:CreationDraft,service:AgendaService|null|undefined){
  if(draft.kind==='ACTIVITY')return {path:'/activities',body:activityPayload({...draft.activity,productId:null,serviceScheduling:undefined}),destinationKind:'ACTIVITY' as const}
  if(!service)throw Error('Selecciona un servicio disponible para agendar.')
  const a=draft.activity,startsAt=instant(a.startsAt,a.timezone)
  const endsAt=a.endsAt?instant(a.endsAt,a.timezone):new Date(new Date(startsAt).getTime()+(service.durationMinutes||0)*60000).toISOString()
  const minutes=(new Date(endsAt).getTime()-new Date(startsAt).getTime())/60000
  if(!Number.isInteger(minutes)||minutes<=0)throw Error('Selecciona un fin posterior al inicio.')
  if(service.durationPolicy!=='EDITABLE'&&minutes!==service.durationMinutes)throw Error(`La duración es fija: ${service.durationMinutes} minutos. Confirma el fin propuesto.`)
  const style=serviceStyle(service)
  if(minutes>(style==='WORK'?44640:1440))throw Error('El intervalo supera el límite del servicio.')
  if(service.allowedVenueKinds&&!service.allowedVenueKinds.includes(a.venue.kind))throw Error('El servicio no admite ese lugar de atención.')
  if(style==='WORK')return {path:'/activities',body:{...activityPayload({...a,startsAt,endsAt,productId:service.id}),serviceScheduling:'CONFIGURED' as const},destinationKind:'ACTIVITY' as const}
  const base={productId:service.id,startsAt,endsAt,timezone:a.timezone,providerIds:a.providerIds,resourceIds:a.resourceIds,
    venue:a.venue,outboundMinutes:a.outboundMinutes,returnMinutes:a.returnMinutes,notes:a.notes}
  if(style==='CLASS')return {path:'/sessions',body:{...base,capacity:draft.capacity},destinationKind:'SESSION' as const}
  if(!draft.contactId)throw Error('Selecciona el cliente de esta atención.')
  return {path:'/bookings',body:{...base,contactId:draft.contactId,quantity:draft.quantity},destinationKind:'BOOKING' as const}
}
export function useCreationDraft({scope,userId,timezone,initial,onSaved}:{scope:AgendaScope;userId:string;timezone:string;initial?:Partial<CreationDraft>;onSaved:(row:CreationResult,kind:'ACTIVITY'|'BOOKING'|'SESSION')=>void}){
  const key=`${scope.companyId}:${scope.branchId}`,seed=useRef({key,value:{kind:'ACTIVITY',productId:'',contactId:'',contactName:'',quantity:'1',capacity:1,...initial,
    activity:newActivity(userId,timezone,initial?.activity)} as CreationDraft})
  if(seed.current.key!==key)seed.current={key,value:{kind:'ACTIVITY',productId:'',contactId:'',contactName:'',quantity:'1',capacity:1,activity:newActivity(userId,timezone)}}
  const [state,setState]=useState(seed.current),[error,setError]=useState<string|null>(null),attempt=useRef<{key:string;hash:string;id:string}|null>(null)
  const mutation=useAgendaMutation(scope),value=state.key===key?state.value:seed.current.value
  const change=(next:CreationDraft)=>{setState({key,value:next});setError(null)}
  const save=async()=>{
    if(mutation.pending)return
    try{
      const command=creationCommand(value,value.service),hash=JSON.stringify(command.body)
      if(attempt.current?.key!==key||attempt.current.hash!==hash)attempt.current={key,hash,id:crypto.randomUUID()}
      const row=await mutation.submit<CreationResult>(command.path,{...command.body,idempotencyKey:attempt.current.id})
      if(row)onSaved(row,command.destinationKind)
    }catch(e){setError(e instanceof Error?e.message:'Revisa los datos antes de guardar.')}
  }
  return {value,change,save,pending:mutation.pending,error:error||mutation.error,fields:mutation.fields,
    dirty:JSON.stringify(value)!==JSON.stringify(seed.current.value)||!!value.activity.title||!!value.productId,
    handoff:():CreationHandoff=>({scope:{...scope},value})}
}
export function fixedServiceEnd(value:CreationDraft){
  if(!value.service?.durationMinutes||!value.activity.startsAt)return null
  try{return new Date(new Date(instant(value.activity.startsAt,value.activity.timezone)).getTime()+value.service.durationMinutes*60000).toISOString()}catch{return null}
}
export function readableCreationTime(value:string,timezone:string){return localDateTime(value,timezone).replace('T',' ')}
