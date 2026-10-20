import { apiFetch, getActiveCompanyId, getActiveBranchId } from '@/services/api'
import type { ApiProduct } from '@/types/product'
export type ScannerScope = { companyId: string; branchId: string; canViewProducts: boolean; inventoryEnabled: boolean }
export async function lookupScannedUnitProduct(scope:ScannerScope,code:string,{signal}:{signal?:AbortSignal}={}){
  assertScope(scope,signal)
  if(typeof code!=='string'||!code.trim()||code.length>100||/[\x00-\x1f\x7f]/.test(code))throw Error('Ingresa un código válido')
  const options={signal,headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}}
  const resolved=await apiFetch<{product_id:string;presentation_id:string|null;unit_revision:number}>(`/api/products/barcodes/resolve?${new URLSearchParams({code,operation:'SALE'})}`,options)
  assertScope(scope,signal)
  const product=await apiFetch<ApiProduct>(`/api/products/${encodeURIComponent(resolved.product_id)}`,options)
  assertScope(scope,signal)
  if(product.id!==resolved.product_id||product.unit_revision!==resolved.unit_revision)throw Error('La presentación cambió durante la lectura. Vuelve a escanear el producto.')
  return {product,presentationId:resolved.presentation_id,unitRevision:resolved.unit_revision}
}
function assertScope(scope: ScannerScope, signal?: AbortSignal) {
  if (!scope.canViewProducts || !scope.inventoryEnabled) throw new Error('Necesitas acceso al catálogo de Inventario para buscar productos')
  if (signal?.aborted || !scope.companyId || !scope.branchId || scope.branchId === 'all' || getActiveCompanyId() !== scope.companyId || getActiveBranchId() !== scope.branchId) throw new DOMException('Selecciona una sucursal activa', 'AbortError')
}
export async function lookupScannedProduct(scope: ScannerScope, code: string, { signal }: { signal?: AbortSignal } = {}): Promise<ApiProduct | null> {
  assertScope(scope, signal)
  if (typeof code !== 'string' || !code.length || code.length > 128 || /[\x00-\x1f\x7f]/.test(code)) throw new Error('Ingresa un código entre 1 y 128 caracteres sin saltos de línea')
  let match: ApiProduct | null = null
  for (let page = 1; page <= 50; page++) {
    const params = new URLSearchParams({ search: code, in_branch: '1', branch_id: scope.branchId, page: String(page), pageSize: '100' })
    const result = await apiFetch<{ items: ApiProduct[]; page: number; totalPages: number }>(`/products?${params}`, { signal, headers: { 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId } })
    assertScope(scope, signal)
    if (!Array.isArray(result.items) || result.page !== page || !Number.isInteger(result.totalPages) || result.totalPages < 1 || result.totalPages > 50) throw new Error('No se pudo verificar todo el catálogo. Ajusta el código y vuelve a intentar.')
    for (const item of result.items) if (item.barcode === code && !item.deleted && !item.deleted_at) {
      if (match && match.id !== item.id) throw new Error('El código corresponde a varios artículos. Revisa el catálogo antes de continuar.')
      match = item
    }
    if (page >= result.totalPages) return match
  }
  throw new Error('No se pudo verificar el catálogo completo')
}
export function shouldSubmitScan(event: { key: string; target: EventTarget | null; currentTarget: EventTarget | null }, suffix: 'ENTER' | 'TAB' | 'NONE'): boolean {
  const target = event.target as HTMLInputElement | null, current = event.currentTarget as HTMLInputElement | null
  return !!target && target.tagName === 'INPUT' && target.type !== 'password' && target.id === current?.id && ((event.key === 'Enter' && suffix === 'ENTER') || (event.key === 'Tab' && suffix === 'TAB'))
}
