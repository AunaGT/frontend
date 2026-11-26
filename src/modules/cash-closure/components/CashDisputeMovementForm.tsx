import {useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Checkbox} from '@/components/ui/checkbox'
import {Notice} from './CashPageParts'
import {CashDisputeSummary} from './CashDisputeSummary'
import {civilDate,formatCurrency} from '../types'
import type {DisputeDocument,DisputeEffectInput} from '@/services/cashDisputeService'

type Props={doc:DisputeDocument;locale:string;today:string;onConfirm:(input:DisputeEffectInput)=>Promise<void>;onRefresh:()=>unknown}
export function CashDisputeMovementForm({doc,locale,today,onConfirm,onRefresh}:Props){
  const [kind,setKind]=useState<DisputeEffectInput['kind']|''>(''),[principal,setPrincipal]=useState(''),[fee,setFee]=useState('0.00')
  const [reference,setReference]=useState(''),[effectiveOn,setEffectiveOn]=useState(today),[support,setSupport]=useState('')
  const [accountingDate,setAccountingDate]=useState(''),[dateReason,setDateReason]=useState(''),[review,setReview]=useState(false),[checked,setChecked]=useState(false)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[stale,setStale]=useState(false)
  const pending=useRef(false),attempt=useRef<{fingerprint:string;key:string}|null>(null),errorRef=useRef<HTMLDivElement>(null)
  const allowed=doc.can.movements&&doc.status!=='CANCELLED',disabled=!allowed||busy
  const money=(amount:string)=>formatCurrency(amount,doc.currencyCode,locale),provider=doc.originMode==='DEFERRED'
  const providerEmpty=provider&&doc.providerPending!=null&&Number(doc.providerPending)<=0
  const dateDiff=!!accountingDate&&accountingDate!==effectiveOn,recoverable=Number(doc.withdrawn)>Number(doc.recovered)
  function showError(message:string){setError(message);requestAnimationFrame(()=>errorRef.current?.focus())}
  async function submit(event:React.FormEvent){
    event.preventDefault();if(disabled||pending.current||stale)return
    if(!kind){showError('Selecciona el tipo de movimiento.');return}
    if(!/^\d{1,10}(\.\d{1,2})?$/.test(principal)||!/^\d{1,10}(\.\d{1,2})?$/.test(fee)||Number(principal)+Number(fee)<=0){showError('Indica el principal y la comisión con hasta dos decimales.');return}
    if(kind==='BANK_RECOVERY'&&Number(principal)<=0){showError('Indica el principal recuperado.');return}
    if(!reference.trim()||!effectiveOn){showError('Completa la referencia y la fecha del movimiento.');return}
    if(dateDiff&&!dateReason.trim()){showError('Explica por qué la fecha contable es diferente.');return}
    setError('')
    if(!review){setReview(true);setChecked(false);return}
    if(!checked){showError('Confirma que revisaste el movimiento en el soporte del proveedor.');return}
    const input:Omit<DisputeEffectInput,'requestKey'>={kind,principal,fee,reference:reference.trim(),effectiveOn,expectedVersion:doc.version,
      ...(support.trim()?{evidence:{identifier:support.trim()}}:{}),...(accountingDate?{accountingDate}:{}),...(dateDiff?{dateChangeReason:dateReason.trim()}:{})}
    const fingerprint=JSON.stringify(input)
    if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()}
    pending.current=true;setBusy(true)
    try{await onConfirm({...input,requestKey:attempt.current.key})}
    catch(cause){if((cause as {name?:string}).name!=='AbortError'){
      if((cause as {status?:number}).status===409){setReview(false);setChecked(false);setStale(true)}
      showError(cause instanceof Error?cause.message:'No se pudo registrar el movimiento. Conservamos los datos para reintentar.')
    }}finally{pending.current=false;setBusy(false)}
  }
  return <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><form onSubmit={submit} className="auna-surface min-w-0 space-y-4 rounded-lg border p-4">
    {!allowed&&<Notice>Esta pantalla está en modo de solo consulta. El registro de movimientos todavía no está habilitado.</Notice>}
    {error&&<div ref={errorRef} role="alert" tabIndex={-1} className="space-y-2 text-sm text-destructive"><p>{error}</p>{stale&&<Button type="button" variant="outline" size="sm" onClick={async()=>{await onRefresh();setStale(false)}}>Revisar estado actual</Button>}</div>}
    {review?<>
      <div><h2 className="font-semibold">Revisa el movimiento</h2><p className="mt-1 text-sm text-muted-foreground">Confirma estos datos con tu estado de cuenta o liquidación.</p></div>
      <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm"><div className="col-span-2"><dt className="text-xs text-muted-foreground">Origen del dinero</dt><dd className="font-medium">{kind==='BANK_DEBIT'?'Débito en el banco del cobro original':kind==='BANK_RECOVERY'?'Abono del banco que devuelve lo retirado':'Retención del saldo pendiente del proveedor'}</dd></div><div><dt className="text-xs text-muted-foreground">Principal</dt><dd className="font-semibold tabular-nums">{money(principal)}</dd></div><div><dt className="text-xs text-muted-foreground">Comisión adicional</dt><dd className="font-semibold tabular-nums">{money(fee)}</dd></div><div><dt className="text-xs text-muted-foreground">Fecha del movimiento</dt><dd>{civilDate(effectiveOn,locale)}</dd></div><div><dt className="text-xs text-muted-foreground">Referencia</dt><dd className="break-words">{reference}</dd></div>{dateDiff&&<div className="col-span-2"><dt className="text-xs text-muted-foreground">Fecha contable</dt><dd>{civilDate(accountingDate,locale)} · {dateReason}</dd></div>}</dl>
      <p className="text-sm text-muted-foreground">{kind==='BANK_RECOVERY'?'La recuperación reduce primero el cargo pendiente del cliente; lo que el cliente ya pagó queda como crédito a su favor.':'El principal y la comisión quedan separados. El cobro original y su turno conservan su historial; el cargo al cliente se decide en la resolución.'}</p>
      <label className="flex items-start gap-2 text-sm"><Checkbox disabled={disabled} checked={checked} onCheckedChange={value=>setChecked(value===true)}/><span>Revisé el movimiento y su referencia en el soporte del proveedor.</span></label>
    </>:<>
      <fieldset disabled={disabled} className="space-y-2"><legend className="mb-2 font-semibold">¿Qué movimiento registras?</legend><div className="grid gap-2 sm:grid-cols-3">
        <Button type="button" variant={kind==='BANK_DEBIT'?'secondary':'outline'} aria-pressed={kind==='BANK_DEBIT'} className="h-auto min-h-12 justify-start whitespace-normal px-3 py-2 text-left" onClick={()=>setKind('BANK_DEBIT')}><span><span className="block font-medium">Se debitó del banco</span><span className="block text-xs font-normal text-muted-foreground">Aparece un retiro en el estado de cuenta.</span></span></Button>
        <Button type="button" variant={kind==='PROVIDER_WITHHOLDING'?'secondary':'outline'} aria-pressed={kind==='PROVIDER_WITHHOLDING'} disabled={!provider||providerEmpty} className="h-auto min-h-12 justify-start whitespace-normal px-3 py-2 text-left" onClick={()=>setKind('PROVIDER_WITHHOLDING')}><span><span className="block font-medium">El proveedor lo retuvo</span><span className="block text-xs font-normal text-muted-foreground">Se descontó antes de depositar el cobro.</span></span></Button>
        <Button id="dispute-movement-recovery" type="button" variant={kind==='BANK_RECOVERY'?'secondary':'outline'} aria-pressed={kind==='BANK_RECOVERY'} disabled={!recoverable} className="h-auto min-h-12 justify-start whitespace-normal px-3 py-2 text-left" onClick={()=>setKind('BANK_RECOVERY')}><span><span className="block font-medium">El banco devolvió el dinero</span><span className="block text-xs font-normal text-muted-foreground">Abono que recupera lo retirado ({money(String(Math.max(0,Number(doc.withdrawn)-Number(doc.recovered)).toFixed(2)))}).</span></span></Button>
      </div>{provider&&<p className="text-xs text-muted-foreground">Pendiente con el proveedor: {doc.providerPending!=null?money(doc.providerPending):'Requiere verificar el saldo original'}.{providerEmpty?' El cobro ya no tiene saldo por retener.':''}</p>}</fieldset>
      <div className="grid max-w-lg grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="dispute-movement-principal">Principal *</Label><Input id="dispute-movement-principal" disabled={disabled} inputMode="decimal" placeholder="0.00" value={principal} onChange={e=>setPrincipal(e.target.value)}/></div><div className="space-y-1"><Label htmlFor="dispute-movement-fee">Comisión</Label><Input id="dispute-movement-fee" disabled={disabled} inputMode="decimal" value={fee} onChange={e=>setFee(e.target.value)}/></div><p className="col-span-2 text-xs text-muted-foreground">La comisión se registra aparte del principal reclamado.</p></div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]"><div className="space-y-1"><Label htmlFor="dispute-movement-reference">Referencia *</Label><Input id="dispute-movement-reference" disabled={disabled} maxLength={255} value={reference} placeholder="N.º de movimiento" onChange={e=>setReference(e.target.value)}/></div><div className="space-y-1"><Label htmlFor="dispute-movement-day">Fecha del movimiento *</Label><Input id="dispute-movement-day" disabled={disabled} type="date" value={effectiveOn} onChange={e=>setEffectiveOn(e.target.value)}/></div></div>
      <details className="rounded-lg border px-3 py-2"><summary className="cursor-pointer text-sm">Soporte y fecha contable · opcional</summary><div className="mt-3 space-y-3"><div className="space-y-1"><Label htmlFor="dispute-movement-support">Identificador del soporte</Label><Input id="dispute-movement-support" disabled={disabled} maxLength={255} value={support} placeholder="Estado de cuenta, línea o expediente" onChange={e=>setSupport(e.target.value)}/></div><div className="max-w-48 space-y-1"><Label htmlFor="dispute-movement-accounting-day">Fecha contable</Label><Input id="dispute-movement-accounting-day" disabled={disabled} type="date" value={accountingDate} onChange={e=>setAccountingDate(e.target.value)}/></div><p className="text-xs text-muted-foreground">Por defecto se usa la fecha del movimiento. Con contabilidad activa debe pertenecer a un período abierto.</p>{dateDiff&&<div className="space-y-1"><Label htmlFor="dispute-movement-date-reason">Motivo del cambio de fecha *</Label><Input id="dispute-movement-date-reason" disabled={disabled} maxLength={1000} value={dateReason} onChange={e=>setDateReason(e.target.value)}/></div>}</div></details>
    </>}
    <div className="flex flex-wrap justify-end gap-2 border-t pt-3">{review&&<Button type="button" variant="outline" disabled={busy} onClick={()=>{setReview(false);setChecked(false)}}>Editar datos</Button>}<Button type="submit" disabled={disabled||stale||(review&&!checked)}>{busy?'Registrando…':review?'Confirmar movimiento':'Revisar movimiento'}</Button></div>
  </form><div className="hidden lg:block"><CashDisputeSummary doc={doc} locale={locale}/></div></div>
}
