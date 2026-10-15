import {useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {usePaymentMethods} from '@/hooks/usePaymentMethods'
import {fetchCashSessionCurrent} from '@/services/cashSessionsService'
import {useAgendaContext} from '../useAgendaContext'
import {appointmentQueryKey,assertCurrentScope} from '../api'
import {useEngagementCommand} from '../engagementDraft'
import {useDraftGuard} from './DraftGuard'
import {FormFeedback} from './FormFeedback'
import {engagementMoney} from './EngagementLines'
import type {EngagementDetail,EngagementPaymentResult} from '../commercialTypes'

export function useEngagementPaymentChannel(enabled:boolean){
  const ctx=useAgendaContext(),methods=usePaymentMethods(),[methodId,setMethodId]=useState('')
  const choices=(methods.data||[]).filter(m=>!m.is_credit),method=choices.find(m=>String(m.id)===methodId)
  const cash=!!method&&['cash','efectivo'].includes(method.name.trim().toLowerCase())
  const session=useQuery({queryKey:appointmentQueryKey(ctx.scope,'cash-session-current'),enabled:enabled&&ctx.writable&&cash,queryFn:async({signal})=>{
    assertCurrentScope(ctx.scope,signal)
    const value=await fetchCashSessionCurrent()
    assertCurrentScope(ctx.scope,signal)
    return value
  },staleTime:0})
  const open=session.data?.ok===true&&session.data.session?.status==='OPEN'?session.data.session:null
  return {methods,choices,methodId,setMethodId,cash,session,open,valid:!!method&&(!cash||!!open),
    input:()=>({paymentMethodId:Number(methodId),...(cash?{cashRegisterSessionId:open?.id}:{} )})}
}
export function EngagementPaymentChannelFields({channel,prefix,disabled=false}:{channel:ReturnType<typeof useEngagementPaymentChannel>;prefix:string;disabled?:boolean}){
  return <div className="space-y-2"><Label id={`${prefix}-method-label`}>Medio de pago *</Label><Select value={channel.methodId} onValueChange={channel.setMethodId} disabled={disabled||channel.methods.isLoading}><SelectTrigger aria-labelledby={`${prefix}-method-label`}><SelectValue placeholder="Selecciona el medio de pago"/></SelectTrigger><SelectContent>{channel.choices.map(m=><SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent></Select>{channel.methods.isError&&<p role="alert" className="text-sm text-destructive">No se pudieron cargar los medios de pago.<Button type="button" variant="ghost" onClick={()=>void channel.methods.refetch()}>Reintentar</Button></p>}{channel.cash&&<div className="text-sm" aria-live="polite">{channel.session.isFetching?'Consultando turno…':channel.open?`Turno abierto · ${channel.session.data?.ok===true?channel.session.data.register?.name||'Caja actual':''}`:<p role="alert" className="text-destructive">Abre tu turno de caja antes de registrar efectivo.</p>}<Button type="button" variant="ghost" size="sm" disabled={disabled||channel.session.isFetching} onClick={()=>void channel.session.refetch()}>Actualizar turno</Button></div>}</div>
}
export function EngagementContextReview({version,pending,onRefresh,onReviewed}:{version:number;pending:boolean;onRefresh?:()=>Promise<EngagementDetail|undefined>;onReviewed:(version:number)=>void}){
  const [reviewed,setReviewed]=useState(version),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('')
  return <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Contexto revisado · versión {reviewed}</span>{onRefresh&&<Button type="button" variant="ghost" size="sm" disabled={pending||refreshing} onClick={async()=>{setRefreshing(true);setError('');try{const row=await onRefresh();if(row){onReviewed(row.version);setReviewed(row.version)}}catch{setError('No se pudo actualizar. Tu borrador se conserva.')}finally{setRefreshing(false)}}}>{refreshing?'Actualizando…':'Actualizar sin perder cambios'}</Button>}{version!==reviewed&&<span role="status">Los datos cambiaron. Actualiza y revisa el saldo antes de guardar.</span>}{error&&<p role="alert">{error}</p>}</div>
}
export function EngagementPaymentForm({engagement,onSaved,onCancel,onRefresh}:{engagement:EngagementDetail;onSaved:(e:EngagementDetail)=>void;onCancel:()=>void;onRefresh?:()=>Promise<EngagementDetail|undefined>}){
  const ctx=useAgendaContext(),command=useEngagementCommand({scope:ctx.scope,engagementId:engagement.id,version:engagement.version})
  const [amount,setAmount]=useState(''),[reference,setReference]=useState(''),[notes,setNotes]=useState(''),[localError,setLocalError]=useState<string|null>(null)
  const channel=useEngagementPaymentChannel(true),guard=useDraftGuard(!!amount||!!reference||!!notes||command.pending)
  const money=engagement.money,allowed=ctx.writable&&!!engagement.capabilities?.collect&&!!money
  const save=async()=>{
    if(command.pending||!allowed)return
    if(!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)<=0||!channel.valid){setLocalError('Indica un importe positivo y un medio de pago disponible.');return}
    setLocalError(null)
    const result=await command.send<EngagementPaymentResult>('payments',{amount,currencyCode:money.currencyCode,...channel.input(),reference,notes})
    if(result)guard.proceed(()=>onSaved(result.engagement))
  }
  return <form className="space-y-4" onSubmit={async e=>{e.preventDefault();await save()}}>{guard.dialog}<div><h3 className="font-semibold">Registrar abono</h3><p className="mt-1 text-sm text-muted-foreground">Se registrará un recibo real para esta contratación, sin repartirlo a otras facturas del cliente.</p></div><FormFeedback error={localError||command.error} fields={command.fields}/>{money&&<p className="text-sm">Saldo de la contratación: <strong>{engagementMoney(money.remaining,money.currencyCode)}</strong></p>}<fieldset disabled={command.pending||!allowed} className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="engagement-payment-amount">Importe recibido *</Label><Input id="engagement-payment-amount" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" aria-invalid={!!command.fields.amount}/>{command.fields.amount&&<p className="text-sm text-destructive">{command.fields.amount}</p>}</div><EngagementPaymentChannelFields channel={channel} prefix="engagement-payment" disabled={command.pending}/><div><Label htmlFor="engagement-payment-reference">Referencia</Label><Input id="engagement-payment-reference" value={reference} onChange={e=>setReference(e.target.value)} maxLength={255}/></div><div><Label htmlFor="engagement-payment-notes">Observaciones del recibo</Label><Input id="engagement-payment-notes" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={500}/></div></fieldset><EngagementContextReview version={engagement.version} pending={command.pending} onRefresh={onRefresh} onReviewed={command.reviewVersion}/><div className="agenda-actions"><Button type="button" variant="outline" disabled={command.pending} onClick={()=>guard.request(onCancel)}>Cancelar</Button><Button type="submit" disabled={command.pending||!allowed||!channel.valid}>{command.pending?'Registrando…':'Registrar abono'}</Button></div></form>
}
