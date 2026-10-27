import {addDays,localDateTime,localInstant} from '@/modules/appointments/viewModel'
import {formatMoney} from '@/utils/formatters'
export type EventPaymentTermsInput={schemaVersion:1;depositPercent:string;balanceDaysBefore:number;referenceStartsAt:string;referenceTimezone:string}
export type EventPaymentTermsSnapshot=EventPaymentTermsInput&{basisTotal:string;currencyCode:string}
export type PublicEventPaymentTerms={depositPercent:string;depositRequired:string;balanceDaysBefore:number;referenceStartsAt:string;referenceTimezone:string;dueAt:string;currencyCode:string}
export function safeEventPaymentTerms(value:PublicEventPaymentTerms|EventPaymentTermsSnapshot|null|undefined):PublicEventPaymentTerms|null{
 if(!value)return null
 const {depositPercent,balanceDaysBefore,referenceStartsAt,referenceTimezone,currencyCode}=value
 if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(depositPercent)||Number(depositPercent)>100||!Number.isInteger(balanceDaysBefore)||balanceDaysBefore<0||balanceDaysBefore>365||!/^[A-Z]{3}$/.test(currencyCode)||!Number.isFinite(Date.parse(referenceStartsAt)))return null
 try{
  let depositRequired:string,dueAt:string
  if('depositRequired'in value){depositRequired=value.depositRequired;dueAt=value.dueAt}
  else{
   if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(value.basisTotal))return null
   const cents=(v:string)=>{const [a,b='']=v.split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'))}
   const required=(cents(value.basisTotal)*cents(depositPercent)+5000n)/10000n
   depositRequired=`${required/100n}.${String(required%100n).padStart(2,'0')}`
   const local=localDateTime(referenceStartsAt,referenceTimezone),date=addDays(local.slice(0,10),-balanceDaysBefore)
   dueAt=new Date(Date.parse(localInstant(`${date}T${local.slice(11,16)}`,referenceTimezone))+new Date(referenceStartsAt).getUTCSeconds()*1000+new Date(referenceStartsAt).getUTCMilliseconds()).toISOString()
  }
  if(!/^\d{1,10}\.\d{2}$/.test(depositRequired)||!Number.isFinite(Date.parse(dueAt)))return null
  new Intl.DateTimeFormat('es-GT',{timeZone:referenceTimezone})
  return {depositPercent,depositRequired,balanceDaysBefore,referenceStartsAt,referenceTimezone,dueAt,currencyCode}
 }catch{return null}
}
export function eventPaymentTermsText(value:PublicEventPaymentTerms|EventPaymentTermsSnapshot|null|undefined,locale='es-GT'){
 const terms=safeEventPaymentTerms(value)
 if(!terms)return ''
 const at=new Intl.DateTimeFormat(locale,{timeZone:terms.referenceTimezone,dateStyle:'long',timeStyle:'short'}).format(new Date(terms.dueAt))
 return `Anticipo para confirmar: ${terms.depositPercent} % · ${formatMoney(terms.depositRequired,locale,terms.currencyCode)}. Saldo del acuerdo: vence el ${at} (${terms.referenceTimezone}). La aceptación no registra pagos ni reserva el horario.`
}
