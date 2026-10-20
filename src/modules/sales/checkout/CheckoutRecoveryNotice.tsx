import {Button} from '@/components/ui/button'
import {Alert,AlertDescription,AlertTitle} from '@/components/ui/alert'
import type {CheckoutAttempt} from './attemptStorage'
type Props={attempt?:CheckoutAttempt|null;pending:boolean;error?:string|null;lastSaleId?:string;ticketFailed?:boolean;ticketPending?:boolean;onCheck:()=>void;onTicket:()=>void;onDetail:()=>void}
export function CheckoutRecoveryNotice(p:Props){
  if(!p.attempt&&!p.lastSaleId&&!p.error)return null
  return <Alert className="mb-4" aria-live="polite"><AlertTitle>{p.attempt?(p.attempt.state==='CONFIRMED'?'Venta registrada':'Comprobando el cobro'):p.lastSaleId?(p.ticketFailed?'Venta registrada; ticket pendiente':'Venta registrada'):'Revisa el cobro'}</AlertTitle><AlertDescription>
    {p.attempt?<p>No vuelvas a cobrar esta operación. Comprueba el resultado antes de continuar.</p>:p.error?<p>{p.error}</p>:p.ticketFailed?<p>Puedes recuperar el ticket sin registrar otra venta.</p>:null}
    <div className="mt-3 flex flex-wrap gap-2">
      {p.attempt&&<Button type="button" variant="outline" disabled={p.pending} onClick={p.onCheck}>Comprobar resultado</Button>}
      {p.lastSaleId&&<><Button type="button" variant="outline" disabled={p.ticketPending} onClick={p.onTicket}>Descargar ticket</Button><Button type="button" variant="ghost" onClick={p.onDetail}>Ver venta</Button></>}
    </div>
  </AlertDescription></Alert>
}
