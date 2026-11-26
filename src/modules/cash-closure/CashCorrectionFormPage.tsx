import {useRef,useState,type FormEvent} from 'react'
import {useNavigate,useParams} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {LoadingState} from '@/components/shared/LoadingState'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {fetchCorrectionContext,previewCorrection,proposeCorrection,type CorrectionContext,type CorrectionPreview,type CorrectionInput} from '@/services/cashCorrectionService'
import {useCorrectionIdentity} from './hooks/useCorrectionIdentity'
import {CashPageHeader,Notice} from './components/CashPageParts'
import {CorrectionLines,CashCorrectionSummary} from './components/CashCorrectionSummary'
import {todayIn} from './components/settlementParts'

export default function CashCorrectionFormPage(){const identity=useCorrectionIdentity(),{id}=useParams();return <CorrectionForm key={`${identity.key}:${id}`} />}
function CorrectionForm(){
  const {id=''}=useParams(),navigate=useNavigate(),identity=useCorrectionIdentity(),{scope,permissions,ready}=identity
  const [denied,setDenied]=useState(false)
  usePageTrail([{label:'Cierre de caja',to:'/cierre-caja'},{label:'Arqueo',to:`/cierre-caja/${id}`},{label:'Corregir declaración'}])
  const query=useQuery({queryKey:['cash-correction-context',id,identity.key],queryFn:({signal})=>fetchCorrectionContext(id,scope,signal),enabled:ready,retry:false,gcTime:0,refetchOnWindowFocus:false})
  return <div className="mx-auto w-full min-w-0 max-w-[1180px] space-y-4 p-4 sm:p-6"><CashPageHeader title="Corregir declaración" subtitle={!denied&&!query.isError&&query.data?`Arqueo #${query.data.closureNumber} · El original se conserva`:'Arqueo finalizado'} backLabel="Volver al arqueo" onBack={()=>navigate(`/cierre-caja/${id}`)} />
    {denied?<Notice role="alert">Ya no tienes acceso a esta corrección. Actualiza tu sesión antes de continuar.</Notice>:!ready?<Notice>Selecciona una sucursal y una sesión con permiso de consulta.</Notice>:query.isError?<Notice role="alert">{query.error.message}</Notice>:query.isPending?<LoadingState variant="detail" message="Cargando declaración…" />:!query.data?.can.propose?<Notice>{query.data?.issue||'No tienes permiso para proponer una corrección.'}</Notice>:<CorrectionEditor key={`${query.data.baseKey}:${permissions}`} context={query.data} onReload={()=>query.refetch()} onDenied={()=>setDenied(true)} />}
  </div>
}
export function CorrectionEditor({context,onReload,onDenied}:{context:CorrectionContext;onReload:()=>unknown;onDenied:()=>void}){
  const {id=''}=useParams(),navigate=useNavigate(),identity=useCorrectionIdentity(),{locale,timezone}=useSystemSettings()
  const [values,setValues]=useState<Record<number,string>>(()=>Object.fromEntries(context.lines.map(l=>[l.closurePaymentId,l.previousActual]))),[reason,setReason]=useState(''),[date,setDate]=useState(()=>todayIn(timezone)),[preview,setPreview]=useState<CorrectionPreview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[stale,setStale]=useState(false)
  const request=useRef<{content:string;input:CorrectionInput}|null>(null),saving=useRef(false),errorRef=useRef<HTMLDivElement>(null)
  const edit=(work:()=>void)=>{work();setPreview(null);setError(null);setStale(false);request.current=null}
  async function submit(event:FormEvent){
    event.preventDefault();if(saving.current)return
    const command={reason,accountingDate:date,previousCorrectionId:context.previousCorrectionId,lines:context.lines.map(l=>({closurePaymentId:l.closurePaymentId,correctedActual:values[l.closurePaymentId]}))},content=JSON.stringify(command)
    if(request.current?.content!==content)request.current={content,input:{...command,requestKey:crypto.randomUUID()}}
    const signal=identity.newSignal();saving.current=true;setBusy(true);setError(null)
    try{
      if(!preview){const result=await previewCorrection(id,request.current!.input,identity.scope,signal);if(!signal.aborted)setPreview(result)}
      else {const result=await proposeCorrection(id,{...request.current!.input,previewKey:preview.previewKey},identity.scope,signal);if(!signal.aborted)navigate(`/cierre-caja/${id}/correcciones/${result.id}`)}
    }catch(e){if(!signal.aborted){if([401,403,404].includes((e as {status?:number}).status||0)){onDenied();return}setError(e instanceof Error?e.message:'No se pudo completar la corrección');setStale((e as {status?:number}).status===409);requestAnimationFrame(()=>errorRef.current?.focus())}}
    finally{saving.current=false;if(!signal.aborted)setBusy(false)}
  }
  return <form onSubmit={submit} className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
    <section className="auna-surface min-w-0 space-y-4 rounded-lg border p-4">
      <div><h2 className="font-semibold">Importes correctos</h2><p className="text-xs text-muted-foreground">Cambia únicamente lo que se declaró mal. Los importes esperados se conservan.</p></div>
      {error&&<div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}{stale&&<Button type="button" variant="link" className="h-auto whitespace-normal px-0 text-left" onClick={()=>{request.current=null;void onReload()}}>Revisar la base actualizada y preparar otra propuesta</Button>}</div>}
      <CorrectionLines lines={preview?.lines||context.lines} values={values} onChange={(line,value)=>edit(()=>setValues(v=>({...v,[line]:value})))} disabled={busy} currency={context.currency} locale={locale} />
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]"><div className="space-y-1"><Label htmlFor="correction-reason">Motivo de la corrección *</Label><Textarea id="correction-reason" value={reason} required maxLength={1000} rows={2} disabled={busy} onChange={e=>edit(()=>setReason(e.target.value))} placeholder="Qué se declaró mal y cómo lo verificaste" /></div><div className="space-y-1"><Label htmlFor="correction-date">Fecha contable *</Label><Input id="correction-date" type="date" required value={date} disabled={busy} onChange={e=>edit(()=>setDate(e.target.value))} /></div></div>
      {preview&&<div className="lg:hidden"><CashCorrectionSummary currency={context.currency} locale={locale} cashDelta={preview.cashDelta} correctedDifference={preview.correctedDifference} accounting={preview.accounting} custodyComparison={preview.custodyComparison} /></div>}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" disabled={busy} onClick={()=>navigate(`/cierre-caja/${id}`)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy?'Procesando…':preview?'Enviar a revisión':'Revisar corrección'}</Button></div>
    </section>
    {preview?<div className="hidden lg:block"><CashCorrectionSummary currency={context.currency} locale={locale} cashDelta={preview.cashDelta} correctedDifference={preview.correctedDifference} accounting={preview.accounting} custodyComparison={preview.custodyComparison} /></div>:<aside className="auna-surface space-y-2 rounded-lg border p-4 text-sm"><h2 className="font-semibold">Antes de enviar</h2><p className="text-muted-foreground">1. Indica los importes correctos y el motivo.</p><p className="text-muted-foreground">2. Revisa el resultado.</p><p className="text-muted-foreground">3. Envía la propuesta para aprobación.</p><p className="border-t pt-2 text-xs text-muted-foreground">Esto no registra efectivo nuevo ni cambia una entrega ya confirmada.</p></aside>}
  </form>
}
