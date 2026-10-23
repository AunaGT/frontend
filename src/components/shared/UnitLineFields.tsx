import type {Product} from '@/types/product'
import {Checkbox} from '@/components/ui/checkbox'
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select'
import {convertUnitQuantity,formatUnitDecimal,type UnitSelection} from '@/modules/inventory/units/public'

export function UnitLineFields({product,selection,quantity,onSelect,onAcceptRounding,disabled=false,operation='SALE'}:{product:Product;selection:UnitSelection;quantity:string;onSelect:(id:string|null)=>void;onAcceptRounding:(accepted:boolean)=>void;disabled?:boolean;operation?:'SALE'|'PURCHASE'}){
  const alternatives=selection.sourceLineId?[]:product.unitConfiguration?.presentations.filter(p=>p.active&&(operation==='PURCHASE'?p.purchase_enabled:p.sale_enabled))??[]
  const label=selection.snapshot.presentation?.label??selection.snapshot.baseUnit.label
  let conversion:ReturnType<typeof convertUnitQuantity>|undefined,error=''
  try{conversion=convertUnitQuantity(quantity,selection.snapshot.factor,selection.snapshot.baseUnit.decimals)}catch(e){error=(e as Error).message}
  return <div className="min-w-0 space-y-2 text-sm text-muted-foreground">
    {alternatives.length>0?<Select value={selection.presentationId??'__base__'} disabled={disabled} onValueChange={value=>{if(!disabled)onSelect(value==='__base__'?null:value)}}><SelectTrigger aria-label={`Presentación de ${product.name}`} className="h-auto min-h-11 w-full text-left [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words"><SelectValue>{selection.snapshot.presentation?.name??selection.snapshot.baseUnit.name}</SelectValue></SelectTrigger><SelectContent>{[<SelectItem key="base" value="__base__" className="min-h-11 whitespace-normal">{selection.snapshot.baseUnit.name} ({selection.snapshot.baseUnit.label})</SelectItem>,...alternatives.map(p=><SelectItem key={p.id} value={p.id} className="min-h-11 whitespace-normal">{p.name}</SelectItem>)]}</SelectContent></Select>:<span className="block font-medium text-foreground">{selection.snapshot.presentation?.name??selection.snapshot.baseUnit.name}</span>}
    {conversion&&<p>{formatUnitDecimal(quantity)} {label} = {formatUnitDecimal(conversion.baseQty)} {selection.snapshot.baseUnit.label}</p>}
    {selection.reviewRequired&&<p role="alert">La unidad guardada necesita revisión. Selecciona la presentación antes de cobrar.</p>}
    {selection.sourceLineId&&<p>Acuerdo original: {formatUnitDecimal(selection.sourceUnitPrice??selection.unitPrice)} por {selection.sourceSnapshot?.presentation?.label??selection.sourceSnapshot?.baseUnit.label}. El importe usa el saldo base del pedido.</p>}
    {conversion?.roundingRequired&&<label className="flex items-start gap-2"><Checkbox checked={selection.acceptRounding} disabled={disabled} onCheckedChange={checked=>{if(!disabled)onAcceptRounding(checked===true)}}/>Aceptar redondeo a {conversion.baseQty} {selection.snapshot.baseUnit.label} (diferencia {conversion.roundingDelta})</label>}
    {error&&quantity&&<p role="alert" className="text-destructive">{error}</p>}
  </div>
}
