import {Button} from '@/components/ui/button'
import {formatMoney} from '@/utils/formatters'
import type {EngagementPaymentPolicy} from '../commercialTypes'

const confirmationLabels={NOT_APPLICABLE:'Sin condiciones adicionales',PENDING_SCHEDULE:'Falta programar',PENDING_DEPOSIT:'Falta completar el anticipo',REVIEW_REQUIRED:'Acuerdo pendiente de revisión',CONFIRMED:'Condiciones para atender cumplidas'}
export function EngagementPaymentStatus({state,currencyCode,onCollect,onSchedule,onReview}:{state?:EngagementPaymentPolicy;currencyCode?:string;onCollect?:()=>void;onSchedule?:()=>void;onReview?:()=>void}){
 if(!state?.enabled)return null
 const review=state.confirmation==='REVIEW_REQUIRED',schedule=state.confirmation==='PENDING_SCHEDULE',collect=!review&&!schedule&&(state.confirmation==='PENDING_DEPOSIT'||state.payment==='OVERDUE')
 const action=review?onReview:schedule?onSchedule:collect?onCollect:undefined
 const money=(value?:string)=>value!==undefined&&currencyCode?formatMoney(value,'es-GT',currencyCode):null
 const missing=money(state.depositMissing),remaining=money(state.remaining)
 return <section className="rounded-lg border bg-muted/30 p-3" aria-label="Condiciones del acuerdo"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><h2 className="text-sm font-semibold">{confirmationLabels[state.confirmation]}</h2><p className="text-sm">{state.payment==='OVERDUE'?'Saldo vencido · se requiere regularizar antes de iniciar o finalizar.':state.payment==='PAID'?'Saldo del acuerdo cubierto.':schedule?'Completa los horarios y asignaciones de todos los servicios.':review?'Revisa cambios de alcance, asignaciones o devoluciones.':state.confirmation==='PENDING_DEPOSIT'?'Registra un abono para cubrir el anticipo acordado.':'Programación y anticipo verificados; el saldo se revisa en cada acción.'}</p>{missing&&state.confirmation==='PENDING_DEPOSIT'&&<p className="text-sm">Falta de anticipo: <strong>{missing}</strong></p>}{remaining&&<p className="text-xs text-muted-foreground">Saldo pendiente: {remaining}</p>}{state.dueAt&&state.reference&&<p className="text-xs text-muted-foreground">Saldo hasta el {new Intl.DateTimeFormat('es-GT',{timeZone:state.reference.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(state.dueAt))} · {state.reference.timezone}</p>}</div>{action&&<Button type="button" size="sm" onClick={action}>{review?'Revisar contratación':schedule?'Programar servicios':'Registrar abono'}</Button>}</div></section>
}
