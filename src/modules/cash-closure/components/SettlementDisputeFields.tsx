import {Checkbox} from '@/components/ui/checkbox'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {disputeStatus,type DisputeListItem} from '@/services/cashDisputeService'

export type SettlementCase=Pick<DisputeListItem,'id'|'event_id'|'provider_reference'|'claimed'|'status'>
export type SettlementRecovery={disputeId:string;amount:string}

/** Expediente de un contracargo nuevo: sin expediente el servidor rechaza la liquidación. */
export function ChargebackCase({id,cases,value,onChange,disabled}:{id:string;cases:SettlementCase[];value:string;onChange:(c:SettlementCase)=>void;disabled:boolean}){
  return <div className="space-y-1"><Label htmlFor={id}>Expediente</Label><Select value={value} disabled={disabled||!cases.length} onValueChange={v=>{const c=cases.find(x=>x.id===v);if(c)onChange(c)}}>
    <SelectTrigger id={id}><SelectValue placeholder={cases.length?'Disputa del cobro':'Sin disputas de este medio'}/></SelectTrigger>
    <SelectContent>{cases.map(c=><SelectItem key={c.id} value={c.id}>{c.provider_reference} · {disputeStatus[c.status]}</SelectItem>)}</SelectContent></Select></div>
}

/** Dinero de disputas que el proveedor devolvió sumado a este depósito; el servidor limita cada una a lo retirado y no recuperado. */
export function SettlementRecoveries({cases,value,onChange,disabled}:{cases:SettlementCase[];value:SettlementRecovery[];onChange:(v:SettlementRecovery[])=>void;disabled:boolean}){
  return <section className="auna-surface space-y-2 rounded-xl border p-4" aria-labelledby="st-recoveries">
    <h2 id="st-recoveries" className="text-sm font-semibold">Recuperaciones de disputas</h2>
    {!cases.length?<p className="text-sm text-muted-foreground">No hay disputas de este medio con dinero por recuperar.</p>
      :<ul className="divide-y text-sm">{cases.map(c=>{const row=value.find(r=>r.disputeId===c.id)
        return <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
          <Checkbox aria-label={`Incluir recuperación de ${c.provider_reference}`} checked={!!row} disabled={disabled} onCheckedChange={on=>onChange(on===true?[...value,{disputeId:c.id,amount:''}]:value.filter(r=>r.disputeId!==c.id))}/>
          <span className="min-w-0 flex-1">{c.provider_reference}<span className="block text-xs text-muted-foreground">{disputeStatus[c.status]}</span></span>
          {row&&<Input aria-label={`Importe recuperado de ${c.provider_reference}`} className="h-9 w-28 text-right" inputMode="decimal" placeholder="0.00" value={row.amount} disabled={disabled} onChange={e=>onChange(value.map(r=>r.disputeId===c.id?{...r,amount:e.target.value}:r))}/>}
        </li>})}</ul>}
  </section>
}
