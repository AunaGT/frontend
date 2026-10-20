import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
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
  { module: 'inventory', requiredModule: 'catalogs', catalog: true, to: catalogsModule.paths.categories, label: 'Categorías', description: 'Clasifica bienes y servicios desde Inventario.', permissions: ['catalogs.view', 'catalogs.manage'] },
  { module: 'catalogs', catalog: true, to: catalogsModule.paths.cashRegisters, label: 'Cajas', description: 'Cajas registradoras y sus asignaciones por sucursal.', permissions: ['catalogs.view', 'catalogs.manage', 'settings.manage'] },
  { module: 'catalogs', catalog: true, to: catalogsModule.paths.paymentMethods, label: 'Métodos de pago', description: 'Opciones de cobro disponibles para ventas y cierres.', permissions: ['catalogs.view', 'catalogs.manage'] },
  { module: 'catalogs', catalog: true, to: catalogsModule.paths.paymentTerms, label: 'Condiciones de pago', description: 'Plazos de pago y condiciones vinculadas a proveedores.', permissions: ['catalogs.view', 'catalogs.manage'] },
  { module: 'accounting', to: accountingModule.paths.list, label: 'Configuración de Contabilidad', description: 'Abre Contabilidad y selecciona su pestaña Configuración para administrar cuentas predeterminadas.', permissions: ['accounting.view'] },
  { module: 'users', to: usersModule.paths.roles, label: 'Roles y permisos', description: 'Administra accesos en su editor actual. Activar un módulo no concede permisos.', permissions: ['roles.view', 'roles.manage'] },
]
export function SettingsRelatedLinks({ confirmLeave, inventoryOnly = false, catalogsOnly = false }: { confirmLeave: (to: string) => void; inventoryOnly?: boolean; catalogsOnly?: boolean }) {
  const { hasPermission } = useAuthPermissions(), modules = useModules()
  if (modules.isLoading || modules.isError || !modules.enabledModuleCodes) return <p className="text-sm text-muted-foreground">No se pudo confirmar la disponibilidad de los accesos. Revisa la carga de módulos.</p>
  const visible = links.filter(link => (!inventoryOnly || link.module === 'inventory') && (!catalogsOnly || link.catalog) && modules.enabledModuleCodes!.has(link.module) && (!link.requiredModule || modules.enabledModuleCodes!.has(link.requiredModule)) && hasPermission(...link.permissions))
  return <div className="config-related-links">{visible.map(link => <Link key={link.to} to={link.to} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); confirmLeave(link.to)
  }}><strong>{link.label}</strong><span>{link.description}</span></Link>)}{!visible.length && <CollectionEmptyState compact title="Tus accesos aparecerán aquí" description="No hay accesos relacionados disponibles con tus permisos y módulos activos." />}</div>
}
