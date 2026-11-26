import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchCustodyCapabilities, fetchCustodyDestinations, fetchTransfer, receiveTransfer, rejectTransfer, sendTransfer, type CashTransfer, type CustodyCapabilities, type CustodyScope } from '@/services/cashCustodyService'
import { useCustodyAttempt } from './hooks/useCashCustodyAttempt'
import { CashPageHeader, Detail, Notice } from './components/CashPageParts'
import { AMOUNT, CASH_TRANSFERS_PATH, cents, destinationLabel, differenceText, exactAmount, fromCents, originLabel, TransferStatusBadge } from './components/transferParts'
import { formatCurrency, formatZonedDateTime } from './types'

type Mode = 'create' | 'detail'
export default function CashTransferPage({ mode, transferId }: { mode: Mode; transferId?: string }) {
  const params = useParams(), { company, branch } = useTenant(), { user } = useAuthPermissions()
  const id = transferId || params.id
  return <TransferView key={JSON.stringify([company?.id, branch?.id, user?.id, mode, id])} mode={mode} transferId={id} />
}

function TransferView({ mode, transferId }: { mode: Mode; transferId?: string }) {
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), { locale, timezone } = useSystemSettings(), navigate = useNavigate()
  const scope: CustodyScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }, ready = !!(scope.companyId && scope.branchId && scope.actorId)
  usePageTrail([{ label: 'Traslados de efectivo', to: CASH_TRANSFERS_PATH }, { label: mode === 'create' ? 'Nuevo traslado' : 'Detalle' }])
  const caps = useQuery({ queryKey: ['cash-custody-capabilities', scope.companyId, scope.branchId, scope.actorId], queryFn: ({ signal }) => fetchCustodyCapabilities(scope, signal), enabled: ready })
  const transfer = useQuery({ queryKey: ['cash-transfer', scope.companyId, scope.branchId, scope.actorId, transferId], queryFn: ({ signal }) => fetchTransfer(transferId!, scope, signal), enabled: ready && mode === 'detail' && !!transferId && !!caps.data?.available })
  const c = caps.data, allowed = !!c && (mode === 'create' ? c.canOperateOwn || c.canOperateTeam : c.canView || c.canReceive || c.canOperateOwn || c.canOperateTeam)
  return <main className="mx-auto w-full max-w-[960px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title={mode === 'create' ? 'Nuevo traslado' : 'Traslado de efectivo'} subtitle={`${branch?.name || 'Selecciona una sucursal'} · Efectivo entre turnos y custodias`} backLabel="Volver a traslados" onBack={() => navigate(CASH_TRANSFERS_PATH)} />
    {caps.isLoading || transfer.isLoading ? <LoadingState variant="cards" message="Cargando…" />
      : caps.error || transfer.error ? <Notice role="alert">{(transfer.error as Error)?.message || 'No se pudo cargar el traslado.'}</Notice>
      : !c?.available ? <Notice>Los traslados de efectivo aún no están disponibles. Falta aplicar la actualización verificada.</Notice>
      : !allowed ? <Notice>No tienes permiso para esta operación de efectivo en la sucursal seleccionada.</Notice>
      : mode === 'detail' ? transfer.data && <TransferDetail transfer={transfer.data} caps={c} scope={scope} locale={locale} timezone={timezone} />
      : <TransferForm caps={c} scope={scope} locale={locale} />}
  </main>
}

function TransferDetail({ transfer: t, caps, scope, locale, timezone }: { transfer: CashTransfer; caps: CustodyCapabilities; scope: CustodyScope; locale?: string; timezone?: string }) {
  const cache = useQueryClient(), money = (v: string) => formatCurrency(v, t.currency_code, locale)
  const [received, setReceived] = useState(''), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [errors, setErrors] = useState<Record<string, string>>({})
  const own = t.sender_id === scope.actorId, diff = cents(received) === null ? null : (cents(received) as number) - (cents(t.amount) as number)
  async function act(kind: 'receive' | 'reject', event?: FormEvent) {
    event?.preventDefault()
    const next: Record<string, string> = {}
    if (kind === 'receive' && !AMOUNT.test(received.trim())) next.received = 'Indica cuánto recibiste, con hasta dos decimales.'
    if ((kind === 'reject' || diff !== null && diff !== 0) && !reason.trim()) next.reason = kind === 'reject' ? 'Explica por qué rechazas el traslado.' : 'Explica la diferencia entre lo enviado y lo recibido.'
    setErrors(next); const first = Object.keys(next)[0]
    if (first) { document.getElementById(`transfer-${first}`)?.focus(); return }
    setBusy(true); setError(null)
    try {
      // El servidor recupera la misma recepción si se reintenta: no acredita dos veces.
      if (kind === 'receive') await receiveTransfer(t.id, exactAmount(received), reason.trim() || undefined, scope)
      else await rejectTransfer(t.id, reason.trim(), scope)
      await cache.invalidateQueries({ queryKey: ['cash-transfer'] }); void cache.invalidateQueries({ queryKey: ['cash-transfers'] })
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar') } finally { setBusy(false) }
  }
  return <>
    <section className="auna-surface space-y-4 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-2xl font-semibold tabular-nums">{money(t.amount)}</p><p className="mt-1 text-sm">{originLabel(t)} → {destinationLabel(t)}</p></div>
        <TransferStatusBadge status={t.status} />
      </div>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <Detail label="Enviado por">{t.sender_name}</Detail>
        <Detail label="Fecha">{formatZonedDateTime(t.created_at, timezone, locale)}</Detail>
        <Detail label="Referencia">{t.reference || '—'}</Detail>
        <Detail label="Motivo" wide>{t.reason}</Detail>
        {t.status === 'RECEIVED' && <><Detail label="Recibido">{money(t.received_amount || '0')} · {t.receiver_name}</Detail><Detail label="Diferencia">{differenceText(t.difference, money)}</Detail><Detail label="Recibido el">{t.received_at ? formatZonedDateTime(t.received_at, timezone, locale) : '—'}</Detail></>}
        {t.status === 'REJECTED' && <Detail label="Rechazado por">{t.receiver_name}</Detail>}
        {t.receipt_reason && <Detail label={t.status === 'REJECTED' ? 'Motivo del rechazo' : 'Motivo de la diferencia'} wide>{t.receipt_reason}</Detail>}
      </dl>
      {(t.returns_transfer_id || t.return_transfer_id) && <p className="text-sm">{t.returns_transfer_id ? <>Devuelve el efectivo de un <Link className="font-medium underline-offset-4 hover:underline" to={`${CASH_TRANSFERS_PATH}/${t.returns_transfer_id}`}>traslado rechazado</Link>.</> : <>Su efectivo vuelve al origen en una <Link className="font-medium underline-offset-4 hover:underline" to={`${CASH_TRANSFERS_PATH}/${t.return_transfer_id}`}>devolución pendiente</Link>.</>}</p>}
    </section>
    {t.status === 'PENDING' && (own ? <Notice>Lo recibe otra persona autorizada en el destino; tú no puedes confirmar el efectivo que entregaste.</Notice>
      : !caps.canReceive ? <Notice>Este traslado espera que alguien autorizado en el destino lo reciba.</Notice>
      : <form onSubmit={e => act('receive', e)} noValidate className="auna-surface space-y-4 rounded-xl border p-4 sm:p-5" aria-labelledby="transfer-receive">
        <h2 id="transfer-receive" className="font-semibold">Recibir efectivo</h2>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-4 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
          <div className="space-y-1"><Label htmlFor="transfer-received">Importe recibido</Label><Input id="transfer-received" inputMode="decimal" autoComplete="off" className="tabular-nums" disabled={busy} value={received} onChange={e => { setReceived(e.target.value.replace(',', '.')); setErrors(x => ({ ...x, received: '' })) }} placeholder={t.amount} aria-invalid={!!errors.received} />
            {errors.received ? <p className="text-sm text-destructive">{errors.received}</p> : <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{diff === null ? 'Cuenta el efectivo antes de confirmar.' : differenceText(fromCents(diff), money)}</p>}</div>
          <div className="space-y-1"><Label htmlFor="transfer-reason">Motivo {diff !== null && diff !== 0 ? 'de la diferencia' : '(si rechazas o hay diferencia)'}</Label><Textarea id="transfer-reason" rows={2} maxLength={500} disabled={busy} value={reason} onChange={e => { setReason(e.target.value); setErrors(x => ({ ...x, reason: '' })) }} aria-invalid={!!errors.reason} />{errors.reason && <p className="text-sm text-destructive">{errors.reason}</p>}</div>
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
          {t.origin_kind !== 'RETURN' && <Button type="button" variant="outline" disabled={busy} onClick={() => void act('reject')}>Rechazar</Button>}
          <Button type="submit" disabled={busy}>{busy ? 'Registrando…' : 'Confirmar recepción'}</Button>
        </footer>
      </form>)}
  </>
}

type Draft = { origin: string; destination: string; amount: string; reason: string; reference: string }
const BLANK: Draft = { origin: '', destination: '', amount: '', reason: '', reference: '' }
function TransferForm({ caps, scope, locale }: { caps: CustodyCapabilities; scope: CustodyScope; locale?: string }) {
  const navigate = useNavigate()
  const options = useQuery({ queryKey: ['cash-custody-destinations', scope.companyId, scope.branchId, scope.actorId], queryFn: ({ signal }) => fetchCustodyDestinations(scope, signal) })
  const form = useCustodyAttempt<Draft>({ scope, action: 'send', blank: BLANK }), d = { ...BLANK, ...form.draft }
  const [errors, setErrors] = useState<Record<string, string>>({})
  const team = caps.canOperateTeam, money = (v: string) => formatCurrency(v, undefined, locale)
  const registers = options.data?.registers || [], custodies = (options.data?.custodies || []).filter(k => k.active)
  const origins = [
    ...registers.filter(r => r.open_session_id && (r.can_operate === undefined ? team || r.opened_by_id === scope.actorId : r.can_operate)).map(r => ({ value: `SESSION:${r.open_session_id}`, register: r.id, label: `Turno abierto · ${r.name} · ${r.responsible_name}` })),
    ...(team ? custodies.filter(k => (cents(k.balance) ?? 0) > 0).map(k => ({ value: `CUSTODY:${k.id}`, register: null, label: `Custodia · ${k.name} · ${money(k.balance)}` })) : []),
    ...(team ? registers.filter(r => !r.open_session_id && (cents(r.retained) ?? 0) > 0).map(r => ({ value: `FLOAT:${r.id}`, register: r.id, label: `Fondo retenido · ${r.name} · ${money(r.retained)}` })) : []),
  ]
  const origin = d.origin || (origins.length === 1 ? origins[0].value : ''), originRegister = origins.find(o => o.value === origin)?.register
  const destinations = [...custodies.filter(k => `CUSTODY:${k.id}` !== origin).map(k => ({ value: `CUSTODY:${k.id}`, label: `Custodia · ${k.name}` })),
    ...registers.filter(r => r.id !== originRegister).map(r => ({ value: `REGISTER:${r.id}`, label: `Caja · ${r.name} · ${r.open_session_id ? `entra al turno de ${r.responsible_name}` : 'sin turno: queda como fondo retenido'}` }))]
  const locked = form.busy || form.pending || form.recoveryBlocked
  const patch = (key: keyof Draft, value: string) => { setErrors(e => ({ ...e, [key]: '' })); form.setDraft(prev => ({ ...BLANK, ...prev, [key]: value })) }
  if (options.isLoading) return <LoadingState variant="cards" message="Buscando turnos y custodias…" />
  if (options.error) return <Notice role="alert">No se pudieron cargar los orígenes y destinos.</Notice>
  if (!origins.length && !form.pending) return <Notice>No tienes de dónde enviar efectivo: abre tu turno desde Nueva venta{team ? ' o registra saldo en una custodia' : ''}. Para entregar un turno terminado usa «Entregar turno».</Notice>
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.pending) {
      const next: Record<string, string> = {}
      if (!origin) next.origin = 'Elige de dónde sale el efectivo.'
      if (!d.destination) next.destination = 'Elige a dónde va el efectivo.'
      if (!AMOUNT.test(d.amount.trim()) || !cents(d.amount)) next.amount = 'Indica un importe mayor que cero, con hasta dos decimales.'
      if (!d.reason.trim()) next.reason = 'Explica el motivo del traslado.'
      setErrors(next); const first = Object.keys(next)[0]
      if (first) { document.getElementById(`transfer-${first}`)?.focus(); return }
    }
    const [ok, ov] = origin.split(':'), [dk, dv] = d.destination.split(':')
    const receipt = await form.submit({ origin: ok === 'SESSION' ? { kind: 'SESSION', sessionId: ov } : ok === 'CUSTODY' ? { kind: 'CUSTODY', custodyId: ov } : { kind: 'FLOAT', registerId: ov },
      destination: dk === 'CUSTODY' ? { kind: 'CUSTODY', custodyId: dv } : { kind: 'REGISTER', registerId: dv }, amount: exactAmount(d.amount), reason: d.reason.trim(), ...(d.reference.trim() ? { reference: d.reference.trim() } : {}) },
      command => sendTransfer(command as Parameters<typeof sendTransfer>[0], scope))
    if (receipt && 'transfer' in receipt) navigate(`${CASH_TRANSFERS_PATH}/${receipt.transfer.id}`, { replace: true })
  }
  const select = (key: 'origin' | 'destination', label: string, value: string, items: { value: string; label: string }[]) => <div className="space-y-1"><Label htmlFor={`transfer-${key}`}>{label}</Label>
    <Select value={value} disabled={locked} onValueChange={v => patch(key, v)}><SelectTrigger id={`transfer-${key}`} aria-invalid={!!errors[key]}><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent>{items.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent></Select>
    {errors[key] && <p className="text-sm text-destructive">{errors[key]}</p>}</div>
  return <form onSubmit={submit} noValidate className="auna-surface space-y-4 rounded-xl border p-4 sm:p-5">
    {form.error && <Notice role="alert">{form.error}</Notice>}
    {form.pending && <p role="status" className="rounded-lg border p-3 text-sm">Hay un traslado pendiente de confirmar. Recupéralo antes de cambiar algo: no se enviará dinero dos veces.</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <div className="min-w-0 space-y-4">{select('origin', 'Sale de', origin, origins)}{select('destination', 'Va a', d.destination, destinations)}</div>
      <div className="min-w-0 space-y-4">
        <div className="space-y-1"><Label htmlFor="transfer-amount">Importe</Label><Input id="transfer-amount" className="max-w-[12rem] tabular-nums" inputMode="decimal" autoComplete="off" disabled={locked} value={d.amount} onChange={e => patch('amount', e.target.value.replace(',', '.'))} placeholder="0.00" aria-invalid={!!errors.amount} />{errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}</div>
        <div className="space-y-1"><Label htmlFor="transfer-reason">Motivo</Label><Textarea id="transfer-reason" rows={2} maxLength={500} disabled={locked} value={d.reason} onChange={e => patch('reason', e.target.value)} placeholder="Ej. resguardo de billetes grandes" aria-invalid={!!errors.reason} />{errors.reason && <p className="text-sm text-destructive">{errors.reason}</p>}</div>
      </div>
    </div>
    <details className="text-sm" open={!!d.reference}><summary className="cursor-pointer py-1 font-medium">Referencia (opcional)</summary><Input id="transfer-reference" className="mt-2" maxLength={255} disabled={locked} value={d.reference} onChange={e => patch('reference', e.target.value)} placeholder="Ej. número de sobre" /></details>
    <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />El efectivo sale del origen al enviarlo y el destino solo suma lo que confirma al recibirlo. No es un gasto ni un pago.</p>
    <footer className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
      <Button type="button" variant="outline" onClick={() => navigate(CASH_TRANSFERS_PATH)}>Cancelar</Button>
      <Button type="submit" disabled={form.recoveryBlocked || (form.busy && !form.pending)}>{form.recoveryBlocked ? 'Recuperación necesaria' : form.busy ? 'Enviando…' : form.pending ? 'Recuperar traslado' : 'Enviar efectivo'}</Button>
    </footer>
  </form>
}
