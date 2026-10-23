import {useParams,useSearchParams} from 'react-router-dom'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {LoadingState} from '@/components/shared/LoadingState'
import {useTemplateScope} from '../documentTemplates/useTemplateScope'
import {TemplateEditor} from '../documentTemplates/TemplateEditor'
import type {PaperFormat} from '../documentTemplates/types'
import '../documentTemplates/documentTemplates.css'
export default function DocumentTemplateEditorPage(){
  const context=useTemplateScope(),{id}=useParams(),[params]=useSearchParams()
  usePageTrail([{label:'Plantillas',to:'/configuracion/plantillas'},{label:id?'Editar diseño':'Nuevo diseño'}])
  if(!context.scope||!context.canRead)return <LoadingState message="Comprobando el acceso al diseño…"/>
  const purpose=params.get('tipo')==='FEL_INVOICE'?'FEL_INVOICE':'INTERNAL_RECEIPT',raw=params.get('formato'),format:PaperFormat=raw==='A4'||raw==='RECEIPT_80'||raw==='LETTER'?raw:purpose==='FEL_INVOICE'?'LETTER':'RECEIPT_80'
  return <TemplateEditor key={JSON.stringify([context.key,id,purpose,format])} scope={context.scope} id={id} baseId={params.get('base')||'CLASSIC'} format={format} purpose={purpose} canManage={context.canManage} canPublish={context.canPublish} companyName={context.companyName} registerGuard={context.registerGuard}/>
}
