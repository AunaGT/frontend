import { usePageTrail } from '@/components/layout/PageNavigation'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { getPermissions, getRoleWithPermissions } from '@/services/userService'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useTenant } from '@/context/useTenant'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UsersPage, Panel, Feedback } from './UsersUI'
import { PermissionMatrix } from './PermissionMatrix'
import { useRoleDraft } from './useRoleDraft'
import { RoleDeleteDialog, invalidateRoleQueries } from './RoleDeleteDialog'

export default function RoleEditor({ id }: { id?: number }) {
  const { company } = useTenant(), { hasPermission, user, permissionsReady } = useAuthPermissions(), { toast } = useToast()
  const context = { companyId: company?.id || '', userId: user?.id || '' }
  const navigate = useNavigate(), cache = useQueryClient()
  const available = !!company && !!user && permissionsReady && hasPermission('roles.view', 'roles.manage', 'users.view', 'users.create', 'users.edit')
  const validId = id === undefined || (Number.isSafeInteger(id) && id > 0)
  const role = useQuery({ queryKey: ['role-with-permissions', context.companyId, context.userId, id], queryFn: () => getRoleWithPermissions(id!), enabled: available && id !== undefined && validId })
  const catalog = useQuery({ queryKey: ['permissions', context.companyId, context.userId], queryFn: getPermissions, enabled: available && hasPermission('roles.view', 'roles.manage') })
  const protectedRole = !!role.data?.protected, canonical = id === undefined || role.data?.id === id
  const canManage = available && hasPermission('roles.manage') && canonical && validId
  const readOnly = !canManage || protectedRole
  const scope = JSON.stringify([context.companyId, context.userId, id, canManage]), live = useRef(scope)
  live.current = scope
  useEffect(() => () => { live.current = '' }, [])
  const draft = useRoleDraft({ context, id, role: role.data, canManage: !readOnly })
  const [deleting, setDeleting] = useState(false), deleteKey = `${context.companyId}:${context.userId}:${id}`
  useEffect(() => { setDeleting(false) }, [deleteKey, canManage])
  useEffect(() => { if (available && id && role.data && role.data.id !== id) navigate(`/usuarios/roles-permisos/${role.data.id}`, { replace: true }) }, [available, id, role.data, navigate])
  usePageTrail(id ? [{ label: 'Roles y permisos', to: '/usuarios/roles-permisos', permissions: ['roles.view', 'roles.manage'] }, { label: 'Detalle' }, ...(draft.dirty && !readOnly ? [{ label: 'Editar' }] : [])] : null)
  useEffect(() => {
    if (!draft.dirty || readOnly) return
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [draft.dirty, readOnly])
  async function save() {
    const saved = await draft.save()
    if (!saved || live.current !== scope) return
    await invalidateRoleQueries(cache, context)
    if (live.current !== scope) return
    if (!id) navigate(`/usuarios/roles-permisos/${saved.id}`, { replace: true })
    toast({ title: 'Rol guardado' })
  }
  return <UsersPage compact title={id ? 'Detalle de permisos' : 'Crear rol'} description="Gestiona las acciones disponibles para este rol." back="/usuarios/roles-permisos" backLabel="Roles y permisos">
    {!validId ? <p role="alert">El enlace de rol no es válido.</p> : <>
      <Feedback loading={catalog.isLoading || (!!id && role.isLoading)} error={catalog.error || role.error} retry={() => { void catalog.refetch(); if (id) void role.refetch() }} />
      {!catalog.isLoading && !catalog.error && available && (!id || (role.data && canonical)) && <>
        <Panel><div className="grid gap-4 md:grid-cols-[1fr_1.5fr_auto] items-end">
          <label className="space-y-2 text-sm">Rol<Input value={draft.name} onChange={e => draft.setName(e.target.value)} maxLength={50} disabled={readOnly || draft.busy} /></label>
          <label className="space-y-2 text-sm">Descripción<Input value={draft.description} onChange={e => draft.setDescription(e.target.value)} maxLength={500} disabled={readOnly || draft.busy} /></label>
          <span className="users-state" data-status="ACTIVE">{protectedRole ? 'Sistema protegido' : 'Personalizado'}</span>
        </div>{protectedRole ? <p className="users-muted text-sm mt-4">El administrador del sistema está protegido. Su acceso administrativo no se modifica ni se elimina.</p> : readOnly ? <p className="users-muted text-sm mt-4">Acceso de consulta. Necesitas permiso para gestionar roles.</p> : <p className="users-muted text-sm mt-4">{draft.dirty ? 'Cambios pendientes: revisa y guarda para aplicarlos.' : 'Los cambios se guardan únicamente al confirmar.'}</p>}</Panel>
        {(draft.error || draft.conflict) && <p role="alert" className="text-sm text-destructive">{draft.error || 'El rol cambió en otra sesión.'}{draft.conflict && ' Recarga los datos y presiona Restablecer para revisar la versión actual.'}</p>}
        <section className="users-panel"><header className="users-panel-heading flex-wrap gap-3"><h2>Matriz de permisos por módulo</h2>{!readOnly && <div className="flex flex-wrap gap-2">
          {id && <Button variant="outline" aria-label="Eliminar rol" disabled={draft.busy} onClick={() => setDeleting(true)}><Trash2 size={16} aria-hidden="true" /></Button>}
          <Button variant="outline" disabled={draft.busy || (!draft.dirty && !draft.conflict)} onClick={() => { if (draft.conflict) void role.refetch().then(() => draft.reset()); else draft.reset() }}>Restablecer</Button>
          <Button disabled={!draft.name.trim() || draft.busy || draft.conflict || (!!id && !draft.dirty)} onClick={save}>{draft.busy ? 'Guardando…' : id ? 'Guardar cambios' : 'Crear rol'}</Button>
        </div>}</header><PermissionMatrix catalog={catalog.data || []} selected={protectedRole ? (catalog.data || []).map(p => p.code) : draft.selected} onChange={draft.setSelected} disabled={readOnly || draft.busy} /></section>
        <p className="users-muted text-sm">Los permisos incluyen sus dependencias. La contratación de módulos se administra por separado.</p>
        {deleting && !readOnly && role.data && <RoleDeleteDialog key={deleteKey} role={role.data} context={context} onClose={() => setDeleting(false)} onDeleted={() => navigate('/usuarios/roles-permisos')} />}
      </>}
    </>}
  </UsersPage>
}
