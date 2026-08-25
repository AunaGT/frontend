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
  id: string
  opened_at: string
  opening_float: number
  opened_by_id: string
  opened_by_name: string | null
}

export interface CashRegisterDto {
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
export async function listCashRegisters(includeInactive = false): Promise<CashRegisterDto[]> {
  const q = includeInactive ? '?include_inactive=1' : ''
  const res = await fetch(`${API_URL}/cash-sessions/registers${q}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(12_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Error ${res.status}`)
  }
  return data as CashRegisterDto[]
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
  cashRegisterId?: string
): Promise<CashSessionCurrentResult> {
  const params = new URLSearchParams()
  if (cashRegisterId) params.set('cash_register_id', cashRegisterId)
  const q = params.toString()
  const url = `${API_URL}/cash-sessions/current${q ? `?${q}` : ''}`
  const res = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(12_000) })
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
}): Promise<CashRegisterSessionDto> {
  const res = await fetch(`${API_URL}/cash-sessions/close`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Error ${res.status}`)
  }
  return data as CashRegisterSessionDto
}
