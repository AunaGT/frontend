import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {disputeLotLabel,type DisputeDocument} from '@/services/cashDisputeService'

export type ResolutionKind='DISPOSITION'|'FORGIVE'|'CORRECT'
export type ResolutionValue={customerPrincipal:string;absorbedPrincipal:string;dueOn:string;lotId:string;amount:string}
export const emptyResolution:ResolutionValue={customerPrincipal:'',absorbedPrincipal:'',dueOn:'',lotId:'',amount:''}
const exact=(v:string,empty='0.00')=>{const t=v.trim();if(!t)return empty;const m=/^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(t);return m?`${m[1]}.${(m[2]||'').padEnd(2,'0')}`:null}

/** Lo que viaja al servidor: decimales exactos de dos posiciones; null si algo no es válido. El servidor recalcula todo. */
export function resolutionPayload(kind:ResolutionKind,v:ResolutionValue,reason:string):Record<string,string>|null{
  if(kind==='DISPOSITION'){
    const customerPrincipal=exact(v.customerPrincipal),absorbedPrincipal=exact(v.absorbedPrincipal)
    if(customerPrincipal==null||absorbedPrincipal==null||Number(customerPrincipal)+Number(absorbedPrincipal)<=0)return null
    return {reason:reason.trim(),customerPrincipal,absorbedPrincipal,...(v.dueOn?{dueOn:v.dueOn}:{})}
  }
  const amount=exact(v.amount,'')
  if(!v.lotId||!amount||Number(amount)<=0)return null
  return {reason:reason.trim(),lotId:v.lotId,amount}
}

type Props={kind:ResolutionKind;doc:DisputeDocument;value:ResolutionValue;onChange:(v:ResolutionValue)=>void;disabled:boolean;money:(v:string)=>string}
export function ResolutionFields({kind,doc,value,onChange,disabled,money}:Props){
  const set=(patch:Partial<ResolutionValue>)=>onChange({...value,...patch})
  if(kind==='DISPOSITION')return <div className="space-y-3">
    <p className="text-sm">Pendiente de resolver: <span className="font-semibold tabular-nums">{money(doc.unresolved)}</span>. Primero se cancela el saldo que el recibo del cliente todavía conserva; lo que falte se emite como cargo.</p>
    <div className="grid max-w-lg grid-cols-2 gap-3">
      <div className="space-y-1"><Label htmlFor="dispute-resolution-customer">Cobrar al cliente</Label><Input id="dispute-resolution-customer" inputMode="decimal" placeholder="0.00" disabled={disabled||!doc.customerName} value={value.customerPrincipal} onChange={e=>set({customerPrincipal:e.target.value})}/></div>
      <div className="space-y-1"><Label htmlFor="dispute-resolution-absorbed">Asume la empresa</Label><Input id="dispute-resolution-absorbed" inputMode="decimal" placeholder="0.00" disabled={disabled} value={value.absorbedPrincipal} onChange={e=>set({absorbedPrincipal:e.target.value})}/></div>
    </div>
    {!doc.customerName&&<p className="text-xs text-muted-foreground">El cobro original está sin cliente identificado: la pérdida solo puede asumirla la empresa.</p>}
    <details className="max-w-lg rounded-lg border px-3 py-2"><summary className="cursor-pointer text-sm">Vencimiento del cargo · opcional</summary><div className="mt-2 max-w-48 space-y-1"><Label htmlFor="dispute-resolution-due">Vencimiento del cargo</Label><Input id="dispute-resolution-due" type="date" disabled={disabled} value={value.dueOn} onChange={e=>set({dueOn:e.target.value})}/><p className="text-xs text-muted-foreground">Si lo dejas vacío se usa el plazo de crédito del cliente.</p></div></details>
  </div>
  const lots=(doc.lots||[]).filter(l=>kind==='CORRECT'||l.kind==='CUSTOMER_CHARGE')
  return <div className="space-y-3">
    <fieldset disabled={disabled} className="space-y-2"><legend className="mb-2 font-semibold">{kind==='FORGIVE'?'Cargo a condonar':'Resolución a corregir'}</legend>
      {!lots.length?<p className="text-sm text-muted-foreground">{kind==='FORGIVE'?'Este expediente no tiene cargos con saldo pendiente.':'Este expediente no tiene resoluciones vigentes.'}</p>
        :<div className="grid gap-2 sm:grid-cols-2">{lots.map(l=>{const limit=l.kind==='CUSTOMER_CHARGE'?l.outstanding??'0.00':l.remaining
          return <Button key={l.id} type="button" variant={value.lotId===l.id?'secondary':'outline'} aria-pressed={value.lotId===l.id} className="h-auto min-h-12 justify-start whitespace-normal px-3 py-2 text-left" onClick={()=>set({lotId:l.id})}>
            <span><span className="block font-medium">{disputeLotLabel[l.kind]}{l.chargeReference?` · ${l.chargeReference}`:''}</span><span className="block text-xs font-normal text-muted-foreground">{l.kind==='CUSTOMER_CHARGE'?'Pendiente de pago':'Vigente'}: {money(limit)}</span></span></Button>})}</div>}
    </fieldset>
    <div className="max-w-48 space-y-1"><Label htmlFor="dispute-resolution-amount">{kind==='FORGIVE'?'Principal a condonar':'Principal a corregir'}</Label><Input id="dispute-resolution-amount" inputMode="decimal" placeholder="0.00" disabled={disabled||!lots.length} value={value.amount} onChange={e=>set({amount:e.target.value})}/></div>
    <p className="text-xs text-muted-foreground">{kind==='FORGIVE'?'Lo que el cliente ya pagó no se condona: se registra como pérdida de la empresa solo el saldo pendiente.':'La corrección compensa la resolución elegida; después puedes preparar una resolución nueva.'}</p>
  </div>
}
