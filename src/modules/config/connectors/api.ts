import { apiFetch } from '@/services/api'
import { assertTemplateScope } from '../documentTemplates/api'
import type { ConnectorScope, Environment, Connection, Command, LocalReview, HistoryEvent } from './types'
import type { FiscalProfile, ProfileDraft, CatalogKind, CatalogPage } from './types'
import type { ProviderCatalog } from './types'
async function providerRequest(scope: ConnectorScope, suffix = '', options: RequestInit = {}) {
  assertTemplateScope(scope, options.signal || undefined)
  const result = await apiFetch<ProviderCatalog>(`/settings/connectors${suffix}`, { ...options, cache: 'no-store', headers: { 'X-Company-Id': scope.companyId, ...(scope.branchId ? { 'X-Branch-Id': scope.branchId } : {}) } })
  assertTemplateScope(scope, options.signal || undefined)
  return result
}
export const readProviderCatalog = (scope: ConnectorScope, signal?: AbortSignal) => providerRequest(scope, '', { signal })
export const selectProvider = (scope: ConnectorScope, command: { provider: 'INFILE' | null; expectedRevision: number }, signal?: AbortSignal) => providerRequest(scope, '/selection', { method: 'PUT', body: JSON.stringify(command), signal })
async function request<T>(scope: ConnectorScope, environment: Environment, suffix = '', options: RequestInit = {}): Promise<T> {
  assertTemplateScope(scope, options.signal || undefined)
  if (!['TEST', 'PRODUCTION'].includes(environment)) throw new Error('Selecciona un entorno válido')
  const result = await apiFetch<T>(`/settings/connectors/infile/${environment}${suffix}`, { ...options, cache: 'no-store', headers: { 'X-Company-Id': scope.companyId, ...(scope.branchId ? { 'X-Branch-Id': scope.branchId } : {}) } })
  assertTemplateScope(scope, options.signal || undefined)
  return result
}
export const readConnection = (scope: ConnectorScope, environment: Environment, signal?: AbortSignal) => request<Connection>(scope, environment, '', { signal })
export const saveConnection = (scope: ConnectorScope, environment: Environment, command: Command, signal?: AbortSignal) => request<Connection>(scope, environment, '', { method: 'PUT', body: JSON.stringify(command), signal })
export const validateLocally = (scope: ConnectorScope, environment: Environment, command: Command, signal?: AbortSignal) => request<LocalReview>(scope, environment, '/validate', { method: 'POST', body: JSON.stringify(command), signal })
export const readConnectionHistory = (scope: ConnectorScope, environment: Environment, signal?: AbortSignal) => request<HistoryEvent[]>(scope, environment, '/history', { signal })
export const readFiscalProfile = (scope: ConnectorScope, environment: Environment, signal?: AbortSignal) => request<FiscalProfile>(scope, environment, '/profile', { signal })
export const saveFiscalProfile = (scope: ConnectorScope, environment: Environment, command: { expectedVersion: number; expectedIssuerFingerprint: string; idempotencyKey: string; profile: ProfileDraft }, signal?: AbortSignal) => request<{ revision: number; versionId: string }>(scope, environment, '/profile', { method: 'PUT', body: JSON.stringify(command), signal })
export const fiscalProfileOptions = (scope: ConnectorScope, environment: Environment, kind: CatalogKind, query: string, page: number, signal?: AbortSignal) => request<CatalogPage>(scope, environment, `/profile/options?${new URLSearchParams({ kind, query, page: String(page) })}`, { signal })
