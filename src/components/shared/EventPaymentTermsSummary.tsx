import {eventPaymentTermsText,type EventPaymentTermsSnapshot,type PublicEventPaymentTerms} from '@/services/eventPaymentTerms'
export function EventPaymentTermsSummary({value,locale='es-GT'}:{value?:EventPaymentTermsSnapshot|PublicEventPaymentTerms|null;locale?:string}){
 const text=eventPaymentTermsText(value,locale)
 return text?<section aria-label="Condiciones para confirmar el servicio" className="space-y-1.5 rounded-lg border bg-muted/30 p-3"><h3 className="text-sm font-semibold">Condiciones para confirmar el servicio</h3><p className="break-words text-sm leading-relaxed text-muted-foreground">{text}</p></section>:null
}
