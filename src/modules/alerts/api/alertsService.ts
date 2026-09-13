import { apiFetch } from '@/services/api'

export interface AlertAssignPayload { user_id: string }

export const reassignAlert = async (id: string, user_id: string) => apiFetch(
  `/api/alerts/${id}/assign`,
  { method: 'POST', body: JSON.stringify({ user_id } as AlertAssignPayload) }
)

export const resolveAlert = async (id: string) => apiFetch(
  `/api/alerts/${id}/resolve`,
  { method: 'PATCH' }
)

export interface AlertLookup { id: number; name: string }

/** Usuarios asignables: requiere alerts.manage, no users.view. */
export const fetchAssignableAlertUsers = async () =>
  apiFetch<{ id: string; name: string }[]>('/api/alerts/assignable-users')

export const fetchAlertTypes = async () => apiFetch<AlertLookup[]>('/api/alerts/types')
export const fetchAlertPriorities = async () => apiFetch<AlertLookup[]>('/api/alerts/priorities')

export interface CreateAlertPayload {
  type_id: number
  priority_id: number
  title: string
  message?: string
  product_id: string
  current_stock?: number
  min_stock?: number
}

export const createAlert = async (payload: CreateAlertPayload) =>
  apiFetch('/api/alerts', { method: 'POST', body: JSON.stringify(payload) })
