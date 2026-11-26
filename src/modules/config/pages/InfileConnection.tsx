import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { TemplateSettingsLayout } from '../documentTemplates/TemplateSettingsLayout'
import { useTemplateConfirmation } from '../documentTemplates/useTemplateConfirmation'
import { useTemplateLeaveGuard } from '../documentTemplates/useTemplateLeaveGuard'
import { useInfileConnection } from '../connectors/useInfileConnection'
import { readConnectionHistory } from '../connectors/api'
import { credentialLabels, endpointLabels, type EndpointAction, type ConnectorScope, type Environment, type CredentialField, type HistoryEvent } from '../connectors/types'

type Props = { scope: ConnectorScope; environment: Environment; canManage: boolean; canTest: boolean; registerGuard: Parameters<typeof useTemplateLeaveGuard>[1]; companyName: string; onEnvironment: (environment: Environment) => void; onBack?: () => void }
function ConnectionHistory({ scope, environment }: { scope: ConnectorScope; environment: Environment }) {
  const [rows, setRows] = useState<HistoryEvent[]>([]), [error, setError] = useState(false), [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    void readConnectionHistory(scope, environment, controller.signal).then(value => { if (!controller.signal.aborted) setRows(value) }).catch(() => { if (!controller.signal.aborted) setError(true) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [scope.companyId, scope.branchId, scope.userId, scope.sessionId, environment])
  if (loading) return <p role="status">Cargando actividad…</p>
  if (error) return <p role="alert">No se pudo cargar la actividad. Cierra y vuelve a abrir este apartado para reintentar.</p>
  return rows.length ? <ul className="divide-y">{rows.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{row.action === 'SAVE_CONNECTION' ? 'Configuración guardada' : row.action === 'VALIDATE_LOCAL' ? 'Revisión local registrada' : 'Cambio de configuración'}</span><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('es-GT')}</time></li>)}</ul> : <p className="text-sm text-muted-foreground">Todavía no hay actividad para este entorno.</p>
}
export function InfileConnection({ scope, environment, canManage, canTest, registerGuard, companyName, onEnvironment, onBack }: Props) {
  const navigate = useNavigate()
  const form = useInfileConnection(scope, environment), { toast } = useToast(), confirmation = useTemplateConfirmation()
  const [history, setHistory] = useState(false), errorSummary = useRef<HTMLDivElement>(null)
  const [endpointsOpen, setEndpointsOpen] = useState(false)
  const canLeave = useTemplateLeaveGuard(form.activity, registerGuard, message => toast({ title: message }), confirmation.confirm, 'la conexión')
  const consolidated = scope.branchId === 'all'
  const disabled = !canManage || consolidated || form.loading || form.pending || !form.connection?.capabilities.encryptionReady
  useEffect(() => { if (form.error) errorSummary.current?.focus() }, [form.error])
  useEffect(() => {
    if (Object.entries(form.fieldErrors).some(([key, error]) => key.startsWith('endpoints') && error)) setEndpointsOpen(true)
  }, [form.fieldErrors])
  const save = async () => {
    if (disabled || !form.dirty) return
    if (form.connection?.id && !await confirmation.confirm({ title: '¿Guardar una nueva versión?', description: 'Se aplicarán los cambios indicados. Vaciar una URL guardada la elimina de la nueva versión; las credenciales en blanco se conservan. No se contactará a Infile.', confirmText: 'Guardar cambios' })) return
    if (await form.save()) { setHistory(false); toast({ title: 'Conexión guardada', description: 'Se guardó la configuración local. No se contactó a Infile.' }) }
  }
  return <TemplateSettingsLayout active="conectores" companyName={companyName} canLeave={canLeave}>
    <div className="space-y-5">
      <header className="space-y-1">{onBack && <Button variant="ghost" className="min-h-11 px-0" onClick={() => { if (canLeave(onBack)) onBack() }}>← Conectores</Button>}<h1 className="text-2xl font-semibold">Configuración de Infile</h1><p className="text-sm text-muted-foreground">Datos de conexión de esta empresa. La emisión FEL sigue deshabilitada.</p></header>
      <section className="rounded-lg border bg-card p-4 sm:p-5 space-y-4" aria-labelledby="infile-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="infile-heading" className="text-lg font-semibold">Conexión Infile</h2><span className="rounded border px-3 py-1 text-sm font-medium">Sin envíos a Infile</span></div>
        <p className="text-sm text-muted-foreground">Estamos preparando la integración. Puedes guardar los datos que te entregue Infile, pero las pruebas externas, la certificación y la activación real están bloqueadas.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Entorno de la conexión">{(['TEST', 'PRODUCTION'] as const).map(value => <Button key={value} type="button" className="min-h-11" variant={environment === value ? 'default' : 'outline'} aria-pressed={environment === value} onClick={() => { if (environment !== value) { const go = () => onEnvironment(value); if (canLeave(go)) go() } }}>{value === 'TEST' ? 'Pruebas' : 'Producción'}</Button>)}</div>
        <p className="text-sm">{environment === 'TEST' ? 'Datos para futuras pruebas. Guardarlos no ejecuta ninguna prueba externa.' : 'Datos separados del entorno de pruebas. Guardarlos no habilita la emisión real.'}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3"><p className="text-sm text-muted-foreground">Puedes preparar establecimientos y mapeos antes de tener credenciales de Infile.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => { const go = () => navigate(`/configuracion/conectores/preparacion?entorno=${environment}`); if (canLeave(go)) go() }}>Preparar datos fiscales</Button></div>
        {consolidated && <p role="status" className="text-sm">Vista consolidada de consulta. Selecciona una sucursal para guardar cambios de esta empresa.</p>}
        {form.loading ? <p role="status">Cargando conexión…</p> : !form.connection ? <p className="text-sm">La conexión no está disponible. Revisa el aviso y vuelve a cargar.</p> : <>
          <div className="border-t pt-4 space-y-4">
            <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{form.connection.id ? 'Datos guardados · Sin aprobación' : 'Aún no configurado'}</strong><span className="text-muted-foreground">{form.connection.revision ? `Versión ${form.connection.revision}` : 'Sin cambios guardados'}</span></div>
            {!form.connection.capabilities.encryptionReady && <p role="status" className="rounded border bg-muted p-3 text-sm">Antes de guardar, el administrador debe preparar la clave de cifrado del servidor. No ingreses credenciales hasta entonces.</p>}
            {!canManage && <p className="text-sm text-muted-foreground">Tu acceso es de consulta. Necesitas permiso para configurar conectores.</p>}
            <form autoComplete="off" noValidate onSubmit={e => { e.preventDefault(); void save() }} className="space-y-4">
              <fieldset disabled={disabled} className="grid gap-4 md:grid-cols-2"><legend className="sr-only">Credenciales de {environment === 'TEST' ? 'pruebas' : 'producción'}</legend>{(Object.keys(credentialLabels) as CredentialField[]).map(field => <label key={field} className="grid gap-2 text-sm" htmlFor={`infile-${field}`}><span className="flex flex-wrap justify-between gap-2"><span className="font-medium">{credentialLabels[field]}</span><span className="text-muted-foreground">{form.connection?.credentialStatus[field] ? 'Guardado' : 'Sin configurar'}</span></span><Input id={`infile-${field}`} name={`infile-${field}`} className="min-h-11" type="password" autoComplete="new-password" spellCheck={false} maxLength={field.endsWith('User') ? 256 : 2048} value={form.fields[field]} onChange={e => form.setField(field, e.target.value)} aria-invalid={!!form.fieldErrors[field]} aria-describedby={`infile-field-hint${form.fieldErrors[field] ? ` infile-${field}-error` : ''}`}/>{form.fieldErrors[field] && <span id={`infile-${field}-error`} className="text-destructive">{form.fieldErrors[field]}</span>}</label>)}</fieldset>
              <p id="infile-field-hint" className="text-sm text-muted-foreground">Las credenciales guardadas no se muestran. Completa un campo para reemplazarlo; en blanco se conserva su valor anterior. Para guardar credenciales por primera vez se necesitan las cuatro. Puedes preparar las URLs sin tenerlas.</p>
              <details className="border-y py-1" open={endpointsOpen} onToggle={e => setEndpointsOpen(e.currentTarget.open)}>
                <summary className="cursor-pointer py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2">URLs por acción · Opcional</summary>
                <div className="space-y-4 pb-4">
                  <p id="infile-endpoints-hint" className="text-sm text-muted-foreground">Ingresa solo las URLs que Infile confirme para este entorno, sin claves ni tokens. No hay valores predeterminados ni se probará la conexión. Vaciar una URL guardada la elimina al guardar.</p>
                  <fieldset disabled={disabled} className="grid gap-4 md:grid-cols-2"><legend className="sr-only">URLs de {environment === 'TEST' ? 'pruebas' : 'producción'}</legend>{(Object.keys(endpointLabels) as EndpointAction[]).map(action => <label key={action} htmlFor={`infile-endpoint-${action}`} className="grid gap-2 text-sm"><span className="font-medium">{endpointLabels[action]}</span><Input id={`infile-endpoint-${action}`} name={`infile-endpoint-${action}`} type="url" inputMode="url" autoComplete="off" spellCheck={false} maxLength={2048} className="min-h-11" value={form.endpoints?.[action] || ''} onChange={e => form.setEndpoint(action, e.target.value)} onBlur={() => form.validateEndpoint(action)} aria-invalid={!!form.fieldErrors[`endpoints.${action}`]} aria-describedby={`infile-endpoints-hint${form.fieldErrors[`endpoints.${action}`] ? ` infile-endpoint-${action}-error` : ''}`}/>{form.fieldErrors[`endpoints.${action}`] && <span id={`infile-endpoint-${action}-error`} className="text-destructive">{form.fieldErrors[`endpoints.${action}`]}</span>}</label>)}</fieldset>
                  <p className="text-sm text-muted-foreground">Una misma URL puede servir para varias acciones si así lo indica Infile. Consulta y recuperación siguen pendientes de confirmar; guardar una URL no confirma que el servicio exista ni habilita envíos.</p>
                </div>
              </details>
              <div className="flex flex-wrap gap-2"><Button type="submit" className="min-h-11" disabled={disabled || !form.dirty}>{form.pending ? 'Guardando o revisando…' : 'Guardar conexión'}</Button><Button type="button" variant="outline" className="min-h-11" disabled={!canTest || consolidated || form.loading || form.pending || form.dirty || !form.connection.id || !form.connection.capabilities.encryptionReady} onClick={async () => { if (await form.validate()) { setHistory(false); toast({ title: 'Revisión local registrada', description: 'No se contactó a Infile ni se aprobaron las credenciales.' }) } }}>Revisar localmente</Button></div>
            </form>
          </div>
          <p className="text-sm text-muted-foreground">La revisión comprueba que existe una configuración local. No verifica tus credenciales con Infile, no certifica documentos y no habilita producción.</p>
          {form.review && <p role="status" className="rounded border bg-muted p-3 text-sm">Revisión local registrada. Conexión externa pendiente de validar con Infile; la emisión sigue deshabilitada.</p>}
        </>}
        {form.error && <div ref={errorSummary} tabIndex={-1} role="alert" className="rounded border border-destructive p-3 text-sm"><p>{form.error}</p><Button type="button" variant="outline" className="mt-3 min-h-11" disabled={form.pending} onClick={() => { const go = () => void form.reload(); if (canLeave(go)) go() }}>Volver a cargar conexión</Button></div>}
      </section>
      <section className="rounded-lg border bg-card p-4 sm:p-5 space-y-3"><Button type="button" variant="ghost" className="min-h-11 px-0" aria-expanded={history} aria-controls="infile-history" onClick={() => setHistory(value => !value)}>Actividad reciente {history ? '−' : '+'}</Button>{history && <div id="infile-history"><ConnectionHistory key={`${environment}-${form.connection?.revision}`} scope={scope} environment={environment}/></div>}</section>
      {confirmation.dialog}
    </div>
  </TemplateSettingsLayout>
}
