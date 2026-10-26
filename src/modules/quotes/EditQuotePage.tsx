import {useEffect,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {usePackageScope} from '@/modules/inventory/packages/usePackageScope'
import {packageRequest,packageError} from '@/modules/inventory/packages/api'
import type {Quote} from '@/services/quoteService'
import QuoteEditor from './QuoteEditor'
function EditWorkspace({id,context}:{id:string;context:ReturnType<typeof usePackageScope>}){
 const [quote,setQuote]=useState<Quote|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 useEffect(()=>{const abort=new AbortController();setLoading(true);void packageRequest<Quote>(context.scope!,'/api/quotes/'+encodeURIComponent(id),{signal:abort.signal}).then(q=>{if(!abort.signal.aborted)setQuote(q)}).catch(e=>{if(!abort.signal.aborted)setError(packageError(e))}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});return()=>abort.abort()},[id,context.scope])
 if(loading)return <p className="p-6" role="status">Cargando cotización…</p>
 if(error||!quote||quote.status!=='DRAFT'||quote.convertedChildren?.length||quote.hasDirectSale)return <section className="p-6 space-y-3"><p role="alert">{error||'Esta cotización ya no admite cambios. Continúa desde su documento vinculado.'}</p><Button variant="outline" asChild><Link to={'/cotizaciones/'+id}>Volver al detalle</Link></Button></section>
 return <QuoteEditor mode="edit" initialQuote={quote}/>
}
export default function EditQuotePage(){const context=usePackageScope(),{id}=useParams();if(!id||!context.scope)return <p className="p-6">Selecciona la empresa y sucursal de la cotización.</p>;return <EditWorkspace key={context.key+id} context={context} id={id}/>}
