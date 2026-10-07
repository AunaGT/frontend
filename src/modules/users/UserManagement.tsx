import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, MoreHorizontal, Shield, FileUp, ArrowUpDown, Search, Crown, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useTenant } from '@/context/useTenant'
import { getUsers, getRoles } from '@/services/userService'
import { UsersPage, UserAvatar, AccessBadge, PageFooter, Feedback, dateLabel } from './UsersUI'

export default function UserManagement() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthPermissions()
  const { company, companies, setCompany } = useTenant()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('name')
  const [direction, setDirection] = useState('asc')
  const pageSize = 8
  const activeFilterCount = Number(Boolean(search.trim())) + Number(Boolean(role)) + Number(Boolean(status))
  const query = useQuery({ queryKey: ['users', company?.id, { page, search, role, status, sort, direction }], queryFn: () => getUsers({ page, pageSize, search, role_id: role ? Number(role) : undefined, status, sort, direction }), enabled: hasPermission('users.view') })
  const roles = useQuery({ queryKey: ['users-role-options', company?.id], queryFn: getRoles, enabled: hasPermission('users.view') })
  function order(key: string) { setSort(key); setDirection(sort === key && direction === 'asc' ? 'desc' : 'asc'); setPage(1) }
  const pageActions = <>
    {(hasPermission('roles.view') || hasPermission('roles.manage') || hasPermission('users.import')) && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><MoreHorizontal size={16} className="mr-2"/>Más opciones</Button></DropdownMenuTrigger><DropdownMenuContent className="users-overlay" align="end">{(hasPermission('roles.view') || hasPermission('roles.manage')) && <DropdownMenuItem onSelect={() => navigate('/usuarios/roles-permisos')}><Shield size={16} className="mr-2"/>Roles y permisos</DropdownMenuItem>}{hasPermission('users.import') && <DropdownMenuItem onSelect={() => navigate('/usuarios/importar')}><FileUp size={16} className="mr-2"/>Importar usuarios</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>}
    {hasPermission('users.create') && <Button asChild><Link to="/usuarios/nuevo"><Plus size={18} className="mr-2"/>Nuevo usuario</Link></Button>}
  </>
  return <UsersPage compact title="Usuarios y roles" back="/" backLabel="Administración" description="Gestiona los usuarios, sus roles y el acceso a las empresas del grupo." actions={!hasPermission('users.view') ? pageActions : undefined}>
    {!hasPermission('users.view') ? <Feedback error={new Error('No tienes permiso para consultar usuarios')}/> : <>
<CompactFilterPanel actions={pageActions} title="Filtros de usuarios" summary="Nombre, correo, rol, empresa y estado" activeCount={activeFilterCount} onClear={() => { setSearch(''); setRole(''); setStatus(''); setPage(1) }} contentClassName="users-filters" search={<label className="auna-control-group users-search"><Search size={19} aria-hidden="true"/><input className="auna-control" aria-label="Buscar usuarios" placeholder="Buscar por nombre, correo o rol…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}/></label>} appliedFilters={[...(search.trim() ? [{label: `Búsqueda: ${search}`, onRemove: () => {setSearch('');setPage(1)}}] : []), ...(role ? [{label: `Rol: ${roles.data?.find(r => String(r.id) === String(role))?.name || role}`,onRemove: () => {setRole('');setPage(1)}}] : []), ...(status ? [{label: `Estado: ${({ACTIVE:'Activo',INACTIVE:'Inactivo',BLOCKED:'Bloqueado'} as Record<string,string>)[status] || status}`,onRemove: () => {setStatus('');setPage(1)}}] : [])]}>

      <select className="auna-control auna-control-select" aria-label="Rol" value={role} onChange={e => { setRole(e.target.value); setPage(1) }}><option value="">Todos los roles</option>{roles.data?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <select className="auna-control auna-control-select" aria-label="Empresa" value={company?.id || ''} onChange={e => setCompany(e.target.value)}><option value="" disabled>Selecciona empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className="auna-control auna-control-select" aria-label="Estado" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">Todos los estados</option><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option><option value="BLOCKED">Bloqueado</option></select>
    </CompactFilterPanel>
    <><section className="users-panel">
      {query.isFetching && query.data && <LoadingIndicator message="Actualizando usuarios…" className="px-4 py-2" />}
      {!query.isLoading && <Feedback error={query.error} empty={!query.data?.items.length} retry={() => void query.refetch()}/>}
      {!query.error && <div className="overflow-x-auto"><table className="users-table"><thead><tr>
        <th aria-sort={sort === 'name' ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className="flex items-center gap-2" onClick={() => order('name')}>Usuario <ArrowUpDown size={12}/></button></th>
        <th aria-sort={sort === 'email' ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className="flex items-center gap-2" onClick={() => order('email')}>Correo <ArrowUpDown size={12}/></button></th><th>Rol</th><th>Empresa</th><th>Estado</th><th>Último acceso</th><th>Acciones</th>
      </tr></thead><tbody>{query.isLoading ? <TableLoadingRows columns={7} message="Cargando usuarios…" /> : query.data?.items.map(u => <tr key={u.id}>
        <td><Link className="flex items-center gap-3 font-semibold whitespace-nowrap" to={`/usuarios/${u.id}`}><UserAvatar name={u.name} photo={u.photo_url}/>{u.name}</Link></td>
        <td className="users-email">{u.email}</td><td><span className="users-role-chip" data-kind={u.role?.name?.toLowerCase() === 'admin' ? 'admin' : /gerente|manager|supervisor/i.test(u.role?.name || '') ? 'manager' : 'default'}>{u.role?.name?.toLowerCase() === 'admin' ? <Crown size={15}/> : /gerente|manager|supervisor/i.test(u.role?.name || '') ? <Users size={15}/> : <Shield size={15}/>} {u.role?.name || 'Sin rol'}</span></td>
        <td>{u.companies?.length ? u.companies.map(c => <span key={c.id} className="users-company-chip">{c.name}</span>) : <span className="users-muted">No asignada</span>}</td><td><AccessBadge status={u.access_status}/></td><td className="users-muted whitespace-nowrap text-xs">{dateLabel(u.last_login_at)}</td>
        <td><div className="flex gap-2">{hasPermission('users.edit') && <Button variant="outline" size="icon" aria-label={`Editar ${u.name}`} onClick={() => navigate(`/usuarios/${u.id}?edit=1`)}><Pencil size={15}/></Button>}<DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="outline" aria-label={`Acciones de ${u.name}`}><MoreHorizontal size={18}/></Button></DropdownMenuTrigger><DropdownMenuContent className="users-overlay" align="end"><DropdownMenuItem onSelect={() => navigate(`/usuarios/${u.id}`)}>Ver detalle</DropdownMenuItem>{hasPermission('users.edit') && <DropdownMenuItem onSelect={() => navigate(`/usuarios/${u.id}?tab=security`)}>Administrar acceso</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div></td>
      </tr>)}</tbody></table></div>}

    </section>
<div className="auna-pagination-outside">{query.data && !query.error && <PageFooter page={query.data.page} totalPages={query.data.totalPages} total={query.data.totalItems} pageSize={pageSize} onChange={setPage} busy={query.isFetching}/>}</div></></>}
  </UsersPage>
}
