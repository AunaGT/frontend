import { apiFetch, getActiveCompanyId, getActiveBranchId } from '@/services/api'
import type { AgendaScope, AgendaFilter, Page, SessionDto, AgendaEntryDto } from './types'

export const appointmentQueryKey = (scope: AgendaScope, kind: string, params: object = {}) => ['appointments', scope.companyId, scope.branchId, kind, params] as const
export function assertCurrentScope(scope: AgendaScope, signal?: AbortSignal) {
  if (signal?.aborted || getActiveCompanyId() !== scope.companyId || (getActiveBranchId() || 'all') !== scope.branchId) throw new DOMException('Cambió la empresa o sucursal activa', 'AbortError')
}
async function request<T>(path: string, scope: AgendaScope, options: RequestInit): Promise<T> {
  if (!scope.companyId || !scope.branchId) throw new Error('Selecciona una empresa y sucursal')
  if (!path.startsWith('/') || path.includes('..') || path.includes('://')) throw new Error('Destino de Agenda no válido')
  assertCurrentScope(scope, options.signal || undefined)
  const result = await apiFetch<T>(`/appointments${path}`, { ...options, headers: { 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId } })
  assertCurrentScope(scope, options.signal || undefined)
  return result
}
export const getAgenda = <T>(path: string, scope: AgendaScope, signal?: AbortSignal) => request<T>(path, scope, { method: 'GET', signal })
export const mutateAgenda = <T>(path: string, scope: AgendaScope, input: object, signal?: AbortSignal, method = 'POST') => {
  if (scope.branchId === 'all') return Promise.reject(new Error('Selecciona una sucursal para guardar cambios'))
  return request<T>(path, scope, { method, signal, body: JSON.stringify(input) })
}
export function agendaParams(input: object) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) if (value !== undefined && value !== '') params.set(key, String(value))
  return params.toString()
}
export async function fetchAllSessions(scope: AgendaScope, filter: AgendaFilter, signal?: AbortSignal): Promise<SessionDto[]> {
  return fetchAll<SessionDto>('sessions',scope,filter,signal)
}
export async function fetchAllEntries(scope:AgendaScope,filter:AgendaFilter,signal?:AbortSignal):Promise<AgendaEntryDto[]> {
  return fetchAll<AgendaEntryDto>('entries',scope,filter,signal)
}
async function fetchAll<T extends {id:string}>(kind:string,scope:AgendaScope,filter:AgendaFilter,signal?:AbortSignal):Promise<T[]> {
  const items: T[] = []
  let total:number|undefined
  for (let page = 1; ; page++) {
    const result = await getAgenda<Page<T>>(`/${kind}?${agendaParams({ ...filter, page, pageSize: 100 })}`, scope, signal)
    if (!Array.isArray(result.items) || !Number.isInteger(result.totalItems) || result.totalItems<0 || result.totalItems > 5000 || result.page !== page || result.pageSize!==100 || (page > 1 && !result.items.length) || (total!==undefined&&total!==result.totalItems)) throw new Error('Acota el período o los filtros para cargar la agenda completa')
    total=result.totalItems
    items.push(...result.items)
    if(items.length>result.totalItems||items.length>5000) throw new Error('La agenda cambió durante la carga; actualiza los datos')
    if (items.length >= result.totalItems) break
  }
  if (new Set(items.map(s => s.id)).size !== items.length) throw new Error('La agenda cambió durante la carga; actualiza los datos')
  return items
}
