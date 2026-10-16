/** Copyright (c) 2026 Diego Patzán. All Rights Reserved. */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { LoadingState } from '@/components/shared/LoadingState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useToast } from '@/hooks/use-toast'
import { SECTION_KEYS, SETTINGS_SECTIONS, type EditableSection } from '../settingsModel'
import { useSettingsDraft, type SaveOutcome } from '../useSettingsDraft'
import { SettingsNavigation } from '../components/SettingsNavigation'
import { SettingsErrorSummary, SettingsSectionActions } from '../components/SettingsSectionActions'
import { CompanySettingsSection } from '../components/CompanySettingsSection'
import { FiscalSettingsSection } from '../components/FiscalSettingsSection'
import { OperationalSettingsSection } from '../components/OperationalSettingsSection'
import { SettingsRelatedLinks } from '../components/SettingsRelatedLinks'
import { ModulesSettings } from './ModulesSettings'
import { HrDocumentsSettings } from './HrDocumentsSettings'
import './config.css'

const descriptions: Record<string, string> = {
  empresa: 'Nombre y logo que identifican a esta empresa en la aplicación y sus documentos.',
  regional: 'Moneda, zona horaria e idioma que utiliza esta empresa.',
  fiscal: 'Datos del emisor y habilitación de facturación electrónica.',
  inventario: 'Bienes, servicios y accesos a los diseños de impresión existentes.',
  ventas: 'Define cómo inicia la pantalla de venta, sin modificar los permisos de los usuarios.',
  cotizaciones: 'Valores iniciales para nuevas cotizaciones y su reserva temporal.',
  pedidos: 'Vigencia inicial de pedidos y reservas.',
  caja: 'Tolerancia y denominaciones disponibles para el conteo de efectivo.',
  accesos: 'Abre los editores existentes de cada módulo, sin duplicar configuraciones.',
}
type Confirmation = { type: 'reset'; section: EditableSection; key: string } | { type: 'leave'; to: string; key: string } | null

export default function ConfigManagement() {
  const { company, branch, isConsolidated, registerTenantExitGuard } = useTenant()
  const { user, hasPermission, permissionsReady } = useAuthPermissions()
  const { refetch } = useSystemSettings(), { toast } = useToast()
  const [params, setParams] = useSearchParams(), navigate = useNavigate()
  const requested = params.get('seccion') || 'empresa'
  const selected = SETTINGS_SECTIONS.find(s => s.id === requested) || SETTINGS_SECTIONS[0]
  const active = selected.id
  const context = { userId: user?.id || '', companyId: company?.id || '', branchId: branch?.id || (isConsolidated ? 'all' : ''), ready: permissionsReady,
    canRead: hasPermission('settings.view', 'settings.manage'), canManage: hasPermission('settings.manage'), consolidated: !!isConsolidated }
  const draft = useSettingsDraft({ context, refresh: refetch })
  const contextKey = JSON.stringify(context)
  const live = useRef({ key: contextKey, active: true })
  if (live.current.key !== contextKey) live.current = { key: contextKey, active: true }
  const owner = live.current
  const latest = useRef({ draft, key: contextKey }); latest.current = { draft, key: contextKey }
  const allowUnload = useRef(false)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [notice, setNotice] = useState('')
  const [focusErrors, setFocusErrors] = useState(0)
  const [logoOperation, setLogoOperation] = useState<string | null>(null)
  const [visited, setVisited] = useState<Set<string>>(() => new Set([active]))
  usePageTrail([{ label: selected.label }])
  const current = () => owner.active && live.current === owner
  const canMutate = context.canManage && !context.consolidated && draft.status === 'ready'
  const editable = Object.prototype.hasOwnProperty.call(SECTION_KEYS, active) ? active as EditableSection : null

  useEffect(() => {
    if (requested !== active) {
      setNotice('La sección solicitada no existe. Mostramos Identidad de empresa.')
      const next = new URLSearchParams(params); next.set('seccion', active); setParams(next, { replace: true })
    }
    setVisited(old => old.has(active) ? old : new Set([...old, active]))
  }, [requested, active, params, setParams])
  useEffect(() => { owner.active = true; return () => { owner.active = false } }, [contextKey])
  useEffect(() => {
    allowUnload.current = false
    const unregister = registerTenantExitGuard(() => {
      const activity = latest.current.draft.getActivity()
      if (activity.pending) { toast({ title: 'Espera a que termine la operación actual.' }); return false }
      if (activity.dirty && !window.confirm('Hay cambios sin guardar en Configuración. ¿Descartarlos y cambiar de empresa o sucursal?')) return false
      allowUnload.current = true
      return true
    })
    const guard = (event: BeforeUnloadEvent) => {
      const activity = latest.current.draft.getActivity()
      if (allowUnload.current || (!activity.dirty && !activity.pending)) return
      event.preventDefault(); event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => { unregister(); window.removeEventListener('beforeunload', guard) }
  }, [registerTenantExitGuard, contextKey, toast])
  useEffect(() => { if (focusErrors) document.getElementById('config-errors')?.focus() }, [focusErrors])

  function selectSection(id: typeof active) {
    if (draft.getActivity().pending) { toast({ title: 'Espera a que termine la operación actual.' }); return }
    const next = new URLSearchParams(params); next.set('seccion', id); setNotice(''); setParams(next)
  }
  function confirmLeave(to: string) {
    const activity = draft.getActivity()
    if (activity.pending) { toast({ title: 'Espera a que termine la operación actual.' }); return }
    if (activity.dirty) setConfirmation({ type: 'leave', to, key: contextKey })
    else navigate(to)
  }
  function feedback(outcome: SaveOutcome) {
    if (!current() || outcome === 'ignored') return
    if (outcome === 'invalid' || outcome === 'failed') { setFocusErrors(n => n + 1); return }
    toast({ title: outcome === 'saved-refresh-failed' ? 'Cambios guardados; no se pudo actualizar la vista.' : 'Configuración guardada',
      description: outcome === 'saved-refresh-failed' ? 'Puedes recargar la página. No necesitas guardar otra vez.' : undefined })
  }
  async function logoAction(file?: File) {
    if (!draft.canStartOperation()) return
    setLogoOperation(contextKey)
    const outcome = file ? await draft.uploadLogo(file) : await draft.removeLogo()
    if (current()) { setLogoOperation(null); feedback(outcome) }
  }
  const common = editable ? { section: editable, values: draft.drafts[editable], disabled: !canMutate || draft.pending, errors: draft.errors[editable] || {}, onField: (key: Parameters<typeof draft.setField>[1], value: unknown) => draft.setField(editable, key, value) } : null
  const scopedConfirmation = confirmation?.key === contextKey ? confirmation : null

  return <div className="config-page mx-auto w-full max-w-[1560px] min-w-0 space-y-5 p-4 sm:p-8">
    <h1 className="sr-only">Configuración</h1>
    <div className="config-context-line"><p>Se aplica a <strong>{draft.confirmed.company_name || company?.name || 'la empresa activa'}</strong></p>{draft.hasChanges && <span>Hay cambios pendientes</span>}</div>
    <div className="config-center"><SettingsNavigation active={active} onSelect={selectSection} /><div className="config-center-content space-y-5">
      {notice && <p role="status" className="config-note">{notice}</p>}
      {draft.status === 'loading' ? <LoadingState variant="page" message="Cargando configuración…" /> : draft.status === 'error' ? <div role="alert" className="config-panel p-5 space-y-3"><p>No se pudo cargar la configuración. No se guardó ningún cambio.</p><p className="text-sm text-muted-foreground">{draft.loadError}</p><Button variant="outline" onClick={() => void draft.reload()}>Reintentar</Button></div> : draft.status === 'unavailable' ? <div className="config-panel p-5 space-y-3"><p>Verifica tu empresa, sucursal y sesión para abrir la configuración.</p><Button variant="outline" onClick={() => window.location.reload()}>Recargar página</Button></div> : <>
        {(!context.canManage || context.consolidated) && <p className="config-note">{context.consolidated ? 'Vista consolidada de consulta. Selecciona una sucursal para guardar cambios.' : 'Acceso de consulta. Necesitas permiso para gestionar estos ajustes.'}</p>}
        {editable && common && <Card className="config-panel"><CardHeader><CardTitle>{selected.label}</CardTitle><CardDescription>{descriptions[active]}</CardDescription></CardHeader><CardContent className="space-y-5">
          <SettingsErrorSummary errors={common.errors} error={draft.error} />
          {active === 'empresa' || active === 'regional' ? <CompanySettingsSection {...common} logoUrl={draft.logoUrl} logoPending={logoOperation === contextKey} canManage={context.canManage} onUpload={file => void logoAction(file)} onRemove={() => void logoAction()} onReject={message => toast({ title: message, variant: 'destructive' })} /> : active === 'fiscal' ? <FiscalSettingsSection {...common} /> : <OperationalSettingsSection {...common} />}
          <SettingsSectionActions dirty={draft.dirty(editable)} pending={draft.pending} canManage={canMutate} onSave={async () => feedback(await draft.save(editable))} onReset={() => setConfirmation({ type: 'reset', section: editable, key: contextKey })} />
        </CardContent></Card>}
        {active === 'inventario' && <SettingsRelatedLinks inventoryOnly confirmLeave={confirmLeave} />}
        {active === 'accesos' && <Card className="config-panel"><CardHeader><CardTitle>{selected.label}</CardTitle><CardDescription>{descriptions.accesos}</CardDescription></CardHeader><CardContent><SettingsRelatedLinks confirmLeave={confirmLeave} /></CardContent></Card>}
        {visited.has('rrhh') && <div hidden={active !== 'rrhh'} key={`hr-${contextKey}`}><HrDocumentsSettings /></div>}
        {visited.has('modulos') && <div hidden={active !== 'modulos'} key={`modules-${contextKey}`}><ModulesSettings canManage={canMutate} /></div>}
      </>}
    </div></div>
    <AlertDialog open={!!scopedConfirmation} onOpenChange={open => { if (!open) setConfirmation(null) }}><AlertDialogContent variant="auna"><AlertDialogHeader><AlertDialogTitle>¿Descartar cambios sin guardar?</AlertDialogTitle><AlertDialogDescription>{scopedConfirmation?.type === 'reset' ? 'Se restablecerá únicamente esta sección. Los cambios de otras secciones se conservan.' : 'Al salir se perderán los cambios pendientes de Configuración. Los cambios ya guardados se conservan.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={() => {
      if (!scopedConfirmation || draft.getActivity().pending) return
      if (scopedConfirmation.type === 'reset') draft.reset(scopedConfirmation.section)
      else { allowUnload.current = true; navigate(scopedConfirmation.to) }
      setConfirmation(null)
    }}>Descartar cambios</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}
