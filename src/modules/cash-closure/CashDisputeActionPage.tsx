import {useRef,useState} from 'react'
import {useNavigate,useParams,useSearchParams} from 'react-router-dom'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Label} from '@/components/ui/label'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {LoadingState} from '@/components/shared/LoadingState'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {toast} from '@/hooks/use-toast'
import {fetchDispute,previewDispute,proposeDispute,decideDispute,confirmDisputeEffect,linkLegacyDeduction,disputeStatus,disputeEventLabel,disputeLotLabel,type DisputeDocument,type DisputePreview} from '@/services/cashDisputeService'
import {useDisputeIdentity} from './hooks/useDisputeIdentity'
import {CashPageHeader,Notice} from './components/CashPageParts'
import {CashDisputeSummary} from './components/CashDisputeSummary'
import {CashDisputeMovementForm} from './components/CashDisputeMovementForm'
import {CashDisputeLegacyForm} from './components/CashDisputeLegacyForm'
import {ResolutionFields,resolutionPayload,emptyResolution,type ResolutionKind} from './components/CashDisputeResolutionFields'
import {civilDate,formatCurrency} from './types'
const kinds:Record<string,string>={resultado:'RESULT',presentar:'SUBMIT',cancelar:'CANCEL',reabrir:'REOPEN',resolver:'DISPOSITION',condonar:'FORGIVE',corregir:'CORRECT'}
const RESOLUTIONS=['DISPOSITION','FORGIVE','CORRECT']
export default function CashDisputeActionPage(){const identity=useDisputeIdentity(),{caseId,kind}=useParams();return <ActionView key={`${identity.key}:${caseId}:${kind}`}/>}
function ActionView(){
  const identity=useDisputeIdentity(),{caseId='',kind=''}=useParams(),navigate=useNavigate(),[denied,setDenied]=useState(false),{locale,timezone}=useSystemSettings(),cache=useQueryClient()
  const query=useQuery({queryKey:['cash-dispute',identity.key,caseId],queryFn:({signal})=>fetchDispute(caseId,identity.scope,signal),enabled:identity.ready&&!denied,retry:false,gcTime:0,refetchOnWindowFocus:false})
  const doc=query.isError||denied?null:query.data
  usePageTrail([{label:'Disputas bancarias',to:'/cierre-caja/disputas'},{label:doc?.providerReference||'Expediente',to:`/cierre-caja/disputas/${caseId}`},{label:kind==='revisar'?'Revisión':'Preparar acción'}])
  return <div className="mx-auto min-w-0 max-w-[1120px] space-y-4 p-4 sm:p-6"><CashPageHeader title={kind==='movimiento'?'Registrar movimiento del banco':kind==='deduccion'?'Vincular deducción histórica':kind==='revisar'?'Revisar propuesta':disputeEventLabel[kinds[kind]]||'Preparar resolución'} subtitle={doc?.providerReference||'Revisa el efecto antes de confirmar'} backLabel="Volver al expediente" onBack={()=>navigate(`/cierre-caja/disputas/${caseId}`)}/>
    {!identity.ready?<Notice>Selecciona una sucursal autorizada para esta acción.</Notice>:denied?<Notice role="alert">Ya no tienes acceso a este expediente.</Notice>:query.isError?<Notice role="alert">{query.error.message}</Notice>:query.isPending?<LoadingState variant="detail" message="Cargando revisión…"/>:doc&&(kind==='movimiento'?<CashDisputeMovementForm doc={doc} locale={locale} today={new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())} onRefresh={()=>query.refetch()} onConfirm={async input=>{
      const signal=identity.newSignal()
      try{const updated=await confirmDisputeEffect(doc.id,input,identity.scope,signal);if(!signal.aborted){cache.setQueryData(['cash-dispute',identity.key,doc.id],updated);toast({title:'Movimiento registrado',description:'El expediente conserva el retiro y su referencia.'});navigate(`/cierre-caja/disputas/${doc.id}`)}}
      catch(error){if(!signal.aborted&&[401,403,404].includes((error as {status?:number}).status||0))setDenied(true);throw error}
    }}/>:kind==='deduccion'?<CashDisputeLegacyForm doc={doc} locale={locale} onRefresh={()=>query.refetch()} onConfirm={async input=>{
      const signal=identity.newSignal()
      try{const updated=await linkLegacyDeduction(doc.id,input,identity.scope,signal);if(!signal.aborted){cache.setQueryData(['cash-dispute',identity.key,doc.id],updated);toast({title:'Deducción vinculada',description:'La liquidación original conserva su importe y asiento.'});navigate(`/cierre-caja/disputas/${doc.id}`)}}
      catch(error){if(!signal.aborted&&[401,403,404].includes((error as {status?:number}).status||0))setDenied(true);throw error}
    }}/>:<ActionForm doc={doc} kind={kind} onRefresh={()=>query.refetch()} onDenied={()=>setDenied(true)}/>)}
  </div>
}
function ActionForm({doc,kind,onRefresh,onDenied}:{doc:DisputeDocument;kind:string;onRefresh:()=>unknown;onDenied:()=>void}){
  const identity=useDisputeIdentity(),navigate=useNavigate(),cache=useQueryClient(),{locale}=useSystemSettings(),[params]=useSearchParams()
  const proposal=doc.proposals.find(p=>p.id===params.get('propuesta')),reviewing=kind==='revisar',action=kinds[kind]
  const [outcome,setOutcome]=useState('WON'),[resolution,setResolution]=useState({...emptyResolution,lotId:params.get('resolucion')||''}),[won,setWon]=useState(doc.claimed),[lost,setLost]=useState('0.00'),[reason,setReason]=useState(''),[selfReason,setSelfReason]=useState(''),[preview,setPreview]=useState<DisputePreview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[denied,setDenied]=useState(false)
  const saving=useRef(false),attempt=useRef<{fingerprint:string;key:string}|null>(null),errorRef=useRef<HTMLDivElement>(null)
  const money=(v:string)=>formatCurrency(v,doc.currencyCode,locale),canPrepare=doc.can.manage&&!denied,canReview=doc.can.resolve&&!denied
  const resolving=RESOLUTIONS.includes(action),payload=resolving?resolutionPayload(action as ResolutionKind,resolution,reason):action==='RESULT'?{reason,won,lost}:{reason},freshPreview=preview?.version===doc.version?preview:null
  const p=proposal?.payload||{},needsCharge=proposal?.kind==='DISPOSITION'&&Number(p.customerPrincipal||0)>0||(['FORGIVE','CORRECT'].includes(proposal?.kind||'')&&p.lotKind!=='ABSORBED'),needsAdjust=['FORGIVE','CORRECT'].includes(proposal?.kind||'')
  const missingAuthority=reviewing&&((needsCharge&&!doc.can.charge)||(needsAdjust&&!doc.can.adjust))
  const plan=(freshPreview?.payload?.plan||null) as {retired:string;charged:string;absorbed:string}|null
  async function run(operation:'PREVIEW'|'PROPOSE'|'APPROVE'|'REJECT'){
    if(saving.current||denied)return
    const allowed=operation==='APPROVE'||operation==='REJECT'?canReview:canPrepare
    if(!allowed)return
    if(!reason.trim()&&operation!=='APPROVE'){setError('Indica el motivo antes de continuar.');requestAnimationFrame(()=>errorRef.current?.focus());return}
    if(!payload&&!reviewing){setError('Revisa los importes: usa hasta dos decimales y elige la resolución.');requestAnimationFrame(()=>errorRef.current?.focus());return}
    saving.current=true;setBusy(true);setError('');const signal=identity.newSignal()
    const fingerprint=JSON.stringify([operation,payload,proposal?.id,doc.version,selfReason]);if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()}
    try{
      if(operation==='PREVIEW'){const result=await previewDispute(doc.id,{kind:action,payload:payload!,expectedVersion:doc.version},identity.scope,signal);if(!signal.aborted)setPreview(result)}
      else if(operation==='PROPOSE'){
        if(!freshPreview)return
        await proposeDispute(doc.id,{kind:action,payload:payload!,expectedVersion:doc.version,previewKey:freshPreview.previewKey,requestKey:attempt.current!.key},identity.scope,signal)
        if(!signal.aborted)navigate(`/cierre-caja/disputas/${doc.id}`)
      }else if(proposal){
        const result=await decideDispute(doc.id,proposal.id,{decision:operation==='APPROVE'?'APPROVE':'REJECT',expectedVersion:doc.version,reason:reason.trim()||undefined,selfReviewReason:selfReason.trim()||undefined,requestKey:attempt.current!.key},identity.scope,signal)
        if(!signal.aborted){cache.setQueryData(['cash-dispute',identity.key,doc.id],result);navigate(`/cierre-caja/disputas/${doc.id}`)}
      }
    }catch(cause){if(!signal.aborted){const status=(cause as {status?:number}).status;if([401,403,404].includes(status||0)){setDenied(true);onDenied()};if(status===409)setPreview(null);setError(cause instanceof Error?cause.message:'No se pudo completar la acción');requestAnimationFrame(()=>errorRef.current?.focus())}}
    finally{saving.current=false;if(!signal.aborted)setBusy(false)}
  }
  if(denied)return <Notice role="alert">Ya no tienes acceso a esta operación. Actualiza tu sesión antes de continuar.</Notice>
  if(reviewing&&!proposal)return <Notice role="alert">La propuesta no pertenece a este expediente o ya no está disponible.</Notice>
  if(!reviewing&&!action)return <Notice role="alert">Esta acción no está disponible. Vuelve al expediente para elegir una opción válida.</Notice>
  return <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="auna-surface min-w-0 space-y-4 rounded-lg border p-4">
    {error&&<div role="alert" ref={errorRef} tabIndex={-1} className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" onClick={()=>{setPreview(null);onRefresh()}}>Revisar estado actual</Button></div>}
    {!canPrepare&&!canReview&&<Notice>Por el momento puedes consultar esta propuesta. Las decisiones todavía no están habilitadas.</Notice>}
    {reviewing&&proposal?<><h2 className="font-semibold">{disputeEventLabel[proposal.kind]||'Propuesta de resolución'}</h2><p className="whitespace-pre-wrap break-words text-sm">{proposal.payload.reason}</p><p className="text-xs text-muted-foreground">Preparada por {proposal.proposed_by_name} · Versión {proposal.expected_version}</p>{proposal.payload.won!=null&&<dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm"><div><dt className="text-muted-foreground">Parte ganada</dt><dd className="font-semibold">{money(proposal.payload.won)}</dd></div><div><dt className="text-muted-foreground">Parte perdida</dt><dd className="font-semibold">{money(proposal.payload.lost)}</dd></div></dl>}{RESOLUTIONS.includes(proposal.kind)&&<dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">{proposal.kind==='DISPOSITION'?<><div><dt className="text-muted-foreground">Cobrar al cliente</dt><dd className="font-semibold">{money(p.customerPrincipal||'0')}</dd></div><div><dt className="text-muted-foreground">Asume la empresa</dt><dd className="font-semibold">{money(p.absorbedPrincipal||'0')}</dd></div>{p.planCharged!=null&&<div className="col-span-2 border-t pt-2"><dt className="text-muted-foreground">Efecto al aprobar</dt><dd className="mt-1 space-y-0.5"><p>Saldo del recibo cancelado: {money(p.planRetired||'0')}</p><p className="font-semibold">El cliente deberá {money(p.planCharged)} adicionales</p><p>Pérdida asumida por la empresa: {money(p.planAbsorbed||'0')}</p></dd></div>}{p.dueOn&&<div className="col-span-2"><dt className="text-muted-foreground">Vencimiento del cargo</dt><dd>{civilDate(p.dueOn,locale)}</dd></div>}</>:<><div><dt className="text-muted-foreground">Resolución</dt><dd className="font-semibold">{disputeLotLabel[p.lotKind as keyof typeof disputeLotLabel]||'Resolución'}</dd></div><div><dt className="text-muted-foreground">Principal</dt><dd className="font-semibold">{money(p.amount||'0')}</dd></div></>}</dl>}
      {missingAuthority&&<Notice>Aprobar esta propuesta requiere {needsAdjust?'permiso de ajustes de cartera y ':''}permiso de cargos por disputa.</Notice>}
      {proposal.expected_version!==doc.version&&<Notice role="alert">El expediente cambió después de esta propuesta. Prepara una revisión con la base actualizada.</Notice>}</>:<>
      {action==='RESULT'&&<><div className="max-w-72 space-y-1"><Label>Resultado comunicado por el proveedor</Label><Select value={outcome} disabled={busy||!canPrepare} onValueChange={v=>{setOutcome(v);setWon(v==='WON'?doc.claimed:v==='LOST'?'0.00':'');setLost(v==='LOST'?doc.claimed:v==='WON'?'0.00':'');setPreview(null)}}><SelectTrigger aria-label="Resultado del reclamo"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="WON">Ganado por completo</SelectItem><SelectItem value="LOST">Perdido por completo</SelectItem><SelectItem value="PARTIAL">Resultado parcial</SelectItem></SelectContent></Select></div>{outcome==='PARTIAL'&&<div className="grid max-w-md grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="dispute-won">Parte ganada</Label><Input id="dispute-won" disabled={busy||!canPrepare} inputMode="decimal" value={won} onChange={e=>{setWon(e.target.value);setPreview(null)}}/></div><div className="space-y-1"><Label htmlFor="dispute-lost">Parte perdida</Label><Input id="dispute-lost" disabled={busy||!canPrepare} inputMode="decimal" value={lost} onChange={e=>{setLost(e.target.value);setPreview(null)}}/></div><p className="col-span-2 text-xs text-muted-foreground">Ambas partes deben sumar {money(doc.claimed)}.</p></div>}<p className="text-sm text-muted-foreground">Este resultado no confirma una devolución del banco ni autoriza un cargo al cliente.</p></>}
      {resolving&&<ResolutionFields kind={action as ResolutionKind} doc={doc} value={resolution} disabled={busy||!canPrepare} money={money} onChange={v=>{setResolution(v);setPreview(null)}}/>}
      {freshPreview&&<div className="rounded-lg border p-3 text-sm"><h2 className="font-semibold">Así quedará el expediente</h2>{freshPreview.before.status!==freshPreview.after.status&&<p className="mt-2">{disputeStatus[freshPreview.before.status]} → {disputeStatus[freshPreview.after.status]}</p>}{action==='RESULT'&&<p className="mt-1 text-muted-foreground">Ganado {money(freshPreview.after.won)} · Perdido {money(freshPreview.after.lost)}</p>}{plan&&<ul className="mt-2 space-y-1 text-muted-foreground"><li>Saldo del recibo cancelado: {money(plan.retired)}</li><li className="font-medium text-foreground">El cliente deberá {money(plan.charged)} adicionales{typeof freshPreview.payload.dueOn==='string'&&` · vence ${civilDate(freshPreview.payload.dueOn,locale)}`}</li><li>Pérdida asumida por la empresa: {money(plan.absorbed)}</li></ul>}{action!=='DISPOSITION'&&resolving&&<p className="mt-1 text-muted-foreground">Se compensan {money(String(freshPreview.payload.amount??'0'))} de la resolución elegida.</p>}<p className="mt-2">Cargo al cliente: {money(freshPreview.after.charged)}</p></div>}
    </>}
    <div className="space-y-1"><Label htmlFor="dispute-action-reason">{reviewing?'Motivo de la decisión':resolving?'Motivo de la resolución':'Motivo y referencia del resultado'}{reviewing?' (obligatorio para rechazar)':' *'}</Label><Textarea id="dispute-action-reason" rows={3} maxLength={1000} value={reason} disabled={busy||!(canPrepare||canReview)} onChange={e=>{setReason(e.target.value);setPreview(null)}}/></div>
    {reviewing&&canReview&&doc.ownerSelfReviewEnabled&&<details className="rounded-lg border px-3 py-2"><summary className="cursor-pointer text-sm">Revisión excepcional del dueño</summary><div className="mt-2 space-y-1"><Label htmlFor="dispute-self-reason">Motivo de la revisión propia</Label><Textarea id="dispute-self-reason" disabled={busy} rows={2} maxLength={1000} value={selfReason} onChange={e=>setSelfReason(e.target.value)}/><p className="text-xs text-muted-foreground">Solo se admite si la empresa habilitó expresamente esta excepción. Ser administrador no la activa.</p></div></details>}
    <div className="lg:hidden"><CashDisputeSummary doc={doc} locale={locale}/></div>
    <div className="flex flex-wrap justify-end gap-2 border-t pt-3">{!reviewing&&<Button variant="outline" onClick={()=>navigate(`/cierre-caja/disputas/${doc.id}`)}>Volver</Button>}{reviewing?<><Button variant="outline" disabled={!canReview||busy||!reason.trim()||proposal?.status!=='PENDING'} onClick={()=>run('REJECT')}>Rechazar</Button><Button aria-label="Aprobar propuesta" disabled={!canReview||busy||missingAuthority||proposal?.status!=='PENDING'||proposal.expected_version!==doc.version} onClick={()=>run('APPROVE')}>Aprobar</Button></>:<Button disabled={!canPrepare||busy} onClick={()=>run(freshPreview?'PROPOSE':'PREVIEW')}>{busy?'Procesando…':freshPreview?'Enviar a revisión':'Revisar efecto'}</Button>}</div>
  </section><div className="hidden lg:block"><CashDisputeSummary doc={doc} locale={locale}/></div></div>
}
