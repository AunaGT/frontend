import { useTenant } from '@/context/useTenant'
import { useModules } from '@/context/useModules'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
export function useAgendaContext() {
  const tenant = useTenant(), modules = useModules(), permissions = useAuthPermissions(), settings = useSystemSettings()
  const scope = { companyId: tenant.company?.id || '', branchId: tenant.isConsolidated ? 'all' : tenant.branch?.id || '' }
  const ready = !!scope.companyId && !!scope.branchId && !modules.isLoading && !modules.isError && modules.isEnabled('appointments') && permissions.permissionsReady && permissions.hasPermission('appointments.view')
  const canUseCatalog = ready && modules.isEnabled('inventory') && settings.inventoryServicesEnabled && permissions.hasPermission('products.view')
  const canUseContacts = ready && modules.isEnabled('contacts') && permissions.hasPermission('contacts.clients.view')
  return { ...tenant, ...permissions, scope, ready, canUseCatalog, canUseContacts, timezone: settings.timezone, writable: ready && scope.branchId !== 'all' }
}
