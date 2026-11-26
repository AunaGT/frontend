import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, Info, Undo2 } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingState } from '@/components/shared/LoadingState'
import { correctCashMovement, createCashMovement, fetchCashMovement, fetchCashMovementCapabilities, fetchCashMovementOptions, type CashMovement, type CashMovementCapabilities, type CashMovementDirection, type CashMovementScope, type CashMovementSession } from '@/services/cashMovementsService'
import { useCashMovementAttempt } from './hooks/useCashMovementAttempt'
import { CashPageHeader, Detail, Notice } from './components/CashPageParts'
import { formatCurrency, formatZonedDateTime } from './types'

export const CASH_MOVEMENTS_PATH = '/cierre-caja/movimientos'
type Mode = 'create' | 'correct' | 'detail'
const AMOUNT = /^\d{1,10}(\.\d{1,2})?$/
const NOTE: Record<CashMovementDirection, string> = {
  IN: 'No es una venta ni un cobro de cliente.',
  OUT: 'No registra un gasto, pago o reembolso, ni acredita otra caja.',
}
const directionLabel = (direction: CashMovementDirection) => direction === 'IN' ? 'Ingreso de fondo' : 'Retiro de efectivo'
// Importe exacto como texto con dos decimales: nunca se convierte a Number.
const exactAmount = (value: string) => { const [whole, cents = ''] = value.trim().split('.'); return `${whole.replace(/^0+(?=\d)/, '')}.${cents.padEnd(2, '0')}` }

export default function CashMovementFormPage({ mode, movementId }: { mode: Mode; movementId?: string }) {
  const { id } = useParams(), { company, branch } = useTenant(), { user } = useAuthPermissions()
  const target = movementId || id
  // Cambiar empresa, sucursal o persona remonta la vista: no se muestra ni se envía el borrador anterior.
  return <CashMovementView key={JSON.stringify([company?.id, branch?.id, user?.id, mode, target])} mode={mode} movementId={target} />
}

function CashMovementView({ mode, movementId }: { mode: Mode; movementId?: string }) {
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), navigate = useNavigate(), { locale } = useSystemSettings()
  const scope: CashMovementScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }
  const ready = !!(scope.companyId && scope.branchId && scope.actorId)
  const capabilities = useQuery({ queryKey: ['cash-movement-capabilities', scope.companyId, scope.branchId, scope.actorId], queryFn: ({ signal }) => fetchCashMovementCapabilities(scope, signal), enabled: ready })
  const movement = useQuery({ queryKey: ['cash-movement', scope.companyId, scope.branchId, scope.actorId, movementId], queryFn: ({ signal }) => fetchCashMovement(movementId!, scope, signal), enabled: ready && mode !== 'create' && !!movementId })
  usePageTrail([{ label: 'Movimientos de efectivo', to: CASH_MOVEMENTS_PATH }, { label: mode === 'create' ? 'Nuevo' : mode === 'correct' ? 'Compensar' : 'Detalle' }])
  const caps = capabilities.data, record = movement.data
  const title = mode === 'create' ? 'Nuevo movimiento' : mode === 'correct' ? 'Compensar movimiento' : record ? directionLabel(record.direction) : 'Movimiento de efectivo'
  const allowed = !caps ? false : mode === 'create' ? caps.canCreateOwn || caps.canCreateTeam : mode === 'correct' ? caps.canCorrect : caps.canViewOwn || caps.canViewTeam
  const loading = capabilities.isLoading || (mode !== 'create' && movement.isLoading)
  return <main className="mx-auto w-full max-w-[960px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title={title} subtitle={`${branch?.name || 'Selecciona una sucursal'} · Caja física · ${mode === 'detail' ? 'Registro inmutable' : 'Turno abierto'}`} backLabel="Volver a movimientos" onBack={() => navigate(CASH_MOVEMENTS_PATH)} />
    {loading ? <LoadingState variant="cards" message="Cargando…" />
      : capabilities.error || movement.error ? <Notice role="alert">{(movement.error as Error)?.message || 'No se pudo cargar la información.'} <Button variant="outline" size="sm" className="ml-2" onClick={() => { void capabilities.refetch(); void movement.refetch() }}>Reintentar</Button></Notice>
      : !caps?.available ? <Notice><strong className="font-medium">Los movimientos de efectivo aún no están disponibles.</strong> Falta aplicar la actualización verificada. Los turnos y arqueos actuales siguen funcionando.</Notice>
      : !allowed ? <Notice>No tienes permiso para esta operación de efectivo en la sucursal seleccionada.</Notice>
      : mode === 'detail' ? record && <MovementDetail movement={record} caps={caps} locale={locale} />
      : <MovementForm mode={mode} scope={scope} caps={caps} original={record} locale={locale} />}
  </main>
}

const sessionLabel = (s: CashMovementSession, locale?: string) => `${s.register_name} · ${s.responsible_name} · desde ${formatZonedDateTime(s.opened_at, s.business_timezone, locale)}`

function MovementForm({ mode, scope, caps, original, locale }: { mode: 'create' | 'correct'; scope: CashMovementScope; caps: CashMovementCapabilities; original?: CashMovement; locale?: string }) {
  const navigate = useNavigate(), [params] = useSearchParams()
  const options = useQuery({ queryKey: ['cash-movement-options', scope.companyId, scope.branchId, scope.actorId], queryFn: ({ signal }) => fetchCashMovementOptions(scope, signal) })
  const form = useCashMovementAttempt({ ...scope, action: mode, originalId: original?.id }), { draft, setDraft } = form
  const [errors, setErrors] = useState<Record<string, string>>({})
  const sessions = options.data?.sessions || [], methods = options.data?.methods || [], requested = params.get('turno')
  // Turno propio único o el que viene del POS; un supervisor con varios turnos elige explícitamente.
  const sessionId = draft.sessionId || (requested && sessions.some(s => s.id === requested) ? requested : '') || (sessions.length === 1 ? sessions[0].id : '')
  const methodId = draft.methodId || (methods.length === 1 ? String(methods[0].id) : '')
  const direction: CashMovementDirection | '' = mode === 'correct' ? original ? original.direction === 'IN' ? 'OUT' : 'IN' : '' : draft.direction
  const locked = form.busy || form.pending || form.recoveryBlocked
  const done = !!original && (!!original.correction_id || !!original.corrects_movement_id)
  const patch = (key: keyof typeof draft, value: string | boolean) => { setErrors(prev => ({ ...prev, [key]: '' })); setDraft(prev => ({ ...prev, [key]: value })) }
  const field = (id: string, key: string) => ({ id, 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `${id}-error` : undefined })
  const fieldError = (id: string, key: string) => errors[key] ? <p id={`${id}-error`} className="text-sm text-destructive">{errors[key]}</p> : null

  if (options.isLoading) return <LoadingState variant="cards" message="Buscando turnos abiertos…" />
  if (options.error) return <Notice role="alert">No se pudieron cargar los turnos abiertos. <Button variant="outline" size="sm" className="ml-2" onClick={() => void options.refetch()}>Reintentar</Button></Notice>
  if (!sessions.length && !form.pending) return <Notice>No hay un turno abierto de caja física disponible para ti en esta sucursal. {caps.canCreateTeam ? 'Cuando un cajero abra su turno podrás registrar el movimiento.' : 'Abre tu turno desde Nueva venta y vuelve aquí.'}</Notice>

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked && !form.pending) return
    if (!form.pending) {
      const next: Record<string, string> = {}
      if (!sessionId) next.sessionId = 'Selecciona el turno donde se mueve el dinero.'
      if (mode === 'create') {
        if (!direction) next.direction = 'Elige si ingresas fondo o retiras efectivo.'
        if (!AMOUNT.test(draft.amount.trim()) || /^0*(\.0*)?$/.test(draft.amount.trim())) next.amount = 'Indica un importe mayor que cero, con hasta dos decimales.'
        if (!methodId) next.methodId = 'Selecciona el medio de efectivo.'
        if (!draft.counterparty.trim()) next.counterparty = direction === 'OUT' ? 'Indica a dónde va el efectivo.' : 'Indica de dónde viene el efectivo.'
      } else if (!draft.confirmed) next.confirmed = 'Confirma que el dinero se movió físicamente.'
      if (!draft.reason.trim()) next.reason = 'Explica el motivo del movimiento.'
      setErrors(next)
      const first = Object.keys(next)[0]
      if (first) { document.getElementById(`movement-${first}`)?.focus(); return }
    }
    const reference = draft.reference.trim() ? { reference: draft.reference.trim() } : {}
    const receipt = mode === 'correct'
      ? await form.submit({ cashRegisterSessionId: sessionId, reason: draft.reason.trim(), ...reference }, command => correctCashMovement(original!.id, command as Parameters<typeof correctCashMovement>[1], scope))
      : await form.submit({ cashRegisterSessionId: sessionId, direction: direction as CashMovementDirection, amount: exactAmount(draft.amount), paymentMethodId: Number(methodId), reason: draft.reason.trim(), counterpartyLabel: draft.counterparty.trim(), ...reference }, command => createCashMovement(command as Parameters<typeof createCashMovement>[0], scope))
    if (receipt) navigate(`${CASH_MOVEMENTS_PATH}/${receipt.id}`, { replace: true, state: { saved: true, replayed: receipt.replayed } })
  }

  const turnField = <div className="space-y-1">
    <Label htmlFor="movement-sessionId">Turno</Label>
    {sessions.length === 1 && !caps.canCreateTeam
      ? <p id="movement-sessionId" tabIndex={-1} className="flex min-h-10 items-center rounded-md border bg-muted/40 px-3 py-2 text-sm leading-snug">{sessionLabel(sessions[0], locale)}</p>
      : <Select value={sessionId} disabled={locked} onValueChange={value => patch('sessionId', value)}><SelectTrigger {...field('movement-sessionId', 'sessionId')}><SelectValue placeholder="Selecciona el turno" /></SelectTrigger><SelectContent>{sessions.map(s => <SelectItem key={s.id} value={s.id}>{sessionLabel(s, locale)}</SelectItem>)}</SelectContent></Select>}
    {fieldError('movement-sessionId', 'sessionId')}
  </div>
  const reasonField = <div className="space-y-1"><Label htmlFor="movement-reason">Motivo</Label><Textarea {...field('movement-reason', 'reason')} rows={2} maxLength={500} disabled={locked} value={draft.reason} onChange={e => patch('reason', e.target.value)} placeholder={mode === 'correct' ? 'Ej. el movimiento no ocurrió físicamente' : 'Ej. cambio para el turno'} />{fieldError('movement-reason', 'reason')}</div>
  const referenceField = <details className="text-sm" open={!!draft.reference}><summary className="cursor-pointer py-1 font-medium">Referencia (opcional)</summary><div className="mt-2 space-y-1"><Label htmlFor="movement-reference" className="sr-only">Referencia</Label><Input id="movement-reference" maxLength={255} disabled={locked} value={draft.reference} onChange={e => patch('reference', e.target.value)} placeholder="Ej. número de sobre o vale" /></div></details>

  return <form onSubmit={submit} noValidate className="space-y-4">
    {form.error && <Notice role="alert">{form.error}</Notice>}
    {form.pending && <p role="status" className="rounded-lg border p-3 text-sm">Hay un registro pendiente de confirmar. Recupéralo antes de cambiar algo: no se registrará dinero dos veces.</p>}
    {done && <Notice>Este movimiento ya tiene una compensación o es una compensación. No se puede compensar de nuevo.</Notice>}
    {mode === 'correct' && original && <section className="auna-surface rounded-xl border p-4 sm:p-5" aria-labelledby="movement-original">
      <h2 id="movement-original" className="text-sm font-semibold">Movimiento original</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Detail label="Tipo">{directionLabel(original.direction)}</Detail>
        <Detail label="Importe"><span className="tabular-nums">{formatCurrency(original.amount, original.currency_code, locale)}</span></Detail>
        <Detail label="Registrado">{formatZonedDateTime(original.created_at, original.business_timezone, locale)}</Detail>
        <Detail label="Caja y responsable">{original.register_name} · {original.responsible_name}</Detail>
        <Detail label="Motivo" wide>{original.reason}</Detail>
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">Se registrará un {direction === 'IN' ? 'ingreso' : 'retiro'} por el mismo importe. Compensación en este turno; el anterior no cambia.</p>
    </section>}
    <section className="auna-surface space-y-4 rounded-xl border p-4 sm:p-5">
      {mode === 'create' && <fieldset className="space-y-1"><legend className="sr-only">Tipo de movimiento</legend>
        <div role="radiogroup" aria-label="Tipo de movimiento" className="grid gap-2 sm:grid-cols-2">
          {(['IN', 'OUT'] as const).map(value => {
            const Icon = value === 'IN' ? ArrowDownToLine : ArrowUpFromLine, checked = draft.direction === value
            return <button key={value} id={value === 'IN' ? 'movement-direction' : undefined} type="button" role="radio" aria-checked={checked} disabled={locked} onClick={() => patch('direction', value)}
              className={`flex min-h-11 items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
              <Icon className={`h-5 w-5 shrink-0 ${checked ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden />
              <span><span className="block text-sm font-medium">{value === 'IN' ? 'Ingresar fondo' : 'Retirar efectivo'}</span><span className="block text-xs text-muted-foreground">{value === 'IN' ? 'Aumenta el efectivo del turno' : 'Reduce el efectivo disponible'}</span></span>
            </button>
          })}
        </div>
        {fieldError('movement-direction', 'direction')}
      </fieldset>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-4">
          {turnField}
          {mode === 'create' && <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3">
            <div className="space-y-1"><Label htmlFor="movement-amount">Importe</Label><Input {...field('movement-amount', 'amount')} inputMode="decimal" autoComplete="off" className="tabular-nums" disabled={locked} value={draft.amount} onChange={e => patch('amount', e.target.value.replace(',', '.'))} placeholder="0.00" />{fieldError('movement-amount', 'amount')}</div>
            <div className="space-y-1"><Label htmlFor="movement-methodId">Medio</Label><Select value={methodId} disabled={locked} onValueChange={value => patch('methodId', value)}><SelectTrigger {...field('movement-methodId', 'methodId')}><SelectValue placeholder="Efectivo" /></SelectTrigger><SelectContent>{methods.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent></Select>{fieldError('movement-methodId', 'methodId')}</div>
          </div>}
          {mode === 'correct' && referenceField}
        </div>
        <div className="min-w-0 space-y-4">
          {mode === 'create' && <div className="space-y-1"><Label htmlFor="movement-counterparty">{direction === 'OUT' ? 'Destino' : direction === 'IN' ? 'Procedencia' : 'Procedencia o destino'}</Label><Input {...field('movement-counterparty', 'counterparty')} maxLength={120} disabled={locked} value={draft.counterparty} onChange={e => patch('counterparty', e.target.value)} placeholder="Ej. caja fuerte, gerencia" />{fieldError('movement-counterparty', 'counterparty')}</div>}
          {reasonField}
        </div>
      </div>
      {mode === 'create' && referenceField}
      {mode === 'correct' && <div className="space-y-1"><label className="flex min-h-11 items-start gap-3 text-sm"><Checkbox id="movement-confirmed" className="mt-0.5" checked={draft.confirmed} disabled={locked} onCheckedChange={value => patch('confirmed', value === true)} aria-invalid={!!errors.confirmed} /><span>Confirmo que el dinero se movió físicamente en este turno.</span></label>{fieldError('movement-confirmed', 'confirmed')}</div>}
      <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{direction ? NOTE[direction] : 'Un ingreso no es una venta y un retiro no es un gasto: los pagos y reembolsos siguen sus propios documentos.'} La procedencia o el destino es lo que declaras; no confirma que otra caja recibió dinero.</p>
      <footer className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => navigate(CASH_MOVEMENTS_PATH)}>Cancelar</Button>
        <Button type="submit" disabled={form.recoveryBlocked || done || (form.busy && !form.pending)}>{form.recoveryBlocked ? 'Recuperación necesaria' : form.busy ? 'Registrando…' : form.pending ? 'Recuperar registro' : mode === 'correct' ? 'Registrar compensación' : direction === 'OUT' ? 'Registrar retiro' : direction === 'IN' ? 'Registrar ingreso' : 'Registrar movimiento'}</Button>
      </footer>
    </section>
  </form>
}


function MovementDetail({ movement: m, caps, locale }: { movement: CashMovement; caps: CashMovementCapabilities; locale?: string }) {
  const navigate = useNavigate(), state = useLocation().state as { saved?: boolean; replayed?: boolean } | null
  const canCompensate = caps.canCorrect && !m.correction_id && !m.corrects_movement_id
  return <section className="auna-surface space-y-4 rounded-xl border p-4 sm:p-5">
    {state?.saved && <p role="status" className="rounded-lg bg-muted/50 p-3 text-sm">{state.replayed ? 'Se recuperó el registro anterior; no se registró dinero dos veces.' : 'Movimiento registrado en el turno abierto.'}</p>}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-2xl font-semibold tabular-nums">{m.direction === 'IN' ? '+' : '−'}{formatCurrency(m.amount, m.currency_code, locale)}</p>
        <div className="mt-1 flex flex-wrap gap-2"><Badge variant={m.direction === 'IN' ? 'default' : 'secondary'}>{directionLabel(m.direction)}</Badge>{m.corrects_movement_id && <Badge variant="outline">Compensación</Badge>}{m.correction_id && <Badge variant="outline">Compensado</Badge>}</div></div>
      {canCompensate && <Button variant="outline" onClick={() => navigate(`${CASH_MOVEMENTS_PATH}/${m.id}/compensar`)}><Undo2 className="h-4 w-4" aria-hidden />Compensar</Button>}
    </div>
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
      <Detail label="Caja y responsable del turno">{m.register_name} · {m.responsible_name}</Detail>
      <Detail label="Registrado por">{m.actor_name}</Detail>
      <Detail label="Fecha">{formatZonedDateTime(m.created_at, m.business_timezone, locale)}</Detail>
      <Detail label={m.direction === 'IN' ? 'Procedencia declarada' : 'Destino declarado'}>{m.counterparty_label}</Detail>
      <Detail label="Medio">{m.payment_method_name}</Detail>
      <Detail label="Referencia">{m.reference || '—'}</Detail>
      <Detail label="Motivo" wide>{m.reason}</Detail>
    </dl>
    {(m.corrects_movement_id || m.correction_id) && <p className="text-sm">{m.corrects_movement_id ? <>Compensa el <Link className="font-medium underline-offset-4 hover:underline" to={`${CASH_MOVEMENTS_PATH}/${m.corrects_movement_id}`}>movimiento original</Link>; el turno anterior no cambia.</> : <>Fue compensado por <Link className="font-medium underline-offset-4 hover:underline" to={`${CASH_MOVEMENTS_PATH}/${m.correction_id}`}>otro movimiento</Link> en un turno abierto.</>}</p>}
    <p className="flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Movimiento físico de efectivo. No registra un gasto ni un pago, y no confirma que otra caja recibió el dinero. Para corregirlo se registra una compensación; este registro no se edita.</p>
  </section>
}
