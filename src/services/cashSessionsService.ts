/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { getApiBaseUrl, getAuthToken } from '@/services/api'

const API_URL = getApiBaseUrl()

/** ISO UTC → `YYYY-MM-DDTHH:mm:ss` en la zona indicada (para inputs datetime-local). */
export function sessionOpenedAtToLocalInput(iso: string, timeZone: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getAuthToken() ?? ''}`,
  }
}

export interface CashRegisterOpenSessionDto {
  can_operate?: boolean
  id: string
  opened_at: string
  opening_float: number
  opened_by_id: string
  opened_by_name: string | null
}

export interface CashRegisterDto {
  access_control_version?: 0 | 1
  authorized_user_count?: number
  can_open?: boolean
  money_event_version?: 0 | 1
  kind?: 'PHYSICAL' | 'VIRTUAL'
  operation_mode?: 'INDIVIDUAL' | 'SHARED'
  currency_code?: string | null
  revision?: number
  id: string
  name: string
  code: string
  is_default: boolean
  active: boolean
  /** Sucursal dueña de la caja: una caja pertenece a una sola sucursal */
  branch?: { id: string; name: string; code: string } | null
  /** Solo en listados de gestión */
  assigned_users?: Array<{ id: string; name: string }>
  has_open_session?: boolean
  open_session?: CashRegisterOpenSessionDto | null
}

/** Lista cajas; con includeInactive=true (gestores) trae también las desactivadas. */
export async function listCashRegisters(includeInactive = false, scope?: RegisterConfigurationScope): Promise<CashRegisterDto[]> {
  const q = includeInactive ? '?include_inactive=1' : ''
  const res = await fetch(`${API_URL}/cash-sessions/registers${q}`, {
    headers: { ...authHeaders(), ...(scope ? { 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId } : {}) },
    signal: AbortSignal.timeout(12_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Error ${res.status}`)
  }
  return data as CashRegisterDto[]
}

export async function fetchCashMoneyCapabilities(scope?: RegisterConfigurationScope): Promise<{ money_events_available: boolean; can_adopt: boolean; shared_turns_available?: boolean; register_configuration_available?: boolean; can_view_register_configuration?: boolean; can_manage_register_configuration?: boolean }> {
  const res = await fetch(`${API_URL}/cash-sessions/capabilities`, { headers: { ...authHeaders(), ...(scope ? { 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId } : {}) }, signal: AbortSignal.timeout(12_000) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'No se pudo verificar el registro de movimientos')
  return data
}
export type CashPaymentOption = { id: string; cashRegisterId: string; name: string; code: string; currencyCode: string | null; moneyEventVersion: 0 | 1 }
export async function fetchCashSessionPaymentOptions(): Promise<{ available: boolean; sessions: CashPaymentOption[] }> {
  const res = await fetch(`${API_URL}/cash-sessions/payment-options`, { headers: authHeaders(), signal: AbortSignal.timeout(12_000) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'No se pudieron cargar tus turnos')
  return data
}

export async function createCashRegister(body: { name: string; code?: string }): Promise<CashRegisterDto> {
  const res = await fetch(`${API_URL}/cash-sessions/registers`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Error ${res.status}`)
  }
  return data as CashRegisterDto
}

export async function updateCashRegister(
  id: string,
  body: { name?: string; active?: boolean; is_default?: boolean }
): Promise<CashRegisterDto> {
  const res = await fetch(`${API_URL}/cash-sessions/registers/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Error ${res.status}`)
  }
  return data as CashRegisterDto
}

/** Deja asignados a la caja exactamente estos usuarios (quita a los que no estén en la lista). */
export async function setCashRegisterUsers(id: string, userIds: string[]): Promise<CashRegisterDto> {
  const res = await fetch(`${API_URL}/cash-sessions/registers/${id}/users`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ user_ids: userIds }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Error ${res.status}`)
  }
  return data as CashRegisterDto
}

export interface CashSessionUserDto {
  id: string
  name: string
  email: string
}

export interface CashRegisterSessionDto {
  actor_participant?: boolean
  can_operate?: boolean
  can_join?: boolean
  can_declare?: boolean
  participants?: { user_id: string; name: string; joined_at: string }[]
  money_event_version?: 0 | 1
  register_type?: 'PHYSICAL' | 'VIRTUAL' | null
  operation_mode?: 'INDIVIDUAL' | 'SHARED' | null
  currency_code?: string | null
  business_date?: string | null
  business_timezone?: string | null
  id: string
  cash_register_id: string
  status: 'OPEN' | 'CLOSED' | 'VOID'
  opened_at: string
  closed_at: string | null
  opened_by_id: string
  closed_by_id: string | null
  opening_float: number
  notes: string | null
  cash_closure_id: string | null
  /** 3C: turno cuyo arqueo pidió reconteo; vuelve a estar pendiente de conteo. */
  recount?: boolean
  openedBy?: CashSessionUserDto
  closedBy?: CashSessionUserDto | null
  cashRegister?: Pick<CashRegisterDto, 'id' | 'name' | 'code' | 'is_default'>
}

export type CashSessionCurrentResult =
  | {
      ok: true
      register: CashRegisterDto | null
      session: CashRegisterSessionDto | null
      /** Último turno CLOSED del usuario en esta caja sin cierre contable vinculado (arqueo pendiente). */
      closableSession: CashRegisterSessionDto | null
    }
  | { ok: false; status: number; message: string }

export async function fetchCashSessionCurrent(
  cashRegisterId?: string,
  cashRegisterSessionId?: string,
  scope?: RegisterConfigurationScope
): Promise<CashSessionCurrentResult> {
  const params = new URLSearchParams()
  if (cashRegisterId) params.set('cash_register_id', cashRegisterId)
  if (cashRegisterSessionId) params.set('cash_register_session_id', cashRegisterSessionId)
  const q = params.toString()
  const url = `${API_URL}/cash-sessions/current${q ? `?${q}` : ''}`
  const res = await fetch(url, { headers: { ...authHeaders(), ...(scope ? { 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId } : {}) }, signal: AbortSignal.timeout(12_000), cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as {
    register?: CashRegisterDto | null
    session?: CashRegisterSessionDto | null
    closable_session?: CashRegisterSessionDto | null
    message?: string
  }
  if (!res.ok) {
    return { ok: false, status: res.status, message: data.message || `Error ${res.status}` }
  }
  return {
    ok: true,
    register: data.register ?? null,
    session: data.session ?? null,
    closableSession: data.closable_session ?? null,
  }
}

export async function openCashSession(body: {
  opening_float: number
  notes?: string | null
  cash_register_id?: string | null
}): Promise<CashRegisterSessionDto> {
  const res = await fetch(`${API_URL}/cash-sessions/open`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Error ${res.status}`)
  }
  return data as CashRegisterSessionDto
}

/** Cierra el turno OPEN sin cierre contable (arqueo formal sigue en Cierre de caja). */
export async function closeCashSession(body?: {
  notes?: string | null
  cash_register_id?: string | null
  cash_register_session_id?: string | null
}, scope?: RegisterConfigurationScope): Promise<CashRegisterSessionDto> {
  const res = await fetch(`${API_URL}/cash-sessions/close`, {
    method: 'POST',
    headers: { ...authHeaders(), ...(scope ? { 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Error ${res.status}`)
  }
  return data as CashRegisterSessionDto
}

export type RegisterConfigurationScope = { companyId: string; branchId: string; actorId: string }
export type RegisterPerson = { id: string; name: string; active?: boolean }
export type RegisterConfiguration = CashRegisterDto & {
  revision: number; access_control_version: 0 | 1; branch_id: string
  authorized_users: RegisterPerson[]; legacy_suggested_users: RegisterPerson[]
  has_pending_closure: boolean; has_open_session: boolean
  capabilities: { register_configuration_available: boolean; can_enable_explicit_access: boolean }
  command_id?: string; replayed?: boolean
}
export type RegisterConfigurationInput = {
  id?: string; expectedRevision?: number; requestKey: string; name: string; code?: string
  currencyCode?: string; active?: boolean; isDefault?: boolean; authorizedUserIds?: string[]; enableExplicitAccess?: true; operationMode?: 'INDIVIDUAL' | 'SHARED'
}
async function registerRequest<T>(path: string, scope: RegisterConfigurationScope, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/cash-sessions${path}`, { ...options, headers: { ...authHeaders(), 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId }, signal: AbortSignal.timeout(15_000), cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.message || 'No se pudo guardar la configuración'), { status: res.status, code: data.code })
  return data as T
}
export const fetchCashRegisterConfiguration = (id: string, scope: RegisterConfigurationScope) => registerRequest<RegisterConfiguration>(`/registers/${encodeURIComponent(id)}/configuration`, scope)
export function saveCashRegisterConfiguration(input: RegisterConfigurationInput, scope: RegisterConfigurationScope) {
  const { id, ...body } = input
  return registerRequest<RegisterConfiguration>(id ? `/registers/${encodeURIComponent(id)}/configuration` : '/registers/configuration', scope, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) })
}
export const fetchEligibleRegisterUsers = (filters: { search: string; page: number; pageSize?: number }, scope: RegisterConfigurationScope) => registerRequest<{ items: RegisterPerson[]; page: number; pageSize: number; totalItems: number; totalPages: number }>(`/register-users?${new URLSearchParams({ search: filters.search, page: String(filters.page), pageSize: String(filters.pageSize || 20) })}`, scope)
