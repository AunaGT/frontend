import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
type Reference={startsAt:string;timezone:string}
type Review={before:Reference;after:Reference;dueBefore:string;dueAfter:string}
function readReview(fields:Record<string,string>):{hash:string;items:Review[]}|null{
 if(!/^[a-f0-9]{64}$/.test(fields.acknowledgedPaymentReviewHash||''))return null
 try{const items=JSON.parse(fields.paymentReferenceReview);if(!Array.isArray(items)||!items.length||items.length>100)return null
  for(const item of items){for(const ref of [item.before,item.after]){if(!ref||!Number.isFinite(Date.parse(ref.startsAt)))return null;new Intl.DateTimeFormat('es-GT',{timeZone:ref.timezone})}if(!Number.isFinite(Date.parse(item.dueBefore))||!Number.isFinite(Date.parse(item.dueAfter)))return null}
  return {hash:fields.acknowledgedPaymentReviewHash,items}
 }catch{return null}
}
export function PaymentReferenceReview({fields,pending=false,onConfirm}:{fields:Record<string,string>;pending?:boolean;onConfirm:(hash:string)=>void}){
 const review=readReview(fields),[accepted,setAccepted]=useState<string|null>(null)
 if(!review)return null
 const date=(at:string,zone:string)=>new Intl.DateTimeFormat('es-GT',{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(new Date(at))
 return <section className="space-y-3 rounded-lg border border-brand-orange/40 bg-brand-orange/5 p-3" aria-label="Revisar vencimiento del acuerdo"><p className="text-sm font-medium">El cambio de horario afecta al vencimiento de todo el acuerdo.</p>{review.items.map((item,index)=><div key={index} className="grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Vencimiento anterior</p><p>{date(item.dueBefore,item.before.timezone)}</p><small className="text-muted-foreground">Primera prestación: {date(item.before.startsAt,item.before.timezone)} · {item.before.timezone}</small></div><div><p className="text-xs text-muted-foreground">Nuevo vencimiento</p><p className="font-medium">{date(item.dueAfter,item.after.timezone)}</p><small className="text-muted-foreground">Primera prestación: {date(item.after.startsAt,item.after.timezone)} · {item.after.timezone}</small></div></div>)}<Button type="button" size="sm" variant="outline" disabled={pending} onClick={()=>setAccepted(review.hash)}>Revisar cambio de fechas</Button><ConfirmDialog open={accepted===review.hash} onOpenChange={open=>{if(!open)setAccepted(null)}} appearance="auna" title="Aceptar nuevo vencimiento" description="Se guardarán los horarios y las fechas mostradas para todo el acuerdo. Los importes y los pagos no cambian. Si cambió algo, Auna pedirá revisarlo otra vez." confirmText="Aceptar fechas y guardar" loading={pending} onConfirm={()=>{setAccepted(null);onConfirm(review.hash)}}/></section>
}
