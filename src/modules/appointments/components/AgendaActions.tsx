import { useState } from 'react'
import {Link} from 'react-router-dom'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
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
  return <AgendaActionEditor key={`${scope.companyId}:${scope.branchId}:${kind}:${row.id}`} scope={scope} row={row} kind={kind} has={has} onSaved={onSaved}/>
}
function AgendaActionEditor({ scope, row, kind, has, onSaved }: { scope: AgendaScope; row: BookingDto | SessionDto | ActivityDto; kind: 'bookings' | 'sessions' | 'activities'; has: (p: string) => boolean; onSaved?: () => void }) {
  const mutation = useAgendaMutation(scope), [attempt, setAttempt] = useState<{ action: Action; reason: string; key: string; version: number } | null>(null)
  const [exceptionReason,setExceptionReason]=useState(''),[confirmException,setConfirmException]=useState<string|null>(null)
  const actions = kind === 'bookings' ? bookingActions(row as BookingDto, has) : kind==='activities'?activityActions(row as ActivityDto,has):sessionActions(row as SessionDto, has)
  const hash=mutation.fields.paymentPolicyReviewHash,canOverride=!!attempt&&['START','COMPLETE','CONFIRM_COMPLETION'].includes(attempt.action.action)&&has('appointments.override_payment_policy')&&has('receivables.view')&&mutation.fields.paymentPolicyCanOverride==='true'&&/^[a-f0-9]{64}$/.test(hash||'')
  const submit=async(exception?:{reason:string;reviewHash:string})=>{
    if(!attempt||mutation.pending)return
    if(await mutation.submit(`/${kind}/${row.id}/transition`,{action:attempt.action.action,reason:attempt.reason,expectedVersion:attempt.version,idempotencyKey:attempt.key,...(exception?{exception}:{})})){setAttempt(null);onSaved?.()}
  }
  return <><div className="flex flex-wrap items-center gap-2">{actions.map(action=><Button key={action.action} variant="outline" size="sm" disabled={mutation.pending} onClick={()=>{mutation.reset();setExceptionReason('');setConfirmException(null);setAttempt({action,reason:'',key:crypto.randomUUID(),version:row.version})}}>{action.label}</Button>)}</div>
    <Dialog open={!!attempt} onOpenChange={open=>{if(!open&&!mutation.pending)setAttempt(null)}}><DialogContent><DialogHeader><DialogTitle>{attempt?.action.label}</DialogTitle><DialogDescription>{kind==='sessions'&&attempt?.action.action==='CANCEL'?`Se cancelarán ${(row as SessionDto).occupied} reservas activas. No se eliminará el historial.`:attempt?.action.action==='COMPLETE'?'Finalizar la atención no registra pagos ni marca automáticamente asistentes de un grupo.':'Confirma esta acción. Quedará registrada en el historial.'}</DialogDescription></DialogHeader>
      <FormFeedback error={mutation.error} fields={mutation.fields}/>{row.engagementId&&mutation.error&&<Button variant="outline" size="sm" asChild><Link to={`/agenda/contrataciones/${row.engagementId}`}>Revisar contratación y cobros</Link></Button>}
      {attempt&&<><Label htmlFor="agenda-reason">Motivo {['CANCEL','CONFIRM_COMPLETION'].includes(attempt.action.action)?'*':'(opcional)'}</Label><Textarea id="agenda-reason" value={attempt.reason} maxLength={1000} disabled={mutation.pending} onChange={e=>setAttempt({...attempt,reason:e.target.value,key:crypto.randomUUID()})}/>
        {canOverride&&<section className="space-y-2 rounded-lg border border-brand-orange/40 p-3"><h3 className="text-sm font-medium">Excepción por saldo vencido</h3><p className="text-xs text-muted-foreground">Solo autoriza «{attempt.action.label}» esta vez. No elimina la deuda ni registra un pago. Quedará tu motivo en el historial.</p><Label htmlFor="agenda-payment-exception">Motivo de la excepción *</Label><Textarea id="agenda-payment-exception" value={exceptionReason} disabled={mutation.pending} maxLength={500} onChange={e=>{setExceptionReason(e.target.value);setAttempt({...attempt,key:crypto.randomUUID()})}}/><Button type="button" size="sm" variant="outline" disabled={mutation.pending||!exceptionReason.trim()||(['CONFIRM_COMPLETION'].includes(attempt.action.action)&&!attempt.reason.trim())} onClick={()=>setConfirmException(hash)}>Revisar excepción para esta acción</Button></section>}
        <div className="agenda-actions"><Button variant="outline" disabled={mutation.pending} onClick={()=>setAttempt(null)}>Volver</Button><Button disabled={mutation.pending||(['CANCEL','CONFIRM_COMPLETION'].includes(attempt.action.action)&&!attempt.reason.trim())} onClick={()=>submit()}>{mutation.pending?'Guardando…':'Confirmar'}</Button></div></>}
      <ConfirmDialog open={!!confirmException&&confirmException===hash&&canOverride} onOpenChange={open=>{if(!open)setConfirmException(null)}} appearance="auna" title="Autorizar solo esta acción" description={`Acción: ${attempt?.action.label}. Motivo: ${exceptionReason}. El saldo seguirá pendiente y Auna comprobará nuevamente los permisos y los pagos.`} confirmText="Autorizar y continuar" loading={mutation.pending} onConfirm={()=>{const reviewHash=confirmException;setConfirmException(null);if(reviewHash&&canOverride)void submit({reason:exceptionReason.trim(),reviewHash})}}/>
    </DialogContent></Dialog></>
}
