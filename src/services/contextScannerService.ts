import {apiFetch,getActiveCompanyId,getActiveBranchId} from '@/services/api'
import {authSessionIdentity} from '@/services/authSession'
import type {ApiProduct} from '@/types/product'
export type ScanOperation='SALE'|'PURCHASE'|'LOOKUP'
export type StockScanAction='move'|'loss'|'surplus'|'replenishment'|'history'
export type StockScanIntent={action:StockScanAction;code:string;productId:string;identity:string}
export function scannerIdentity(){return JSON.stringify([getActiveCompanyId(),getActiveBranchId(),authSessionIdentity()])}
export async function resolveContextScan(code:string,operation:ScanOperation,signal?:AbortSignal){
 const companyId=getActiveCompanyId(),branchId=getActiveBranchId(),identity=scannerIdentity()
 if(!companyId||!branchId||branchId==='all'||signal?.aborted)throw new DOMException('Selecciona una sucursal','AbortError')
 const out=await apiFetch<{product:ApiProduct;presentationId:string|null;unitRevision:number}>(`/products/scan?${new URLSearchParams({code,operation})}`,{signal,headers:{'X-Company-Id':companyId,'X-Branch-Id':branchId}})
 if(signal?.aborted||identity!==scannerIdentity())throw new DOMException('Cambió la empresa, sucursal o sesión','AbortError')
 return out
}
export async function operationalScanner(signal:AbortSignal){
 const companyId=getActiveCompanyId(),branchId=getActiveBranchId(),identity=scannerIdentity()
 let station:string|null=null
 try{const user=JSON.parse(localStorage.getItem('auth:user')||'null');station=localStorage.getItem(`hardware:workstation:${JSON.stringify([companyId,branchId,user?.id])}`)}catch{/* Explicit input works without remembered hardware. */}
 if(!station||!companyId||!branchId||branchId==='all')return null
 const out=await apiFetch<{name:string;profile:{scannerSuffix?:'ENTER'|'TAB'|'NONE';scannerPrefix?:string;scannerMinLength?:number;scannerMaxLength?:number}}|null>(`/products/scanner-profile?${new URLSearchParams({workstationId:station})}`,{signal,headers:{'X-Company-Id':companyId,'X-Branch-Id':branchId}})
 if(signal.aborted||identity!==scannerIdentity())throw new DOMException('Cambió la sesión','AbortError');return out
}
