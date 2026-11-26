import {useEffect,useState} from 'react'
import {Link,useNavigate,useParams} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Checkbox} from '@/components/ui/checkbox'
import {useAgendaContext} from '../useAgendaContext'
import {appointmentQueryKey} from '../api'
import {previewSourceBilling} from '../commercialApi'
import {useSourceBillingDraft} from '../billingDraft'
import {useDraftGuard} from '../components/DraftGuard'
import {FormFeedback} from '../components/FormFeedback'
import {AgendaPicker} from '../components/AgendaPicker'
import {engagementMoney} from '../components/EngagementLines'
import type {BillingOrigin} from '../commercialTypes'
import '../appointments.css'
export default function ServiceBillingPreparationPage({kind}:{kind:BillingOrigin['kind']}){
  const ctx=useAgendaContext(),{id}=useParams()
  return <BillingWorkspace key={`${ctx.scope.companyId}:${ctx.scope.branchId}:${kind}:${id}`} origin={{kind,id:id||''}}/>
}
export function BillingWorkspace({origin}:{origin:BillingOrigin}){
  const ctx=useAgendaContext(),navigate=useNavigate()
  const back=`/agenda/${origin.kind==='BOOKING'?'reservas':'actividades'}/${origin.id}`
  usePageTrail([{label:'Agenda',to:'/agenda'},{label:origin.kind==='BOOKING'?'Reserva':'Actividad',to:back},{label:'Preparar cobros'}])
  const allowed=ctx.writable&&ctx.canUseCatalog&&ctx.canUseContacts&&['appointments.create','receivables.view'].every(permission=>ctx.hasPermission(permission))
  const draft=useSourceBillingDraft({scope:ctx.scope,origin,preview:undefined,onSaved:row=>guard.proceed(()=>navigate(`/agenda/contrataciones/${row.id}`,{replace:true}))})
  const [previewChoices,setPreviewChoices]=useState(draft.choices)
  const waitingForInput=previewChoices!==draft.choices
  useEffect(()=>{
    if(!waitingForInput)return
    const timer=setTimeout(()=>setPreviewChoices(draft.choices),300)
    return()=>clearTimeout(timer)
  },[draft.choices,waitingForInput])
  const query=useQuery({queryKey:appointmentQueryKey(ctx.scope,'billing-preview',{origin,...previewChoices}),queryFn:({signal})=>previewSourceBilling(ctx.scope,origin,previewChoices,signal),enabled:allowed&&!!origin.id,retry:false,
    // Retain field context only within this company, branch and source while recalculating.
    placeholderData:(previous,previousQuery)=>previousQuery?.queryKey[1]===ctx.scope.companyId&&previousQuery.queryKey[2]===ctx.scope.branchId&&previous?.origin.kind===origin.kind&&previous.origin.id===origin.id?previous:undefined})
  const p=allowed?query.data:undefined,guard=useDraftGuard(draft.dirty)
  const updating=waitingForInput||query.isFetching
  const reviewReady=!!p&&!updating&&!query.isLoading&&!query.isError&&!query.isPlaceholderData
  const existingId=!query.isPlaceholderData?p?.engagementId:undefined,proceed=guard.proceed
  useEffect(()=>{if(existingId)proceed(()=>navigate(`/agenda/contrataciones/${existingId}`,{replace:true}))},[existingId,navigate,proceed])
  if(existingId)return <main className="agenda-page">{guard.dialog}<p role="status">Este servicio ya tiene una contratación. Abriendo el vínculo existente; los datos del borrador no se han aplicado.</p><Button variant="outline" onClick={()=>proceed(()=>navigate(`/agenda/contrataciones/${existingId}`,{replace:true}))}>Ver contratación</Button></main>
  const error=draft.error||(!waitingForInput&&query.error instanceof Error?query.error.message:null)
  const when=(value:string)=>new Intl.DateTimeFormat('es-GT',{dateStyle:'medium',timeStyle:'short',timeZone:p?.schedule.timezone}).format(new Date(value))
  return <main className="agenda-page">{guard.dialog}<div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-lg font-semibold">Preparar cobros del servicio</h1><Button asChild variant="outline"><Link to={back}>Volver</Link></Button></div>
    {!allowed?<p role="alert">Selecciona una sucursal y verifica tu acceso a Agenda, catálogo, contactos y Cartera.</p>:<>
      <FormFeedback error={error} fields={draft.fields} focusOnError={!!draft.error}/><div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" disabled={draft.pending||updating} onClick={()=>{draft.approve(false);void query.refetch()}}>Actualizar y revisar contexto</Button><p className="text-xs text-muted-foreground">No cambia el horario ni registra asistencia.</p></div>
      <form className="agenda-editor-grid" aria-label="Preparar cobros" aria-busy={draft.pending} onSubmit={event=>{event.preventDefault();if(reviewReady)void draft.save(p)}}>
        <section className="agenda-panel space-y-5"><div><h2 className="font-semibold">{p?.service.name||'Servicio programado'}</h2><p className="text-sm text-muted-foreground">{origin.kind==='BOOKING'?'Se conservarán los importes pactados al reservar.':'Elige a quién cobrar y la cantidad comercial. Los asistentes y la duración no determinan el precio.'}</p></div>
          {p&&<dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Inicio</dt><dd>{when(p.schedule.startsAt)}</dd></div><div><dt className="text-muted-foreground">Finalización</dt><dd>{when(p.schedule.endsAt)}</dd></div></dl>}
          {origin.kind==='ACTIVITY'?<div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="agenda-contactId">Cliente al que se cobrará *</Label><AgendaPicker scope={ctx.scope} kind="contacts" label={p?.customer?.name||'Selecciona un cliente'} disabled={draft.pending} onSelect={customer=>draft.change({...draft.choices,contactId:customer.id})}/></div><div><Label htmlFor="agenda-quantity">Cantidad · {p?.service.unitLabel||'unidad comercial'}</Label><Input id="agenda-quantity" type="number" min={p?.service.quantityDecimals?10**-p.service.quantityDecimals:1} step={p?.service.quantityDecimals?10**-p.service.quantityDecimals:1} required value={draft.choices.quantity||''} disabled={draft.pending} onChange={event=>draft.change({...draft.choices,quantity:event.target.value})}/><p className="mt-1 text-xs text-muted-foreground">No es el número de invitados ni la duración del evento.</p></div></div>:p&&<dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Cliente</dt><dd className="font-medium">{p.customer?.name}</dd></div><div><dt className="text-muted-foreground">Cantidad acordada</dt><dd>{p.quantity} {p.service.unitLabel}</dd></div></dl>}
          <div className="border-t pt-4 text-sm"><p>Preparar crea un borrador de venta, sin registrar cobros ni efectos contables. Si ya registraste esta prestación en Ventas, no generes otra.</p><p className="mt-2 text-muted-foreground">No se enlazan automáticamente ventas manuales anteriores. Después podrás registrar anticipos, cobrar el saldo y confirmar el mismo borrador desde la contratación.</p></div>
          <div className="flex items-start gap-3"><Checkbox id="billing-reviewed" checked={reviewReady&&draft.isApproved(p)} disabled={draft.pending||!reviewReady||!p?.canPrepare} onCheckedChange={value=>{if(reviewReady)draft.approve(value===true,p)}}/><Label htmlFor="billing-reviewed" className="leading-relaxed">Revisé el cliente, la cantidad y el importe, y confirmé que esta prestación no tiene otra venta registrada.</Label></div>
          <div className="agenda-actions"><Button type="submit" disabled={draft.pending||!reviewReady||!draft.isApproved(p)}>{draft.pending?'Preparando…':'Preparar y continuar a cobros'}</Button></div>
        </section><aside className="agenda-panel agenda-editor-summary space-y-4" aria-busy={updating}>
          <h2>Resumen comercial</h2>
          <p role="status" className="min-h-5 text-xs text-muted-foreground">{updating?p?'Actualizando importe…':'Consultando el servicio…':query.isError?'No se pudo revisar el importe. Tus datos se conservan.':reviewReady?p.reason||'Importe actualizado. Revisa antes de continuar.':'Completa los datos para revisar el importe.'}</p>
          <p className="text-sm text-muted-foreground">{p?.priceSource==='RESERVATION'?'Precio original de la reserva':'Precio vigente del catálogo'}</p>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt>Precio unitario</dt><dd>{reviewReady?engagementMoney(p.unitPrice,p.currencyCode):'—'}</dd></div>
            <div className="flex justify-between gap-3"><dt>Cantidad</dt><dd>{origin.kind==='ACTIVITY'?draft.choices.quantity||'—':p?.quantity||'—'}</dd></div>
            <div className="flex justify-between gap-3 border-t pt-3 font-semibold"><dt>Total</dt><dd aria-label="Total revisado">{reviewReady?engagementMoney(p.total,p.currencyCode):'—'}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">No es una factura fiscal. El cobro y la venta se gestionan por separado, sin duplicar el dinero.</p>
        </aside>
      </form>
    </>}
  </main>
}
