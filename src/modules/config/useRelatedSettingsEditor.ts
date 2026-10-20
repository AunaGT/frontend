import { useEffect, useRef, useState } from 'react'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { getActiveBranchId, getActiveCompanyId } from '@/services/api'
import type { EditorActivity } from './useSettingsDraft'
export type RelatedEditorProps = { active?: boolean; disabled?: boolean; onActivityChange?: (activity: EditorActivity) => void; canStartOperation?: () => boolean }
type Owner = { key: string; epoch: number; active: boolean; blocked: boolean; pending: boolean; dirty: boolean }
type Ticket = { owner: Owner; epoch: number }
export function useRelatedSettingsEditor(props: RelatedEditorProps, dirty = false, managePermission = 'settings.manage', permissionContext = '') {
  const { company, branch, isConsolidated } = useTenant(), { user, hasPermission, permissionsReady } = useAuthPermissions()
  const companyId = company?.id || '', branchId = branch?.id || (isConsolidated ? 'all' : ''), canManage = hasPermission(managePermission)
  const key = JSON.stringify([companyId, branchId, user?.id, permissionsReady, canManage, managePermission, permissionContext])
  const live = useRef<Owner>({ key, epoch: 0, active: true, blocked: false, pending: false, dirty }), latest = useRef(props), [, paint] = useState(0)
  latest.current = props
  if (live.current.key !== key) live.current = { key, epoch: live.current.epoch + 1, active: true, blocked: false, pending: false, dirty: false }
  const owner = live.current; owner.dirty = dirty
  const scopeMatches = () => companyId === getActiveCompanyId() && branchId === getActiveBranchId()
  const capture = (): Ticket => ({ owner, epoch: owner.epoch })
  const isCurrent = (ticket: Ticket = capture()) => ticket.owner === live.current && ticket.owner.active && !ticket.owner.blocked && ticket.epoch === ticket.owner.epoch && scopeMatches()
  const report = () => latest.current.onActivityChange?.({ dirty: owner.dirty, pending: owner.pending })
  useEffect(() => {
    owner.active = true
    function invalidate(event: Event) {
      if (live.current !== owner) return
      if (event.type === 'tenant:changed' && scopeMatches()) return
      if (event.type === 'storage' && (event as StorageEvent).key != null && !['tenant:companyId', 'tenant:branchId', 'auth:user', 'auth:isAuthenticated'].includes((event as StorageEvent).key!)) return
      owner.blocked = true; owner.epoch++; owner.pending = false; owner.dirty = false; report(); paint(n => n + 1)
    }
    if (typeof window !== 'undefined') for (const name of ['tenant:changed', 'auth:unauthorized', 'storage']) window.addEventListener(name, invalidate)
    return () => {
      owner.active = false; owner.epoch++
      if (typeof window !== 'undefined') for (const name of ['tenant:changed', 'auth:unauthorized', 'storage']) window.removeEventListener(name, invalidate)
    }
  }, [key])
  useEffect(() => { if (isCurrent()) report() }, [key, dirty, owner.pending, props.onActivityChange])
  const disabled = !!props.disabled || props.active === false || !permissionsReady || !user?.id || !companyId || !branchId || !!isConsolidated || !canManage || !isCurrent()
  function begin(): Ticket | null {
    if (disabled || latest.current.disabled || latest.current.active === false || !isCurrent() || owner.pending || latest.current.canStartOperation?.() === false) return null
    owner.pending = true; report(); paint(n => n + 1); return capture()
  }
  function end(ticket: Ticket) {
    if (!isCurrent(ticket)) return
    owner.pending = false; report(); paint(n => n + 1)
  }
  return { key, userId: user?.id, companyId, headers: { 'X-Company-Id': companyId, 'X-Branch-Id': branchId }, disabled, pending: owner.pending, capture, isCurrent, begin, end }
}
