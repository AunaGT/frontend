import {useRef,useState} from 'react'
import {Link,useNavigate,useParams} from 'react-router-dom'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {Download} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Textarea} from '@/components/ui/textarea'
import {Label} from '@/components/ui/label'
import {LoadingState} from '@/components/shared/LoadingState'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {fetchCorrection,decideCorrection,cancelCorrection,correctionStatus,correctionAccountingStatus} from '@/services/cashCorrectionService'
import {useCorrectionIdentity} from './hooks/useCorrectionIdentity'
import {CashPageHeader,Notice} from './components/CashPageParts'
import {CorrectionLines,CashCorrectionSummary} from './components/CashCorrectionSummary'
import {civilDate,formatZonedDateTime} from './types'
import {downloadCorrectionPdf} from './documents/correctionPdf'

export default function CashCorrectionPage(){const identity=useCorrectionIdentity(true),{id,correctionId}=useParams();return <CorrectionView key={`${identity.key}:${id}:${correctionId}`} />}
function CorrectionView(){
  const {id='',correctionId=''}=useParams(),identity=useCorrectionIdentity(true),navigate=useNavigate(),cache=useQueryClient(),{locale,timezone,companyName}=useSystemSettings()
  const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),saving=useRef(false),request=useRef<{fingerprint:string;key:string}|null>(null)
  const [denied,setDenied]=useState(false)
  const key=['cash-correction',id,correctionId,identity.key]
  const query=useQuery({queryKey:key,queryFn:({signal})=>fetchCorrection(id,correctionId,identity.scope,signal),enabled:identity.ready,retry:false,gcTime:0,refetchOnWindowFocus:false})
  const doc=query.isError||denied?null:query.data
  usePageTrail([{label:'Cierre de caja',to:'/cierre-caja'},{label:'Arqueo',to:`/cierre-caja/${id}`},{label:'Corrección'}])
  async function decide(action:'APPROVE'|'REJECT'|'CANCEL'){
    if(!doc||saving.current)return
    const fingerprint=JSON.stringify([action,reason,doc.updatedAt]);if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,key:crypto.randomUUID()}
    saving.current=true;setBusy(true);setError(null);const signal=identity.newSignal()
    try{
      const body={requestKey:request.current!.key,expectedUpdatedAt:doc.updatedAt,reason}
      const updated=await (action==='CANCEL'?cancelCorrection(id,correctionId,body,identity.scope,signal):decideCorrection(id,correctionId,{...body,action},identity.scope,signal))
      if(!signal.aborted){cache.setQueryData(key,updated);await cache.invalidateQueries({queryKey:['cash-correction-context',id]})}
    }catch(e){if(!signal.aborted){if([401,403,404].includes((e as {status?:number}).status||0))setDenied(true);setError(e instanceof Error?e.message:'No se pudo guardar la decisión')}}
    finally{saving.current=false;if(!signal.aborted)setBusy(false)}
  }
  return <div className="mx-auto w-full min-w-0 max-w-[1180px] space-y-4 p-4 sm:p-6"><CashPageHeader title={doc?.sequence?`Corrección ${doc.sequence}`:'Propuesta de corrección'} subtitle={doc?`Arqueo #${doc.closureNumber}`:'Declaración de arqueo'} backLabel="Volver al arqueo" onBack={()=>navigate(`/cierre-caja/${id}`)} actions={doc&&<Button variant="outline" className="w-10 px-0 sm:w-auto sm:px-4" onClick={()=>{void downloadCorrectionPdf(doc,companyName,locale,timezone)}}><Download className="h-4 w-4 sm:mr-2" aria-hidden /><span className="sr-only sm:not-sr-only">Descargar PDF</span></Button>} />
    {denied?<Notice role="alert">Ya no tienes acceso a esta corrección. Actualiza tu sesión antes de continuar.</Notice>:!identity.ready?<Notice>Selecciona una sucursal y una sesión con permiso de consulta.</Notice>:query.isError?<Notice role="alert">{query.error.message}</Notice>:query.isPending?<LoadingState variant="detail" message="Cargando corrección…" />:doc&&<>
      <div className="flex flex-wrap gap-2"><Badge variant={doc.status==='REJECTED'?'destructive':'secondary'}>{correctionStatus[doc.status]}</Badge><Badge variant="outline">{correctionAccountingStatus[doc.accountingStatus]}</Badge>{doc.selfReview&&<Badge variant="outline">Autorrevisión autorizada</Badge>}</div>
      {doc.stale&&doc.status==='PENDING'&&<Notice>Otra corrección fue aprobada después de esta propuesta. Puedes cancelarla y preparar una nueva con la base actualizada.</Notice>}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="auna-surface min-w-0 space-y-4 rounded-lg border p-4"><CorrectionLines lines={doc.lines} currency={doc.currency} locale={locale} /><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Propuesta por</dt><dd>{doc.proposedByName} · {formatZonedDateTime(doc.proposedAt,timezone,locale)}</dd></div><div><dt className="text-xs text-muted-foreground">Fecha contable</dt><dd>{civilDate(doc.accountingDate,locale)}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Motivo</dt><dd className="whitespace-pre-wrap break-words">{doc.reason}</dd></div>{doc.decidedByName&&<div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Decisión</dt><dd>{doc.decidedByName} · {doc.decidedAt&&formatZonedDateTime(doc.decidedAt,timezone,locale)}{doc.decisionReason&&<p className="mt-1 whitespace-pre-wrap break-words">{doc.decisionReason}</p>}</dd></div>}{doc.entryNumber&&<div><dt className="text-xs text-muted-foreground">Asiento</dt><dd>{doc.entryNumber}</dd></div>}</dl>
        <div className="lg:hidden"><CashCorrectionSummary currency={doc.currency} locale={locale} cashDelta={doc.cashDelta} correctedDifference={doc.correctedDifference} accounting={doc.accounting} custodyComparison={doc.custodyComparison} /></div>
        {(doc.can.approve||doc.can.reject||doc.can.cancel)&&<div className="space-y-3 border-t pt-3">{doc.requiresSelfReviewReason&&<p className="text-xs text-muted-foreground">La excepción del dueño permite esta revisión propia. Debes explicar el motivo y quedará registrado.</p>}<div className="max-w-[640px] space-y-1"><Label htmlFor="correction-decision">Motivo de la decisión {doc.requiresSelfReviewReason?'*':'(obligatorio para rechazar o cancelar)'}</Label><Textarea id="correction-decision" rows={2} maxLength={1000} disabled={busy} value={reason} onChange={e=>setReason(e.target.value)} /></div>{error&&<p role="alert" className="text-sm text-destructive">{error} <Button variant="link" onClick={()=>query.refetch()}>Revisar estado actual</Button></p>}<div className="flex flex-wrap gap-2">{doc.can.approve&&<Button disabled={busy||doc.accounting?.status==='BLOCKED'||doc.requiresSelfReviewReason&&!reason.trim()} onClick={()=>decide('APPROVE')}>{busy?'Procesando…':'Aprobar corrección'}</Button>}{doc.can.reject&&<Button variant="outline" disabled={busy||!reason.trim()} onClick={()=>decide('REJECT')}>Rechazar</Button>}{doc.can.cancel&&<Button variant="outline" disabled={busy||!reason.trim()} onClick={()=>decide('CANCEL')}>Cancelar propuesta</Button>}</div></div>}
        <Link to={`/cierre-caja/${id}`} className="inline-block text-sm underline">Consultar el arqueo original</Link>
      </section><div className="hidden lg:block"><CashCorrectionSummary currency={doc.currency} locale={locale} cashDelta={doc.cashDelta} correctedDifference={doc.correctedDifference} accounting={doc.accounting} custodyComparison={doc.custodyComparison} /></div></div>
    </>}
  </div>
}
