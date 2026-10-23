import {Button} from '@/components/ui/button'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog'
import {selectProductUnit,formatUnitDecimal,formatUnitMoney} from '@/modules/inventory/units/public'
import type {Product} from '@/types/product'

type Props={product:Product|null;priceContext:string;locale?:string;currencyCode?:string;disabled?:boolean;onSelect:(id:string|null)=>void;onCancel:()=>void}

export function SalePresentationOptions({product,priceContext,locale,currencyCode,disabled=false,onSelect}:Omit<Props,'onCancel'>){
 if(!product?.unitConfiguration)return null
 const presentations=product.unitConfiguration.presentations.filter(p=>p.active&&p.sale_enabled)
 return <div className="grid gap-2" aria-label={`Presentaciones de ${product.name}`}>
  {[null,...presentations.map(p=>p.id)].map(id=>{
   const selection=selectProductUnit(product,id,priceContext)!
   const {baseUnit,presentation,factor}=selection.snapshot
   const name=presentation?.name??baseUnit.name,label=presentation?.label??baseUnit.label
   const subcent=(selection.unitPrice.split('.')[1]?.replace(/0+$/,'').length??0)>2
   const rate=subcent?`${currencyCode||'GTQ'} ${formatUnitDecimal(selection.unitPrice,locale)}`:formatUnitMoney(selection.unitPrice,locale,currencyCode)
   return <Button key={id??'base'} type="button" variant="outline" disabled={disabled} aria-label={`Agregar ${product.name} en ${name}`} className="h-auto min-h-14 w-full justify-between gap-4 whitespace-normal py-3 text-left" onClick={()=>{if(!disabled)onSelect(id)}}>
    <span className="min-w-0 break-words"><strong className="block font-medium">{name}</strong><span className="mt-1 block text-xs font-normal text-muted-foreground">{presentation?`1 ${label} = ${formatUnitDecimal(factor,locale)} ${baseUnit.label}`:`Venta por ${baseUnit.label} · unidad base`}</span></span>
    <span className="min-w-0 max-w-[45%] shrink-0 break-words text-right"><strong className="block">{rate}</strong><span className="text-xs font-normal text-muted-foreground">por {label}</span></span>
   </Button>
  })}
 </div>
}

export function SalePresentationDialog(props:Props){
 if(!props.product)return null
 return <Dialog open onOpenChange={open=>{if(!open&&!props.disabled)props.onCancel()}}><DialogContent variant="auna" className="max-h-[90dvh] overflow-y-auto">
  <DialogHeader><DialogTitle>¿Cómo lo vas a vender?</DialogTitle><DialogDescription>{props.product.name}. Elige la presentación antes de agregarla a la venta.</DialogDescription></DialogHeader>
  <SalePresentationOptions {...props}/>
  <p className="text-xs text-muted-foreground">El código de una presentación la agrega directamente. Para venta a granel, ingresa después el peso real.</p>
  <DialogFooter><Button type="button" variant="ghost" disabled={props.disabled} onClick={props.onCancel}>Cancelar</Button></DialogFooter>
 </DialogContent></Dialog>
}
