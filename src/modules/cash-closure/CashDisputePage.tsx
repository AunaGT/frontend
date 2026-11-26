import {useState} from 'react'
import {Link,useNavigate,useParams} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Input} from '@/components/ui/input'
import {ModuleTabBar} from '@/components/shared/ModuleTabs'
import {LoadingState} from '@/components/shared/LoadingState'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {fetchDispute,disputeStatus,disputeEventLabel,disputeLotLabel,uploadDisputeEvidence,openDisputeEvidence,postDisputeSources} from '@/services/cashDisputeService'
import {toast} from '@/hooks/use-toast'
import {useQueryClient} from '@tanstack/react-query'
import {useDisputeIdentity} from './hooks/useDisputeIdentity'
import {CashPageHeader,Notice,Detail} from './components/CashPageParts'
import {CashDisputeSummary} from './components/CashDisputeSummary'
import {CashDisputeAccounting} from './components/CashDisputeAccounting'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {civilDate,formatCurrency,formatZonedDateTime} from './types'
const tabs=[{value:'case',label:'Reclamo'},{value:'money',label:'Dinero'},{value:'resolution',label:'Resoluciones'},{value:'accounting',label:'Contabilidad'},{value:'history',label:'Historial'}] as const
export default function CashDisputePage(){const identity=useDisputeIdentity(true),{caseId}=useParams();return <DisputeDetail key={`${identity.key}:${caseId}`}/>}
function DisputeDetail(){
  const {hasPermission}=useAuthPermissions()
  const {caseId=''}=useParams(),identity=useDisputeIdentity(true),navigate=useNavigate(),{locale,timezone}=useSystemSettings(),[tab,setTab]=useState<(typeof tabs)[number]['value']>('case')
  const query=useQuery({queryKey:['cash-dispute',identity.key,caseId],queryFn:({signal})=>fetchDispute(caseId,identity.scope,signal),enabled:identity.ready,retry:false,gcTime:0,refetchOnWindowFocus:false})
  const doc=query.isError?null:query.data,money=(v:string)=>formatCurrency(v,doc?.currencyCode||'GTQ',locale)
  usePageTrail([{label:'Disputas bancarias',to:'/cierre-caja/disputas'},{label:doc?.providerReference||'Expediente'}])
  const {companyName,companyLogoUrl}=useSystemSettings(),[pdfPending,setPdfPending]=useState(false),[posting,setPosting]=useState(false)
  // Registro contable tardío: una sola petición a la vez; el servidor exige permiso contable y contabiliza en orden.
  async function postPending(){
    if(!doc||posting)return
    setPosting(true);const signal=identity.newSignal()
    try{await postDisputeSources(doc.id,identity.scope,signal);if(!signal.aborted){await query.refetch();toast({title:'Fuentes contabilizadas',description:'Cada movimiento conserva su asiento y fecha contable.'})}}
    catch(error){if(!signal.aborted)toast({variant:'destructive',title:'No se pudo contabilizar',description:error instanceof Error?error.message:'Revisa el estado contable del expediente.'})}
    finally{if(!signal.aborted)setPosting(false)}
  }
  const resolvable=!!doc&&doc.can.manage&&['PARTIALLY_LOST','LOST'].includes(doc.status)&&Number(doc.unresolved)>0
  // El PDF usa el expediente ya cargado en esta vista: no vuelve a consultar ni sale de este contexto.
  async function downloadPdf(){
    if(!doc)return
    setPdfPending(true)
    try{const [{downloadDisputePdf},{resolvePdfLogoDataUrl}]=await Promise.all([import('./documents/disputePdf'),import('@/utils/pdfBranding')]);downloadDisputePdf(doc,{companyName,logoDataUrl:await resolvePdfLogoDataUrl(companyLogoUrl),locale,timezone})}
    finally{setPdfPending(false)}
  }
  return <div className="mx-auto w-full min-w-0 max-w-[1200px] space-y-4 p-4 sm:p-6"><CashPageHeader title={doc?`Disputa ${doc.providerReference}`:'Disputa bancaria'} subtitle={doc?.customerName||'Seguimiento del reclamo y sus movimientos'} backLabel="Volver a disputas" onBack={()=>navigate('/cierre-caja/disputas')} actions={doc&&<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pdfPending} onClick={downloadPdf}>{pdfPending?'Preparando PDF…':'PDF del expediente'}</Button>{doc.can.manage&&doc.status!=='CANCELLED'&&<Button onClick={()=>navigate(`/cierre-caja/disputas/${doc.id}/acciones/${['OPEN','SUBMITTED'].includes(doc.status)?'resultado':'reabrir'}`)}>{['OPEN','SUBMITTED'].includes(doc.status)?'Registrar resultado':'Reabrir expediente'}</Button>}</div>}/>
    {!identity.ready?<Notice>Selecciona una empresa y una sucursal autorizadas.</Notice>:query.isError?<Notice role="alert">{query.error.message}</Notice>:query.isPending?<LoadingState variant="detail" message="Cargando expediente…"/>:doc&&<>
      <div className="flex flex-wrap gap-2"><Badge variant="outline">{disputeStatus[doc.status]}</Badge>{Number(doc.withdrawn)>Number(doc.recovered)&&doc.status==='WON'&&<Badge variant="secondary">Pendiente de recuperación bancaria</Badge>}</div>
      <ModuleTabBar items={tabs} value={tab} onValueChange={setTab} ariaLabel="Contenido del expediente"/>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="auna-surface min-w-0 space-y-4 rounded-lg border p-4">
        {tab==='case'&&<><h2 className="text-base font-semibold">Datos del reclamo</h2><dl className="grid gap-4 text-sm sm:grid-cols-2"><Detail label="Principal reclamado">{money(doc.claimed)}</Detail><Detail label="Plazo de respuesta">{doc.deadline?civilDate(doc.deadline,locale):'Sin plazo registrado'}</Detail><Detail label="Registrado por">{doc.createdByName}</Detail><Detail label="Registro">{formatZonedDateTime(doc.createdAt,timezone,locale)}</Detail><div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Motivo</dt><dd className="mt-1 whitespace-pre-wrap break-words">{doc.reason}</dd></div></dl>{doc.replacesCaseId&&<Link className="block text-sm underline" to={`/cierre-caja/disputas/${doc.replacesCaseId}`}>Consultar expediente anterior</Link>}{doc.replacedByCaseId&&<Link className="block text-sm underline" to={`/cierre-caja/disputas/${doc.replacedByCaseId}`}>Consultar expediente corregido</Link>}<DisputeEvidence doc={doc} scope={identity.scope} queryKey={['cash-dispute',identity.key,caseId]} locale={locale} timezone={timezone}/><p className="border-t pt-3 text-sm text-muted-foreground">El resultado del reclamo, los movimientos del banco y la decisión de cobrar al cliente se registran por separado.</p></>}
        {tab==='money'&&<><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">Movimientos del banco y proveedor</h2>{doc.can.movements&&doc.status!=='CANCELLED'&&<div className="flex flex-wrap gap-2">{!!doc.legacyDeductions?.length&&<Button size="sm" variant="outline" asChild><Link to={`/cierre-caja/disputas/${doc.id}/acciones/deduccion`}>Vincular deducción histórica</Link></Button>}<Button size="sm" asChild><Link to={`/cierre-caja/disputas/${doc.id}/acciones/movimiento`}>Registrar movimiento</Link></Button></div>}</div>{!!doc.legacyDeductions?.length&&<Notice>Una liquidación anterior ya descontó un contracargo de este cobro. Vincúlala al expediente antes de registrar otro retiro.</Notice>}{doc.history.filter(e=>Number(e.principal)>0||Number(e.fee)>0).map(e=><article key={e.id} className="flex flex-wrap justify-between gap-2 border-b pb-3 text-sm"><div><p className="font-medium">{disputeEventLabel[e.kind]||'Movimiento del expediente'}</p><p className="text-xs text-muted-foreground">{e.economic_on&&civilDate(e.economic_on,locale)}{e.reference&&` · ${e.reference}`}</p></div><div className="text-right"><p className="font-medium tabular-nums">{money(e.principal)}</p>{Number(e.fee)>0&&<p className="text-xs text-muted-foreground">Comisión {money(e.fee)}</p>}</div></article>)}{!doc.history.some(e=>Number(e.principal)>0||Number(e.fee)>0)&&<p className="text-sm text-muted-foreground">Todavía no hay retiros ni recuperaciones registrados. El reclamo por sí solo no mueve dinero.</p>}</>}
        {tab==='resolution'&&<><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">Propuestas y decisiones</h2>{resolvable&&<Button size="sm" asChild><Link to={`/cierre-caja/disputas/${doc.id}/acciones/resolver`}>Resolver pérdida</Link></Button>}</div>{!!doc.lots?.length&&<ul className="divide-y rounded-lg border text-sm">{doc.lots.map(l=><li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><div className="min-w-0"><p className="font-medium">{disputeLotLabel[l.kind]}{l.chargeReference&&` · ${l.chargeReference}`}</p><p className="text-xs text-muted-foreground">{l.kind==='CUSTOMER_CHARGE'?`Pendiente de pago ${money(l.outstanding??'0')} de ${money(l.remaining)}`:`Vigente ${money(l.remaining)}`}</p></div>{doc.can.manage&&doc.status!=='CANCELLED'&&<div className="flex gap-2">{l.kind==='CUSTOMER_CHARGE'&&Number(l.outstanding)>0&&<Button size="sm" variant="outline" asChild><Link to={`/cierre-caja/disputas/${doc.id}/acciones/condonar?resolucion=${encodeURIComponent(l.id)}`}>Condonar</Link></Button>}<Button size="sm" variant="ghost" asChild><Link to={`/cierre-caja/disputas/${doc.id}/acciones/corregir?resolucion=${encodeURIComponent(l.id)}`}>Corregir</Link></Button></div>}</li>)}</ul>}{!doc.proposals.length?<p className="text-sm text-muted-foreground">Todavía no se ha propuesto una resolución.</p>:doc.proposals.map(p=><article key={p.id} className="space-y-2 border-b pb-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{disputeEventLabel[p.kind]||'Resolución'}</h3><Badge variant="outline">{{PENDING:'Pendiente de revisión',APPROVED:'Aprobada',REJECTED:'Rechazada',CANCELLED:'Cancelada'}[p.status]||p.status}</Badge></div><p className="text-muted-foreground">{p.proposed_by_name} · {formatZonedDateTime(p.proposed_at,timezone,locale)}</p>{typeof p.payload.reason==='string'&&<p className="whitespace-pre-wrap break-words">{p.payload.reason}</p>}<Button variant="outline" size="sm" asChild><Link to={`/cierre-caja/disputas/${doc.id}/acciones/revisar?propuesta=${encodeURIComponent(p.id)}`}>Consultar revisión</Link></Button></article>)}</>}
        {tab==='accounting'&&<CashDisputeAccounting accounting={doc.accounting} locale={locale} canViewSettlement={identity.scope.branchId!=='all'&&hasPermission('cash.settlements.manage')} onPost={doc.can.post&&identity.scope.branchId!=='all'?postPending:undefined} posting={posting}/>}
        {tab==='history'&&<><h2 className="text-base font-semibold">Historial del expediente</h2><ol className="space-y-4">{doc.history.map(e=><li key={e.id} className="border-l-2 border-border pl-3 text-sm"><p className="font-medium">{disputeEventLabel[e.kind]||'Actualización'}</p><p className="text-xs text-muted-foreground">{formatZonedDateTime(e.created_at,timezone,locale)} · {e.actor_name}</p>{typeof e.payload?.reason==='string'&&<p className="mt-1 whitespace-pre-wrap break-words">{e.payload.reason}</p>}</li>)}</ol></>}
      </section><CashDisputeSummary doc={doc} locale={locale}/></div>
    </>}
  </div>
}

// Soportes privados del expediente: se abren con un enlace firmado de un minuto, nunca con una ruta pública.
function DisputeEvidence({doc,scope,queryKey,locale,timezone}:{doc:import('@/services/cashDisputeService').DisputeDocument;scope:import('@/services/cashDisputeService').DisputeScope;queryKey:unknown[];locale?:string;timezone?:string}){
  const items=doc.history.filter(e=>e.kind==='EVIDENCE'),canAdd=(doc.can.manage||doc.can.movements)&&doc.status!=='CANCELLED',client=useQueryClient()
  const [file,setFile]=useState<{file:File;key:string}|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState('')
  async function open(id:string){setBusy(id);setError('');try{const {url}=await openDisputeEvidence(doc.id,id,scope);window.open(url,'_blank','noopener,noreferrer')}catch(e){setError((e as Error).message)}finally{setBusy('')}}
  async function add(){if(!file)return;setBusy('upload');setError('');try{client.setQueryData(queryKey,await uploadDisputeEvidence(doc.id,file.file,file.key,scope));setFile(null)}catch(e){setError((e as Error).message)}finally{setBusy('')}}
  if(!items.length&&!canAdd)return null
  return <section aria-label="Soporte del expediente" className="space-y-2 border-t pt-3"><h3 className="text-sm font-semibold">Soporte</h3>
    {items.length?<ul className="divide-y text-sm">{items.map(e=>{const p=e.payload as Record<string,string>;return <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><div className="min-w-0"><p className="truncate font-medium">{p.fileName||'Soporte'}</p><p className="text-xs text-muted-foreground">{e.actor_name} · {formatZonedDateTime(e.created_at,timezone,locale)}{p.fileSize?` · ${Math.ceil(Number(p.fileSize)/1024)} KB`:''}</p></div><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>open(e.id)}>{busy===e.id?'Abriendo…':'Abrir'}</Button></li>})}</ul>:<p className="text-sm text-muted-foreground">Todavía no hay archivos de soporte.</p>}
    {canAdd&&<div className="flex flex-wrap items-center gap-2"><Input aria-label="Archivo de soporte" type="file" accept="application/pdf,image/png,image/jpeg" className="max-w-sm text-sm" onChange={e=>{const f=e.target.files?.[0];setFile(f?{file:f,key:crypto.randomUUID()}:null)}}/><Button size="sm" disabled={!file||!!busy} onClick={add}>{busy==='upload'?'Agregando…':'Agregar soporte'}</Button><p className="w-full text-xs text-muted-foreground">PDF, PNG o JPG de hasta 5 MB. Se guarda en almacenamiento privado.</p></div>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
