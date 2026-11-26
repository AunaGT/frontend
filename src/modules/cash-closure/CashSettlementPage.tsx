import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchSettlement, voidSettlement, type SettlementScope } from '@/services/cashSettlementsService'
import { CashPageHeader, Detail, Notice } from './components/CashPageParts'
import { CASH_SETTLEMENTS_PATH } from './components/settlementParts'
import { civilDate, formatCurrency, formatZonedDateTime } from './types'

const KIND = { FEE: 'Comisión', CHARGEBACK: 'Contracargo', OTHER: 'Otra deducción' } as const
const SOURCE: Record<string, string> = { SALE: 'Venta', CUSTOMER_PAYMENT: 'Cobro', CUSTOMER_PAYMENT_REFUND: 'Devolución de anticipo', RETURN_SETTLEMENT: 'Reembolso de devolución' }

export default function CashSettlementPage({ settlementId }: { settlementId?: string }) {
  const params = useParams(), id = settlementId ?? params.id ?? ''
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), { locale, timezone, currencyCode } = useSystemSettings(), navigate = useNavigate(), cache = useQueryClient()
  const scope: SettlementScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }
  usePageTrail([{ label: 'Liquidaciones', to: CASH_SETTLEMENTS_PATH }, { label: 'Liquidación' }])
  const query = useQuery({ queryKey: ['cash-settlement', id, scope.companyId, scope.branchId], queryFn: ({ signal }) => fetchSettlement(id, scope, signal), enabled: !!(id && scope.companyId && scope.branchId) })
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const s = query.data, money = (v: string) => formatCurrency(v, currencyCode, locale)
  async function annul() {
    if (!reason.trim()) { setError('Escribe el motivo de la anulación.'); document.getElementById('settlement-void-reason')?.focus(); return }
    if (!window.confirm('Se revierte el asiento y los cobros vuelven a quedar pendientes de liquidar. Una anulación no se deshace. ¿Anular?')) return
    setBusy(true); setError(null)
    try { await voidSettlement(id, reason.trim(), scope) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo anular') } finally { setBusy(false); await cache.invalidateQueries({ queryKey: ['cash-settlement'] }); await cache.invalidateQueries({ queryKey: ['cash-settlements'] }) }
  }
  return <main className="mx-auto w-full max-w-[960px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title="Liquidación" subtitle={`${branch?.name || ''} · Lo que el proveedor depositó por los cobros de esta sucursal`} backLabel="Volver a liquidaciones" onBack={() => navigate(CASH_SETTLEMENTS_PATH)} />
    {query.isLoading ? <LoadingState variant="detail" message="Cargando liquidación…" />
      : !s ? <Notice role="alert">No se encontró la liquidación en la sucursal activa.</Notice>
      : <>
        <section className="auna-surface space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">Depósito {s.deposit_reference}</h2><Badge variant={s.status === 'POSTED' ? 'default' : 'outline'}>{s.status === 'POSTED' ? 'Registrada' : 'Anulada'}</Badge></div>
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            <Detail label="Cobros">{money(s.gross)}</Detail>
            <Detail label="Reembolsos">−{money(s.refunds)}</Detail>
            <Detail label="Deducciones">−{money(s.deductions_total)}</Detail>
            <Detail label="Neto de esta sucursal"><strong>{money(s.net)}</strong></Detail>
            <Detail label="Medio y fecha">{s.payment_method_name} · {civilDate(s.deposited_on, locale)}</Detail>
            <Detail label="Total del depósito">{money(s.deposit_total)}</Detail>
            <Detail label="Asiento">{s.entry_number || 'Sin contabilización'}</Detail>
            <Detail label="Registrada por">{s.created_by_name}</Detail>
          </dl>
        </section>
        <section aria-labelledby="alloc-title" className="auna-surface space-y-2 rounded-xl border p-4 text-sm">
          <h2 id="alloc-title" className="font-semibold">Cobros liquidados</h2>
          <ul className="divide-y">{s.allocations.map(a => <li key={a.event_id} className="flex items-center justify-between gap-2 py-2"><span>{SOURCE[a.source_type] || a.source_type} · {formatZonedDateTime(a.economic_at, timezone, locale)}{a.reference ? ` · ${a.reference}` : ''}</span><span className="tabular-nums">{Number(a.amount) < 0 ? '−' : ''}{money(String(Math.abs(Number(a.amount))))}</span></li>)}</ul>
          {s.deductions.length > 0 && <>
            <h3 className="pt-2 font-semibold">Deducciones</h3>
            <ul className="divide-y">{s.deductions.map((d, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{KIND[d.kind]} · {d.description}{d.account_label ? <span className="block text-xs text-muted-foreground">{d.account_label}</span> : null}</span><span className="tabular-nums">−{money(d.amount)}</span></li>)}</ul>
          </>}
        </section>
        {s.status === 'VOIDED'
          ? <Notice>Anulada por {s.voided_by_name}{s.voided_at ? ` el ${formatZonedDateTime(s.voided_at, timezone, locale)}` : ''}: {s.void_reason}.{s.void_entry_number ? ` Contra-asiento ${s.void_entry_number}.` : ''} Sus cobros volvieron a quedar pendientes.</Notice>
          : <section className="auna-surface space-y-2 rounded-xl border p-4">
            <Label htmlFor="settlement-void-reason">Anular liquidación</Label>
            <Textarea id="settlement-void-reason" rows={2} maxLength={500} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder="Por qué se anula (referencia equivocada, importe distinto…)" />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button variant="outline" disabled={busy} onClick={() => void annul()}>Anular liquidación</Button>
          </section>}
      </>}
  </main>
}
