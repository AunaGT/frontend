import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePaymentMethods } from '@/hooks/usePaymentMethods'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingState } from '@/components/shared/LoadingState'
import { SavedCustomerMany2One } from '@/modules/sales/components/SavedCustomerMany2One'
import { createNotice, fetchNoticeCapabilities, type NoticeScope } from '@/services/cashNoticesService'
import { CashPageHeader, Notice } from './components/CashPageParts'
import { AMOUNT, exactAmount } from './components/transferParts'
import { useNoticeAttempt } from './hooks/useCashNoticeAttempt'
import { CASH_NOTICES_PATH } from './CashNoticesPage'

const blank = { customerId: '', customerName: '', amount: '', paymentMethodId: '', reportedPaidOn: '', reportedReference: '', notes: '' }

// Registrar lo que el cliente informó. No cobra ni toca su saldo: un encargado lo confirma después con el banco.
export default function CashNoticeFormPage() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions()
  const scope: NoticeScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }
  return scope.companyId && scope.branchId && scope.actorId ? <NoticeForm key={JSON.stringify(scope)} scope={scope} branchName={branch?.name} /> : <LoadingState variant="cards" message="Cargando…" />
}

function NoticeForm({ scope, branchName }: { scope: NoticeScope; branchName?: string }) {
  const navigate = useNavigate(), cache = useQueryClient()
  usePageTrail([{ label: 'Cobros digitales', to: CASH_NOTICES_PATH }, { label: 'Registrar aviso' }])
  const caps = useQuery({ queryKey: ['cash-notice-capabilities', scope.companyId, scope.branchId, scope.actorId], queryFn: ({ signal }) => fetchNoticeCapabilities(scope, signal) })
  const methods = (usePaymentMethods().data ?? []).filter(m => m.settlement_kind === 'BANK' && !m.is_credit)
  const { draft, setDraft, pending, busy, error, recoveryBlocked, submit } = useNoticeAttempt(scope, blank)
  const set = (patch: Partial<typeof blank>) => setDraft(d => ({ ...d, ...patch }))
  async function save(event: FormEvent) {
    event.preventDefault()
    const missing = !draft.customerId ? 'notice-customer' : !AMOUNT.test(draft.amount.trim()) || Number(draft.amount) <= 0 ? 'notice-amount' : !draft.paymentMethodId ? 'notice-method' : !draft.reportedPaidOn ? 'notice-date' : null
    if (missing) { document.getElementById(missing)?.focus(); return }
    const receipt = await submit({ customerId: draft.customerId, amount: exactAmount(draft.amount), paymentMethodId: Number(draft.paymentMethodId), reportedPaidOn: draft.reportedPaidOn,
      ...(draft.reportedReference.trim() ? { reportedReference: draft.reportedReference.trim() } : {}), ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}) },
      command => createNotice(command as Parameters<typeof createNotice>[0], scope))
    if (receipt) { await cache.invalidateQueries({ queryKey: ['cash-notices'] }); navigate(`${CASH_NOTICES_PATH}/${receipt.notice.id}`) }
  }
  const disabled = busy || recoveryBlocked
  return <main className="mx-auto w-full max-w-[960px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title="Registrar aviso de pago" subtitle={`${branchName || ''} · El cliente informó un pago digital; no cambia su saldo hasta confirmarlo`} backLabel="Volver a cobros digitales" onBack={() => navigate(CASH_NOTICES_PATH)} />
    {caps.isLoading ? <LoadingState variant="cards" message="Verificando permisos…" />
      : !caps.data?.available || !caps.data.canCreate ? <Notice>No puedes registrar avisos de pago en esta sucursal.</Notice>
      : <form onSubmit={e => void save(e)} noValidate className="auna-surface space-y-4 rounded-xl border p-4">
        {pending && <Notice role="alert">Hay un aviso enviado sin confirmación. Al guardar se recupera el mismo aviso; no se crea otro.</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="notice-customer">Cliente</Label>
            <div id="notice-customer" tabIndex={-1}><SavedCustomerMany2One mode="required" valueId={draft.customerId || '__none__'} linkedDisplayName={draft.customerName} onPick={c => set({ customerId: c.id, customerName: c.name })} onClear={() => set({ customerId: '', customerName: '' })} /></div></div>
          <div className="space-y-1"><Label htmlFor="notice-amount">Importe informado</Label><Input id="notice-amount" inputMode="decimal" value={draft.amount} disabled={disabled} onChange={e => set({ amount: e.target.value })} placeholder="0.00" /></div>
          <div className="space-y-1"><Label htmlFor="notice-method">Medio</Label>
            <Select value={draft.paymentMethodId} onValueChange={v => set({ paymentMethodId: v })} disabled={disabled}><SelectTrigger id="notice-method"><SelectValue placeholder="Transferencia, tarjeta…" /></SelectTrigger>
              <SelectContent>{methods.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="notice-date">Fecha que informó</Label><Input id="notice-date" type="date" value={draft.reportedPaidOn} disabled={disabled} onChange={e => set({ reportedPaidOn: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="notice-ref">Referencia que informó (opcional)</Label><Input id="notice-ref" maxLength={120} value={draft.reportedReference} disabled={disabled} onChange={e => set({ reportedReference: e.target.value })} placeholder="No. de boleta o transferencia" /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="notice-notes">Nota (opcional)</Label><Textarea id="notice-notes" rows={2} maxLength={1000} value={draft.notes} disabled={disabled} onChange={e => set({ notes: e.target.value })} placeholder="Qué venta o servicio dice pagar" /></div>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => navigate(CASH_NOTICES_PATH)} disabled={busy}>Cancelar</Button><Button type="submit" disabled={disabled}>{busy ? 'Guardando…' : 'Registrar aviso'}</Button></div>
      </form>}
  </main>
}
