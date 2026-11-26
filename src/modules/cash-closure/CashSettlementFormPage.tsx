import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingState } from '@/components/shared/LoadingState'
import { createSettlement, fetchBankMethods, fetchEligibleAccounts, fetchPendingReceipts, fetchSettlementCapabilities, findDeposit, type DeductionKind, type SettlementScope } from '@/services/cashSettlementsService'
import { CashPageHeader, Notice } from './components/CashPageParts'
import { fetchDisputeCapabilities, fetchDisputes } from '@/services/cashDisputeService'
import { ChargebackCase, SettlementRecoveries, type SettlementRecovery } from './components/SettlementDisputeFields'
import { CASH_SETTLEMENTS_PATH, settlementBalance } from './components/settlementParts'
import { AMOUNT, exactAmount } from './components/transferParts'
import { useSettlementAttempt } from './hooks/useCashSettlementAttempt'
import { formatCurrency, formatZonedDateTime } from './types'

type Deduction = { kind: DeductionKind; amount: string; description: string; accountId: string; disputeId?: string; eventId?: string }
const blank = { methodId: '', reference: '', depositedOn: '', total: '', depositId: '', depositPending: '', net: '', selected: {} as Record<string, string>, deductions: [] as Deduction[], recoveries: [] as SettlementRecovery[] }
const KIND = { FEE: 'Comisión', CHARGEBACK: 'Contracargo', OTHER: 'Otra' } as const

export default function CashSettlementFormPage() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions()
  const scope: SettlementScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }
  return scope.companyId && scope.branchId && scope.actorId ? <SettlementForm key={JSON.stringify(scope)} scope={scope} branchName={branch?.name} /> : <LoadingState variant="cards" message="Cargando…" />
}

// Registrar lo que el proveedor depositó para esta sucursal: cobros que salda, deducciones documentadas y cuadre exacto con el neto.
function SettlementForm({ scope, branchName }: { scope: SettlementScope; branchName?: string }) {
  const navigate = useNavigate(), cache = useQueryClient(), { locale, timezone, currencyCode } = useSystemSettings(), key = [scope.companyId, scope.branchId, scope.actorId]
  usePageTrail([{ label: 'Liquidaciones', to: CASH_SETTLEMENTS_PATH }, { label: 'Registrar liquidación' }])
  const caps = useQuery({ queryKey: ['cash-settlement-capabilities', ...key], queryFn: ({ signal }) => fetchSettlementCapabilities(scope, signal) })
  const methods = useQuery({ queryKey: ['cash-bank-methods', ...key], queryFn: ({ signal }) => fetchBankMethods(scope, signal), enabled: !!caps.data?.canSettle })
  const accounts = useQuery({ queryKey: ['cash-bank-accounts', ...key], queryFn: ({ signal }) => fetchEligibleAccounts(scope, signal), enabled: !!caps.data?.canSettle })
  const pending = useQuery({ queryKey: ['cash-settlements-pending', ...key], queryFn: ({ signal }) => fetchPendingReceipts(scope, undefined, signal), enabled: !!caps.data?.canSettle })
  const { draft, setDraft, pending: inFlight, busy, error, recoveryBlocked, submit } = useSettlementAttempt(scope, blank)
  // Contracargos y recuperaciones solo con disputas liberadas: cada uno nombra su expediente y el servidor valida su presupuesto.
  const disputeCaps = useQuery({ queryKey: ['cash-dispute-capabilities', ...key], queryFn: ({ signal }) => fetchDisputeCapabilities(scope, signal), enabled: !!caps.data?.canSettle, retry: false })
  const disputesOn = !!disputeCaps.data?.available && !!disputeCaps.data.commandsAvailable && !!disputeCaps.data.can.movements
  const cases = useQuery({ queryKey: ['cash-settlement-disputes', ...key, draft.methodId], queryFn: ({ signal }) => fetchDisputes(scope, { methodId: Number(draft.methodId), pageSize: 100 }, signal), enabled: disputesOn && !!draft.methodId, retry: false })
  const openCases = (cases.data?.items || []).filter(c => c.status !== 'CANCELLED')
  const caseMissing = draft.deductions.some(d => d.kind === 'CHARGEBACK' && !d.disputeId) || (disputesOn && draft.recoveries.some(r => !r.amount))
  const set = (patch: Partial<typeof blank>) => setDraft(d => ({ ...d, ...patch }))
  const deferred = (methods.data || []).filter(m => m.active?.mode === 'DEFERRED'), method = deferred.find(m => String(m.payment_method_id) === draft.methodId)
  const receipts = (pending.data?.items || []).filter(i => String(i.payment_method_id) === draft.methodId)
  const chosen = receipts.filter(r => draft.selected[r.event_id] !== undefined)
  const balance = settlementBalance({ allocations: chosen.map(r => ({ direction: r.direction, amount: draft.selected[r.event_id] })), deductions: draft.deductions, recoveries: disputesOn ? draft.recoveries : [], net: draft.net })
  const money = (v: string) => formatCurrency(v, currencyCode, locale), diff = Number(balance.difference)
  const overDeposit = draft.depositPending !== '' && AMOUNT.test(draft.net) && Number(draft.net) > Number(draft.depositPending)
  async function lookup() {
    if (!draft.methodId || !draft.reference.trim()) return
    try {
      const d = await findDeposit(Number(draft.methodId), draft.reference.trim(), scope)
      set(d ? { depositId: d.id, depositedOn: d.deposited_on, total: d.total_amount, depositPending: d.pending } : { depositId: '', depositPending: '' })
    } catch { set({ depositId: '', depositPending: '' }) }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!balance.balanced || overDeposit || caseMissing) return
    const receipt = await submit({ paymentMethodId: Number(draft.methodId), net: exactAmount(draft.net),
      deposit: draft.depositId ? { id: draft.depositId } : { reference: draft.reference.trim(), depositedOn: draft.depositedOn, totalAmount: exactAmount(draft.total) },
      allocations: chosen.map(r => ({ eventId: r.event_id, amount: exactAmount(draft.selected[r.event_id]) })),
      deductions: draft.deductions.map(d => d.kind === 'CHARGEBACK' ? { kind: d.kind, amount: exactAmount(d.amount), description: d.description.trim(), accountId: null, eventId: d.eventId, disputeId: d.disputeId } : { kind: d.kind, amount: exactAmount(d.amount), description: d.description.trim(), accountId: d.accountId ? Number(d.accountId) : null }),
      ...(disputesOn && draft.recoveries.length ? { recoveries: draft.recoveries.map(r => ({ disputeId: r.disputeId, amount: exactAmount(r.amount) })) } : {}) },
      command => createSettlement(command as Parameters<typeof createSettlement>[0], scope))
    if (receipt) { await cache.invalidateQueries({ queryKey: ['cash-settlements'] }); await cache.invalidateQueries({ queryKey: ['cash-settlements-pending'] }); navigate(`${CASH_SETTLEMENTS_PATH}/${receipt.settlement.id}`) }
  }
  const disabled = busy || recoveryBlocked
  const setDeduction = (i: number, patch: Partial<Deduction>) => set({ deductions: draft.deductions.map((d, j) => j === i ? { ...d, ...patch } : d) })
  return <main className="mx-auto w-full max-w-[1100px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title="Registrar liquidación" subtitle={`${branchName || ''} · Lo que el proveedor depositó por los cobros diferidos de esta sucursal`} backLabel="Volver a liquidaciones" onBack={() => navigate(CASH_SETTLEMENTS_PATH)} />
    {caps.isLoading ? <LoadingState variant="cards" message="Verificando permisos…" />
      : !caps.data?.available || !caps.data.canSettle ? <Notice>No puedes registrar liquidaciones en esta sucursal.</Notice>
      : !deferred.length ? <Notice>Ningún medio está aprobado como «Lo liquida un proveedor». Configúralo en Medios bancarios.</Notice>
      : <form onSubmit={e => void save(e)} noValidate className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {inFlight && <Notice role="alert">Hay una liquidación enviada sin confirmación. Al guardar se recupera la misma; no se registra otra.</Notice>}
          <section className="auna-surface grid gap-3 rounded-xl border p-4 sm:grid-cols-2" aria-label="Depósito">
            <div className="space-y-1"><Label htmlFor="st-method">Medio</Label>
              <Select value={draft.methodId} onValueChange={v => set({ methodId: v, selected: {}, depositId: '', depositPending: '', recoveries: [], deductions: draft.deductions.filter(d => d.kind !== 'CHARGEBACK') })} disabled={disabled}><SelectTrigger id="st-method"><SelectValue placeholder="Tarjeta, pasarela…" /></SelectTrigger>
                <SelectContent>{deferred.map(m => <SelectItem key={m.payment_method_id} value={String(m.payment_method_id)}>{m.name} · {m.active!.destination_label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label htmlFor="st-reference">Referencia del depósito</Label><Input id="st-reference" maxLength={120} value={draft.reference} disabled={disabled} onChange={e => set({ reference: e.target.value, depositId: '', depositPending: '' })} onBlur={() => void lookup()} placeholder="Como aparece en el banco" /></div>
            <div className="space-y-1"><Label htmlFor="st-date">Fecha del depósito</Label><Input id="st-date" type="date" value={draft.depositedOn} disabled={disabled || !!draft.depositId} onChange={e => set({ depositedOn: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="st-total">Total del depósito (todas las sucursales)</Label><Input id="st-total" inputMode="decimal" value={draft.total} disabled={disabled || !!draft.depositId} onChange={e => set({ total: e.target.value })} placeholder="0.00" /></div>
            {draft.depositId && <p className="text-xs text-muted-foreground sm:col-span-2">Depósito ya registrado: falta distribuir {money(draft.depositPending)} entre sucursales.</p>}
            <div className="space-y-1"><Label htmlFor="st-net">Neto de esta sucursal</Label><Input id="st-net" inputMode="decimal" value={draft.net} disabled={disabled} onChange={e => set({ net: e.target.value })} placeholder="0.00" /></div>
          </section>
          <section className="auna-surface space-y-2 rounded-xl border p-4" aria-labelledby="st-receipts">
            <h2 id="st-receipts" className="text-sm font-semibold">Pendiente de liquidar</h2>
            {!draft.methodId ? <p className="text-sm text-muted-foreground">Elige el medio para ver sus cobros pendientes.</p>
              : !receipts.length ? <p className="text-sm text-muted-foreground">No hay cobros pendientes de este medio en la sucursal.</p>
              : <ul className="divide-y text-sm">{receipts.map(r => { const on = draft.selected[r.event_id] !== undefined
                return <li key={r.event_id} className="flex flex-wrap items-center gap-3 py-2">
                  <Checkbox aria-label={`Incluir cobro del ${formatZonedDateTime(r.economic_at, timezone, locale)}`} checked={on} disabled={disabled}
                    onCheckedChange={c => { const next = { ...draft.selected }; if (c === true) next[r.event_id] = r.remaining; else delete next[r.event_id]; set({ selected: next }) }} />
                  <span className="min-w-0 flex-1">{r.direction === 'IN' ? 'Cobro' : 'Reembolso'} · {formatZonedDateTime(r.economic_at, timezone, locale)}{r.reference ? ` · ${r.reference}` : ''}<span className="block text-xs text-muted-foreground">Pendiente {money(r.remaining)}</span></span>
                  {on && <Input aria-label="Importe a liquidar" className="h-9 w-28 text-right" inputMode="decimal" value={draft.selected[r.event_id]} disabled={disabled} onChange={e => set({ selected: { ...draft.selected, [r.event_id]: e.target.value } })} />}
                </li> })}</ul>}
          </section>
          <section className="auna-surface space-y-2 rounded-xl border p-4" aria-labelledby="st-deductions">
            <div className="flex items-center justify-between"><h2 id="st-deductions" className="text-sm font-semibold">Deducciones</h2>
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => set({ deductions: [...draft.deductions, { kind: 'FEE', amount: '', description: 'Comisión del proveedor', accountId: String(method?.active?.fee_account_id ?? '') }] })}><Plus className="h-4 w-4" aria-hidden />Agregar</Button></div>
            {!draft.deductions.length && <p className="text-sm text-muted-foreground">Comisiones, contracargos u otros descuentos del proveedor, cada uno con su cuenta.</p>}
            {draft.deductions.map((d, i) => <div key={i} className="grid gap-2 sm:grid-cols-[8rem_7rem_minmax(0,1fr)_12rem_auto] sm:items-end">
              <div className="space-y-1"><Label htmlFor={`st-d-kind-${i}`}>Tipo</Label><Select value={d.kind} onValueChange={v => setDeduction(i, v === 'CHARGEBACK' ? { kind: 'CHARGEBACK', accountId: '', description: d.description || 'Contracargo del proveedor' } : { kind: v as DeductionKind, disputeId: undefined, eventId: undefined })} disabled={disabled}><SelectTrigger id={`st-d-kind-${i}`}><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(KIND) as DeductionKind[]).filter(k => k !== 'CHARGEBACK' || disputesOn || d.kind === 'CHARGEBACK').map(k => <SelectItem key={k} value={k}>{KIND[k]}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label htmlFor={`st-d-amount-${i}`}>Importe</Label><Input id={`st-d-amount-${i}`} inputMode="decimal" value={d.amount} disabled={disabled} onChange={e => setDeduction(i, { amount: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor={`st-d-desc-${i}`}>Descripción</Label><Input id={`st-d-desc-${i}`} maxLength={300} value={d.description} disabled={disabled} onChange={e => setDeduction(i, { description: e.target.value })} /></div>
              {d.kind === 'CHARGEBACK' ? <ChargebackCase id={`st-d-case-${i}`} cases={openCases} value={d.disputeId || ''} disabled={disabled} onChange={c => setDeduction(i, { disputeId: c.id, eventId: c.event_id })} /> : <div className="space-y-1"><Label htmlFor={`st-d-account-${i}`}>Cuenta</Label><Select value={d.accountId} onValueChange={v => setDeduction(i, { accountId: v })} disabled={disabled}><SelectTrigger id={`st-d-account-${i}`}><SelectValue placeholder="Cuenta de gasto" /></SelectTrigger><SelectContent>{(accounts.data?.expenses || []).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div>}
              <Button type="button" variant="ghost" size="icon" aria-label="Quitar deducción" disabled={disabled} onClick={() => set({ deductions: draft.deductions.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" aria-hidden /></Button>
            </div>)}
          </section>
          {disputesOn && !!draft.methodId && <SettlementRecoveries cases={openCases} value={draft.recoveries} disabled={disabled} onChange={recoveries => set({ recoveries })} />}
        </div>
        <aside className="auna-surface h-fit space-y-2 rounded-xl border p-4 text-sm lg:sticky lg:top-4" aria-label="Cuadre">
          <h2 className="font-semibold">Cuadre</h2>
          <dl className="space-y-1 tabular-nums">
            <div className="flex justify-between"><dt>Cobros</dt><dd>{money(balance.gross)}</dd></div>
            <div className="flex justify-between"><dt>Reembolsos</dt><dd>−{money(balance.refunds)}</dd></div>
            <div className="flex justify-between"><dt>Deducciones</dt><dd>−{money(balance.deductions)}</dd></div>
            {balance.recoveries !== '0.00' && <div className="flex justify-between"><dt>Recuperaciones</dt><dd>+{money(balance.recoveries)}</dd></div>}
            <div className="flex justify-between border-t pt-1 font-medium"><dt>Debe depositarse</dt><dd>{money(balance.expected)}</dd></div>
            <div className="flex justify-between"><dt>Neto declarado</dt><dd>{draft.net ? money(draft.net) : '—'}</dd></div>
          </dl>
          <p role="status" className={balance.balanced ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'font-medium text-amber-700 dark:text-amber-300'}>
            {balance.balanced ? 'Cuadra' : !chosen.length || !draft.net ? 'Selecciona cobros y escribe el neto.' : `No cuadra: ${diff > 0 ? 'sobran' : 'faltan'} ${money(String(Math.abs(diff)))} en el depósito. Documenta la diferencia como deducción o revisa los importes.`}</p>
          {caseMissing && <p role="alert" className="text-destructive">Cada contracargo necesita su expediente y cada recuperación su importe.</p>}
          {overDeposit && <p role="alert" className="text-destructive">El neto supera lo que falta distribuir del depósito ({money(draft.depositPending)}).</p>}
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={disabled || !balance.balanced || overDeposit || caseMissing}>{busy ? 'Registrando…' : 'Registrar liquidación'}</Button>
        </aside>
      </form>}
  </main>
}
