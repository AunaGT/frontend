import {useMemo} from 'react'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {fetchPosAvailability,type ProductAvailability} from '@/services/productService'
import {authSessionIdentity} from '@/services/authSession'
import type {CheckoutScope} from '../checkout/attemptStorage'

export function posAvailabilityOptions(scope:CheckoutScope,locationId:string|null,productIds:string[]){
  const ids=[...new Set(productIds)].sort(),session=authSessionIdentity()
  return {
    queryKey:['products','pos-availability',scope.companyId,scope.branchId,scope.userId,session,locationId,ids] as const,
    staleTime:15_000,gcTime:0,retry:false,refetchOnWindowFocus:'always' as const,
    queryFn:async({signal}:{signal:AbortSignal})=>{
      const availability:Record<string,ProductAvailability>={}
      const check=()=>{if(signal.aborted||authSessionIdentity()!==session)throw new DOMException('Cambió la sesión','AbortError')}
      for(let offset=0;offset<ids.length;offset+=400){
        check()
        const groups=[ids.slice(offset,offset+200),ids.slice(offset+200,offset+400)].filter(group=>group.length)
        const results=await Promise.all(groups.map(group=>fetchPosAvailability(group,{signal,headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}})))
        check()
        for(const result of results){
          if(!result.salesLocation.configured||result.salesLocation.id!==locationId)throw Error('La ubicación de venta cambió. Actualiza el punto de venta.')
          Object.assign(availability,result.availability)
        }
      }
      return {availability,salesLocation:{configured:!!locationId,id:locationId}}
    },
  }
}
export function usePosAvailability(scope:CheckoutScope,locationId:string|null,productIds:string[],enabled:boolean){
  const client=useQueryClient(),idsKey=JSON.stringify([...new Set(productIds)].sort()),session=authSessionIdentity()
  const ids=useMemo<string[]>(()=>JSON.parse(idsKey),[idsKey])
  const options=useMemo(()=>posAvailabilityOptions(scope,locationId,ids),[scope.companyId,scope.branchId,scope.userId,session,locationId,ids])
  const query=useQuery({...options,enabled:enabled&&ids.length>0&&!!locationId})
  return {availability:query.data?.availability??{},ensureCurrent:(requested:string[])=>client.fetchQuery(posAvailabilityOptions(scope,locationId,[...ids,...requested])),invalidate:()=>client.invalidateQueries({queryKey:['products','pos-availability',scope.companyId,scope.branchId]})}
}
