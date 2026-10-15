import {useRef,useState} from 'react'
import {Button} from '@/components/ui/button'
import {FileText,Loader2} from 'lucide-react'
import {requestSaleInvoice} from '@/services/saleService'
import type {Sale,SaleCommercialView} from '@/types/sale'
import {fiscalLabel} from '../commercialPresentation'

export function SaleFiscalAction({sale,onRequested}:{sale:Sale;onRequested:(result:SaleCommercialView)=>void}){
  const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null)
  const attempt=useRef<{saleId:string;version:number;key:string}|null>(null)
  if(sale.commercial?.fiscalState==='PENDING_CONNECTOR')return <p role="status" className="text-xs text-muted-foreground max-w-72">{fiscalLabel('PENDING_CONNECTOR')}</p>
  if(!sale.capabilities?.requestInvoice)return null
  const request=async()=>{
    if(pending||!sale.commercial)return
    const version=sale.commercial.version
    if(attempt.current?.saleId!==sale.id||attempt.current.version!==version)attempt.current={saleId:sale.id,version,key:crypto.randomUUID()}
    setPending(true);setError(null)
    try{onRequested(await requestSaleInvoice(sale.id,{expectedVersion:version,idempotencyKey:attempt.current.key}))}
    catch(err){setError(err instanceof Error?err.message:'No se pudo solicitar la factura')}
    finally{setPending(false)}
  }
  return <div className="flex flex-col items-end gap-1 max-w-80"><Button variant="outline" disabled={pending} onClick={request}>{pending?<Loader2 aria-hidden className="animate-spin"/>:<FileText aria-hidden/>}{pending?'Solicitando…':'Generar factura'}</Button><p className="text-xs text-muted-foreground">Por ahora quedará pendiente: el certificador no está conectado.</p>{error&&<p role="alert" className="text-xs text-destructive">{error} Puedes actualizar el detalle y volver a intentarlo.</p>}</div>
}
