import {apiFetch} from '@/services/api'
import type {ApiProduct} from '@/types/product'
import type {MeasureUnit,Presentation,PresentationInput,UnitScope,UnitPreview,UnitPreviewLine} from './types'

const options=(scope:UnitScope,signal?:AbortSignal):RequestInit=>({headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId},signal})
const productPath=(id:string)=>`/api/products/${encodeURIComponent(id)}`
export const fetchUnits=(scope:UnitScope,signal?:AbortSignal)=>apiFetch<{items:MeasureUnit[]}>(`/api/products/units?include_archived=true`,options(scope,signal))
export const saveUnit=(scope:UnitScope,input:Partial<Omit<MeasureUnit,'id'|'company_id'|'is_standard'>>,id?:string)=>apiFetch<MeasureUnit>(`/api/products/units${id?'/'+encodeURIComponent(id):''}`,{...options(scope),method:id?'PUT':'POST',body:JSON.stringify(input)})
export const fetchPresentations=(scope:UnitScope,id:string,signal?:AbortSignal)=>apiFetch<{items:Presentation[];unit_revision:number;base_unit_locked:boolean}>(`${productPath(id)}/presentations?include_archived=true`,options(scope,signal))
export const savePresentation=(scope:UnitScope,productId:string,revision:number,input:PresentationInput,id?:string)=>apiFetch<{presentation:Presentation;unit_revision:number}>(`${productPath(productId)}/presentations${id?'/'+encodeURIComponent(id):''}`,{...options(scope),method:id?'PUT':'POST',body:JSON.stringify({...input,unit_revision:revision})})
export const archivePresentation=(scope:UnitScope,productId:string,id:string,revision:number)=>apiFetch<{presentation:Presentation;unit_revision:number}>(`${productPath(productId)}/presentations/${encodeURIComponent(id)}`,{...options(scope),method:'DELETE',body:JSON.stringify({unit_revision:revision})})
export const configureProductUnits=(scope:UnitScope,id:string,input:{unit_revision:number;base_unit_id?:string;quantity_decimals?:number;default_purchase_presentation_id?:string|null;default_sale_presentation_id?:string|null})=>apiFetch<ApiProduct>(`${productPath(id)}/units`,{...options(scope),method:'PUT',body:JSON.stringify(input)})
export const previewUnitLine=(scope:UnitScope,id:string,input:{qty:string;presentation_id?:string|null;unit_revision:number;accept_rounding?:boolean;price_tier?:'LIST'|'WHOLESALE'|'PROMOTION';operation?:'SALE'|'PURCHASE'},signal?:AbortSignal)=>apiFetch<UnitPreview>(`${productPath(id)}/presentations/preview`,{...options(scope,signal),method:'POST',body:JSON.stringify(input)})
export const previewUnitLines=(scope:UnitScope,lines:UnitPreviewLine[],signal?:AbortSignal)=>apiFetch<{items:{client_line_key:string;preview:UnitPreview}[]}>('/api/products/presentations/preview-batch',{...options(scope,signal),method:'POST',body:JSON.stringify({lines})})
