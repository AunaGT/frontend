import { getApiBaseUrl, getAuthToken } from '@/services/api'
export type MyTurnScope = { companyId: string; branchId: string; actorId: string }
export type MyTurn = {
  id: string; registerId: string; registerName: string; registerCode: string; responsibleName: string
  operationMode: 'INDIVIDUAL' | 'SHARED'; registerType: 'PHYSICAL' | 'VIRTUAL'; role: 'RESPONSIBLE' | 'PARTICIPANT' | 'INVITED'
  participants: { user_id: string; name: string; joined_at: string }[]
  openedAt: string; closedAt: string | null; timeZone: string; businessDate: string | null; operationCount: number
  state: 'OPERATING' | 'PENDING_COUNT' | 'RECOUNT' | 'REJECTED' | 'PENDING_REVIEW' | 'FINALIZED'
  closureId: string | null; closureStatus: string | null; needsCloseReason: boolean
  can: { join: boolean; close: boolean; count: boolean; handover: boolean; movement: boolean }
}
export type MyTurns = { available: boolean; current: MyTurn[]; pending: MyTurn[] }
async function request<T>(path: string, scope: MyTurnScope, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...options, cache: 'no-store', signal: options.signal ?? AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() ?? ''}`, 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId } })
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(data.message || 'No se pudo actualizar el turno'), { status: response.status })
  return data as T
}
export const fetchMyTurns = (scope: MyTurnScope, signal?: AbortSignal, sessionId?: string | null) => request<MyTurns>(`/cash-closures/my-turns${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`, scope, { signal })
export const joinCashTurn = (id: string, scope: MyTurnScope) => request(`/cash-sessions/${encodeURIComponent(id)}/join`, scope, { method: 'POST', body: '{}' })
export const finishCashTurn = (turn: MyTurn, notes: string, scope: MyTurnScope) => request('/cash-sessions/close', scope, { method: 'POST', body: JSON.stringify({ cash_register_id: turn.registerId, cash_register_session_id: turn.id, notes }) })
