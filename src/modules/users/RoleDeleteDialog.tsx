import { useEffect, useRef, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { deleteRole, type Role } from '@/services/userService'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { RoleContext } from './useRoleDraft'
export async function invalidateRoleQueries(cache: QueryClient, context: RoleContext) {
  const prefixes = ['roles', 'roles-with-permissions', 'role-with-permissions', 'permissions', 'users', 'users-role-options', 'user-create-role', 'user-activity']
  await cache.invalidateQueries({ predicate: query => prefixes.includes(String(query.queryKey[0])) && query.queryKey[1] === context.companyId })
}
export function RoleDeleteDialog({ role, context, onClose, onDeleted }: { role: Role; context: RoleContext; onClose: () => void; onDeleted: () => void }) {
  const { hasPermission, permissionsReady } = useAuthPermissions(), cache = useQueryClient()
  const allowed = permissionsReady && hasPermission('roles.manage') && !role.protected
  const key = JSON.stringify([context.companyId, context.userId, role.id, allowed])
  const live = useRef({ key, pending: false, epoch: 0 })
  if (live.current.key !== key) live.current = { key, pending: false, epoch: live.current.epoch + 1 }
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  useEffect(() => () => { live.current.epoch++ }, [])
  async function confirm() {
    if (!allowed || !role.canDelete || live.current.pending || live.current.key !== key) return
    const epoch = live.current.epoch; live.current.pending = true; setBusy(true); setError(null)
    try {
      await deleteRole(role.id, role.revision)
      if (epoch !== live.current.epoch || key !== live.current.key) return
      await invalidateRoleQueries(cache, context)
      if (epoch === live.current.epoch && key === live.current.key) onDeleted()
    } catch (e) {
      if (epoch === live.current.epoch && key === live.current.key) setError((e as Error).message)
    } finally {
      if (epoch === live.current.epoch && key === live.current.key) { live.current.pending = false; setBusy(false) }
    }
  }
  if (!allowed) return null
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}><DialogContent variant="auna" className="users-overlay"><DialogHeader><DialogTitle>Eliminar rol «{role.name}»</DialogTitle><DialogDescription>Solo se elimina sin usuarios ni referencias heredadas. No se reasignará ninguna cuenta automáticamente.</DialogDescription></DialogHeader>
    {!role.canDelete && <p role="status" className="text-sm">{role.deleteBlockedReason || 'El rol no se puede eliminar.'}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button variant="destructive" data-role-delete-confirm disabled={busy || !role.canDelete} onClick={confirm}>{busy ? 'Eliminando…' : 'Eliminar rol'}</Button></div>
  </DialogContent></Dialog>
}
