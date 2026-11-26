import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingState } from '@/components/shared/LoadingState'
import { approveBankMethod, fetchBankMethods, fetchEligibleAccounts, fetchSettlementCapabilities, proposeBankMethod, rejectBankMethod, withdrawBankMethod,
  type BankMethod, type BankMode, type EligibleAccount, type MethodVersion, type SettlementScope } from '@/services/cashSettlementsService'
import { CashPageHeader, Notice } from './components/CashPageParts'
import { CASH_SETTLEMENTS_PATH, MODE_LABEL } from './components/settlementParts'

// Cómo llega el dinero de cada medio digital. El gestor propone; solo el administrador pone en vigor, también los cambios.
export default function CashBankMethodsPage() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), navigate = useNavigate(), cache = useQueryClient()
  const scope: SettlementScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }, ready = !!(scope.companyId && scope.branchId && scope.actorId)
  const key = [scope.companyId, scope.branchId, scope.actorId]
  usePageTrail([{ label: 'Liquidaciones', to: CASH_SETTLEMENTS_PATH }, { label: 'Medios bancarios' }])
  const caps = useQuery({ queryKey: ['cash-settlement-capabilities', ...key], queryFn: ({ signal }) => fetchSettlementCapabilities(scope, signal), enabled: ready })
  const methods = useQuery({ queryKey: ['cash-bank-methods', ...key], queryFn: ({ signal }) => fetchBankMethods(scope, signal), enabled: ready && !!caps.data?.available })
  const accounts = useQuery({ queryKey: ['cash-bank-accounts', ...key], queryFn: ({ signal }) => fetchEligibleAccounts(scope, signal), enabled: ready && !!caps.data?.available })
  const [editing, setEditing] = useState<number | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  async function act(work: () => Promise<unknown>) {
    setBusy(true); setError(null)
    try { await work(); setEditing(null) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setBusy(false); await cache.invalidateQueries({ queryKey: ['cash-bank-methods'] }) }
  }
  return <main className="mx-auto w-full max-w-[960px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title="Medios bancarios" subtitle="Si el dinero llega directo al banco o lo deposita después un proveedor (tarjeta). Cambia solo los cobros nuevos." backLabel="Volver a liquidaciones" onBack={() => navigate(CASH_SETTLEMENTS_PATH)} />
    {caps.isLoading || methods.isLoading ? <LoadingState variant="cards" message="Cargando medios…" />
      : !caps.data?.available ? <Notice>Las liquidaciones aún no están disponibles. Falta aplicar la actualización verificada.</Notice>
      : <>
        {!caps.data.canApprove && <Notice>Puedes preparar propuestas; el administrador las revisa y las pone en vigor.</Notice>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <ul className="space-y-3">{(methods.data || []).map(m => <li key={m.payment_method_id} className="auna-surface space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{m.name}</h2>
            {m.active ? <Badge variant="default">{MODE_LABEL[m.active.mode]}</Badge> : <Badge variant="outline">Sin configurar</Badge>}
            {!m.active && m.suggested_mode && <span className="text-xs text-muted-foreground">Sugerido: {MODE_LABEL[m.suggested_mode]}</span>}
            {caps.data!.canManage && !m.proposal && editing !== m.payment_method_id && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditing(m.payment_method_id)}>{m.active ? 'Proponer cambio' : 'Configurar'}</Button>}
          </div>
          {m.active ? <VersionSummary v={m.active} /> : <p className="text-sm text-muted-foreground">Sus cobros se contabilizan como hasta ahora y no se liquidan.</p>}
          {m.proposal && <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-sm font-medium">Propuesta pendiente · versión {m.proposal.version} · {m.proposal.proposed_by_name}</p>
            <VersionSummary v={m.proposal} />
            <ProposalActions method={m} canApprove={caps.data!.canApprove} canWithdraw={caps.data!.canManage} busy={busy}
              onApprove={() => act(() => approveBankMethod(m.proposal!.id, scope))} onReject={reason => act(() => rejectBankMethod(m.proposal!.id, reason, scope))} onWithdraw={() => act(() => withdrawBankMethod(m.proposal!.id, scope))} />
          </div>}
          {editing === m.payment_method_id && <ProposalForm method={m} accounts={accounts.data} busy={busy} onCancel={() => setEditing(null)} onSubmit={c => act(() => proposeBankMethod(c, scope))} />}
        </li>)}</ul>
      </>}
  </main>
}

function VersionSummary({ v }: { v: MethodVersion }) {
  return <dl className="grid gap-2 text-sm sm:grid-cols-2">
    <div><dt className="text-xs text-muted-foreground">Modo y destino</dt><dd>{MODE_LABEL[v.mode]} · {v.destination_label}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Banco</dt><dd>{v.bank_account_label || 'Sin contabilización'}</dd></div>
    {v.mode === 'DEFERRED' && <div><dt className="text-xs text-muted-foreground">Transitoria (cobros por liquidar)</dt><dd>{v.clearing_account_label || '—'}</dd></div>}
    {v.mode === 'DEFERRED' && <div><dt className="text-xs text-muted-foreground">Comisiones</dt><dd>{v.fee_account_label || '—'}</dd></div>}
  </dl>
}

function ProposalActions({ method, canApprove, canWithdraw, busy, onApprove, onReject, onWithdraw }: { method: BankMethod; canApprove: boolean; canWithdraw: boolean; busy: boolean; onApprove: () => void; onReject: (reason: string) => void; onWithdraw: () => void }) {
  const [reason, setReason] = useState('')
  return <div className="flex flex-wrap items-end gap-2">
    {canApprove && <>
      <Button size="sm" disabled={busy} onClick={() => { if (window.confirm(`Desde ahora los cobros nuevos de ${method.name} se registrarán como «${MODE_LABEL[method.proposal!.mode]}». Los anteriores no cambian. ¿Aprobar?`)) onApprove() }}>Aprobar</Button>
      <Input aria-label="Motivo del rechazo" className="h-9 max-w-xs" value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo del rechazo" disabled={busy} />
      <Button size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => onReject(reason.trim())}>Rechazar</Button>
    </>}
    {canWithdraw && <Button size="sm" variant="ghost" disabled={busy} onClick={onWithdraw}>Retirar propuesta</Button>}
  </div>
}

function ProposalForm({ method, accounts, busy, onCancel, onSubmit }: { method: BankMethod; accounts?: { assets: EligibleAccount[]; expenses: EligibleAccount[] }; busy: boolean; onCancel: () => void; onSubmit: (c: Parameters<typeof proposeBankMethod>[0]) => void }) {
  const base = method.active
  const [form, setForm] = useState({ mode: (base?.mode || method.suggested_mode || 'DIRECT') as BankMode, destination: base?.destination_label || '', bank: String(base?.bank_account_id ?? ''), clearing: String(base?.clearing_account_id ?? ''), fee: String(base?.fee_account_id ?? '') })
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))
  const pick = (id: string, label: string, value: string, list: EligibleAccount[] = [], onChange: (v: string) => void) => <div className="space-y-1"><Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={onChange} disabled={busy}><SelectTrigger id={id}><SelectValue placeholder="Selecciona la cuenta" /></SelectTrigger>
      <SelectContent>{list.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div>
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.destination.trim()) { document.getElementById(`bm-destination-${method.payment_method_id}`)?.focus(); return }
    const num = (v: string) => v ? Number(v) : null
    onSubmit({ paymentMethodId: method.payment_method_id, mode: form.mode, destinationLabel: form.destination.trim(), bankAccountId: num(form.bank), ...(form.mode === 'DEFERRED' ? { clearingAccountId: num(form.clearing), feeAccountId: num(form.fee) } : {}) })
  }
  return <form onSubmit={submit} noValidate className="space-y-3 border-t pt-3">
    <div role="radiogroup" aria-label="Cómo llega el dinero" className="flex flex-wrap gap-2">
      {(['DIRECT', 'DEFERRED'] as const).map(m => <Button key={m} type="button" size="sm" role="radio" aria-checked={form.mode === m} variant={form.mode === m ? 'default' : 'outline'} onClick={() => set({ mode: m })}>{MODE_LABEL[m]}</Button>)}
    </div>
    <p className="text-xs text-muted-foreground">{form.mode === 'DIRECT' ? 'El cobro ya está en el banco: se registra en la cuenta del banco.' : 'El cobro queda «por liquidar» hasta que el proveedor deposita; la liquidación descuenta comisiones.'}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2"><Label htmlFor={`bm-destination-${method.payment_method_id}`}>Destino (proveedor y cuenta)</Label><Input id={`bm-destination-${method.payment_method_id}`} maxLength={150} value={form.destination} disabled={busy} onChange={e => set({ destination: e.target.value })} placeholder="Ej. Visanet · Banco Industrial 0012" /></div>
      {pick(`bm-bank-${method.payment_method_id}`, 'Cuenta del banco', form.bank, accounts?.assets, v => set({ bank: v }))}
      {form.mode === 'DEFERRED' && pick(`bm-clearing-${method.payment_method_id}`, 'Cuenta transitoria (cobros por liquidar)', form.clearing, accounts?.assets, v => set({ clearing: v }))}
      {form.mode === 'DEFERRED' && pick(`bm-fee-${method.payment_method_id}`, 'Cuenta de comisiones', form.fee, accounts?.expenses, v => set({ fee: v }))}
    </div>
    {!method.accounting && <p className="text-xs text-muted-foreground">La contabilidad está apagada: las cuentas son opcionales y los cobros quedan «sin contabilización».</p>}
    <div className="flex gap-2"><Button type="submit" disabled={busy}>Enviar propuesta</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button></div>
  </form>
}
