import type {PackageGroup} from '@/modules/inventory/packages/types'
import {formatMoney} from '@/utils/formatters'
export type PackageDisplayLine={package_component_key?:string|null;packageComponentKey?:string|null;qty?:string|number;quantity?:string;line_total?:string|number;lineTotal?:string|number;net_total?:string|number}
export function publicCommercialPackageGroups(groups:PackageGroup[]):PackageGroup[]{
 return groups.map(g=>({schemaVersion:1,groupId:g.groupId,name:g.name,variantName:g.variantName,currency:g.currency,state:g.state,estimatedAmount:g.estimatedAmount,amount:g.amount,netAmount:g.netAmount,
  issues:g.issues.map(i=>({code:i.code,message:i.message,remainingQuantity:i.remainingQuantity})),
  components:g.components.map(c=>({key:c.key,productId:c.productId,itemName:c.itemName,itemKind:c.itemKind,quantity:c.quantity,unitLabel:c.unitLabel,quantityDecimals:c.quantityDecimals,unitPrice:c.unitPrice,lineTotal:c.lineTotal,netLineTotal:c.netLineTotal}))}))
}
export function packageLineLabel(groups:PackageGroup[]|undefined,key?:string|null){
 const group=groups?.find(g=>g.components.some(c=>c.key===key))
 return group?`${group.name} · ${group.variantName}`:''
}
export function CommercialPackageSummary({groups=[],lines,mode,locale='es-GT'}:{groups?:PackageGroup[];lines:PackageDisplayLine[];mode:'quote'|'order'|'sale'|'engagement'|'public';locale?:string}){
 const sold=mode==='sale',actual=new Map(lines.map(l=>[l.package_component_key??l.packageComponentKey,l]))
 if(!groups.length)return null
 return <section aria-label="Paquetes acordados" className="space-y-3">{groups.map(g=>{
  const components=sold?g.components.filter(c=>actual.has(c.key)):g.components
  if(sold&&!components.length)return null
  const money=(v:string|number)=>formatMoney(Number(v),locale,g.currency)
  return <article key={g.groupId} className="rounded-lg border p-4 space-y-3"><header className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{g.name}</h3><p className="text-sm text-muted-foreground">{g.variantName}</p></div><p className="text-sm">{g.state==='INCOMPLETE'?'Total pendiente de completar':sold?'Referencia del acuerdo':'Importe del paquete'}{g.state==='COMPLETE'&&<> · {money(g.netAmount??g.amount??'0')}</>}</p></header>
   {mode==='engagement'&&<p className="text-sm text-muted-foreground">Composición acordada. Los horarios, responsables y recursos se confirman por separado en Programaciones.</p>}
   {sold&&<p className="text-sm text-muted-foreground">Solo se muestran los componentes facturados en esta venta. La referencia del acuerdo no es un cobro adicional.</p>}
   <ul className="divide-y">{components.map(c=>{const line=actual.get(c.key);return <li key={c.key} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{sold?line?.qty??line?.quantity:c.quantity} {c.unitLabel} · {c.itemName}</span><span className="tabular-nums">{money(sold?line?.net_total??line?.line_total??line?.lineTotal??'0':c.netLineTotal)}</span></li>})}</ul>
   {g.issues.map((issue,i)=><p key={i} className="text-sm text-muted-foreground">{issue.message} · {issue.remainingQuantity} pendientes</p>)}
  </article>
 })}</section>
}
