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
import { fetchCustodyCapabilities, fetchHandoverContext, handoverTurn, type CustodyScope, type Handover, type HandoverContext } from '@/services/cashCustodyService'
import { useCustodyAttempt } from './hooks/useCashCustodyAttempt'
import { CashPageHeader, Detail, Notice } from './components/CashPageParts'
import { AMOUNT, CASH_TRANSFERS_PATH, cents, differenceText, exactAmount, fromCents } from './components/transferParts'
import { formatCurrency, formatZonedDateTime } from './types'

type Draft = { delivered: string; retained: string; destination: string; notes: string }
const BLANK: Draft = { delivered: '', retained: '', destination: '', notes: '' }

export default function CashHandoverPage({ sessionId }: { sessionId?: string }) {
  const params = useParams(), { company, branch } = useTenant(), { user } = useAuthPermissions()
  const id = sessionId || params.sessionId || ''
  return <HandoverView key={JSON.stringify([company?.id, branch?.id, user?.id, id])} sessionId={id} />
}

function HandoverView({ sessionId }: { sessionId: string }) {
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), { locale } = useSystemSettings(), navigate = useNavigate()
  const scope: CustodyScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }, ready = !!(scope.companyId && scope.branchId && scope.actorId && sessionId)
  usePageTrail([{ label: 'Traslados de efectivo', to: CASH_TRANSFERS_PATH }, { label: 'Entregar turno' }])
  const caps = useQuery({ queryKey: ['cash-custody-capabilities', scope.companyId, scope.branchId, scope.actorId], queryFn: ({ signal }) => fetchCustodyCapabilities(scope, signal), enabled: ready })
  const context = useQuery({ queryKey: ['cash-handover', scope.companyId, scope.branchId, scope.actorId, sessionId], queryFn: ({ signal }) => fetchHandoverContext(sessionId, scope, signal), enabled: ready && !!caps.data?.available })
  const c = context.data
  return <main className="mx-auto w-full max-w-[960px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title="Entregar turno" backLabel="Volver a traslados" onBack={() => navigate(CASH_TRANSFERS_PATH)}
      subtitle={c ? `${c.session.register_name} · ${c.session.responsible_name}${c.session.closed_at ? ` · terminó ${formatZonedDateTime(c.session.closed_at, c.session.business_timezone, locale)}` : ''}` : branch?.name || ''} />
    {caps.isLoading || context.isLoading ? <LoadingState variant="cards" message="Cargando el turno…" />
      : caps.error || context.error ? <Notice role="alert">{(context.error as Error)?.message || 'No se pudo cargar el turno.'}</Notice>
      : !caps.data?.available ? <Notice>La entrega de turnos aún no está disponible. Falta aplicar la actualización verificada; los turnos y arqueos actuales siguen funcionando.</Notice>
      : !c ? null
      : c.handover ? <HandoverSummary handover={c.handover} currency={c.session.currency_code} locale={locale} />
      : c.session.status !== 'CLOSED' ? <Notice>Termina el turno antes de entregar su efectivo. Desde Nueva venta: panel Turno → Cerrar caja.</Notice>
      : !c.eligible ? <Notice>Este turno usa el registro anterior de caja y no admite entrega con custodia.</Notice>
      : !c.canHandover ? <Notice>Solo su responsable o un encargado autorizado puede entregar este turno.</Notice>
      : <HandoverForm context={c} scope={scope} locale={locale} />}
  </main>
}

function HandoverSummary({ handover: h, currency, locale }: { handover: Handover; currency: string; locale?: string }) {
  return <section className="auna-surface space-y-3 rounded-xl border p-4 sm:p-5" aria-labelledby="handover-done">
    <h2 id="handover-done" className="font-semibold">Turno entregado</h2>
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
      <Detail label="Entregado a custodia">{formatCurrency(h.delivered_amount, currency, locale)}{h.destination_custody_name ? ` · ${h.destination_custody_name}` : ''}</Detail>
      <Detail label="Fondo que queda en la caja">{formatCurrency(h.retained_amount, currency, locale)}</Detail>
      <Detail label="Efectivo esperado al corte">{h.expected_cash ? formatCurrency(h.expected_cash, currency, locale) : '—'}</Detail>
      <Detail label="Diferencia (se revisa en el arqueo)">{differenceText(h.difference, v => formatCurrency(v, currency, locale)) || '—'}</Detail>
      <Detail label="Entregó">{h.actor_name}</Detail>
      <Detail label="Recepción en custodia">{h.transfer_id ? <Link className="underline-offset-4 hover:underline" to={`${CASH_TRANSFERS_PATH}/${h.transfer_id}`}>{h.transfer_status === 'PENDING' ? 'Pendiente de recibir' : h.transfer_status === 'RECEIVED' ? 'Recibido' : 'Rechazado'}</Link> : 'No aplica'}</Detail>
    </dl>
  </section>
}

function HandoverForm({ context: c, scope, locale }: { context: HandoverContext; scope: CustodyScope; locale?: string }) {
  const cache = useQueryClient()
  const form = useCustodyAttempt<Draft>({ scope, action: 'handover', target: c.session.id, blank: BLANK }), d = { ...BLANK, ...form.draft }
  const [errors, setErrors] = useState<Record<string, string>>({}), [done, setDone] = useState<Handover | null>(null)
  const locked = form.busy || form.pending || form.recoveryBlocked, retainedLocked = locked || c.registerHasOpenTurn
  const destination = d.destination || (c.custodies.length === 1 ? c.custodies[0].id : '')
  const declared = (cents(d.delivered || '0') ?? 0) + (cents(c.registerHasOpenTurn ? '0' : d.retained || '0') ?? 0), expected = c.expectedCash ? cents(c.expectedCash) : null
  const patch = (key: keyof Draft, value: string) => { setErrors(e => ({ ...e, [key]: '' })); form.setDraft(prev => ({ ...BLANK, ...prev, [key]: value })) }
  const money = (v: string) => formatCurrency(v, c.session.currency_code, locale)
  if (done) return <HandoverSummary handover={done} currency={c.session.currency_code} locale={locale} />
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.pending) {
      const next: Record<string, string> = {}, delivered = d.delivered.trim() || '0', retained = c.registerHasOpenTurn ? '0' : d.retained.trim() || '0'
      if (!AMOUNT.test(delivered)) next.delivered = 'Indica un importe con hasta dos decimales.'
      if (!AMOUNT.test(retained)) next.retained = 'Indica un importe con hasta dos decimales.'
      if ((cents(delivered) ?? 0) > 0 && !destination) next.destination = 'Elige la custodia que recibe lo entregado.'
      setErrors(next)
      const first = Object.keys(next)[0]; if (first) { document.getElementById(`handover-${first}`)?.focus(); return }
    }
    const delivered = exactAmount(d.delivered.trim() || '0'), retained = exactAmount(c.registerHasOpenTurn ? '0' : d.retained.trim() || '0')
    const receipt = await form.submit({ deliveredAmount: delivered, retainedAmount: retained, ...((cents(delivered) ?? 0) > 0 ? { destinationCustodyId: destination } : {}), ...(d.notes.trim() ? { notes: d.notes.trim() } : {}) },
      command => handoverTurn(c.session.id, command as Parameters<typeof handoverTurn>[1], scope))
    if (receipt && 'handover' in receipt) { setDone(receipt.handover); void cache.invalidateQueries({ queryKey: ['cash-transfers'] }) }
  }
  const field = (id: string) => ({ id: `handover-${id}`, 'aria-invalid': !!errors[id], 'aria-describedby': errors[id] ? `handover-${id}-error` : undefined })
  const fieldError = (id: string) => errors[id] ? <p id={`handover-${id}-error`} className="text-sm text-destructive">{errors[id]}</p> : null
  return <form onSubmit={submit} noValidate className="auna-surface space-y-4 rounded-xl border p-4 sm:p-5">
    {form.error && <Notice role="alert">{form.error}</Notice>}
    {form.pending && <p role="status" className="rounded-lg border p-3 text-sm">Hay una entrega pendiente de confirmar. Recupérala antes de cambiar algo: el turno no se entregará dos veces.</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <div className="min-w-0 space-y-1">
        <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3">
          <div className="space-y-1"><Label htmlFor="handover-delivered">Entregado a custodia</Label><Input {...field('delivered')} inputMode="decimal" autoComplete="off" className="tabular-nums" disabled={locked} value={d.delivered} onChange={e => patch('delivered', e.target.value.replace(',', '.'))} placeholder="0.00" /></div>
          <div className="space-y-1"><Label htmlFor="handover-destination">Custodia</Label><Select value={destination} disabled={locked || !c.custodies.length} onValueChange={v => patch('destination', v)}><SelectTrigger {...field('destination')}><SelectValue placeholder={c.custodies.length ? 'Selecciona' : 'Sin custodias activas'} /></SelectTrigger><SelectContent>{c.custodies.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {fieldError('delivered')}{fieldError('destination')}
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor="handover-retained">Fondo que queda en la caja</Label>
        <Input {...field('retained')} inputMode="decimal" autoComplete="off" className="tabular-nums" disabled={retainedLocked} value={c.registerHasOpenTurn ? '0.00' : d.retained} onChange={e => patch('retained', e.target.value.replace(',', '.'))} placeholder="0.00" />
        {fieldError('retained')}
        <p className="text-xs text-muted-foreground">{c.registerHasOpenTurn ? 'La caja ya abrió otro turno: entrega todo el efectivo a una custodia.' : 'Lo hereda el próximo turno de esta caja, que lo cuenta al abrir.'}</p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm tabular-nums" aria-live="polite">
      <span>Efectivo esperado al corte: <strong className="font-medium">{c.expectedCash ? money(c.expectedCash) : '—'}</strong></span>
      <span>Declaras: <strong className="font-medium">{money(fromCents(declared))}</strong></span>
      {expected !== null && <span>{differenceText(fromCents(declared - expected), money)}</span>}
    </div>
    <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />El esperado es solo referencia: cualquier diferencia se revisa en el arqueo y aquí no se ajusta nada. La custodia confirma después lo que recibe.</p>
    <details className="text-sm" open={!!d.notes}><summary className="cursor-pointer py-1 font-medium">Notas (opcional)</summary><Textarea id="handover-notes" className="mt-2" rows={2} maxLength={500} disabled={locked} value={d.notes} onChange={e => patch('notes', e.target.value)} /></details>
    <footer className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
      <Button type="submit" disabled={form.recoveryBlocked || (form.busy && !form.pending)}>{form.recoveryBlocked ? 'Recuperación necesaria' : form.busy ? 'Entregando…' : form.pending ? 'Recuperar entrega' : 'Entregar turno'}</Button>
    </footer>
  </form>
}
