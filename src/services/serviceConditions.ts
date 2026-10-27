export type PublicServiceConditions={version:1;schedulingStyle:'APPOINTMENT'|'CLASS'|'WORK';durationPolicy:'FIXED'|'EDITABLE';durationMinutes:number;allowedVenueKinds:('BRANCH'|'HOME'|'EVENT_VENUE'|'ONLINE')[];publicInstructions:string;assignmentRequirements?:{name:string;kind:'PROVIDER'|'RESOURCE';quantity:number;attendanceMode?:'FULL'|'INTERVENTION'}[]}
export function publicServiceConditions(s:PublicServiceConditions):PublicServiceConditions{
 return{version:s.version,schedulingStyle:s.schedulingStyle,durationPolicy:s.durationPolicy,durationMinutes:s.durationMinutes,allowedVenueKinds:[...s.allowedVenueKinds],publicInstructions:s.publicInstructions,
  ...(s.assignmentRequirements?.length?{assignmentRequirements:s.assignmentRequirements.map(({name,kind,quantity,attendanceMode})=>({name,kind,quantity,...(attendanceMode==='FULL'||attendanceMode==='INTERVENTION'?{attendanceMode}:{})}))}:{})}
}
const styles={APPOINTMENT:'Atención individual',CLASS:'Sesión con cupos',WORK:'Trabajo o evento'}
const venues={BRANCH:'En sucursal',HOME:'A domicilio',EVENT_VENUE:'Lugar del evento',ONLINE:'En línea'}
export function serviceConditionText(snapshot?:PublicServiceConditions|null):string {
  if(!snapshot) return ''
  const requirements=snapshot.assignmentRequirements?.map(r=>`${r.name} · ${r.quantity} ${r.kind==='PROVIDER'?(r.quantity===1?'profesional':'profesionales'):(r.quantity===1?'equipo o sala':'equipos o salas')}${r.attendanceMode==='INTERVENTION'?' · en un momento del evento':r.attendanceMode==='FULL'?' · todo el evento':''}`).join('; ')
  return `${styles[snapshot.schedulingStyle]} · ${snapshot.durationMinutes} min${snapshot.durationPolicy==='EDITABLE'?' (duración ajustable)':''} · ${snapshot.allowedVenueKinds.map(kind=>venues[kind]).join(', ')}${snapshot.publicInstructions?`\n${snapshot.publicInstructions}`:''}${requirements?`\nRequisitos: ${requirements}`:''}\nHorario sujeto a disponibilidad y confirmación al agendar.`
}
