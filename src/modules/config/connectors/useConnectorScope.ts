import { useEffect, useState } from 'react'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { authSessionIdentity, authSessionMatches } from '@/services/authSession'
import type { ConnectorScope } from './types'
export const FISCAL_READ_PERMISSIONS = ['fiscal.view', 'fiscal.manage', 'fiscal.test', 'fiscal.activate', 'fiscal.retry', 'fiscal.cancel', 'fiscal.download']
export function useConnectorScope() {
  const tenant = useTenant(), auth = useAuthPermissions(), [, refresh] = useState(0)
  useEffect(() => { const changed = () => refresh(n => n + 1); window.addEventListener('storage', changed); window.addEventListener('auth:unauthorized', changed); return () => { window.removeEventListener('storage', changed); window.removeEventListener('auth:unauthorized', changed) } }, [])
  const scope: ConnectorScope | null = tenant.company?.id && auth.user?.id && auth.permissionsReady && authSessionMatches(auth.user.id) ? { companyId: tenant.company.id, branchId: tenant.branch?.id || (tenant.isConsolidated ? 'all' : undefined), userId: auth.user.id, sessionId: authSessionIdentity() } : null
  return { scope, canRead: auth.hasPermission(...FISCAL_READ_PERMISSIONS), canManage: auth.hasPermission('fiscal.manage'), canTest: auth.hasPermission('fiscal.test'), companyName: tenant.company?.name || 'Empresa activa', registerGuard: tenant.registerTenantExitGuard }
}
