import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchCashMoneyCapabilities } from '@/services/cashSessionsService'
import { CashRegisterAccessFields } from '../components/CashRegisterAccessFields'
import { useCashRegisterConfiguration } from '../hooks/useCashRegisterConfiguration'
import { CatalogAccess } from '../components/CatalogAccess'

export default function CashRegisterFormPage({ mode, registerId }: { mode: 'create' | 'view' | 'edit'; registerId?: string }) {
  const { id } = useParams(), { company, branch } = useTenant(), { user } = useAuthPermissions()
  const identity = JSON.stringify([company?.id, branch?.id, user?.id, registerId || id, mode])
  return <CatalogAccess kind="cash-registers"><CashRegisterForm key={identity} mode={mode} id={registerId || id} /></CatalogAccess>
}
function CashRegisterForm({ mode, id }: { mode: 'create' | 'view' | 'edit'; id?: string }) {
  const tenant = useTenant(), { company, branch } = tenant, { user, hasPermission } = useAuthPermissions(), navigate = useNavigate(), cache = useQueryClient()
  const scope = { companyId: company?.id || '', branchId: branch?.id || '', actorId: user?.id || '' }
  const canManage = hasPermission('cash.registers.manage'), readOnly = mode === 'view' || !canManage
  const form = useCashRegisterConfiguration({ ...scope, id, readOnly }), { draft, setDraft, record } = form
  const [errors, setErrors] = useState<Record<string, string>>({}), [saved, setSaved] = useState(false)
  const capabilities = useQuery({ queryKey: ['cash-register-capabilities', scope.companyId, scope.branchId, scope.actorId], queryFn: () => fetchCashMoneyCapabilities(scope), enabled: !!company && !!branch && !!user })
  const available = capabilities.data?.register_configuration_available === true
  const disabled = readOnly || form.busy || form.uncertain || form.recoveryBlocked || !available
  usePageTrail([{ label: 'Cajas', to: '/configuracion/cajas', permissions: ['cash.registers.view', 'cash.registers.manage'] }, { label: mode === 'create' ? 'Nueva caja' : mode === 'edit' ? 'Editar' : 'Detalle' }])
  useEffect(() => {
    if (!form.dirty && !form.uncertain) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', unload)
    const unregister = tenant.registerTenantExitGuard?.(() => window.confirm('Hay un borrador de caja pendiente. Se conservará para esta empresa y sucursal. ¿Cambiar de contexto?'))
    return () => { window.removeEventListener('beforeunload', unload); unregister?.() }
  }, [form.dirty, form.uncertain, tenant.registerTenantExitGuard])
  function patch(key: keyof typeof draft, value: unknown) { setSaved(false); setDraft(prev => ({ ...prev, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (readOnly || !available) return
    if (!form.uncertain) {
      const next: Record<string, string> = {}
      if (!draft.name.trim()) next['cash-name'] = 'Ingresa el nombre de la caja.'
      if (!id && !/^[A-Z\d][A-Z\d_-]{0,39}$/i.test(draft.code)) next['cash-code'] = 'Usa letras, números o guiones; máximo 40 caracteres.'
      if (draft.currencyCode && !/^[A-Z]{3}$/.test(draft.currencyCode)) next['cash-currency'] = 'Usa el código de tres letras de la moneda de la empresa.'
      setErrors(next)
      if (Object.keys(next).length) { document.getElementById(Object.keys(next)[0])?.focus(); return }
    }
    const result = await form.save()
    if (!result) return
    setSaved(true)
    void cache.invalidateQueries({ queryKey: ['cash-registers'] })
    if (!id) navigate(`/configuracion/cajas/${result.id}/editar`, { replace: true })
    else if (result.replayed) await form.loadCurrent(false)
  }
  return <main className="mx-auto w-full max-w-[1180px] space-y-4 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Button variant="outline" size="icon" aria-label="Volver a cajas" onClick={() => navigate('/configuracion/cajas')}><ArrowLeft aria-hidden size={18} /></Button><div><h1 className="text-xl font-semibold">{mode === 'create' ? 'Nueva caja' : record?.name || 'Configuración de caja'}</h1><p className="text-sm text-muted-foreground">{branch?.name || 'Selecciona una sucursal'} · {readOnly ? 'Consulta' : 'Configuración y acceso'}</p></div></div>{mode === 'view' && canManage && <Button variant="outline" onClick={() => navigate(`/configuracion/cajas/${id}/editar`)}>Editar caja</Button>}</header>
    {capabilities.isLoading ? <LoadingState variant="cards" message="Verificando disponibilidad…" /> : capabilities.error ? <p role="alert" className="text-destructive">No se pudo verificar la configuración. <Button variant="outline" onClick={() => void capabilities.refetch()}>Reintentar</Button></p> : !available ? <section className="auna-surface rounded-xl border p-4"><h2 className="font-semibold">La configuración avanzada aún no está disponible</h2><p className="mt-1 text-sm text-muted-foreground">Falta aplicar la actualización verificada de cajas. Tus cajas y turnos anteriores continúan funcionando; esta página no los convierte ni modifica.</p></section> : form.loading ? <LoadingState variant="cards" message="Cargando configuración…" /> : <>
      {form.error && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm"><p>{form.error}</p>{form.recoveryBlocked ? <Button variant="outline" className="mt-2" onClick={() => navigate(id ? `/configuracion/cajas/${id}` : '/configuracion/cajas')}>{id ? 'Consultar configuración guardada' : 'Ver cajas'}</Button> : form.conflict ? <><p className="mt-1 text-muted-foreground">Tu borrador se conserva. Carga la revisión actual, revisa tus cambios y vuelve a guardar.</p><Button variant="outline" className="mt-2" onClick={() => void form.loadCurrent(true)}>Cargar estado actual conservando mi borrador</Button></> : !record && id && !form.uncertain && <Button variant="outline" onClick={() => void form.loadCurrent(false)}>Reintentar carga</Button>}</div>}
      {form.uncertain && <p role="status" className="rounded-lg border p-3 text-sm">Hay un guardado pendiente de confirmar. Recupera el mismo intento antes de editar; no se creará una segunda caja.</p>}
      {saved && <p role="status" className="text-sm">Configuración guardada. No se abrió ningún turno ni se activó el registro de dinero.</p>}
      {(!id || record || form.uncertain || form.recoveryBlocked) && <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <section className="auna-surface min-w-0 space-y-4 rounded-xl border p-4 sm:p-5" aria-labelledby="cash-identity"><div><h2 id="cash-identity" className="font-semibold">Identidad de la caja</h2><p className="text-sm text-muted-foreground">Usa un nombre que el equipo reconozca.</p></div>
            <div className="space-y-1"><Label htmlFor="cash-name">Nombre</Label><Input id="cash-name" value={draft.name} maxLength={120} onChange={e => patch('name', e.target.value)} disabled={disabled} aria-invalid={!!errors['cash-name']} aria-describedby={errors['cash-name'] ? 'cash-name-error' : undefined} placeholder="Ej. Mostrador principal" />{errors['cash-name'] && <p id="cash-name-error" className="text-sm text-destructive">{errors['cash-name']}</p>}</div>
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]"><div className="space-y-1"><Label htmlFor="cash-code">Código</Label><Input id="cash-code" value={draft.code} maxLength={40} onChange={e => patch('code', e.target.value.toUpperCase())} disabled={disabled || !!id} aria-invalid={!!errors['cash-code']} aria-describedby={errors['cash-code'] ? 'cash-code-error' : undefined} placeholder="CAJA-01" />{errors['cash-code'] && <p id="cash-code-error" className="text-sm text-destructive">{errors['cash-code']}</p>}</div><div className="space-y-1"><Label htmlFor="cash-currency">Moneda</Label><Input id="cash-currency" value={draft.currencyCode} maxLength={3} onChange={e => patch('currencyCode', e.target.value.toUpperCase())} disabled={disabled || (!!id && (record?.money_event_version === 1 || !!record?.has_open_session || !!record?.has_pending_closure))} aria-invalid={!!errors['cash-currency']} aria-describedby={errors['cash-currency'] ? 'cash-currency-error cash-currency-help' : 'cash-currency-help'} placeholder="GTQ" />{errors['cash-currency'] && <p id="cash-currency-error" className="text-sm text-destructive">{errors['cash-currency']}</p>}</div></div>
            <p id="cash-currency-help" className="text-xs text-muted-foreground">La moneda debe coincidir con la empresa. No se convierte dinero ni se cambia una moneda con historial.</p>
            {record?.operation_mode === 'SHARED' && record.money_event_version === 0 && <p className="rounded-lg border p-3 text-sm text-muted-foreground">Compartida con registro anterior. Puedes editar su nombre y personas. Para habilitar el libro: termina el turno, guarda como Individual, habilita el registro de movimientos y el acceso explícito; después vuelve a Compartida. Los turnos anteriores conservan su modalidad.</p>}
            <fieldset className="space-y-2"><legend className="text-sm font-medium">¿Quién trabaja en el turno?</legend><div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Modalidad del turno">{(['INDIVIDUAL', 'SHARED'] as const).map(value => <Button key={value} type="button" role="radio" aria-checked={(draft.operationMode || record?.operation_mode || 'INDIVIDUAL') === value} variant={(draft.operationMode || record?.operation_mode || 'INDIVIDUAL') === value ? 'default' : 'outline'} disabled={disabled || !capabilities.data?.shared_turns_available || !record || record.kind !== 'PHYSICAL' || (record.money_event_version !== 1 && !(value === 'INDIVIDUAL' && record.operation_mode === 'SHARED')) || record.has_open_session || value === 'SHARED' && !(record.access_control_version === 1 || draft.enableExplicitAccess)} onClick={() => patch('operationMode', value)}>{value === 'SHARED' ? 'Equipo · compartida' : 'Una persona · individual'}</Button>)}</div><p className="text-xs text-muted-foreground">{(draft.operationMode || record?.operation_mode) === 'SHARED' ? 'Elige al menos dos personas autorizadas. Se unen con su propio usuario; quien abre es el responsable.' : record?.kind === 'VIRTUAL' ? 'Los períodos virtuales son individuales y no manejan efectivo.' : 'Para compartir: habilita el libro y el acceso explícito, selecciona dos personas y termina cualquier turno abierto.'}</p>{record?.has_open_session && <p className="text-xs text-muted-foreground">La modalidad no cambia mientras haya un turno abierto.</p>}</fieldset>
            <div className="flex flex-wrap gap-x-5 gap-y-3"><label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={draft.active} disabled={disabled || !!record?.is_default || !!record?.has_open_session || !!record?.has_pending_closure} onCheckedChange={checked => patch('active', checked === true)} />Caja activa</label><label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={draft.isDefault} disabled={disabled || !draft.active} onCheckedChange={checked => patch('isDefault', checked === true)} />Sugerida por defecto en esta sucursal</label></div>
            {(record?.has_open_session || record?.has_pending_closure) && <p className="text-sm text-muted-foreground">Hay un turno o arqueo pendiente. Resuélvelo antes de desactivar esta caja.</p>}
            <details className="border-t pt-3 text-sm"><summary className="cursor-pointer py-1 font-medium">Caja sugerida para vender · preferencia anterior</summary><p className="mt-2 text-muted-foreground">{record?.legacy_suggested_users.map(u => u.name).join(', ') || 'Ninguna persona tiene esta caja sugerida.'} Esta preferencia no se copia a las autorizaciones ni se reemplaza al guardar.</p></details>
          </section>
          <section className="auna-surface min-w-0 space-y-4 rounded-xl border p-4 sm:p-5"><CashRegisterAccessFields scope={scope} selected={draft.authorizedUserIds} known={record?.authorized_users || []} disabled={disabled} readOnly={readOnly} onChange={ids => patch('authorizedUserIds', ids)} />
            <details className="space-y-2 border-t pt-3"><summary className="cursor-pointer py-1 text-sm font-semibold">{record?.access_control_version === 1 ? 'Acceso explícito habilitado' : 'Acceso anterior · opciones de habilitación'}</summary><p className="text-sm text-muted-foreground">{record?.access_control_version === 1 ? 'Se exige autorización y pertenencia activa a esta empresa y sucursal al abrir y operar. Solo las personas autorizadas pueden unirse a un turno compartido.' : 'Puedes preparar las personas sin cambiar la operación actual. Guardar no habilita el libro de movimientos. Las nuevas cajas son físicas e individuales. Después de habilitar el libro y estos accesos podrás elegir un turno compartido.'}</p>
              {!readOnly && record?.access_control_version === 0 && <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><Checkbox className="mt-1" checked={draft.enableExplicitAccess} disabled={disabled || record.money_event_version !== 1 || record.kind !== 'PHYSICAL' || record.operation_mode !== 'INDIVIDUAL' || !record.currency_code || record.has_open_session || !draft.authorizedUserIds.length} onCheckedChange={checked => patch('enableExplicitAccess', checked === true)} /><span><strong className="font-medium">Usar las personas autorizadas para abrir futuros turnos</strong><span className="mt-1 block text-muted-foreground">Requiere libro habilitado, moneda y turno terminado. Una vez habilitado, no vuelve al acceso anterior.</span></span></label>}
            </details>
          </section>
        </div>
        {!readOnly && <footer className="flex flex-wrap items-center justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={() => navigate('/configuracion/cajas')}>Volver a cajas</Button><Button type="submit" disabled={form.busy || form.conflict || form.recoveryBlocked || !available}>{form.recoveryBlocked ? 'Recuperación necesaria' : form.busy ? 'Guardando…' : form.uncertain ? 'Recuperar guardado' : mode === 'create' ? 'Crear caja' : 'Guardar cambios'}</Button></footer>}
      </form>}
    </>}
  </main>
}
