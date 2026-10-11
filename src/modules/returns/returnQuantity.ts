import { normalizeQuantityInput, quantityTicks, previewLineTotal } from '@/lib/commercialQuantity'
import type { EligibleSaleItem, ReturnItem,CompleteReturnPayload } from './api/returnService'

export function returnQuantity(raw: string, item: EligibleSaleItem, locale: string) {
  try {
    const qty=normalizeQuantityInput(raw,{kind:item.item_kind || 'STANDARD',quantityDecimals:item.quantity_decimals || 0},locale)
    return quantityTicks(qty)<=quantityTicks(String(item.available_to_return)) ? qty : null
  } catch { return null }
}

export function estimateLineRefund(qty: string, item: EligibleSaleItem) {
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
  return {return_item_id:item.id,...(completion ? {received_qty:Number(item.qty_returned)} : {}),disposition,stock_location_id:disposition==='SCRAP' ? null : decision.stock_location_id || null}
}
