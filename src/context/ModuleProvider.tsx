import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/services/api'
import { useTenant } from './useTenant'
import { ModuleContext, type CompanyModule } from './ModuleContext'

type ModulesResponse = { modules: CompanyModule[] }

export const ModuleProvider = ({ children }: { children: React.ReactNode }) => {
  const { company } = useTenant()
  const query = useQuery({
    queryKey: ['company-modules', company?.id],
    queryFn: () => apiFetch<ModulesResponse>('/modules'),
    enabled: Boolean(company?.id),
    staleTime: 30_000,
    retry: 1,
  })

  const modules = useMemo(() => query.data?.modules ?? [], [query.data])
  const enabledModuleCodes = useMemo<ReadonlySet<string> | null>(() => {
    // Fallar abierto solo durante una actualización descoordinada del frontend:
    // el backend sigue siendo la autoridad y bloquea toda operación desactivada.
    if (!query.data) return null
    return new Set(modules.filter((module) => module.effectiveEnabled).map((module) => module.code))
  }, [modules, query.data])

  const isEnabled = useCallback(
    (code: string) => enabledModuleCodes === null || enabledModuleCodes.has(code),
    [enabledModuleCodes]
  )

  const value = useMemo(
    () => ({
      modules,
      enabledModuleCodes,
      isEnabled,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: query.refetch,
    }),
    [enabledModuleCodes, isEnabled, modules, query.isError, query.isLoading, query.refetch]
  )

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>
}

export default ModuleProvider
