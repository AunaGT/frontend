import {useEffect,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Pagination} from '@/components/shared/Pagination'
import {CollectionEmptyState} from '@/components/shared/CollectionEmptyState'
import {PdfDocumentPreview} from '@/components/shared/pdf/PdfDocumentPreview'
import {Input} from '@/components/ui/input'
import {Checkbox} from '@/components/ui/checkbox'
import {renderPrintSource} from '@/services/printRenderers'
import {usePrintJob} from './usePrintJob'
import {printRequest} from './api'
import type {HardwareScope,PrintJob} from './types'
import type {HardwarePage} from '../types'
const labels={CREATED:'Por preparar',PREPARED:'Preparado',DOWNLOAD_REQUESTED:'Descarga solicitada',FAILED:'No se pudo preparar'}
export function PrintHistory({scope}:{scope:HardwareScope}){
 const [page,setPage]=useState(1),[refresh,setRefresh]=useState(0),[reason,setReason]=useState(''),[selected,setSelected]=useState('')
 const [pdfOnly,setPdfOnly]=useState(false)
 const [state,setState]=useState<{key:string;data:HardwarePage<PrintJob>|null;error:string}>({key:'',data:null,error:''})
 const key=JSON.stringify([scope,page,refresh]),job=usePrintJob(scope,renderPrintSource)
 useEffect(()=>{const abort=new AbortController();setState({key,data:null,error:''});void printRequest<HardwarePage<PrintJob>>(scope,`/print-jobs?page=${page}&pageSize=10`,{signal:abort.signal}).then(data=>{if(!abort.signal.aborted)setState({key,data,error:''})}).catch(e=>{if(!abort.signal.aborted)setState({key,data:null,error:e.message})});return()=>abort.abort()},[key])
 const data=state.key===key?state.data:null
 return <section className="space-y-4"><p className="text-sm text-muted-foreground">Preparar o descargar no confirma impresión física. Las copias conservan los datos originales; nunca repiten un cobro.</p>{state.key===key&&state.error&&<p role="alert">{state.error}</p>}{data?.items.length?<><ul className="divide-y divide-border">{data.items.map(row=><li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong>{row.source.kind==='SALE_TICKET'?'Ticket de venta':'Etiquetas'} · {row.source.id.slice(0,8)}</strong><p className="text-xs text-muted-foreground">{labels[row.state]} · {row.destinationName||'PDF sin equipo'} · {new Date(row.createdAt).toLocaleString()}{row.parentId?' · Copia':''}</p></div>{row.capabilities?.reprint===true&&<Button variant="outline" size="sm" disabled={job.pending} onClick={()=>{setSelected(row.id);setReason('');setPdfOnly(false)}}>Preparar copia</Button>}</li>)}</ul><Pagination currentPage={data.page} totalPages={data.totalPages} totalItems={data.totalItems} pageSize={10} count={data.items.length} itemLabel="trabajos" onPageChange={setPage}/></>:data?<CollectionEmptyState compact title="Tus próximos documentos dejarán su huella" description="Aquí aparecerán los tickets y etiquetas que prepares con registro de impresión."/>:<p role="status">Cargando trabajos…</p>}{selected&&<div className="flex max-w-2xl flex-wrap items-end gap-2 border-t border-border pt-3"><label className="grid flex-1 gap-1 text-sm">Motivo de la copia<Input value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} /></label><label className="flex items-center gap-2 text-sm"><Checkbox checked={pdfOnly} disabled={job.pending} onCheckedChange={value=>setPdfOnly(value===true)}/>PDF sin equipo (conserva el documento original)</label><Button disabled={!reason.trim()||job.pending} onClick={()=>void job.retry(selected,reason,pdfOnly).then(ok=>{if(ok)setRefresh(n=>n+1)})}>Preparar copia</Button><Button variant="ghost" onClick={()=>setSelected('')}>Cancelar</Button></div>}{job.error&&<p role="alert" className="text-sm text-destructive">{job.error}</p>}{job.blob&&<PdfDocumentPreview pdf={job.blob} onDownload={()=>void job.download()}/>}</section>
}
