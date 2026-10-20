import { apiFetch, getActiveCompanyId, getActiveBranchId } from '@/services/api'
import type { HardwareScope, WorkspaceDto, Workstation, Device, WorkstationInput, DeviceInput, Assignment, HardwareTestInput, TestRun, HardwarePage, AuditEvent } from './types'
export function assertHardwareScope(scope: HardwareScope, signal?: AbortSignal) {
  if (signal?.aborted || !scope.companyId || !scope.branchId || scope.companyId !== getActiveCompanyId() || scope.branchId !== getActiveBranchId()) throw new DOMException('Cambió la empresa o sucursal', 'AbortError')
}
async function request<T>(scope: HardwareScope, path: string, options: RequestInit = {}): Promise<T> {
  assertHardwareScope(scope, options.signal || undefined)
  if (options.method && options.method !== 'GET' && scope.branchId === 'all') throw new Error('Selecciona una sucursal para guardar cambios')
  const value = await apiFetch<T>(`/settings/hardware${path}`, { ...options, headers: { 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId } })
  assertHardwareScope(scope, options.signal || undefined)
  return value
}
export const getHardwareWorkspace = (scope: HardwareScope, signal?: AbortSignal) => request<WorkspaceDto>(scope, '/workspace', { signal })
export const saveHardwareWorkstation = (scope: HardwareScope, id: string | null, input: WorkstationInput) => request<Workstation>(scope, `/workstations${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) })
export const saveHardwareDevice = (scope: HardwareScope, id: string | null, input: DeviceInput) => request<Device>(scope, `/devices${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) })
export const assignHardwareDevices = (scope: HardwareScope, id: string, expectedVersion: number, assignments: Assignment[]) => request<Workstation>(scope, `/workstations/${encodeURIComponent(id)}/assignments`, { method: 'PUT', body: JSON.stringify({ expectedVersion, assignments: assignments.map(({ role, deviceId }) => ({ role, deviceId })) }) })
export const recordHardwareTest = (scope: HardwareScope, input: HardwareTestInput) => request<TestRun>(scope, '/tests', { method: 'POST', body: JSON.stringify(input) })
export const getHardwareHistory = (scope: HardwareScope, page = 1, tests = false, signal?: AbortSignal) => request<HardwarePage<AuditEvent | TestRun>>(scope, `/${tests ? 'tests' : 'history'}?page=${page}&pageSize=10`, { signal })
