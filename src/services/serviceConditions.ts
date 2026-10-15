export type PublicServiceConditions={version:1;schedulingStyle:'APPOINTMENT'|'CLASS'|'WORK';durationPolicy:'FIXED'|'EDITABLE';durationMinutes:number;allowedVenueKinds:('BRANCH'|'HOME'|'EVENT_VENUE'|'ONLINE')[];publicInstructions:string}
const styles={APPOINTMENT:'Atención individual',CLASS:'Sesión con cupos',WORK:'Trabajo o evento'}
const venues={BRANCH:'En sucursal',HOME:'A domicilio',EVENT_VENUE:'Lugar del evento',ONLINE:'En línea'}
export function serviceConditionText(snapshot?:PublicServiceConditions|null):string {
  if(!snapshot) return ''
  return `${styles[snapshot.schedulingStyle]} · ${snapshot.durationMinutes} min${snapshot.durationPolicy==='EDITABLE'?' (duración ajustable)':''} · ${snapshot.allowedVenueKinds.map(kind=>venues[kind]).join(', ')}${snapshot.publicInstructions?`\n${snapshot.publicInstructions}`:''}\nHorario sujeto a disponibilidad y confirmación al agendar.`
}
