import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { FormFeedback } from './FormFeedback'
import { useAgendaMutation } from '../hooks'
import type { AgendaScope, BookingDto, SessionDto, ActivityDto, TransitionInput } from '../types'
type Action = { action: TransitionInput['action']; label: string }
const labels = { CONFIRM: 'Confirmar', ARRIVE: 'Registrar llegada', START: 'Iniciar atención', COMPLETE: 'Finalizar', NO_SHOW: 'No asistió', CANCEL: 'Cancelar',CONFIRM_COMPLETION:'Confirmar realización' }
export function bookingActions(row: Pick<BookingDto,'status'|'startsAt'>, has: (p: string) => boolean, now = new Date()): Action[] {
  const actions: TransitionInput['action'][] = row.status === 'PENDING' || row.status === 'HELD' ? ['CONFIRM','CANCEL'] : row.status === 'CONFIRMED' ? ['ARRIVE','NO_SHOW','CANCEL'] : row.status === 'ARRIVED' ? ['START','CANCEL'] : row.status === 'IN_SERVICE' ? ['COMPLETE','CANCEL'] : []
  return actions.filter(action => has(action === 'CONFIRM' ? 'appointments.edit' : action === 'CANCEL' ? 'appointments.cancel' : 'appointments.attend') && (!['START','NO_SHOW'].includes(action) || new Date(row.startsAt) <= now)).map(action => ({ action, label: labels[action] }))
}
export function sessionActions(row: Pick<SessionDto,'mode'|'status'|'startsAt'>, has: (p: string) => boolean, now = new Date()): Action[] {
  if (row.mode !== 'GROUP') return []
  const actions: TransitionInput['action'][] = row.status === 'SCHEDULED' ? ['START','CANCEL'] : row.status === 'IN_PROGRESS' ? ['COMPLETE','CANCEL'] : []
  return actions.filter(a => has(a === 'CANCEL' ? 'appointments.cancel' : 'appointments.attend') && (a !== 'START' || new Date(row.startsAt) <= now)).map(action => ({action,label:labels[action]}))
}
export function activityActions(row:Pick<ActivityDto,'status'|'startsAt'|'actualCompletedAt'|'commercialCompletionConfirmedAt'|'completionPolicy'>,has:(p:string)=>boolean,now=new Date()):Action[] {
  if(row.status==='COMPLETED'&&row.completionPolicy==='AUTO'&&row.actualCompletedAt&&!row.commercialCompletionConfirmedAt&&has('appointments.attend'))return [{action:'CONFIRM_COMPLETION',label:labels.CONFIRM_COMPLETION}]
  return sessionActions({...row,mode:'GROUP'},has,now).map(a=>({...a,label:a.action==='START'?'Iniciar actividad':a.action==='COMPLETE'?'Finalizar actividad':a.label}))
}
export function AgendaActions({ scope, row, kind, has, onSaved }: { scope: AgendaScope; row: BookingDto | SessionDto | ActivityDto; kind: 'bookings' | 'sessions' | 'activities'; has: (p: string) => boolean; onSaved?: () => void }) {
  const mutation = useAgendaMutation(scope), [attempt, setAttempt] = useState<{ action: Action; reason: string; key: string; version: number } | null>(null)
  const actions = kind === 'bookings' ? bookingActions(row as BookingDto, has) : kind==='activities'?activityActions(row as ActivityDto,has):sessionActions(row as SessionDto, has)
  return <><div className="flex flex-wrap items-center gap-2">{actions.map(action => <Button key={action.action} variant="outline" size="sm" disabled={mutation.pending} onClick={() => setAttempt({action,reason:'',key:crypto.randomUUID(),version:row.version})}>{action.label}</Button>)}</div><Dialog open={!!attempt} onOpenChange={open => { if (!open && !mutation.pending) setAttempt(null) }}><DialogContent><DialogHeader><DialogTitle>{attempt?.action.label}</DialogTitle><DialogDescription>{kind === 'sessions' && attempt?.action.action === 'CANCEL' ? `Se cancelarán ${(row as SessionDto).occupied} reservas activas. No se eliminará el historial.` : attempt?.action.action === 'COMPLETE' ? 'Finalizar la atención no registra pagos ni marca automáticamente asistentes de un grupo.' : 'Confirma esta acción. Quedará registrada en el historial.'}</DialogDescription></DialogHeader><FormFeedback error={mutation.error} fields={mutation.fields} />{attempt && <><Label htmlFor="agenda-reason">Motivo {['CANCEL','CONFIRM_COMPLETION'].includes(attempt.action.action) ? '*' : '(opcional)'}</Label><Textarea id="agenda-reason" value={attempt.reason} maxLength={1000} disabled={mutation.pending} onChange={e => setAttempt({...attempt,reason:e.target.value,key:crypto.randomUUID()})} /><div className="agenda-actions"><Button variant="outline" disabled={mutation.pending} onClick={() => setAttempt(null)}>Volver</Button><Button disabled={mutation.pending || (['CANCEL','CONFIRM_COMPLETION'].includes(attempt.action.action) && !attempt.reason.trim())} onClick={async () => { if (await mutation.submit(`/${kind}/${row.id}/transition`, {action:attempt.action.action,reason:attempt.reason,expectedVersion:attempt.version,idempotencyKey:attempt.key})) {setAttempt(null);onSaved?.()} }}>{mutation.pending ? 'Guardando…' : 'Confirmar'}</Button></div></>}</DialogContent></Dialog></>
}
