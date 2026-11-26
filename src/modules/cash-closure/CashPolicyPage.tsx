import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchPolicies, fetchReviewCapabilities, savePolicy, type Policy, type ReviewScope } from '@/services/cashReviewService'
import { CashPageHeader, Notice } from './components/CashPageParts'

type Level = 'company' | 'branch'
const blank = { cash: '0.00', digital: '0.00', blind: false, owner: false }

// Umbrales por clase de medio y conteo ciego. La excepción del dueño es de toda la empresa y solo la cambia el administrador.
export default function CashPolicyPage() {
  const { company, branch } = useTenant(), { user } = useAuthPermissions(), navigate = useNavigate(), cache = useQueryClient()
  const scope: ReviewScope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }, ready = !!(scope.companyId && scope.branchId && scope.actorId)
  const key = [scope.companyId, scope.branchId, scope.actorId]
  usePageTrail([{ label: 'Cierre de caja', to: '/cierre-caja' }, { label: 'Política de diferencias' }])
  const caps = useQuery({ queryKey: ['cash-review-capabilities', ...key], queryFn: ({ signal }) => fetchReviewCapabilities(scope, signal), enabled: ready })
  const policies = useQuery({ queryKey: ['cash-review-policy', ...key], queryFn: ({ signal }) => fetchPolicies(scope, signal), enabled: ready && !!caps.data?.available })
  const [level, setLevel] = useState<Level>('company'), [form, setForm] = useState(blank), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [saved, setSaved] = useState(false)
  const current: Policy | null = policies.data?.[level] ?? null, company_ = policies.data?.company ?? null
  useEffect(() => {
    const p = current ?? (level === 'branch' ? company_ : null)
    setForm(p ? { cash: p.cash_threshold, digital: p.digital_threshold, blind: p.blind_count, owner: !!company_?.owner_self_review } : { ...blank, owner: !!company_?.owner_self_review })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, policies.data])
  const canEdit = !!caps.data?.canManagePolicy, isAdmin = !!caps.data?.isAdmin
  async function submit(event: FormEvent) {
    event.preventDefault()
    const bad = (['cash', 'digital'] as const).find(k => !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(form[k].trim()))
    if (bad) { setError('Ingresa montos no negativos con hasta dos decimales.'); document.getElementById(`policy-${bad}`)?.focus(); return }
    const ownerChanged = level === 'company' && form.owner !== !!company_?.owner_self_review
    if (ownerChanged && form.owner && !window.confirm('Con la excepción activa, quien declaró podrá revisar su propio arqueo y recibir sus propios traslados. Cada autorrevisión quedará marcada. ¿Activarla?')) return
    setBusy(true); setError(null); setSaved(false)
    try {
      await savePolicy({ branchId: level === 'branch' ? scope.branchId : null, cashThreshold: form.cash.trim(), digitalThreshold: form.digital.trim(), blindCount: form.blind,
        ...(ownerChanged ? { ownerSelfReview: form.owner } : {}), expectedRevision: current?.revision ?? 0 }, scope)
      await cache.invalidateQueries({ queryKey: ['cash-review-policy'] }); setSaved(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la política') } finally { setBusy(false) }
  }
  const effective = policies.data?.effective
  return <main className="mx-auto w-full max-w-[960px] space-y-4 p-4 sm:p-6">
    <CashPageHeader title="Política de diferencias" subtitle={`${branch?.name || 'Selecciona una sucursal'} · Cuánta diferencia se acepta al revisar un arqueo`} backLabel="Volver a cierres" onBack={() => navigate('/cierre-caja')} />
    {caps.isLoading || policies.isLoading ? <LoadingState variant="cards" message="Cargando política…" />
      : !caps.data?.available ? <Notice>La revisión con política aún no está disponible. Falta aplicar la actualización verificada.</Notice>
      : <form onSubmit={submit} noValidate className="auna-surface space-y-4 rounded-xl border p-4">
        <div role="radiogroup" aria-label="Alcance de la política" className="flex flex-wrap gap-2">
          {(['company', 'branch'] as const).map(l => <Button key={l} type="button" role="radio" aria-checked={level === l} variant={level === l ? 'default' : 'outline'} size="sm" onClick={() => setLevel(l)}>
            {l === 'company' ? 'Toda la empresa' : `Solo ${branch?.name || 'esta sucursal'}`}</Button>)}
        </div>
        {level === 'branch' && !current && <p className="text-xs text-muted-foreground">Esta sucursal usa la política de la empresa. Al guardar tendrá la suya.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="policy-cash">Tolerancia en efectivo</Label>
            <Input id="policy-cash" inputMode="decimal" value={form.cash} disabled={!canEdit || busy} onChange={e => setForm({ ...form, cash: e.target.value })} aria-describedby="policy-cash-help" />
            <p id="policy-cash-help" className="text-xs text-muted-foreground">Faltante o sobrante que se acepta sin revisión. 0.00 revisa toda diferencia.</p></div>
          <div className="space-y-1"><Label htmlFor="policy-digital">Tolerancia en medios digitales</Label>
            <Input id="policy-digital" inputMode="decimal" value={form.digital} disabled={!canEdit || busy} onChange={e => setForm({ ...form, digital: e.target.value })} aria-describedby="policy-digital-help" />
            <p id="policy-digital-help" className="text-xs text-muted-foreground">Tarjeta, transferencia y otros. Un sobrante de un medio nunca cubre el faltante de otro.</p></div>
        </div>
        <div className="config-toggle-row flex items-start justify-between gap-4"><div className="space-y-1"><Label htmlFor="policy-blind">Conteo ciego</Label>
          <p id="policy-blind-help" className="text-xs text-muted-foreground">Quien cuenta no ve lo esperado hasta guardar su conteo.</p></div>
          <Switch id="policy-blind" checked={form.blind} disabled={!canEdit || busy} aria-describedby="policy-blind-help" onCheckedChange={v => setForm({ ...form, blind: v })} /></div>
        {level === 'company' && <div className="config-toggle-row flex items-start justify-between gap-4 border-t pt-4"><div className="space-y-1"><Label htmlFor="policy-owner">Dueño que opera solo</Label>
          <p id="policy-owner-help" className="text-xs text-muted-foreground">Permite revisar el propio arqueo y recibir los propios traslados cuando no hay otra persona. Cada caso queda marcado.{!isAdmin && ' Solo el administrador puede cambiarlo.'}</p></div>
          <Switch id="policy-owner" checked={form.owner} disabled={!isAdmin || busy} aria-describedby="policy-owner-help" onCheckedChange={v => setForm({ ...form, owner: v })} /></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {saved && <p role="status" className="text-sm text-muted-foreground">Política guardada. Aplica a los arqueos nuevos; los ya presentados conservan la suya.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {effective && <p className="text-xs text-muted-foreground">Vigente en esta sucursal: política {effective.source === 'BRANCH' ? 'de la sucursal' : effective.source === 'COMPANY' ? 'de la empresa' : 'predeterminada'}.</p>}
          {canEdit && <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar política'}</Button>}
        </div>
      </form>}
  </main>
}
