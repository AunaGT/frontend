import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAgendaContext } from './useAgendaContext'
import { appointmentQueryKey, getAgenda } from './api'
import { defaultProfile } from './components/ServiceScheduleFields'
import type { ProfileInput, Directory } from './types'
export const emptyDirectory: Directory = { branches: [], providers: [], resources: [], employeeCandidates: [] }
export function useServiceScheduleDraft(isService: boolean, productId?: string) {
  const ctx = useAgendaContext(), allowed = isService && ctx.writable && ctx.canUseCatalog !== false && ctx.hasPermission('appointments.configure')
  const key = `${ctx.scope.companyId}:${ctx.scope.branchId}:${productId || 'new'}`
  const profile = useQuery({ queryKey: appointmentQueryKey(ctx.scope, 'profile', { productId }), queryFn: ({ signal }) => getAgenda<{ profile: ProfileInput; version: number } | null>(`/services/${productId}/profile`, ctx.scope, signal), enabled: allowed && !!productId })
  const directory = useQuery({ queryKey: appointmentQueryKey(ctx.scope, 'directory'), queryFn: ({ signal }) => getAgenda<Directory>('/directory', ctx.scope, signal), enabled: allowed })
  const [draft, setDraft] = useState<{ key: string; value: ProfileInput } | null>(null)
  const value = draft?.key === key ? draft.value : profile.data?.profile || { ...defaultProfile, branchIds: ctx.scope.branchId !== 'all' && ctx.scope.branchId ? [ctx.scope.branchId] : [] }
  const change = (next: ProfileInput) => setDraft({ key, value: next })
  const reset = () => setDraft(null)
  return { allowed, value, change, reset, directory: directory.data || emptyDirectory, dirty: draft?.key === key,
    ready: !allowed || directory.isSuccess && (!productId || profile.isSuccess), error: profile.error || directory.error,
    payload: allowed && draft?.key === key ? { schedule_profile: draft.value } : {}, reload: async () => { if (productId) await profile.refetch(); reset() } }
}
