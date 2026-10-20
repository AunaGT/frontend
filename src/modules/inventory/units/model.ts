import {normalizeUnitDecimal,normalizeProductQuantity} from '@/lib/unitQuantity'
import type {Product,ProductKind} from '@/types/product'
import type {InitialUnitsConfiguration,Presentation,PresentationDraft,PresentationInput,ProductUnitsDraft,UnitConfiguration,UnitValues} from './types'

export function advancedProduct(product:{base_unit_id?:string|null;unit_metadata_version?:number}){
  if(product.base_unit_id&&![1,2].includes(product.unit_metadata_version??0))throw Error('Recarga los datos completos de unidad del producto')
  return product.unit_metadata_version===2
}

export const emptyUnitsDraft=():ProductUnitsDraft=>({baseUnitId:'',quantityDecimals:'0',presentations:[],defaultPurchaseKey:null,defaultSaleKey:null})
export const presentationDraft=(p:Presentation):PresentationDraft=>({key:p.id,id:p.id,version:p.version,name:p.name,label:p.label,factor:p.factor,quantityDecimals:String(p.quantity_decimals),purchaseEnabled:p.purchase_enabled,saleEnabled:p.sale_enabled,price:p.prices.LIST??'',wholesale:p.prices.WHOLESALE??'',promotion:p.prices.PROMOTION??'',promotionUntil:p.promotion_valid_until?.slice(0,16)??'',barcode:p.barcode??'',measureUnitId:p.measure_unit_id??null})
export function unitsDraft(configuration?:UnitConfiguration):ProductUnitsDraft{
  return configuration?{baseUnitId:configuration.base_unit_id,quantityDecimals:String(configuration.quantity_decimals),presentations:configuration.presentations.filter(p=>p.active).map(presentationDraft),defaultPurchaseKey:configuration.default_purchase_presentation_id,defaultSaleKey:configuration.default_sale_presentation_id}:emptyUnitsDraft()
}
export function presentationInput(row:PresentationDraft,kind:ProductKind='STANDARD'):PresentationInput{
  const maximum=kind==='SERVICE'?4:6
  if(!row.name.trim()||row.name.trim().length>100||!row.label.trim()||row.label.trim().length>50)throw new Error('Completa el nombre y la etiqueta de la presentación')
  if(!/^\d$/.test(row.quantityDecimals)||Number(row.quantityDecimals)>maximum)throw new Error(`Elige de 0 a ${maximum} decimales para la presentación`)
  return {name:row.name.trim(),label:row.label.trim(),quantity_decimals:Number(row.quantityDecimals),...(row.measureUnitId?{measure_unit_id:row.measureUnitId}:{measure_unit_id:null,factor:normalizeUnitDecimal(row.factor,{decimals:12,max:'99999999.999999999999',allowZero:false})}),purchase_enabled:row.purchaseEnabled,sale_enabled:row.saleEnabled,prices:Object.fromEntries([['LIST',row.price],['WHOLESALE',row.wholesale],['PROMOTION',row.promotion]].map(([key,value])=>[key,value.trim()?normalizeUnitDecimal(value,{decimals:6,max:'9999999999.99'}):null])),barcode:row.barcode.trim()||null,promotion_valid_until:row.promotionUntil?new Date(row.promotionUntil).toISOString():null}
}
export function initialUnitsConfiguration(value:ProductUnitsDraft,kind:ProductKind):InitialUnitsConfiguration|undefined{
  if(!value.baseUnitId)return undefined
  const max=kind==='KIT'?0:kind==='SERVICE'?4:6
  if(!/^\d$/.test(value.quantityDecimals)||Number(value.quantityDecimals)>max)throw new Error(`Elige de 0 a ${max} decimales para las existencias`)
  for(const [key,enabled] of [[value.defaultPurchaseKey,'purchaseEnabled'],[value.defaultSaleKey,'saleEnabled']] as const)if(key&&!value.presentations.some(p=>p.key===key&&p[enabled]))throw new Error('Selecciona una presentación predeterminada disponible')
  return {base_unit_id:value.baseUnitId,quantity_decimals:Number(value.quantityDecimals),presentations:value.presentations.map(p=>({client_key:p.key,...presentationInput(p,kind)})),default_purchase_key:value.defaultPurchaseKey,default_sale_key:value.defaultSaleKey}
}
export function exactProductValues(product:Product):UnitValues{
  return product.unitValues??{stock:String(product.stock),minStock:String(product.minStock),price:String(product.price),priceWholesale:product.priceWholesale==null?null:String(product.priceWholesale),pricePromotion:product.pricePromotion==null?null:String(product.pricePromotion),cost:String(product.cost)}
}
export function productDecimalPayload(input:{stock?:string;minStock?:string;cost?:string;price:string;priceWholesale?:string;pricePromotion?:string},{kind,quantityDecimals,advanced}:{kind:ProductKind;quantityDecimals:number;advanced:boolean},locale='es-GT'){
  const rules={kind,quantityDecimals,advanced}
  const price=(value:string)=>normalizeUnitDecimal(value,{decimals:advanced?6:2,max:'9999999999.99'})
  return {price:price(input.price),price_wholesale:input.priceWholesale?.trim()?price(input.priceWholesale):null,price_promotion:input.pricePromotion?.trim()?price(input.pricePromotion):null,...(kind==='SERVICE'?{}:{stock:normalizeProductQuantity(input.stock||'0',rules,locale),min_stock:normalizeProductQuantity(input.minStock||'0',rules,locale),...(input.cost===undefined?{}:{cost:normalizeUnitDecimal(input.cost||'0',{decimals:advanced?6:2,max:'9999999999.99'})})})}
}
