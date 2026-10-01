import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPermissions, getRoleWithPermissions, createRole, updateRole } from '@/services/userService'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useTenant } from '@/context/useTenant'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UsersPage, Panel, Feedback } from './UsersUI'
import { PermissionMatrix } from './PermissionMatrix'
import { roleDraft } from './roleEditorModel.mjs'

export default function RoleEditor({ id }: { id?: number }) {
  const { company } = useTenant(), { hasPermission } = useAuthPermissions(), { toast } = useToast()
  const navigate = useNavigate(), cache = useQueryClient()
  const role = useQuery({ queryKey: ['role-with-permissions', company?.id, id], queryFn: () => getRoleWithPermissions(id!), enabled: !!id })
  const catalog = useQuery({ queryKey: ['permissions', company?.id], queryFn: getPermissions })
  const [name, setName] = useState(''), [description, setDescription] = useState(''), [selected, setSelected] = useState<string[]>([]), [saving, setSaving] = useState(false)
  const canManage = hasPermission('roles.manage'), fromTemplate = !!role.data?.protected
  const readOnly = !canManage
  const initial = roleDraft(role.data)
  const dirty = name !== initial.name || description !== initial.description || [...selected].sort().join('|') !== [...initial.selected].sort().join('|')
  function reset() { setName(initial.name); setDescription(initial.description); setSelected(initial.selected) }
  useEffect(() => { reset() }, [role.data])
  useEffect(() => { if (!dirty || readOnly) return; const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard) }, [dirty, readOnly])
  async function save() {
    setSaving(true)
    try {
      const payload = { name: name.trim(), description, permissions: selected }
      const saved = id && !fromTemplate ? await updateRole(id, payload) : await createRole(payload)
      await cache.invalidateQueries({ queryKey: ['roles-with-permissions'] })
      if (id && !fromTemplate) await role.refetch(); else navigate(`/usuarios/roles-permisos/${saved.id}`, { replace: true })
      toast({ title: fromTemplate ? 'Versión editable creada' : 'Rol guardado' })
    } catch (e) { toast({ title: 'No se pudo guardar', description: (e as Error).message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }
  return <UsersPage title={id ? 'Detalle de permisos' : 'Crear rol'} description="Gestiona los permisos del rol seleccionando las acciones por módulo." back="/usuarios/roles-permisos" backLabel="Roles y permisos">
    <Feedback loading={catalog.isLoading || (!!id && role.isLoading)} error={catalog.error || role.error} retry={() => { void catalog.refetch(); if (id) void role.refetch() }}/>
    {!catalog.isLoading && !catalog.error && (!id || role.data) && <>
      <Panel><div className="grid gap-5 md:grid-cols-[1fr_1.5fr_.6fr] items-end"><label className="space-y-2 text-sm">Rol<Input value={name} onChange={e => setName(e.target.value)} maxLength={50} disabled={readOnly || saving}/></label><label className="space-y-2 text-sm">Descripción<Input value={description} onChange={e => setDescription(e.target.value)} maxLength={500} disabled={readOnly || saving}/></label><div className="space-y-2 text-sm"><span className="block">Tipo</span><span className="users-state" data-status="ACTIVE">{fromTemplate ? 'Plantilla del sistema' : 'Personalizado'}</span></div></div>{fromTemplate && canManage && <p className="users-muted text-sm mt-4">Estás personalizando una plantilla. Al guardar se creará un rol editable únicamente para {company?.name || 'la empresa activa'}.</p>}{readOnly && <p className="users-muted text-sm mt-4">Acceso de consulta. Necesitas el permiso para gestionar roles.</p>}</Panel>
      <section className="users-panel"><header className="users-panel-heading"><h2>Matriz de permisos por módulo</h2><div className="flex gap-2"><Button variant="outline" disabled={!dirty || readOnly || saving} onClick={reset}>Restablecer</Button><Button disabled={!name.trim() || readOnly || saving || (!dirty && !fromTemplate)} onClick={save}>{saving ? 'Guardando…' : fromTemplate ? 'Crear versión editable' : 'Guardar cambios'}</Button></div></header><PermissionMatrix catalog={catalog.data || []} selected={role.data?.name.toLowerCase() === 'admin' && !fromTemplate ? (catalog.data || []).map(p => p.code) : selected} onChange={setSelected} disabled={readOnly || saving}/></section>
      <p className="users-muted text-sm">Los permisos incluyen sus dependencias. Al retirar un permiso se retiran también los que lo necesitan. La contratación de módulos se administra por separado.</p>
    </>}
  </UsersPage>
}
