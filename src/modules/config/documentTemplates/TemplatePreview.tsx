import {PdfDocumentPreview} from '@/components/shared/pdf/PdfDocumentPreview'
import {assertTemplateScope} from './api'
import type {ReactNode} from 'react'
import type {TemplateScope} from './types'
export function downloadDocumentBlob(scope:TemplateScope,blob:Blob,filename:string){
  assertTemplateScope(scope)
  const url=URL.createObjectURL(blob),anchor=document.createElement('a')
  anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export function TemplatePreview({scope,pdf,pending,stale,actions}:{scope:TemplateScope;pdf:Blob|null;pending:boolean;stale:boolean;actions?:ReactNode}){
  return <section className="document-template-preview" aria-label="Vista previa del documento" aria-busy={pending}>
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><h2 className="font-semibold">Vista previa real</h2><span className="text-xs text-muted-foreground">Muestra · Sin validez fiscal</span></div>
    {actions&&<div className="document-template-preview-actions">{actions}</div>}
    {pending&&<p role="status">Preparando el PDF en segundo plano…</p>}
    {stale&&pdf&&<p role="status" className="text-sm mb-3">El diseño cambió. Genera otra muestra para ver los cambios.</p>}
    {pdf?<PdfDocumentPreview pdf={pdf} onDownload={()=>downloadDocumentBlob(scope,pdf,'muestra-sin-validez-fiscal.pdf')}/>:<div className="document-template-preview-empty"><p>Tu diseño, en papel.</p><span>Genera una muestra corta, larga o con textos extensos. Verás el mismo PDF que se descarga, no una aproximación.</span></div>}
  </section>
}
