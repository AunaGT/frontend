import type {UnitSnapshot} from './types'
import type {UnitSelection} from './selection'
import {unitTicks,unitFromTicks,remainingUnitQuantity,selectedBaseQuantity,selectedQuantity} from './selection'
import {normalizeUnitDecimal,formatUnitDecimal,displayUnitRate} from '@/lib/unitQuantity'
export {previewUnitPartialTotal} from '@/lib/unitQuantity'

export type UnitDocumentLine={id?:string;qty:string|number;unit_price?:string|number;line_total?:string|number;unit_metadata_version?:number;unit_snapshot?:UnitSnapshot|null;base_qty?:string|null;base_fulfilled?:string|null;base_invoiced?:string|null;qty_fulfilled?:string|number;qty_invoiced?:string|number;unit_label?:string|null;quantity_decimals?:number}
export type PartialUnitBasis='BASE'|'ORIGINAL'
export const isUnitDocumentLine=(line:UnitDocumentLine)=>line.unit_metadata_version===2&&line.unit_snapshot?.version===2
export function frozenDocumentSelection(line:UnitDocumentLine,basis:PartialUnitBasis='ORIGINAL'):UnitSelection{
  if(!isUnitDocumentLine(line))throw Error('El documento no tiene una unidad versionada')
  const snapshot=basis==='BASE'?{...line.unit_snapshot!,presentation:null,factor:'1',roundingDelta:'0'}:line.unit_snapshot!
  return {version:2,presentationId:snapshot.presentation?.id??null,revision:0,priceContext:'SOURCE',unitPrice:basis==='BASE'?displayUnitRate(String(line.unit_price??'0'),String(line.base_qty),String(line.qty)):String(line.unit_price??'0'),snapshot,acceptRounding:true,sourceLineId:line.id,sourceBasis:basis,sourceUnitPrice:String(line.unit_price??'0'),sourceSnapshot:line.unit_snapshot!,sourceQty:String(line.qty),sourceBaseQty:String(line.base_qty),sourceNetTotal:String(line.line_total),sourceConsumedBase:String(line.base_fulfilled??'0')}
}
export function remainingDocumentQuantity(line:UnitDocumentLine,operation:'delivery'|'invoice'='delivery',basis:PartialUnitBasis='BASE'){
  const remaining=remainingUnitQuantity(isUnitDocumentLine(line)?String(operation==='invoice'?line.base_fulfilled??'0':line.base_qty??'0'):String(operation==='invoice'?line.qty_fulfilled??'0':line.qty),isUnitDocumentLine(line)?String(operation==='invoice'?line.base_invoiced??'0':line.base_fulfilled??'0'):String(operation==='invoice'?line.qty_invoiced??'0':line.qty_fulfilled??'0'))
  if(!isUnitDocumentLine(line)||basis==='BASE')return remaining
  const originalBase=unitTicks(String(line.base_qty)),scaled=unitTicks(remaining)*unitTicks(String(line.qty))
  if(!originalBase||scaled%originalBase)throw Error('Usa la unidad base para esta cantidad parcial')
  const result=unitFromTicks(scaled/originalBase)
  return result==='0'?'0':selectedQuantity(result,frozenDocumentSelection(line))
}
export function partialDocumentInput(line:UnitDocumentLine,raw:string,basis:PartialUnitBasis='BASE'){
  const advanced=isUnitDocumentLine(line)
  const qty=normalizeUnitDecimal(raw,{decimals:advanced?(basis==='BASE'?line.unit_snapshot!.baseUnit.decimals:line.unit_snapshot!.presentation?.decimals??line.unit_snapshot!.baseUnit.decimals):line.quantity_decimals??0,allowZero:false})
  const baseQty=!advanced||basis==='BASE'?qty:qty===String(line.qty)?String(line.base_qty):selectedBaseQuantity(qty,frozenDocumentSelection(line))
  return {qty,baseQty,...(advanced&&basis==='BASE'?{presentation_id:null}:{})}
}
const cents=(raw:string)=>{const [whole,fraction='']=normalizeUnitDecimal(raw,{decimals:2,max:'9999999999.99'}).split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))}
const money=(value:bigint)=>`${value/100n}.${(value%100n).toString().padStart(2,'0')}`
export function documentNetAmounts(document:{total:string|number;lines:UnitDocumentLine[]}){
  const weights=document.lines.map(l=>cents(String(l.line_total??'0'))),gross=weights.reduce((a,b)=>a+b,0n),net=cents(String(document.total))
  if(!document.lines.some(isUnitDocumentLine)||gross===net)return document.lines.map(l=>String(l.line_total??'0'))
  if(net>gross||!gross)throw Error('Las partidas no concilian con el total acordado')
  let cumulative=0n,assigned=0n
  return weights.map((weight,index)=>{cumulative+=weight;const end=index===weights.length-1?net:(net*cumulative+gross/2n)/gross;const amount=money(end-assigned);assigned=end;return amount})
}
export const documentUnitPrice=(line:UnitDocumentLine,locale='es-GT')=>formatUnitDecimal(String(line.unit_price??'0'),locale)
