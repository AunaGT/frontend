import { Link } from 'react-router-dom'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useModules } from '@/context/useModules'
import { appointmentsModule } from '@/modules/appointments/manifest'
import { inventoryModule } from '@/modules/inventory/manifest'
import { accountingModule } from '@/modules/accounting/manifest'
import { catalogsModule } from '@/modules/catalogs/manifest'
import { usersModule } from '@/modules/users/manifest'
const links = [
  { module: 'appointments', to: appointmentsModule.paths.settings, label: 'Configuración de Agenda', description: 'Calendarios, profesionales, recursos y disponibilidad.', permissions: ['appointments.configure'] },
  { module: 'inventory', to: inventoryModule.paths.barcodePrint, label: 'Diseño de códigos de barras', description: 'Abre el editor de impresión existente de Inventario.', permissions: ['products.view'] },
  { module: 'inventory', to: inventoryModule.paths.shelfPricePrint, label: 'Diseño de etiquetas de precio', description: 'Formato y diseño de etiquetas para estantes.', permissions: ['products.view'] },
  { module: 'catalogs', to: catalogsModule.paths.list, label: 'Pagos, cajas y condiciones de pago', description: 'En Datos maestros, abre Métodos de pago, Cajas o Términos de pago. Sus editores siguen disponibles allí.', permissions: ['catalogs.view', 'catalogs.manage'] },
  { module: 'accounting', to: accountingModule.paths.list, label: 'Configuración de Contabilidad', description: 'Abre Contabilidad y selecciona su pestaña Configuración para administrar cuentas predeterminadas.', permissions: ['accounting.view'] },
  { module: 'users', to: usersModule.paths.roles, label: 'Roles y permisos', description: 'Administra accesos en su editor actual. Activar un módulo no concede permisos.', permissions: ['roles.view', 'roles.manage'] },
]
export function SettingsRelatedLinks({ confirmLeave, inventoryOnly = false }: { confirmLeave: (to: string) => void; inventoryOnly?: boolean }) {
  const { hasPermission } = useAuthPermissions(), modules = useModules()
  if (modules.isLoading || modules.isError || !modules.enabledModuleCodes) return <p className="text-sm text-muted-foreground">No se pudo confirmar la disponibilidad de los accesos. Revisa la carga de módulos.</p>
  const visible = links.filter(link => (!inventoryOnly || link.module === 'inventory') && modules.enabledModuleCodes!.has(link.module) && hasPermission(...link.permissions))
  return <div className="config-related-links">{visible.map(link => <Link key={link.to} to={link.to} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); confirmLeave(link.to)
  }}><strong>{link.label}</strong><span>{link.description}</span></Link>)}{!visible.length && <p className="text-sm text-muted-foreground">No hay accesos relacionados disponibles con tus permisos y módulos activos.</p>}</div>
}
