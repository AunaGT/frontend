import {localInstant} from './viewModel'
import type {ActivityInput,AssignmentRequirement,Directory,OperationalTimeline,TimelineSpan} from './types'
export type TimelineSession=Pick<ActivityInput,'startsAt'|'endsAt'|'timezone'>&Partial<Pick<ActivityInput,'organizerId'|'userIds'|'providerIds'|'resourceIds'|'outboundMinutes'|'setupMinutes'|'teardownMinutes'|'returnMinutes'>>
export const emptyTimeline=():OperationalTimeline=>({schemaVersion:1,milestones:[],attendanceWindows:[],requirementWindows:[]})
export function timelineInstant(value:string,zone:string){return /(Z|[+-]\d\d:\d\d)$/.test(value)?new Date(value).toISOString():localInstant(value,zone)}
export function timelineSpanInstant(span:TimelineSpan,side:'start'|'end',session:TimelineSession){
 const draft=side==='start'?span.startInput:span.endInput
 if(draft!==undefined)return draft
 try{return new Date(Date.parse(timelineInstant(session.startsAt,session.timezone))+(side==='start'?span.startOffsetMinutes:span.endOffsetMinutes)*60000).toISOString()}catch{return ''}
}
export function updateTimelineSpan<T extends TimelineSpan>(span:T,side:'start'|'end',value:string,session:TimelineSession):T{
 const next={...span},draft=side==='start'?'startInput':'endInput',offset=side==='start'?'startOffsetMinutes':'endOffsetMinutes'
 try{const minutes=(Date.parse(timelineInstant(value,session.timezone))-Date.parse(timelineInstant(session.startsAt,session.timezone)))/60000
  if(!Number.isInteger(minutes))throw Error();next[offset]=minutes;delete next[draft]
 }catch{next[draft]=value}
 return next
}
export function spanError(span:TimelineSpan,session:TimelineSession){
 if(span.startInput!==undefined||span.endInput!==undefined)return 'Completa la fecha y hora de inicio y fin.'
 const duration=(Date.parse(timelineInstant(session.endsAt,session.timezone))-Date.parse(timelineInstant(session.startsAt,session.timezone)))/60000
 if(!Number.isFinite(duration)||duration<=0)return 'Completa primero el inicio y fin del evento.'
 if(!Number.isInteger(span.startOffsetMinutes)||!Number.isInteger(span.endOffsetMinutes)||span.startOffsetMinutes<0||span.endOffsetMinutes>duration)return 'Este horario queda fuera del evento. Ajusta el horario o amplía el evento.'
 if(span.endOffsetMinutes<=span.startOffsetMinutes)return 'La salida debe ser posterior a la llegada.'
 return null
}
export function timelinePayload(value:OperationalTimeline,session:TimelineSession):OperationalTimeline{
 const clean=(span:TimelineSpan,name:string)=>{
  let error;try{error=spanError(span,session)}catch{error='Completa primero el inicio y fin del evento.'}
  if(error)throw Error(`${error} ${name}`)
  return {startOffsetMinutes:span.startOffsetMinutes,endOffsetMinutes:span.endOffsetMinutes}
 }
 return {schemaVersion:1,milestones:value.milestones.map(m=>{
  if(!m.name.trim())throw Error('Escribe el nombre de cada momento del evento.')
  return{id:m.id,name:m.name,...clean(m,m.name)}
 }),attendanceWindows:value.attendanceWindows.map(w=>{
  if(w.marginsReviewed===false)throw Error('Revisa y confirma el traslado y la preparación de cada horario propio.')
  for(const n of [w.outboundMinutes,w.setupMinutes,w.teardownMinutes,w.returnMinutes])if(!Number.isInteger(n)||n<0||n>1440)throw Error('Indica minutos entre 0 y 1440 para traslado y preparación.')
  return {kind:w.kind,entityId:w.entityId,...clean(w,'Horario del personal o equipo'),outboundMinutes:w.outboundMinutes,setupMinutes:w.setupMinutes,teardownMinutes:w.teardownMinutes,returnMinutes:w.returnMinutes}
 }),requirementWindows:value.requirementWindows.map(r=>({...r}))}
}
// This is a draft hint. The server repeats the identity/calendar/absence check under its transaction lock.
export function timelineCovers(r:AssignmentRequirement,id:string,session:TimelineSession,timeline:OperationalTimeline,directory:Pick<Directory,'providers'>){
 try{
  const key=(kind:string,id:string)=>{const p=kind==='PROVIDER'?directory.providers.find(p=>p.id===id):null;return p?`person:${p.userId||p.employeeId||p.id}`:kind==='USER'?`person:${id}`:`resource:${id}`}
  const target=key(r.kind,id),duration=(Date.parse(timelineInstant(session.endsAt,session.timezone))-Date.parse(timelineInstant(session.startsAt,session.timezone)))/60000
  const before=(session.outboundMinutes||0)+(session.setupMinutes||0),after=(session.teardownMinutes||0)+(session.returnMinutes||0)
  const assignments=[...new Set([session.organizerId,...session.userIds||[]].filter((id):id is string=>!!id))].map(id=>({kind:'USER',id})).concat((session.providerIds||[]).map(id=>({kind:'PROVIDER',id})),(session.resourceIds||[]).map(id=>({kind:'RESOURCE',id})))
  const presence:{start:number;end:number}[]=[],reserved:{start:number;end:number}[]=[]
  for(const a of assignments.filter(a=>key(a.kind,a.id)===target)){
   const w=timeline.attendanceWindows.find(w=>w.kind===a.kind&&w.entityId===a.id)
   if(w&&(w.marginsReviewed===false||spanError(w,session)))continue
   presence.push({start:w?.startOffsetMinutes??0,end:w?.endOffsetMinutes??duration})
   reserved.push({start:w?w.startOffsetMinutes-w.outboundMinutes-w.setupMinutes:-before,end:w?w.endOffsetMinutes+w.teardownMinutes+w.returnMinutes:duration+after})
  }
  const covers=(ranges:typeof presence,start:number,end:number)=>{
   let cursor=start;for(const range of ranges.sort((a,b)=>a.start-b.start)){if(range.start>cursor)break;if(range.end>cursor)cursor=range.end;if(cursor>=end)return true}return false
  }
  if(r.attendanceMode==='INTERVENTION'){
   const milestone=timeline.milestones.find(m=>m.id===timeline.requirementWindows.find(w=>w.requirementId===r.id)?.milestoneId)
   return !!milestone&&!spanError(milestone,session)&&covers(presence,milestone.startOffsetMinutes,milestone.endOffsetMinutes)
  }
  return duration>0&&covers(presence,0,duration)&&covers(reserved,-before,duration+after)
 }catch{return false}
}
