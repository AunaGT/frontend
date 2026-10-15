import {apiFetch,getApiBaseUrl,getAuthToken,tenantHeaders} from '@/services/api'
import type {CouponAsset} from './CouponCanvas'
export type CouponScope={companyId:string;draftId?:string;promotionId?:string}
const headers=(ctx:CouponScope)=>({...tenantHeaders(),'X-Company-Id':ctx.companyId})
const query=(ctx:CouponScope)=>new URLSearchParams({...ctx.draftId?{draft_id:ctx.draftId}:{},...ctx.promotionId?{promotion_id:ctx.promotionId}:{}}).toString()
export async function uploadCouponAsset(file:File,ctx:CouponScope,signal?:AbortSignal):Promise<CouponAsset>{
  const body=new FormData();body.append('file',file)
  const token=getAuthToken(),res=await fetch(`${getApiBaseUrl()}/promotions/coupon-assets?${query(ctx)}`,{method:'POST',credentials:'include',headers:{...headers(ctx),...(token?{Authorization:`Bearer ${token}`}:{})},body,signal})
  const data=await res.json();if(!res.ok)throw Error(data.message||'No se pudo cargar la imagen del cupón')
  return data
}
export const resolveCouponAssets=(ids:string[],ctx:CouponScope,signal?:AbortSignal)=>ids.length?apiFetch<CouponAsset[]>('/promotions/coupon-assets/resolve',{method:'POST',headers:headers(ctx),body:JSON.stringify({asset_ids:ids,draft_id:ctx.draftId,promotion_id:ctx.promotionId}),signal}):Promise.resolve([])
export const removeDraftCouponAsset=(id:string,ctx:CouponScope,signal?:AbortSignal)=>apiFetch<void>(`/promotions/coupon-assets/${id}?${query(ctx)}`,{method:'DELETE',headers:headers(ctx),signal})
