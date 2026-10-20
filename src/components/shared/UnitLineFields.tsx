import type {Product} from '@/types/product'
import {Checkbox} from '@/components/ui/checkbox'
import {convertUnitQuantity,formatUnitDecimal,type UnitSelection} from '@/modules/inventory/units/public'

export function UnitLineFields({product,selection,quantity,onSelect,onAcceptRounding,disabled=false,operation='SALE'}:{product:Product;selection:UnitSelection;quantity:string;onSelect:(id:string|null)=>void;onAcceptRounding:(accepted:boolean)=>void;disabled?:boolean;operation?:'SALE'|'PURCHASE'}){
  const alternatives=selection.sourceLineId?[]:product.unitConfiguration?.presentations.filter(p=>p.active&&(operation==='PURCHASE'?p.purchase_enabled:p.sale_enabled))??[]
  const label=selection.snapshot.presentation?.label??selection.snapshot.baseUnit.label
  let conversion:ReturnType<typeof convertUnitQuantity>|undefined,error=''
  try{conversion=convertUnitQuantity(quantity,selection.snapshot.factor,selection.snapshot.baseUnit.decimals)}catch(e){error=(e as Error).message}
  return <div className="mt-1 space-y-1 text-xs text-muted-foreground">
    {alternatives.length>0?<select className="auna-control auna-control-select max-w-48" aria-label={`Unidad de ${product.name}`} value={selection.presentationId??''} disabled={disabled} onChange={e=>{if(!disabled)onSelect(e.target.value||null)}}><option value="">{selection.snapshot.baseUnit.label}</option>{alternatives.map(p=><option key={p.id} value={p.id}>{p.name} · {p.label}</option>)}</select>:<span>{label}</span>}
    {conversion&&<p>{formatUnitDecimal(quantity)} {label} = {formatUnitDecimal(conversion.baseQty)} {selection.snapshot.baseUnit.label}</p>}
    {selection.reviewRequired&&<p role="alert">La unidad guardada necesita revisión. Selecciona la presentación antes de cobrar.</p>}
    {selection.sourceLineId&&<p>Acuerdo original: {formatUnitDecimal(selection.sourceUnitPrice??selection.unitPrice)} por {selection.sourceSnapshot?.presentation?.label??selection.sourceSnapshot?.baseUnit.label}. El importe usa el saldo base del pedido.</p>}
    {conversion?.roundingRequired&&<label className="flex items-start gap-2"><Checkbox checked={selection.acceptRounding} disabled={disabled} onCheckedChange={checked=>{if(!disabled)onAcceptRounding(checked===true)}}/>Aceptar redondeo a {conversion.baseQty} {selection.snapshot.baseUnit.label} (diferencia {conversion.roundingDelta})</label>}
    {error&&quantity&&<p role="alert" className="text-destructive">{error}</p>}
  </div>
}
