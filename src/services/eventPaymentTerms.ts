import {addDays,localDateTime,localInstant} from '@/modules/appointments/viewModel'
import {formatMoney} from '@/utils/formatters'
export type EventPaymentTermsInput={schemaVersion:1;depositPercent:string;balanceDaysBefore:number;referenceStartsAt:string;referenceTimezone:string}
export type EventPaymentTermsSnapshot=EventPaymentTermsInput&{basisTotal:string;currencyCode:string}
export type PublicEventPaymentTerms={depositPercent:string;depositRequired:string;balanceDaysBefore:number;referenceStartsAt:string;referenceTimezone:string;dueAt:string;currencyCode:string}
function agreedFields(value:PublicEventPaymentTerms|EventPaymentTermsSnapshot){
 const {depositPercent,balanceDaysBefore,referenceStartsAt,referenceTimezone,currencyCode}=value
 if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(depositPercent)||Number(depositPercent)>100||!Number.isInteger(balanceDaysBefore)||balanceDaysBefore<0||balanceDaysBefore>365||!/^[A-Z]{3}$/.test(currencyCode)||!Number.isFinite(Date.parse(referenceStartsAt)))return null
 new Intl.DateTimeFormat('es-GT',{timeZone:referenceTimezone})
 let depositRequired:string
 if('depositRequired'in value)depositRequired=value.depositRequired
 else{
  if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(value.basisTotal))return null
  const cents=(v:string)=>{const [a,b='']=v.split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'))}
  const required=(cents(value.basisTotal)*cents(depositPercent)+5000n)/10000n
  depositRequired=`${required/100n}.${String(required%100n).padStart(2,'0')}`
 }
 if(!/^\d{1,10}\.\d{2}$/.test(depositRequired))return null
 return {depositPercent,depositRequired,balanceDaysBefore,referenceStartsAt,referenceTimezone,currencyCode}
}
export function safeEventPaymentTerms(value:PublicEventPaymentTerms|EventPaymentTermsSnapshot|null|undefined):PublicEventPaymentTerms|null{
 if(!value)return null
 try{
  const fields=agreedFields(value);if(!fields)return null
  const {balanceDaysBefore,referenceStartsAt,referenceTimezone}=fields
  let dueAt:string
  if('dueAt'in value)dueAt=value.dueAt
  else{
   const local=localDateTime(referenceStartsAt,referenceTimezone),date=addDays(local.slice(0,10),-balanceDaysBefore)
   dueAt=new Date(Date.parse(localInstant(`${date}T${local.slice(11,16)}`,referenceTimezone))+new Date(referenceStartsAt).getUTCSeconds()*1000+new Date(referenceStartsAt).getUTCMilliseconds()).toISOString()
  }
  if(!Number.isFinite(Date.parse(dueAt)))return null
  return {...fields,dueAt}
 }catch{return null}
}
export function eventPaymentTermsText(value:PublicEventPaymentTerms|EventPaymentTermsSnapshot|null|undefined,locale='es-GT'){
 const terms=safeEventPaymentTerms(value)
 if(!terms){
  // An unsaved preview must not invent a DST resolution or hide the agreement.
  // Saved readers receive the authoritative dueAt calculated by the server.
  try{
   if(!value)return ''
   const fields=agreedFields(value);if(!fields)return ''
   const reference=new Intl.DateTimeFormat(locale,{timeZone:fields.referenceTimezone,dateStyle:'long',timeStyle:'short'}).format(new Date(fields.referenceStartsAt))
   return `Anticipo para confirmar: ${fields.depositPercent} % · ${formatMoney(fields.depositRequired,locale,fields.currencyCode)}. Saldo: ${fields.balanceDaysBefore} ${fields.balanceDaysBefore===1?'día de calendario':'días de calendario'} antes de la primera prestación (${reference}, ${fields.referenceTimezone}). Auna verificará la hora exacta del vencimiento al guardar.`
  }catch{return ''}
 }
 const at=new Intl.DateTimeFormat(locale,{timeZone:terms.referenceTimezone,dateStyle:'long',timeStyle:'short'}).format(new Date(terms.dueAt))
 return `Anticipo para confirmar: ${terms.depositPercent} % · ${formatMoney(terms.depositRequired,locale,terms.currencyCode)}. Saldo del acuerdo: vence el ${at} (${terms.referenceTimezone}). La aceptación no registra pagos ni reserva el horario.`
}
