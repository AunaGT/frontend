import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Shield, Users, Layers, Pencil, Copy, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getRolesWithPermissions, getPermissions, createRole, deleteRole, type Role } from '@/services/userService'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useTenant } from '@/context/useTenant'
import { useToast } from '@/hooks/use-toast'
import { formatPermissionGroupLabel } from '@/lib/permissionGroups'
import { UsersPage, Panel, PageFooter, Feedback } from './UsersUI'
export default function RolesPermissionsManagement() {
  const navigate = useNavigate()
  const { company } = useTenant(), { hasPermission } = useAuthPermissions(), { toast } = useToast(), cache = useQueryClient()
  const canManage = hasPermission('roles.manage')
  const [page,setPage] = useState(1), [search,setSearch] = useState(''), [kind,setKind] = useState(''), [module,setModule] = useState('')
  const [action,setAction] = useState<{role: Role; type: 'copy' | 'delete'} | null>(null), [name,setName] = useState(''), [busy,setBusy] = useState(false)
  const query = useQuery({ queryKey: ['roles-with-permissions', company?.id, page, search, kind, module], queryFn: () => getRolesWithPermissions({ page, pageSize: 12, search, kind, module }) })
  const catalog = useQuery({ queryKey: ['permissions', company?.id], queryFn: getPermissions })
  const modules = [...new Set((catalog.data || []).map(p => p.code.split('.')[0]))]
  async function confirm() {
    if (!action) return
    setBusy(true)
    try {
      if (action.type === 'delete') await deleteRole(action.role.id)
      else {
        const copy = await createRole({ name, description: action.role.description || '', permissions: action.role.permissions?.map(p => p.code) || [] })
        navigate(`/usuarios/roles-permisos/${copy.id}`)
      }
      await cache.invalidateQueries({ queryKey: ['roles-with-permissions'] })
      setAction(null); toast({ title: action.type === 'delete' ? 'Rol eliminado' : 'Rol duplicado' })
    } catch(e) { toast({ title: 'No se pudo completar', description: (e as Error).message, variant: 'destructive' }) }
    finally { setBusy(false) }
  }
  return <UsersPage title="Roles y permisos" description="Administra los roles y el acceso a los módulos de tu empresa." actions={canManage && <Button asChild><Link to="/usuarios/roles-permisos/nuevo"><Plus className="mr-2" size={16}/>Crear rol</Link></Button>}>
    <div className="grid gap-4 md:grid-cols-3">{[[Shield,'Roles totales',query.data?.stats?.totalRoles],[Users,'Usuarios asignados',query.data?.stats?.assignedUsers],[Layers,'Módulos del sistema',query.data?.stats?.modules]].map(([Icon,label,value]) => { const Symbol = Icon as typeof Shield; return <Panel key={String(label)}><div className="flex items-center gap-5"><Symbol className="users-muted" size={32}/><div><strong className="text-2xl">{typeof value === 'number' ? value : '—'}</strong><p className="users-muted text-sm">{String(label)}</p></div></div></Panel> })}</div>
    <div className="users-filters users-filters--roles"><label className="users-search"><Search size={19} aria-hidden="true"/><input aria-label="Buscar roles" placeholder="Buscar por nombre de rol…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}/></label><select aria-label="Tipo de rol" value={kind} onChange={e => { setKind(e.target.value); setPage(1) }}><option value="">Todos los tipos</option><option value="protected">De sistema</option><option value="custom">Personalizados</option></select><select aria-label="Módulo" value={module} onChange={e => { setModule(e.target.value); setPage(1) }}><option value="">Todos los módulos</option>{modules.map(m => <option key={m} value={m}>{formatPermissionGroupLabel(m)}</option>)}</select><Button variant="outline" onClick={() => { setSearch(''); setKind(''); setModule(''); setPage(1) }}>Limpiar</Button></div>
    <section className="users-panel"><Feedback loading={query.isLoading} error={query.error} empty={!query.data?.items.length} retry={() => void query.refetch()}/>{!!query.data?.items.length && !query.error && <div className="overflow-x-auto"><table className="users-table"><thead><tr><th>Rol</th><th>Usuarios asignados</th><th>Permisos por módulo</th><th>Uso</th><th>Acciones</th></tr></thead><tbody>{query.data.items.map(r => {
      const groups = [...new Set((r.permissions || []).map(p => p.code.split('.')[0]))]
      return <tr key={r.id}><td><Link className="font-semibold" to={`/usuarios/roles-permisos/${r.id}`}>{r.name}</Link><p className="users-muted text-xs mt-1">{r.description || (r.protected ? 'Rol de sistema protegido' : 'Sin descripción')}</p></td><td>{r.usersCount ?? 0} usuarios</td><td><div className="flex gap-1 flex-wrap">{groups.slice(0,5).map(g => <span key={g} className="users-module-chip">{formatPermissionGroupLabel(g)}</span>)}{groups.length > 5 && <span className="users-chip" title={groups.slice(5).map(formatPermissionGroupLabel).join(', ')}>+{groups.length-5}</span>}{!groups.length && <span className="users-muted">Sin permisos</span>}</div></td><td><span className="users-state" data-status={r.usersCount ? 'ACTIVE' : 'INACTIVE'}>{r.usersCount ? 'En uso' : 'Sin asignar'}</span></td><td><div className="flex gap-1">{r.protected && canManage ? <Button size="icon" variant="outline" aria-label={`Crear copia editable de ${r.name}`} onClick={() => { setName(`${r.name} copia`.slice(0,50)); setAction({role:r,type:'copy'}) }}><Copy size={15}/></Button> : <Button size="icon" variant="outline" asChild><Link aria-label={canManage ? `Editar ${r.name}` : `Ver permisos de ${r.name}`} to={`/usuarios/roles-permisos/${r.id}`}><Pencil size={15}/></Link></Button>}{canManage && !r.protected && <><Button size="icon" variant="outline" aria-label={`Duplicar ${r.name}`} onClick={() => { setName(`${r.name} copia`.slice(0,50)); setAction({role:r,type:'copy'}) }}><Copy size={15}/></Button><Button size="icon" variant="outline" aria-label={`Eliminar ${r.name}`} onClick={() => setAction({role:r,type:'delete'})}><Trash2 size={15}/></Button></>}</div></td></tr>
    })}</tbody></table></div>}{query.data && <PageFooter page={query.data.page} totalPages={query.data.totalPages} total={query.data.totalItems} pageSize={12} onChange={setPage} busy={query.isFetching}/>}</section>
    <Dialog open={!!action} onOpenChange={open => { if (!open && !busy) setAction(null) }}><DialogContent className="users-overlay"><DialogHeader><DialogTitle>{action?.type === 'copy' ? 'Duplicar rol' : 'Eliminar rol'}</DialogTitle><DialogDescription>{action?.type === 'copy' ? 'Se creará un rol personalizado para la empresa activa con estos permisos.' : 'Solo se puede eliminar un rol sin usuarios asignados. No se reasignarán usuarios automáticamente.'}</DialogDescription></DialogHeader>{action?.type === 'copy' && <label>Nombre<Input value={name} onChange={e => setName(e.target.value)} maxLength={50}/></label>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Cancelar</Button><Button disabled={busy || (action?.type === 'copy' && !name.trim())} onClick={confirm}>{busy ? 'Procesando…' : 'Confirmar'}</Button></div></DialogContent></Dialog>
  </UsersPage>
}
