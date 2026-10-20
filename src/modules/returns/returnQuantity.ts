import { normalizeQuantityInput, quantityTicks, previewLineTotal } from '@/lib/commercialQuantity'
import type { EligibleSaleItem, ReturnItem,CompleteReturnPayload } from './api/returnService'
import {isUnitDocumentLine,partialDocumentInput,unitTicks,previewUnitPartialTotal,formatUnitDecimal,remainingUnitQuantity,type PartialUnitBasis} from '@/modules/inventory/units/public'

const documentLine=(item:EligibleSaleItem)=>({...item,id:String(item.id),unit_snapshot:item.unit_snapshot?.version===2?item.unit_snapshot:null,unit_price:item.price,line_total:item.net_total})
export function returnUnitLabel(item:{unit_snapshot?:ReturnItem['unit_snapshot'];unit_label?:string|null},basis:PartialUnitBasis='ORIGINAL') {
  const snapshot=item.unit_snapshot
  if(snapshot?.version===2)return (basis==='ORIGINAL'?snapshot.presentation?.label:null)||snapshot.baseUnit?.label||item.unit_label||'unidades'
  return snapshot?.unit_label||item.unit_label||'unidades'
}
export const formatReturnQuantity=(qty:string|number,item:ReturnItem)=>item.unit_metadata_version===2&&item.unit_snapshot?.version===2?formatUnitDecimal(String(qty),'es-GT'):String(qty)

export function returnQuantity(raw: string, item: EligibleSaleItem, locale: string,basis:PartialUnitBasis='ORIGINAL') {
  try {
    if(isUnitDocumentLine(documentLine(item))){
      const partial=partialDocumentInput(documentLine(item),raw,basis)
      return unitTicks(partial.baseQty)<=unitTicks(String(item.available_base_to_return??'0'))?partial.qty:null
    }
    const qty=normalizeQuantityInput(raw,{kind:item.item_kind || 'STANDARD',quantityDecimals:item.quantity_decimals || 0},locale)
    return quantityTicks(qty)<=quantityTicks(String(item.available_to_return)) ? qty : null
  } catch { return null }
}

export function estimateLineRefund(qty: string, item: EligibleSaleItem,basis:PartialUnitBasis='ORIGINAL') {
  if(isUnitDocumentLine(documentLine(item))){
    try{const base=partialDocumentInput(documentLine(item),qty,basis).baseQty,available=String(item.available_base_to_return??'0');if(unitTicks(base)<=0n||unitTicks(base)>unitTicks(available))return 0;if(unitTicks(base)===unitTicks(available))return Number(item.refundable_amount);return Math.min(Number(item.refundable_amount),Number(previewUnitPartialTotal(String(item.base_qty),String(item.net_total),base,remainingUnitQuantity(String(item.base_qty),available)))) }catch{return 0}
  }
  const requested=quantityTicks(qty),available=quantityTicks(String(item.available_to_return))
  if (requested<=0n || requested>available) return 0
  if (item.net_total==null || item.refundable_amount==null) return Number(previewLineTotal(qty,Number(item.estimated_unit_refund).toFixed(2)))
  if (requested===available) return Number(item.refundable_amount)
  const original=quantityTicks(String(item.qty)),cents=BigInt(Math.round(Number(item.net_total)*100))
  const rounded=(cents*requested+original/2n)/original
  return Math.min(Number(item.refundable_amount),Number(rounded)/100)
}

export function returnLineDecision(item: ReturnItem, decision: {disposition?: ReturnItem['disposition'];stock_location_id?: string}, completion=false): CompleteReturnPayload['lines'][number] {
  if (item.sale_item?.item_kind==='SERVICE') return {return_item_id:item.id}
  const disposition=decision.disposition || 'SELLABLE'
  return {return_item_id:item.id,...(completion ? {received_qty:item.unit_metadata_version===2?String(item.qty_returned):Number(item.qty_returned)} : {}),disposition,stock_location_id:disposition==='SCRAP' ? null : decision.stock_location_id || null}
}
