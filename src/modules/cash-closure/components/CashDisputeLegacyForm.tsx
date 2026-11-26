import {useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Notice} from './CashPageParts'
import {CashDisputeSummary} from './CashDisputeSummary'
import {civilDate,formatCurrency} from '../types'
import type {DisputeDocument,LegacyDeductionInput} from '@/services/cashDisputeService'

type Props={doc:DisputeDocument;locale:string;onConfirm:(input:LegacyDeductionInput)=>Promise<void>;onRefresh:()=>unknown}
/** Vincula al expediente una deducción de contracargo de una liquidación anterior: por su importe exacto, sin otro retiro. */
export function CashDisputeLegacyForm({doc,locale,onConfirm,onRefresh}:Props){
  const deductions=doc.legacyDeductions||[]
  const [deductionId,setDeductionId]=useState(deductions.length===1?deductions[0].id:''),[reference,setReference]=useState('')
  const [accountingDate,setAccountingDate]=useState(''),[dateReason,setDateReason]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[stale,setStale]=useState(false)
  const pending=useRef(false),attempt=useRef<{fingerprint:string;key:string}|null>(null),errorRef=useRef<HTMLDivElement>(null)
  const allowed=doc.can.movements&&doc.status!=='CANCELLED',disabled=!allowed||busy
  const chosen=deductions.find(d=>d.id===deductionId),money=(v:string)=>formatCurrency(v,doc.currencyCode,locale)
  const dateDiff=!!accountingDate&&!!chosen?.depositedOn&&accountingDate!==chosen.depositedOn
  function showError(message:string){setError(message);requestAnimationFrame(()=>errorRef.current?.focus())}
  async function submit(event:React.FormEvent){
    event.preventDefault();if(disabled||pending.current||stale)return
    if(!chosen){showError('Selecciona la deducción de la liquidación original.');return}
    if(!reference.trim()){showError('Indica la referencia de la deducción.');return}
    if(dateDiff&&!dateReason.trim()){showError('Explica por qué la fecha contable es diferente de la liquidación.');return}
    const input={deductionId:chosen.id,principal:chosen.amount,reference:reference.trim(),expectedVersion:doc.version,...(accountingDate?{accountingDate}:{}),...(dateDiff?{dateChangeReason:dateReason.trim()}:{})}
    const fingerprint=JSON.stringify(input)
    if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()}
    pending.current=true;setBusy(true);setError('')
    try{await onConfirm({...input,requestKey:attempt.current.key})}
    catch(cause){if((cause as {name?:string}).name!=='AbortError'){if((cause as {status?:number}).status===409)setStale(true);showError(cause instanceof Error?cause.message:'No se pudo vincular la deducción. Conservamos los datos para reintentar.')}}
    finally{pending.current=false;setBusy(false)}
  }
  return <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><form onSubmit={submit} className="auna-surface min-w-0 space-y-4 rounded-lg border p-4">
    {!allowed&&<Notice>Esta pantalla está en modo de solo consulta. Vincular deducciones todavía no está habilitado.</Notice>}
    {error&&<div ref={errorRef} role="alert" tabIndex={-1} className="space-y-2 text-sm text-destructive"><p>{error}</p>{stale&&<Button type="button" variant="outline" size="sm" onClick={async()=>{await onRefresh();setStale(false)}}>Revisar estado actual</Button>}</div>}
    <fieldset disabled={disabled} className="space-y-2"><legend className="mb-2 font-semibold">Deducción de la liquidación original</legend>
      {!deductions.length?<p className="text-sm text-muted-foreground">No hay contracargos de liquidaciones anteriores pendientes de vincular a este cobro.</p>
        :<div className="grid gap-2 sm:grid-cols-2">{deductions.map(d=><Button key={d.id} id={`dispute-legacy-${d.id}`} type="button" disabled={disabled} variant={deductionId===d.id?'secondary':'outline'} aria-pressed={deductionId===d.id} className="h-auto min-h-12 justify-start whitespace-normal px-3 py-2 text-left" onClick={()=>setDeductionId(d.id)}>
          <span><span className="block font-medium tabular-nums">{money(d.amount)}</span><span className="block text-xs font-normal text-muted-foreground">Depósito {d.reference||'sin referencia'}{d.depositedOn&&` · ${civilDate(d.depositedOn,locale)}`}</span></span></Button>)}</div>}
    </fieldset>
    <div className="space-y-1"><Label htmlFor="dispute-legacy-reference">Referencia *</Label><Input id="dispute-legacy-reference" disabled={disabled} maxLength={255} value={reference} placeholder="Como aparece en la liquidación" onChange={e=>setReference(e.target.value)}/></div>
    <details className="rounded-lg border px-3 py-2"><summary className="cursor-pointer text-sm">Fecha contable · opcional</summary><div className="mt-3 space-y-3"><div className="max-w-48 space-y-1"><Label htmlFor="dispute-legacy-accounting-day">Fecha contable</Label><Input id="dispute-legacy-accounting-day" disabled={disabled} type="date" value={accountingDate} onChange={e=>setAccountingDate(e.target.value)}/></div><p className="text-xs text-muted-foreground">Por defecto se usa la fecha del depósito original.</p>{dateDiff&&<div className="space-y-1"><Label htmlFor="dispute-legacy-date-reason">Motivo del cambio de fecha *</Label><Input id="dispute-legacy-date-reason" disabled={disabled} maxLength={1000} value={dateReason} onChange={e=>setDateReason(e.target.value)}/></div>}</div></details>
    <p className="text-sm text-muted-foreground">Se vincula el importe completo de la deducción. La liquidación original y su depósito no cambian; solo se reclasifica el gasto a fondos en disputa.</p>
    <div className="flex justify-end border-t pt-3"><Button type="submit" disabled={disabled||stale||!deductions.length}>{busy?'Vinculando…':'Vincular deducción'}</Button></div>
  </form><div className="hidden lg:block"><CashDisputeSummary doc={doc} locale={locale}/></div></div>
}
