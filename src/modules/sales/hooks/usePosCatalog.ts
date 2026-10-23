import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {adaptApiProduct,fetchPosCatalog,fetchPosCatalogCategories,fetchPosCatalogItems,postPricingPreview,type PosCatalogFilters,type PricingPreviewResponse} from '@/services/productService'
import {authSessionIdentity} from '@/services/authSession'
import type {Product} from '@/types/product'
import type {CheckoutScope} from '../checkout/attemptStorage'

export function usePosCatalog(scope:CheckoutScope,filters:PosCatalogFilters,enabled:boolean){
 const session=authSessionIdentity(),owner=useMemo(()=>({active:true,controller:new AbortController(),products:new Map<string,Product>()}),[scope.companyId,scope.branchId,scope.userId,session])
 const currentOwner=useRef(owner);currentOwner.current=owner
 useEffect(()=>{owner.active=true;return()=>{owner.active=false;owner.controller.abort();owner.products.clear()}},[owner])
 const check=useCallback((signal?:AbortSignal)=>{if(!enabled||!owner.active||currentOwner.current!==owner||signal?.aborted||authSessionIdentity()!==session)throw new DOMException('Cambió la sesión o sucursal','AbortError')},[owner,enabled,session])
 const search=filters.search.trim(),[debouncedSearch,setDebouncedSearch]=useState(search),[revision,setRevision]=useState(0)
 useEffect(()=>{const timer=setTimeout(()=>setDebouncedSearch(search),300);return()=>clearTimeout(timer)},[search])
 const settled=debouncedSearch===search,normalized={...filters,search:debouncedSearch,category:debouncedSearch?null:filters.category}
 const prefix=['products','pos-catalog',scope.companyId,scope.branchId,scope.userId,session]
 const common={staleTime:15_000,gcTime:0,retry:false,enabled:enabled&&!!scope.companyId&&!!scope.branchId&&scope.branchId!=='all'&&settled}
 const query=useQuery({...common,queryKey:[...prefix,'page',normalized],queryFn:async({signal})=>{
  check(signal);const result=await fetchPosCatalog(scope,normalized,signal);check(signal)
  if(!Array.isArray(result.items)||!Number.isSafeInteger(result.totalItems)||result.totalItems<0||!Number.isSafeInteger(result.page)||result.page<1||!Number.isSafeInteger(result.totalPages)||result.totalPages<1)throw Error('Respuesta de catálogo inválida')
  return{...result,items:result.items.map(adaptApiProduct)}
 }})
 const categories=useQuery({...common,queryKey:[...prefix,'categories',normalized.search,normalized.catalogType],queryFn:async({signal})=>{
  check(signal);const result=await fetchPosCatalogCategories(scope,normalized,signal);check(signal);if(!Array.isArray(result.items))throw Error('Respuesta de categorías inválida');return result
 }})
 const mergedPage=useRef<{owner:typeof owner;data:unknown}|null>(null)
 if(enabled&&query.data&&(mergedPage.current?.owner!==owner||mergedPage.current?.data!==query.data)){
  for(const product of query.data.items)owner.products.set(product.id,product)
  mergedPage.current={owner,data:query.data}
 }
 const ensureProducts=useCallback(async(requested:string[])=>{
  check(owner.controller.signal);const ids=[...new Set(requested)].sort(),items:Product[]=[],missingIds:string[]=[]
  for(let offset=0;offset<ids.length;offset+=400){
   const groups=[ids.slice(offset,offset+200),ids.slice(offset+200,offset+400)].filter(group=>group.length)
   const responses=await Promise.all(groups.map(async group=>{
    const result=await fetchPosCatalogItems(scope,group,filters.catalogType,owner.controller.signal);check(owner.controller.signal)
    const expected=new Set(group),seen=new Set<string>()
    if(!Array.isArray(result.items)||!Array.isArray(result.missingIds))throw Error('Respuesta de productos incompleta')
    for(const id of [...result.items.map(item=>item.id),...result.missingIds]){if(typeof id!=='string'||!expected.has(id)||seen.has(id))throw Error('Respuesta de productos incompleta');seen.add(id)}
    if(seen.size!==expected.size)throw Error('Respuesta de productos incompleta')
    return{items:result.items.map(adaptApiProduct),missingIds:result.missingIds}
   }))
   for(const response of responses){items.push(...response.items);missingIds.push(...response.missingIds)}
  }
  check(owner.controller.signal)
  for(const item of items)owner.products.set(item.id,item)
  setRevision(value=>value+1)
  return{items,missingIds}
 },[check,owner,scope.companyId,scope.branchId,filters.catalogType])
 // El índice es local al POS: navegar de página no expulsa las líneas ya elegidas.
 const retainedProducts=useMemo(()=>enabled?[...owner.products.values()]:[],[owner,enabled,query.data,revision])
 return{...query,data:enabled&&settled?query.data:undefined,isLoading:query.isLoading||!settled,categories:{...categories,data:enabled?categories.data:undefined},retainedProducts,ensureProducts}
}

export async function preparePosPrices(scope:CheckoutScope,productIds:string[],salesChannel:string,customerContactId:string|null,signal?:AbortSignal){
 const ids=[...new Set(productIds)].sort(),session=authSessionIdentity(),unit_prices:Record<string,number>={}
 let tier:PricingPreviewResponse['price_tier_used']|undefined
 for(let offset=0;offset<ids.length;offset+=400){
  const groups=[ids.slice(offset,offset+200),ids.slice(offset+200,offset+400)].filter(group=>group.length)
  const results=await Promise.all(groups.map(async group=>{
   if(signal?.aborted||authSessionIdentity()!==session)throw new DOMException('Cambió la sesión','AbortError')
   const result=await postPricingPreview({product_ids:group,sales_channel:salesChannel,customer_contact_id:customerContactId},{signal,headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}})
   if(signal?.aborted||authSessionIdentity()!==session)throw new DOMException('Cambió la sesión','AbortError')
   if(!group.every(id=>Object.prototype.hasOwnProperty.call(result.unit_prices??{},id)&&Number.isFinite(result.unit_prices[id])))throw Error('La preparación de precios está incompleta')
   return result
  }))
  for(const result of results){if(tier&&tier!==result.price_tier_used)throw Error('La tarifa cambió durante la preparación de precios');tier=result.price_tier_used;Object.assign(unit_prices,result.unit_prices)}
 }
 return{unit_prices,price_tier_used:tier??'LIST'}
}
