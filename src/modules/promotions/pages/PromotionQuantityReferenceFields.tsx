import {useEffect} from 'react'
import {useQuery} from '@tanstack/react-query'
import {useTenant} from '@/context/useTenant'
import {useSystemSettings} from '@/hooks/useSystemSettings'
import {fetchUnits} from '@/modules/inventory/units/public'
import {fetchAllProducts} from '@/services/productService'
import {Label} from '@/components/ui/label'

export type PromotionQuantityReference={version:1;trigger:{id:string;code:string;family:string;factor:string};gift:{id:string;code:string;family:string;factor:string}|null}
export type PromotionReferenceDraft={trigger_unit_id:string;gift_unit_id:string}
export const promotionReferenceDraft=(reference?:PromotionQuantityReference|null):PromotionReferenceDraft=>({trigger_unit_id:reference?.trigger.id??'',gift_unit_id:reference?.gift?.id??''})
export function promotionReferenceInput(draft:PromotionReferenceDraft){
  if(!draft.trigger_unit_id){if(draft.gift_unit_id)throw Error('Selecciona la referencia del activador');return null}
  return {trigger_unit_id:draft.trigger_unit_id,...(draft.gift_unit_id?{gift_unit_id:draft.gift_unit_id}:{})}
}
const quantityTypes=['BUY_X_GET_Y','MIN_QTY_DISCOUNT','FREE_GIFT','COMBO_DISCOUNT']
export function PromotionQuantityReferenceFields({typeName,value,onChange,onError,productIds,categoryIds,appliesToAll,triggerProductId,targetProductId}:{typeName?:string;value:PromotionReferenceDraft;onChange:(next:PromotionReferenceDraft)=>void;onError:(error:string)=>void;productIds:string[];categoryIds:number[];appliesToAll:boolean;triggerProductId:string;targetProductId:string}){
  const {company,branch}=useTenant(),{inventoryUnitsEnabled}=useSystemSettings()
  const supported=!!typeName&&quantityTypes.includes(typeName),enabled=supported&&inventoryUnitsEnabled&&!!company&&!!branch
  const unitsQuery=useQuery({queryKey:['promotion-reference-units',company?.id,branch?.id],queryFn:({signal})=>fetchUnits({companyId:company!.id,branchId:branch!.id},signal),enabled})
  const productsQuery=useQuery({queryKey:['promotion-reference-products',company?.id,branch?.id],queryFn:({signal})=>fetchAllProducts({catalogType:'goods'},{signal,headers:{'X-Company-Id':company!.id,'X-Branch-Id':branch!.id}}),enabled})
  const units=enabled?(unitsQuery.data?.items.filter(unit=>unit.active)??[]):[],trigger=units.find(unit=>unit.id===value.trigger_unit_id),gift=units.find(unit=>unit.id===value.gift_unit_id)
  let error=''
  const excluded:string[]=[]
  if(supported&&!value.trigger_unit_id&&value.gift_unit_id)error='Selecciona primero la referencia activadora.'
  if(supported&&value.trigger_unit_id){
    if(!enabled)error='Selecciona una sucursal con unidades habilitadas.'
    else if(unitsQuery.isFetching||productsQuery.isFetching)error='Verificando unidades y productos…'
    else if(unitsQuery.isError||productsQuery.isError||!trigger)error='No se pudieron verificar las unidades. Revisa la selección.'
    else if(trigger.family!=='COUNT'&&(appliesToAll||categoryIds.length||(!productIds.length&&!triggerProductId)))error='Una referencia medida requiere productos concretos de la misma familia.'
    if(trigger){
      const ids=[...new Set([...productIds,triggerProductId].filter(Boolean))]
      for(const id of [...ids,...(targetProductId?[targetProductId]:[])]){
        const product=productsQuery.data?.find(p=>p.id===id),family=product?.unitConfiguration?.base_unit?.family??'COUNT'
        const reference=id===targetProductId?gift:trigger
        if(!product||product.kind==='SERVICE'||(product.unitConfiguration&&!product.unitConfiguration.base_unit)||family!==(reference?.family??'COUNT'))excluded.push(product?.name??id)
      }
      if(typeName==='BUY_X_GET_Y'&&gift&&gift.family!==trigger.family)error='La referencia del regalo debe tener la misma familia que el activador.'
      if(excluded.length)error=`Productos incompatibles excluidos: ${excluded.join(', ')}. Revisa la selección antes de guardar.`
    }
    if(value.gift_unit_id&&!gift)error='La referencia del regalo ya no está disponible.'
  }
  useEffect(()=>{onError(error)},[error,onError])
  if(!supported||!inventoryUnitsEnabled)return null
  return <div className="space-y-2 border-t pt-3">
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="promotion-trigger-reference">Referencia de la cantidad activadora</Label><select id="promotion-trigger-reference" className="auna-control auna-control-select" aria-label="Referencia de cantidad activadora" value={value.trigger_unit_id} disabled={!enabled||unitsQuery.isLoading} onChange={event=>onChange({trigger_unit_id:event.target.value,gift_unit_id:''})}><option value="">Unidades de conteo (regla existente)</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name} · {unit.code}</option>)}</select></div>
    {['BUY_X_GET_Y','FREE_GIFT','COMBO_DISCOUNT'].includes(typeName!)&&<div className="space-y-1"><Label htmlFor="promotion-gift-reference">Referencia de la cantidad de regalo</Label><select id="promotion-gift-reference" className="auna-control auna-control-select" aria-label="Referencia de cantidad de regalo" value={value.gift_unit_id} disabled={!enabled||!trigger} onChange={event=>onChange({...value,gift_unit_id:event.target.value})}><option value="">{typeName==='BUY_X_GET_Y'?'La misma que el activador':'Unidades de conteo'}</option>{units.filter(unit=>typeName!=='BUY_X_GET_Y'||unit.family===trigger?.family).map(unit=><option key={unit.id} value={unit.id}>{unit.name} · {unit.code}</option>)}</select></div>}</div>
    <p className="text-xs text-muted-foreground">Umbrales en {trigger?.label??'unidades de conteo'}{typeName==='BUY_X_GET_Y'||typeName==='FREE_GIFT'?` · Regalo en ${gift?.label??(typeName==='BUY_X_GET_Y'?trigger?.label??'unidades de conteo':'unidades de conteo')}`:''}. Cada regalo conserva su propia referencia.</p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>
}
