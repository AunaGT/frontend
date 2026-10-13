import { createContext } from 'react'

export type CompanyModuleStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'DISABLED'

export type CompanyModule = {
  code: string
  name: string
  dependencies: string[]
  status: CompanyModuleStatus
  effectiveEnabled: boolean
  blockedBy: string[]
  trialEndsAt: string | null
  config: Record<string, unknown>
  persisted: boolean
  protected: boolean
}

export type ModuleContextType = {
  modules: CompanyModule[]
  enabledModuleCodes: ReadonlySet<string> | null
  isEnabled: (code: string) => boolean
  isLoading: boolean
  isError: boolean
  refetch: () => Promise<unknown>
}

export const ModuleContext = createContext<ModuleContextType | undefined>(undefined)
