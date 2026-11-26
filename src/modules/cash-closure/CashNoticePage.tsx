import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingState } from '@/components/shared/LoadingState'
import { confirmNotice, fetchNotice, fetchNoticeCapabilities, fetchNoticeEvidence, fetchVirtualPeriods, rejectNotice, uploadNoticeEvidence, type NoticeScope, type PaymentNotice } from '@/services/cashNoticesService'
import { CashPageHeader, Detail, Notice } from './components/CashPageParts'
import { CASH_NOTICES_PATH, NOTICE_STATUS } from './CashNoticesPage'
import { civilDate, formatCurrency, formatZonedDateTime } from './types'

export default function CashNoticePage({ noticeId }: { noticeId?: string }) {
  const params = useParams(), id = noticeId ?? params.id ?? ''
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), { locale, timezone } = useSystemSettings(), navigate = useNavigate(), cache = useQueryClient()
  const scope: NoticeScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }, ready = !!(scope.companyId && scope.branchId && scope.actorId && id)
  const key = [scope.companyId, scope.branchId, scope.actorId]
  usePageTrail([{ label: 'Cobros digitales', to: CASH_NOTICES_PATH }, { label: 'Aviso de pago' }])
  const caps = useQuery({ queryKey: ['cash-notice-capabilities', ...key], queryFn: ({ signal }) => fetchNoticeCapabilities(scope, signal), enabled: ready })
  const notice = useQuery({ queryKey: ['cash-notice', id, ...key], queryFn: ({ signal }) => fetchNotice(id, scope, signal), enabled: ready && !!caps.data?.available })
  const pendingConfirm = notice.data?.status === 'PENDING' && !!caps.data?.canConfirm
  const periods = useQuery({ queryKey: ['cash-notice-periods', ...key], queryFn: ({ signal }) => fetchVirtualPeriods(scope, signal), enabled: ready && pendingConfirm })
  const refresh = () => cache.invalidateQueries({ queryKey: ['cash-notice'] }).then(() => cache.invalidateQueries({ queryKey: ['cash-notices'] }))
  const n = notice.data
  return <main className="mx-auto w-full max-w-[960px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title="Aviso de pago" subtitle={`${branch?.name || 'Selecciona una sucursal'} · Lo que el cliente informó; no es dinero hasta confirmarlo`} backLabel="Volver a cobros digitales" onBack={() => navigate(CASH_NOTICES_PATH)} />
    {caps.isLoading || notice.isLoading ? <LoadingState variant="detail" message="Cargando aviso…" />
      : !n ? <Notice role="alert">No se encontró el aviso en la sucursal activa.</Notice>
      : <>
        <section className="auna-surface space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{n.customer_name}</h2><Badge variant={NOTICE_STATUS[n.status].variant}>{n.status === 'PENDING' ? 'Informado por el cliente · por confirmar' : NOTICE_STATUS[n.status].label}</Badge></div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Detail label="Importe informado">{formatCurrency(n.amount, n.currency_code, locale)}</Detail>
            <Detail label="Medio">{n.payment_method_name}</Detail>
            <Detail label="Fecha y referencia informadas">{civilDate(n.reported_paid_on, locale)}{n.reported_reference ? ` · ${n.reported_reference}` : ''}</Detail>
            <Detail label="Registrado por">{n.created_by_name} · {formatZonedDateTime(n.created_at, timezone, locale)}</Detail>
            {n.notes && <Detail label="Nota" wide>{n.notes}</Detail>}
          </dl>
        </section>
        {n.status === 'CONFIRMED' && <Confirmed notice={n} scope={scope} canOpen={!!caps.data?.canConfirm} />}
        {n.status === 'REJECTED' && <Notice>Rechazado por {n.rejected_by_name}{n.rejected_at ? ` el ${formatZonedDateTime(n.rejected_at, timezone, locale)}` : ''}: {n.rejection_reason}. No se registró dinero.</Notice>}
        {pendingConfirm && (periods.isLoading ? <LoadingState variant="cards" message="Buscando períodos de caja virtual…" />
          : !periods.data?.length ? <Notice>Abre un período de caja virtual en esta sucursal para confirmar. Los cobros digitales no se registran en cajas físicas ni en períodos cerrados.</Notice>
          : <ConfirmForm notice={n} scope={scope} periods={periods.data} evidenceUpload={!!caps.data?.evidenceUpload} onDone={refresh} />)}
        {n.status === 'PENDING' && !caps.data?.canConfirm && <Notice>Un encargado con permiso para confirmar cobros digitales debe revisarlo con el banco.</Notice>}
      </>}
  </main>
}

function Confirmed({ notice: n, scope, canOpen }: { notice: PaymentNotice; scope: NoticeScope; canOpen: boolean }) {
  const { locale, timezone } = useSystemSettings(), [error, setError] = useState<string | null>(null)
  async function open() { setError(null); try { window.open((await fetchNoticeEvidence(n.id, scope)).url, '_blank', 'noopener') } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir la evidencia') } }
  return <section className="auna-surface space-y-2 rounded-xl border p-4 text-sm">
    <p className="font-medium">Confirmado manualmente por {n.confirmed_by_name}{n.confirmed_at ? ` el ${formatZonedDateTime(n.confirmed_at, timezone, locale)}` : ''}</p>
    <dl className="grid gap-3 sm:grid-cols-3">
      <Detail label="Fecha real del pago">{civilDate(n.paid_on, locale)}</Detail>
      <Detail label="Referencia del banco o proveedor">{n.external_reference}</Detail>
      <Detail label="Caja virtual">{n.register_name}</Detail>
      {n.verification_id && <Detail label="Identificador verificable">{n.verification_id}</Detail>}
    </dl>
    {n.evidence_path && canOpen && <Button variant="outline" size="sm" onClick={() => void open()}>Ver evidencia</Button>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>
}

function ConfirmForm({ notice: n, scope, periods, evidenceUpload, onDone }: { notice: PaymentNotice; scope: NoticeScope; periods: { id: string; register_name: string; responsible_name: string }[]; evidenceUpload: boolean; onDone: () => Promise<unknown> }) {
  const [form, setForm] = useState({ sessionId: periods[0]?.id || '', paidOn: n.reported_paid_on, externalReference: '', verificationId: '', attested: false, allowAdvance: false, reason: '' })
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))
  async function act(work: () => Promise<unknown>) {
    setBusy(true); setError(null)
    try { await work(); await onDone() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción'); await onDone() } finally { setBusy(false) }
  }
  function confirm(event: FormEvent) {
    event.preventDefault()
    const missing = !form.externalReference.trim() ? 'notice-reference' : !form.verificationId.trim() && !file ? 'notice-verification' : !form.attested ? 'notice-attest' : null
    if (missing) { setError(missing === 'notice-attest' ? 'Marca que revisaste el depósito en el banco o proveedor.' : missing === 'notice-reference' ? 'Escribe la referencia del banco o proveedor.' : 'Agrega el identificador verificable o un archivo de evidencia.'); document.getElementById(missing)?.focus(); return }
    void act(async () => {
      const evidencePath = file ? (await uploadNoticeEvidence(file, scope)).path : undefined
      await confirmNotice(n.id, { sessionId: form.sessionId, paidOn: form.paidOn, externalReference: form.externalReference.trim(), ...(form.verificationId.trim() ? { verificationId: form.verificationId.trim() } : {}), ...(evidencePath ? { evidencePath } : {}), attested: true, allowAdvance: form.allowAdvance }, scope)
    })
  }
  function reject() {
    if (!form.reason.trim()) { setError('Escribe el motivo del rechazo.'); document.getElementById('notice-reject-reason')?.focus(); return }
    void act(() => rejectNotice(n.id, form.reason.trim(), scope))
  }
  return <section aria-labelledby="confirm-title" className="auna-surface space-y-4 rounded-xl border p-4">
    <h2 id="confirm-title" className="text-base font-semibold">Confirmar cobro</h2>
    <form onSubmit={confirm} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="notice-period">Período de caja virtual</Label>
          <Select value={form.sessionId} onValueChange={v => set({ sessionId: v })} disabled={busy}><SelectTrigger id="notice-period"><SelectValue /></SelectTrigger>
            <SelectContent>{periods.map(p => <SelectItem key={p.id} value={p.id}>{p.register_name} · {p.responsible_name}</SelectItem>)}</SelectContent></Select>
          {(() => { const p = periods.find(x => x.id === form.sessionId); return p && <p className="text-xs text-muted-foreground">El cobro entra a {p.register_name}, período de {p.responsible_name}.</p> })()}</div>
        <div className="space-y-1"><Label htmlFor="notice-paid-on">Fecha real del pago</Label><Input id="notice-paid-on" type="date" value={form.paidOn} disabled={busy} onChange={e => set({ paidOn: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="notice-reference">Referencia del banco o proveedor</Label><Input id="notice-reference" maxLength={120} value={form.externalReference} disabled={busy} onChange={e => set({ externalReference: e.target.value })} placeholder="Como aparece en el estado de cuenta" /></div>
        <div className="space-y-1"><Label htmlFor="notice-verification">Identificador verificable</Label><Input id="notice-verification" maxLength={120} value={form.verificationId} disabled={busy} onChange={e => set({ verificationId: e.target.value })} placeholder="No. de autorización o transacción" /></div>
        {evidenceUpload && <div className="space-y-1 sm:col-span-2"><Label htmlFor="notice-evidence">Evidencia privada (opcional si hay identificador)</Label><Input id="notice-evidence" type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} /><p className="text-xs text-muted-foreground">PDF, PNG o JPG de hasta 5 MB. Una captura del cliente no confirma el pago por sí sola.</p></div>}
      </div>
      <label className="flex items-start gap-3 text-sm"><Checkbox id="notice-attest" checked={form.attested} disabled={busy} onCheckedChange={c => set({ attested: c === true })} /><span>Revisé el depósito en el banco o con el proveedor y corresponde a este aviso.</span></label>
      <label className="flex items-start gap-3 text-sm"><Checkbox checked={form.allowAdvance} disabled={busy} onCheckedChange={c => set({ allowAdvance: c === true })} /><span>Si el importe supera lo que debe el cliente, dejar la diferencia como anticipo.</span></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Procesando…' : `Confirmar cobro de ${formatCurrency(n.amount, n.currency_code)}`}</Button>
    </form>
    <div className="space-y-2 border-t pt-4">
      <Label htmlFor="notice-reject-reason">Rechazar aviso</Label>
      <Textarea id="notice-reject-reason" rows={2} maxLength={1000} value={form.reason} disabled={busy} onChange={e => set({ reason: e.target.value })} placeholder="Por qué no corresponde (no aparece en el banco, importe distinto…)" />
      <Button type="button" variant="outline" disabled={busy} onClick={reject}>Rechazar aviso</Button>
    </div>
  </section>
}
