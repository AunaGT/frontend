import { apiFetch } from '@/services/api'
import { applicableReportFilters } from '../reportCatalog'
import { preparedReportSchema, type PreparedReport, type ReportFilters, type ReportId } from '../reportModel'
export async function fetchPreparedReport(id: ReportId, companyId: string, filters: ReportFilters, signal?: AbortSignal): Promise<PreparedReport> {
  if (!companyId) throw new Error('Selecciona una empresa.')
  const clean = applicableReportFilters(id, filters)
  const params = new URLSearchParams({ format: 'json' })
  for (const [key, value] of Object.entries(clean)) {
    if (key === 'branchId') continue
    params.set(({ warehouseId: 'warehouse_id', locationId: 'location_id', productId: 'product_id',catalogType:'catalog_type' } as Record<string, string>)[key] || key, String(value))
  }
  const raw = await apiFetch<unknown>(`/reports/${id}?${params}`, { method: 'GET', signal, headers: { 'X-Company-Id': companyId, 'X-Branch-Id': clean.branchId } })
  const parsed = preparedReportSchema.safeParse(raw)
  if (!parsed.success || parsed.data.id !== id || parsed.data.scope.companyId !== companyId || (clean.branchId !== 'all' && parsed.data.scope.branches.some(b => b.id !== clean.branchId))) throw new Error('El servidor devolvió un reporte inválido o de otro contexto. Intenta prepararlo nuevamente.')
  return parsed.data
}
