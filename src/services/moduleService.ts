import { apiFetch } from './api'
import type { CompanyModule, CompanyModuleStatus } from '@/context/ModuleContext'

export type UpdateCompanyModuleInput = {
  status?: CompanyModuleStatus
  trialEndsAt?: string | null
  config?: Record<string, unknown>
}

export const updateCompanyModule = (code: string, input: UpdateCompanyModuleInput) =>
  apiFetch<{ modules: CompanyModule[] }>(`/modules/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
