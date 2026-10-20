import type {Product} from '@/types/product'
import type {UnitSnapshot,UnitPreview} from './types'
import {exactProductValues} from './model'
import {normalizeUnitDecimal,convertUnitQuantity,deriveUnitPrice,unitLineTotal,previewUnitPartialTotal,unitTicks,unitFromTicks,compareUnitDecimals} from '@/lib/unitQuantity'

export type UnitSelection={version:2;presentationId:string|null;revision:number;priceContext:string;unitPrice:string;snapshot:UnitSnapshot;acceptRounding:boolean;reviewRequired?:boolean;sourceLineId?:string;sourceBasis?:'BASE'|'ORIGINAL';sourceUnitPrice?:string;sourceSnapshot?:UnitSnapshot;sourceQty?:string;sourceBaseQty?:string;sourceNetTotal?:string;sourceConsumedBase?:string}
export {unitTicks,unitFromTicks,addUnitQuantities,remainingUnitQuantity,compareUnitQuantities,stepUnitQuantity} from '@/lib/unitQuantity'
export function selectProductUnit(product:Product,presentationId?:string|null,priceContext='LIST',operation:'SALE'|'PURCHASE'='SALE'):UnitSelection|undefined{
  const config=product.unitConfiguration
  if(!config||product.kind==='SERVICE'&&operation==='PURCHASE')return undefined
  const id=presentationId===undefined?(operation==='PURCHASE'?config.default_purchase_presentation_id:config.default_sale_presentation_id):presentationId
  const presentation=id?config.presentations.find(p=>p.id===id&&p.active&&(operation==='PURCHASE'?p.purchase_enabled:p.sale_enabled)):null
  if(id&&!presentation)throw Error('Esta presentación cambió. Revisa el producto antes de continuar.')
  const values=exactProductValues(product),tier=priceContext==='WHOLESALE'?'WHOLESALE':priceContext==='PROMOTION'?'PROMOTION':'LIST'
  const active=(until?:string|null)=>tier!=='PROMOTION'||!until||new Date(until).getTime()>=Date.now()
  const alternate=tier==='WHOLESALE'?values.priceWholesale:tier==='PROMOTION'?values.pricePromotion:values.price
  const basePrice=active(product.promotionValidUntil)&&alternate!=null&&(tier==='LIST'||compareUnitDecimals(alternate,'0')>0)?alternate:values.price
  const override=active(presentation?.promotion_valid_until)?presentation?.prices[tier]:null
  return {version:2,presentationId:id??null,revision:config.unit_revision,priceContext,unitPrice:operation==='PURCHASE'?'0':override??deriveUnitPrice(basePrice,presentation?.factor??'1'),acceptRounding:false,snapshot:{version:2,baseUnit:{id:config.base_unit_id,code:config.base_unit?.code??'',name:config.base_unit?.name??'Unidad',label:config.base_unit?.label??'unidades',decimals:product.kind==='KIT'?0:config.quantity_decimals},presentation:presentation?{id:presentation.id,version:presentation.version,name:presentation.name,label:presentation.label,decimals:presentation.quantity_decimals}:null,factor:presentation?.factor??'1',roundingDelta:'0'}}
}
export function reconcileUnitPreview(selection:UnitSelection,quantity:string,preview:UnitPreview){
  if(selection.sourceLineId)return {selection,quantity,changed:false}
  if(preview.unit_metadata_version!==2||preview.unit_snapshot?.version!==2||preview.unit_price==null||preview.line_total==null)throw Error('Recarga la preparación completa de esta unidad antes de continuar.')
  const snapshot=preview.unit_snapshot,next={...selection,presentationId:snapshot.presentation?.id??null,revision:preview.unit_revision??selection.revision,unitPrice:preview.unit_price,snapshot}
  const identity=(s:UnitSnapshot)=>JSON.stringify([s.version,s.baseUnit.id,s.baseUnit.code,s.baseUnit.name,s.baseUnit.label,s.baseUnit.decimals,s.presentation?.id??null,s.presentation?.version??null,s.presentation?.name??null,s.presentation?.label??null,s.presentation?.decimals??null,s.factor,s.roundingDelta])
  const changed=compareUnitDecimals(selectedQuantity(quantity,selection),preview.qty)!==0||compareUnitDecimals(selectedBaseQuantity(quantity,selection),preview.base_qty)!==0||compareUnitDecimals(selection.unitPrice,preview.unit_price)!==0||compareUnitDecimals(selectedLineTotal(quantity,selection),preview.line_total)!==0||next.revision!==selection.revision||identity(snapshot)!==identity(selection.snapshot)
  return {selection:next,quantity:preview.qty,changed}
}
export function countBaseQuantity(boxes:string,factor:string,loose:string,baseDecimals:number):string|null{
  const whole=normalizeUnitDecimal(boxes||'0',{decimals:0})
  if(whole==='0')return normalizeUnitDecimal(loose||'0',{decimals:baseDecimals})
  const converted=convertUnitQuantity(whole,factor,baseDecimals)
  if(converted.roundingRequired)return null
  return normalizeUnitDecimal(unitFromTicks(unitTicks(converted.baseQty)+unitTicks(normalizeUnitDecimal(loose||'0',{decimals:baseDecimals}))),{decimals:baseDecimals})
}
export const unitCartKey=(productId:string,selection?:UnitSelection)=>selection?JSON.stringify([productId,selection.presentationId,selection.snapshot.presentation?.version??null,selection.revision,selection.priceContext,selection.sourceLineId??null]):productId
export const selectedQuantity=(raw:string,selection:UnitSelection)=>normalizeUnitDecimal(raw,{decimals:selection.snapshot.presentation?.decimals??selection.snapshot.baseUnit.decimals,allowZero:false})
export function selectedBaseQuantity(raw:string,selection:UnitSelection){
  if(selection.sourceLineId&&selection.sourceBasis==='ORIGINAL'){
    const original=unitTicks(selection.sourceQty!),scaled=unitTicks(selectedQuantity(raw,selection))*unitTicks(selection.sourceBaseQty!)
    if(!original||scaled%original)throw Error('Usa la unidad base para esta cantidad parcial')
    try{return normalizeUnitDecimal(unitFromTicks(scaled/original),{decimals:selection.snapshot.baseUnit.decimals,allowZero:false})}catch{throw Error('Usa la unidad base para esta cantidad parcial')}
  }
  const converted=convertUnitQuantity(selectedQuantity(raw,selection),selection.snapshot.factor,selection.snapshot.baseUnit.decimals);if(converted.roundingRequired&&!selection.acceptRounding)throw Error(`Revisa el redondeo a ${converted.baseQty} ${selection.snapshot.baseUnit.label}`);return converted.baseQty
}
export const selectedLineTotal=(raw:string,selection:UnitSelection)=>selection.sourceLineId?previewUnitPartialTotal(selection.sourceBaseQty!,selection.sourceNetTotal!,selectedBaseQuantity(raw,selection),selection.sourceConsumedBase??'0'):unitLineTotal(selectedQuantity(raw,selection),selection.unitPrice)
export const selectedUnitPayload=(selection?:UnitSelection)=>selection?{presentation_id:selection.presentationId,unit_revision:selection.revision,accept_rounding:selection.acceptRounding}:{}
