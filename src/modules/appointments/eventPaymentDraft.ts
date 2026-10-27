import type {EventPaymentTermsInput,EventPaymentTermsSnapshot} from '@/services/eventPaymentTerms'
import {localDateTime,localInstant} from './viewModel'

export type EventPaymentDraft={enabled:boolean;depositPercent:string;balanceDaysBefore:string;referenceLocal:string;referenceTimezone:string}
export function eventPaymentDraft(terms:EventPaymentTermsSnapshot|null|undefined,timezone:string):EventPaymentDraft{
 return {enabled:!!terms,depositPercent:terms?.depositPercent??'',balanceDaysBefore:terms?String(terms.balanceDaysBefore):'',referenceLocal:terms?localDateTime(terms.referenceStartsAt,terms.referenceTimezone):'',referenceTimezone:terms?.referenceTimezone||timezone}
}
export function eventPaymentDraftErrors(value:EventPaymentDraft):Record<string,string>{
 if(!value.enabled)return {}
 const errors:Record<string,string>={}
 if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(value.depositPercent)||Number(value.depositPercent)>100)errors.depositPercent='Indica un porcentaje de 0 a 100, con hasta 2 decimales.'
 if(!/^\d{1,3}$/.test(value.balanceDaysBefore)||Number(value.balanceDaysBefore)>365)errors.balanceDaysBefore='Indica de 0 a 365 días enteros.'
 try{new Intl.DateTimeFormat('es-GT',{timeZone:value.referenceTimezone})}catch{errors.referenceTimezone='Selecciona una zona horaria válida.'}
 try{if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.referenceLocal))throw Error();localInstant(value.referenceLocal,value.referenceTimezone)}catch{errors.referenceLocal='Indica la fecha y hora de la primera prestación; revisa su zona horaria.'}
 return errors
}
export function eventPaymentPayload(value:EventPaymentDraft):EventPaymentTermsInput|null{
 if(!value.enabled)return null
 if(Object.keys(eventPaymentDraftErrors(value)).length)throw Error('Completa las condiciones de anticipo y saldo.')
 return {schemaVersion:1,depositPercent:value.depositPercent,balanceDaysBefore:Number(value.balanceDaysBefore),referenceStartsAt:localInstant(value.referenceLocal,value.referenceTimezone),referenceTimezone:value.referenceTimezone}
}
