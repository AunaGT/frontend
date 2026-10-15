import {useRef,useState} from 'react'
import {useAgendaMutation} from './hooks'
import {localInstant} from './viewModel'
import type {ActivityInput,ActivityDto,AgendaScope} from './types'
export type ActivityDraft=Omit<ActivityInput,'idempotencyKey'> & {userNames?:Record<string,string>}
export type ActivityHandoff={scope:AgendaScope;value:ActivityDraft}
export function activityFromDto(row:ActivityDto):ActivityDraft {
  const keys=Object.keys(newActivity(row.organizerId,row.timezone)) as (keyof ActivityDraft)[]
  return Object.fromEntries(keys.map(key=>[key,key==='userNames'?Object.fromEntries((row.participants||[]).map(p=>[p.id,p.name])):key==='notes'?row.notes||'':row[key]])) as ActivityDraft
}
export function newActivity(userId:string,timezone:string,initial?:Partial<ActivityDraft>):ActivityDraft {
  return {completionPolicy:'MANUAL',purpose:'MEETING',title:'',startsAt:'',endsAt:'',timezone,organizerId:userId,userIds:[],providerIds:[],resourceIds:[],guests:[],
    productId:null,serviceScheduling:undefined,venue:{kind:'BRANCH'},estimatedAttendance:null,outboundMinutes:0,setupMinutes:0,teardownMinutes:0,returnMinutes:0,notes:'',userNames:{},...initial}
}
export function localDateTime(value:string,zone:string) {
  if(!value||!/(Z|[+-]\d\d:\d\d)$/.test(value))return value
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
export function activityPayload(value:ActivityDraft):ActivityDraft {
  const at=(value:string)=>/(Z|[+-]\d\d:\d\d)$/.test(value)?new Date(value).toISOString():localInstant(value,valueTimezone)
  const valueTimezone=value.timezone,startsAt=at(value.startsAt),endsAt=at(value.endsAt)
  if(!value.title.trim())throw Error('Escribe un título para la actividad.')
  if(!value.organizerId)throw Error('Selecciona un responsable.')
  if(new Date(endsAt)<=new Date(startsAt))throw Error('El fin debe ser posterior al inicio.')
  const {userNames,...payload}=value
  return {...payload,startsAt,endsAt}
}
export function useActivityDraft({scope,userId,timezone,initial,row,onSaved}: {scope:AgendaScope;userId:string;timezone:string;initial?:Partial<ActivityDraft>;row?:ActivityDto;onSaved:(row:ActivityDto)=>void}) {
  const key=`${scope.companyId}:${scope.branchId}:${row?.id||'new'}`,seed=useRef({key,value:newActivity(userId,timezone,initial)})
  if(seed.current.key!==key)seed.current={key,value:newActivity(userId,timezone)}
  const [state,setState]=useState(seed.current),[reason,setReason]=useState(''),[localError,setLocalError]=useState<string|null>(null)
  const mutation=useAgendaMutation(scope),attempt=useRef<{key:string;hash:string;requestKey:string}|null>(null)
  const value=state.key===key?state.value:seed.current.value
  const change=(value:ActivityDraft)=>{setState({key,value});setLocalError(null)}
  const save=async()=>{
    if(mutation.pending)return
    let payload:ActivityDraft
    try{payload=activityPayload(value);if(row&&!reason.trim())throw Error('Indica el motivo del cambio.')}catch(e){setLocalError(e instanceof Error?e.message:'Revisa los campos.');return}
    const body={...payload,...(row?{expectedVersion:row.version,reason}:{})},hash=JSON.stringify(body)
    if(attempt.current?.key!==key||attempt.current.hash!==hash)attempt.current={key,hash,requestKey:crypto.randomUUID()}
    const result=await mutation.submit<ActivityDto>(row?`/activities/${row.id}`:'/activities',{...body,idempotencyKey:attempt.current.requestKey},row?'PUT':'POST')
    if(result)onSaved(result)
  }
  return {value,change,save,reason,setReason,pending:mutation.pending,error:localError||mutation.error,fields:mutation.fields,
    dirty:JSON.stringify(value)!==JSON.stringify(seed.current.value)||!!reason||(!row&&!!value.title.trim()),
    handoff:():ActivityHandoff=>({scope:{...scope},value})}
}
