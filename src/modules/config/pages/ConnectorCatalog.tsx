import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { TemplateSettingsLayout } from '../documentTemplates/TemplateSettingsLayout'
import { useTemplateConfirmation } from '../documentTemplates/useTemplateConfirmation'
import { useProviderCatalog } from '../connectors/useProviderCatalog'
import type { ConnectorScope, Environment } from '../connectors/types'
import { InfileConnection } from './InfileConnection'

type Props = { scope: ConnectorScope; companyName: string; canManage: boolean; canTest: boolean; registerGuard: Parameters<typeof InfileConnection>[0]['registerGuard']; environment: Environment; onEnvironment: (environment: Environment) => void }
export function ConnectorCatalog(props: Props) {
  const { scope, companyName, canManage } = props
  const form = useProviderCatalog(scope), confirmation = useTemplateConfirmation(), { toast } = useToast()
  const [configuring, setConfiguring] = useState(false)
  const selected = form.data?.selectedProvider, consolidated = scope.branchId === 'all'
  const disabled = !canManage || consolidated || form.loading || form.pending || !!form.error
  const choose = async (provider: 'INFILE' | null) => {
    if (disabled || provider && selected) return
    if (!await confirmation.confirm(provider ? { title: '¿Activar Infile para esta empresa?', description: 'Infile quedará seleccionado como proveedor de facturación. Esto no habilita la emisión FEL ni realiza pruebas o envíos a Infile.', confirmText: 'Activar Infile' } : { title: '¿Desactivar el conector?', description: 'Se quitará como conector activo de esta empresa. Se conservarán sus credenciales, configuración e historial. No se enviará ninguna solicitud a Infile.', confirmText: 'Desactivar conector' })) return
    if (await form.choose(provider)) toast({ title: provider ? 'Infile activado para configurar' : 'Conector desactivado', description: 'La emisión FEL sigue deshabilitada. No se contactó a Infile.' })
  }
  if (configuring && selected === 'INFILE') return <InfileConnection key={props.environment} {...props} onBack={() => setConfiguring(false)}/>
  return <TemplateSettingsLayout active="conectores" companyName={companyName}>
    <div className="space-y-6">
      <header className="space-y-2"><h1 className="text-2xl font-semibold">Conectores</h1><p className="max-w-2xl text-sm text-muted-foreground">Elige el servicio de facturación de esta empresa. Solo puedes tener un conector activo a la vez; para cambiarlo, desactiva primero el actual.</p></header>
      {consolidated && <p role="status" className="text-sm text-muted-foreground">Selecciona una sucursal para cambiar el conector de esta empresa.</p>}
      {!canManage && <p className="text-sm text-muted-foreground">Tu acceso es de consulta. Necesitas permiso para configurar conectores.</p>}
      {form.loading && <p role="status">Cargando conectores…</p>}
      {form.error && <div role="alert" className="rounded-lg border border-destructive p-4 text-sm"><p>{form.error}</p><Button variant="outline" className="mt-3 min-h-11" disabled={form.pending || form.loading} onClick={() => void form.reload()}>Recargar conectores</Button></div>}
      {selected && selected !== 'INFILE' && <section className="space-y-3 rounded-lg border bg-muted p-4"><p>Hay otro conector activo para esta empresa. Desactívalo antes de elegir Infile.</p><Button variant="outline" className="min-h-11" disabled={disabled} onClick={() => void choose(null)}>Desactivar conector actual</Button></section>}
      <div className="grid max-w-xl gap-3">{form.data?.providers.map(provider => <section key={provider.id} aria-labelledby={`connector-${provider.id}-title`} className={`flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:gap-4 ${selected === provider.id ? 'border-primary' : ''}`}>
        <div className="flex h-14 w-28 shrink-0 items-center justify-center rounded-lg border bg-white px-2"><img src="/connectors/infile.svg" width="100" height="50" alt="Infile"/></div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 id={`connector-${provider.id}-title`} className="font-semibold">Infile</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{selected === provider.id ? 'Seleccionado' : 'Sin activar'}</span></div><p className="text-sm text-muted-foreground">Facturación electrónica · Guatemala</p><p className="mt-1 text-xs text-muted-foreground">Emisión FEL deshabilitada. Seleccionar Infile no realiza envíos.</p></div>
        <div className="flex w-full shrink-0 gap-2 sm:w-auto">{selected === provider.id ? <><Button className="min-h-11 flex-1 bg-brand-orange text-white hover:bg-brand-orange-strong sm:flex-initial" disabled={form.loading || form.pending || !!form.error} onClick={() => setConfiguring(true)}>Configurar</Button><Button type="button" variant="outline" className="min-h-11 flex-1 sm:flex-initial" disabled={disabled} onClick={() => choose(null)}>Desactivar</Button></> : <Button className="min-h-11 w-full bg-brand-orange text-white hover:bg-brand-orange-strong sm:w-auto" disabled={disabled || !!selected} onClick={() => choose('INFILE')}>Activar Infile</Button>}</div>
      </section>)}</div>
      {form.pending && <p role="status" className="text-sm text-muted-foreground">Guardando selección…</p>}
      {confirmation.dialog}
    </div>
  </TemplateSettingsLayout>
}
