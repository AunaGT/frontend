import { getApiBaseUrl, getAuthToken } from '@/services/api'

// Cajas 5: cierre del día por sucursal y fecha operativa.
export type DayScope = { companyId: string; branchId: string; actorId: string }
export type TurnState = 'OPERATING' | 'PENDING_COUNT' | 'PENDING_REVIEW' | 'RECOUNT' | 'FINALIZED' | 'REJECTED'
export type DayTurn = { id: string; register_name: string; register_type: 'PHYSICAL' | 'VIRTUAL'; operation_mode?: 'SHARED'; participants?: { user_id: string; name: string }[]; responsible_id?:string; responsible_name: string; opened_at: string; closed_at: string | null; state: TurnState
  closure_id: string | null; closure_number: number | null; review_result: 'CLEAN' | 'WITHIN' | 'REVIEW' | null; difference: string | null }
export type CashBridge = {
  initial:string;declaredInitial:string;inheritedInitial:string;externalIn:string;externalOut:string;openingDifference:string;acceptedDifference:string
  internal:{inheritedWithinDay:string;openingTransfersIn:string;floatTransfersOut?:string;floatTransfersReceived?:string;sessionsIn:string;sessionsOut:string;delivered:string;net:string}
  retainedFinal:string;undeliveredFinal:string;final:string;calculatedFinal:string;difference:string;balanced:boolean
  sources:{sessionId:string;entryId:string;originSessionId:string|null;transferId:string|null;kind:string;amount:string}[]
}
export type DaySnapshot = {
  version?: 2; businessDate:string
  turns: DayTurn[]; blockers: { code: TurnState; sessionId: string; closureId: string | null; register: string; message: string }[]
  cash: { bridge?:CashBridge; opening: string; received: string; fundIn: string; custodyIn: string; paidOut: string; sentToCustody: string; delivered: string; retained: string; acceptedDifference: string; inTransit: { count: number; amount: string } }
  digital: { byMethod: { name: string; amount: string }[]; toSettle: string; pendingNotices?: { count: number; amount: string; oldest: string | null }; settlements?: { count: number; net: string } }
  entries: string[]; legacyNotice: string | null
}
export type DayCurrent={asOf:string;pendingNotices:{count:number;amount:string;oldest:string|null};toSettle:string;settlementReferences:{id:string;reference:string;deposited_on:string}[];depositsByRealDate:{date:string;count:number;net:string};corrections?:{id:string;closure_id:string;closure_number:number;sequence:number;currency_code:string;reason:string;decided_at:string;accounting_date:string;accounting_status:string;entry_number:string|null;cash_delta:string;corrected_difference:string}[];disputes?:DayDisputes|null}
export type DayDisputes={withdrawn:string;recovered:string;fees:string;chargesIssued:{count:number;amount:string};items:{id:string;disputeId:string;kind:string;principal:string;fee:string;providerReference:string;inSettlement:boolean;accountingStatus:string}[]}
export type DayView={status:'PROVISIONAL'|'FINALIZED';contentKey:string;finalizedBy:string|null;finalizedAt:string|null;canFinalize?:boolean;snapshot:DaySnapshot;current:DayCurrent}
async function request<T>(path: string, scope: DayScope, options: RequestInit = {}): Promise<T> {
  const deadline=AbortSignal.timeout(30_000),controller=new AbortController(),signal=controller.signal
  const sources=[options.signal,deadline].filter((source):source is AbortSignal=>!!source)
  const abort=(event:Event)=>controller.abort((event.target as AbortSignal).reason)
  for(const source of sources){if(source.aborted)controller.abort(source.reason);else source.addEventListener('abort',abort,{once:true})}
  try {
    const res = await fetch(`${getApiBaseUrl()}/cash-closures/days/${path}`, {
    ...options, cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() ?? ''}`, 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId },
  })
  let data: { message?: string; code?: string } | null = null
  try { data = await res.json() } catch { if (res.ok) throw Object.assign(new Error('No se pudo leer la respuesta del servidor.'), { status: res.status }) }
  if(signal.aborted)throw new DOMException('Consulta cancelada','AbortError')
  if (!res.ok) throw Object.assign(new Error(data?.message || 'No se pudo completar la operación del día'), { status: res.status, code: data?.code })
    return data as T
  } catch(error) {
    if(deadline.aborted&&!options.signal?.aborted)throw Object.assign(new Error('El servidor tardó demasiado. Revisa el estado del día antes de reintentar.'),{name:'TimeoutError'})
    throw error
  } finally {for(const source of sources)source.removeEventListener('abort',abort)}
}
export const fetchDay = (date: string, scope: DayScope, signal?: AbortSignal) => request<DayView>(encodeURIComponent(date), scope, { signal })
export const finalizeDay = (date: string, contentKey: string, scope: DayScope,signal?:AbortSignal) => request<{ replayed: boolean; view: DayView }>(`${encodeURIComponent(date)}/finalize`, scope, { method: 'POST', body: JSON.stringify({ contentKey }),signal })
