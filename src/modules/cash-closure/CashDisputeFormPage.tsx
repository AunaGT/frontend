import {useRef,useState} from 'react'
import {useNavigate,useSearchParams} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Label} from '@/components/ui/label'
import {LoadingState} from '@/components/shared/LoadingState'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {fetchDisputeCapabilities,fetchDisputeOrigin,createDispute} from '@/services/cashDisputeService'
import {useDisputeIdentity} from './hooks/useDisputeIdentity'
import {CashPageHeader,Notice} from './components/CashPageParts'
import {formatCurrency,formatZonedDateTime} from './types'
export default function CashDisputeFormPage(){const identity=useDisputeIdentity(),[params]=useSearchParams();return <DisputeForm key={`${identity.key}:${params.get('origen')||''}`}/>}
function DisputeForm(){
  const identity=useDisputeIdentity(),[params]=useSearchParams(),eventId=params.get('origen')||'',navigate=useNavigate(),{locale,timezone}=useSystemSettings()
  const [claimed,setClaimed]=useState(''),[reference,setReference]=useState(''),[reason,setReason]=useState(''),[deadline,setDeadline]=useState(''),[support,setSupport]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[denied,setDenied]=useState(false)
  const pending=useRef(false),attempt=useRef<{fingerprint:string;key:string}|null>(null),errorRef=useRef<HTMLDivElement>(null)
  const caps=useQuery({queryKey:['cash-dispute-capabilities',identity.key],queryFn:({signal})=>fetchDisputeCapabilities(identity.scope,signal),enabled:identity.ready,retry:false,gcTime:0})
  const origin=useQuery({queryKey:['cash-dispute-origin',identity.key,eventId],queryFn:({signal})=>fetchDisputeOrigin(eventId,identity.scope,signal),enabled:identity.ready&&!!eventId&&!!caps.data?.available,retry:false,gcTime:0,refetchOnWindowFocus:false})
  const doc=origin.isError||denied?null:origin.data,canSave=!!caps.data?.commandsAvailable&&!!caps.data.can.manage&&!!doc?.eligible&&!denied
  usePageTrail([{label:'Disputas bancarias',to:'/cierre-caja/disputas'},{label:'Nuevo reclamo'}])
  async function submit(e:React.FormEvent){
    e.preventDefault();if(!canSave||pending.current||!doc)return
    if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(claimed)||Number(claimed)<=0||!reference.trim()||!reason.trim()){setError('Completa el principal, la referencia y el motivo del reclamo.');requestAnimationFrame(()=>errorRef.current?.focus());return}
    const body={eventId:doc.eventId,claimed,providerReference:reference.trim(),reason:reason.trim(),...(deadline?{deadline}:{}),...(support.trim()?{evidence:{identifier:support.trim()}}:{})}
    const fingerprint=JSON.stringify(body);if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()}
    pending.current=true;setBusy(true);setError('');const signal=identity.newSignal()
    try{const saved=await createDispute({...body,requestKey:attempt.current!.key},identity.scope,signal);if(!signal.aborted)navigate(`/cierre-caja/disputas/${saved.id}`)}
    catch(cause){if(!signal.aborted){const status=(cause as {status?:number}).status;if([401,403,404].includes(status||0))setDenied(true);setError(cause instanceof Error?cause.message:'No se pudo registrar el reclamo');if(status===409)void origin.refetch();requestAnimationFrame(()=>errorRef.current?.focus())}}
    finally{pending.current=false;if(!signal.aborted)setBusy(false)}
  }
  return <div className="mx-auto min-w-0 max-w-[1120px] space-y-4 p-4 sm:p-6"><CashPageHeader title="Nuevo reclamo bancario" subtitle="Verifica el cobro y registra el aviso del banco o proveedor." backLabel="Volver a disputas" onBack={()=>navigate('/cierre-caja/disputas')}/>
    {!identity.ready?<Notice>Selecciona una sucursal para preparar el reclamo.</Notice>:caps.isError?<Notice role="alert">{caps.error.message}</Notice>:!eventId?<Notice>Abre el cobro digital o su liquidación y selecciona el cobro que deseas reclamar. Así conservamos su importe y procedencia.</Notice>:origin.isError||denied?<Notice role="alert">{denied?'Ya no tienes acceso al cobro original.':origin.error?.message}</Notice>:caps.isPending||origin.isPending&&caps.data?.available?<LoadingState variant="detail" message="Verificando cobro original…"/>:!caps.data?.available?<Notice>Esta empresa todavía no tiene habilitado el registro de disputas.</Notice>:doc&&<>
      {!caps.data.commandsAvailable&&<Notice>{caps.data.reason}</Notice>}{doc.issues.map(issue=><Notice key={issue} role="alert">{issue}</Notice>)}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><form onSubmit={submit} className="auna-surface order-2 min-w-0 space-y-4 rounded-lg border p-4 lg:order-1">
        {error&&<div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</div>}
        <div className="grid items-end gap-3 grid-cols-[minmax(0,1fr)_112px] sm:grid-cols-[minmax(0,1fr)_160px]"><div className="space-y-1"><Label htmlFor="dispute-reference">Referencia del proveedor *</Label><Input id="dispute-reference" maxLength={120} value={reference} onChange={e=>setReference(e.target.value)} required disabled={busy||!canSave} placeholder="N.º de caso"/></div><div className="space-y-1"><Label htmlFor="dispute-amount">Principal reclamado *</Label><Input id="dispute-amount" inputMode="decimal" value={claimed} onChange={e=>setClaimed(e.target.value)} required disabled={busy||!canSave} placeholder="0.00"/></div></div>

        <div className="space-y-1"><Label htmlFor="dispute-reason">Motivo del reclamo *</Label><Textarea id="dispute-reason" rows={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} required disabled={busy||!canSave}/></div>
        <details className="rounded-lg border px-3 py-2"><summary className="cursor-pointer text-sm font-medium">Plazo de respuesta y soporte · opcional</summary><div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]"><div className="space-y-1"><Label htmlFor="dispute-deadline">Responder antes de</Label><Input id="dispute-deadline" type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} disabled={busy||!canSave}/></div><div className="space-y-1"><Label htmlFor="dispute-support">Identificador del soporte</Label><Input id="dispute-support" value={support} onChange={e=>setSupport(e.target.value)} maxLength={255} disabled={busy||!canSave}/></div><p className="text-xs text-muted-foreground sm:col-span-2">Referencia del aviso o consulta del proveedor. Evita datos completos de tarjetas o credenciales.</p></div></details>
        <p className="text-xs text-muted-foreground">Indica solo el principal. Las comisiones se registran con el retiro real del banco.</p>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3"><Button variant="outline" type="button" onClick={()=>navigate('/cierre-caja/disputas')} disabled={busy||!canSave}>Volver</Button><Button type="submit" disabled={!canSave||busy}>{busy?'Registrando…':'Registrar reclamo'}</Button></div>
      </form><aside className="auna-surface order-1 space-y-3 rounded-lg border p-4 text-sm lg:order-2"><h2 className="font-semibold">Cobro original</h2><p>{doc.customerName||'Cliente sin identificar'}</p><p className="text-muted-foreground">{doc.methodName} · {formatZonedDateTime(doc.economicAt,timezone,locale)}</p><dl className="space-y-2">{[['Cobrado',doc.amount],['Devuelto',doc.effectiveRefunded],['Disponible para reclamar',doc.claimable]].map(([label,value])=><div key={label} className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{formatCurrency(value,doc.currencyCode,locale)}</dd></div>)}</dl><p className="border-t pt-3 text-xs text-muted-foreground">Solo reserva el saldo libre afectado; no retira dinero ni crea deuda.</p></aside></div>
    </>}
  </div>
}
