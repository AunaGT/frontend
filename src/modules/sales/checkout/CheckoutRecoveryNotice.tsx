import {Button} from '@/components/ui/button'
import {Alert,AlertDescription,AlertTitle} from '@/components/ui/alert'
import {canRetryCheckout,type CheckoutAttempt} from './attemptStorage'
type Props={attempt?:CheckoutAttempt|null;pending:boolean;hasProcessingButton?:boolean;error?:string|null;lastSaleId?:string;ticketFailed?:boolean;ticketPending?:boolean;onCheck:()=>void;onRetry?:()=>void;canRetry?:boolean;productNames?:Record<string,string>;onTicket:()=>void;onDetail:()=>void}
export function CheckoutRecoveryNotice(p:Props){
  if(!p.attempt&&!p.error&&!(p.lastSaleId&&p.ticketFailed))return null
  if(p.hasProcessingButton&&p.pending&&p.attempt?.state==='SUBMITTING'&&!p.error&&!p.attempt.lastError)return null
  const rawLines=p.attempt?.payload?.items??p.attempt?.payload?.lines
  const lines=Array.isArray(rawLines)?rawLines.filter((row):row is Record<string,unknown>=>Boolean(row&&typeof row==='object'&&!Array.isArray(row))):[]
  return <Alert className="mb-4" aria-live="polite"><AlertTitle>{p.attempt?(p.attempt.state==='CONFIRMED'?'Venta registrada':'Comprobando el cobro'):p.lastSaleId?(p.ticketFailed?'Venta registrada; ticket pendiente':'Venta registrada'):'Revisa el cobro'}</AlertTitle><AlertDescription>
    {p.attempt?<p>No vuelvas a cobrar esta operación. Comprueba el resultado antes de continuar.</p>:p.error?<p>{p.error}</p>:p.ticketFailed?<p>Puedes recuperar el ticket sin registrar otra venta.</p>:null}
    {p.attempt?.state!=='CONFIRMED'&&p.attempt&&<>
      {p.attempt.lastError&&<p className="mt-2 break-words"><strong>Último error al enviar:</strong> {p.attempt.lastError}</p>}
      {p.error&&p.error!==p.attempt.lastError&&<p className="mt-2 break-words" role="status">{p.error}</p>}
      {lines.length>0&&<details className="mt-3"><summary className="cursor-pointer">Ver la operación guardada ({lines.length} {lines.length===1?'línea':'líneas'})</summary><ul className="mt-2 space-y-1">{lines.map((row,index)=><li key={index}>{typeof row.qty==='string'||typeof row.qty==='number'?String(row.qty):'—'} × {typeof row.product_id==='string'?(p.productNames?.[row.product_id]??`Producto ${row.product_id.slice(0,8)}`):`Línea del pedido ${index+1}`}</li>)}</ul></details>}
    </>}
    <div className="mt-3 flex flex-wrap gap-2">
      {p.attempt&&<Button type="button" variant="outline" disabled={p.pending} onClick={p.onCheck}>Comprobar resultado</Button>}
      {p.canRetry&&p.onRetry&&canRetryCheckout(p.attempt??null)&&<Button type="button" disabled={p.pending} onClick={()=>{if(!p.pending)p.onRetry?.()}}>Reintentar este cobro</Button>}
      {p.lastSaleId&&<><Button type="button" variant="outline" disabled={p.ticketPending} onClick={p.onTicket}>Descargar ticket</Button><Button type="button" variant="ghost" onClick={p.onDetail}>Ver venta</Button></>}
    </div>
    {p.canRetry&&canRetryCheckout(p.attempt??null)&&<p className="mt-2 text-xs">El reintento comprueba primero el resultado y conserva la misma clave, productos e importes. No inicia una venta diferente.</p>}
  </AlertDescription></Alert>
}
