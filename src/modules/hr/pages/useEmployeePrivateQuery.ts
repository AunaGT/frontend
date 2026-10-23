import { useQuery } from '@tanstack/react-query'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'

/** Authorization changes must invalidate both the cache identity and late response visibility. */
export function useEmployeePrivateQuery<T>(key: readonly unknown[], employeeId: string, load: (request: RequestInit) => Promise<T>) {
  const { company, branch, isConsolidated } = useTenant(), { user, permissions, hasPermission } = useAuthPermissions()
  const companyId = company?.id || '', branchId = branch?.id || (isConsolidated ? 'all' : '')
  const enabled = !!employeeId && !!companyId && !!branchId && hasPermission('hr.employees.view')
  const scopeKey = JSON.stringify([employeeId, companyId, branchId, user?.id, [...(permissions || [])].sort(), hasPermission('hr.deductions.view')])
  const query = useQuery({
    queryKey: [...key, scopeKey], enabled,
    queryFn: async ({ signal }) => ({ scopeKey, payload: await load({ signal, headers: { 'X-Company-Id': companyId, 'X-Branch-Id': branchId } }) }),
  })
  const data = enabled && query.data?.scopeKey === scopeKey ? query.data.payload : undefined
  return { ...query, data, isPending: enabled && !data && !query.isError }
}
