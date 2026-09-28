import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ChevronLeft, ChevronRight, Loader2, MapPin, Package, Pencil, Plus, Search, Warehouse } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useTenant } from '@/context/useTenant'
import { useAuth } from '@/context/useAuth'
import { createBranch, fetchBranchManagers, fetchBranches, updateBranch, type CreateBranchPayload } from '@/services/tenantService'
import { fetchWarehouses } from '@/services/warehouseService'
import type { Branch } from '@/context/AuthContext'
import { CompaniesCard } from './CompaniesCard'
import { WarehousesCard } from './WarehousesCard'
import { filterBranches } from './branchOverview.mjs'
import './branches.css'

const emptyForm: CreateBranchPayload = { name: '', address: '', phone: '' }
const stateOf = (branch: Branch) => branch.state || (branch.active === false ? 'inactive' : branch.operational_status === 'MAINTENANCE' ? 'maintenance' : 'operating')
const labelOf = { operating: 'Operativa', maintenance: 'En mantenimiento', inactive: 'Inactiva' }
type BranchEdit = { name: string; address: string; phone: string; operational_status: 'OPERATING' | 'MAINTENANCE'; manager_user_id: string }

export default function BranchesManagement() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { company, companies, setCompany } = useTenant()
  const { refreshUser } = useAuth()
  const { hasPermission } = useAuthPermissions()
  const canManage = hasPermission('branches.manage')
  const canViewAll = canManage || hasPermission('branches.view_all') || hasPermission('users.view')
  const [tab, setTab] = useState<'companies' | 'branches' | 'warehouses'>('branches')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [order, setOrder] = useState('name')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateBranchPayload>(emptyForm)
  const [editBranch, setEditBranch] = useState<Branch | null>(null)
  const [editForm, setEditForm] = useState<BranchEdit>({ name: '', address: '', phone: '', operational_status: 'OPERATING', manager_user_id: '' })
  const [detail, setDetail] = useState<Branch | null>(null)

  const branchesQuery = useQuery({ queryKey: ['branches', 'all', company?.id, canViewAll], queryFn: () => fetchBranches(canViewAll), enabled: Boolean(company) })
  const branches = branchesQuery.data || []
  const warehousesQuery = useQuery({ queryKey: ['warehouses', 'all', company?.id], queryFn: () => fetchWarehouses('all'), enabled: Boolean(company) })
  const warehouses = warehousesQuery.data || []
  const managersQuery = useQuery({ queryKey: ['branch-managers', editBranch?.id], queryFn: () => fetchBranchManagers(editBranch!.id), enabled: Boolean(editBranch) && canManage })
  const filtered = useMemo(() => filterBranches(branches.map((branch) => ({ ...branch, state: stateOf(branch) })), { search, status, order }) as Branch[], [branches, search, status, order])
  const pageSize = 6
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const counts = { operating: branches.filter((branch) => stateOf(branch) === 'operating').length, maintenance: branches.filter((branch) => stateOf(branch) === 'maintenance').length, inactive: branches.filter((branch) => stateOf(branch) === 'inactive').length }
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ['branches'] }); void refreshUser() }
  const fail = (error: Error) => toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' })
  const createMutation = useMutation({ mutationFn: createBranch, onSuccess: () => { setCreateOpen(false); setCreateForm(emptyForm); invalidate(); toast({ title: 'Sucursal creada' }) }, onError: fail })
  const updateMutation = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateBranch>[1] }) => updateBranch(id, payload), onSuccess: () => { setEditBranch(null); invalidate(); toast({ title: 'Sucursal actualizada' }) }, onError: fail })
  const beginEdit = (branch: Branch) => { setEditBranch(branch); setEditForm({ name: branch.name, address: branch.address || '', phone: branch.phone || '', operational_status: branch.operational_status || 'OPERATING', manager_user_id: branch.manager_user_id || '' }) }
  const create = () => { if (!createForm.name?.trim()) return; createMutation.mutate({ ...createForm, name: createForm.name.trim() }) }
  const save = () => { if (!editBranch || !editForm.name.trim()) return; updateMutation.mutate({ id: editBranch.id, payload: { ...editForm, name: editForm.name.trim(), manager_user_id: editForm.manager_user_id || null } }) }

  return <main className="branches-page">
    <header className="branches-heading"><div><p className="branches-eyebrow">ADMINISTRACIÓN</p><h1>Empresas, sucursales y almacenes</h1><p>Gestiona sedes, espacios de inventario y sus responsables desde un solo lugar.</p></div>{tab === 'branches' && canManage && <Button className="branches-primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Nueva sucursal</Button>}</header>
    <nav className="branches-tabs" aria-label="Secciones del módulo"><button type="button" data-active={tab === 'companies'} onClick={() => setTab('companies')}>Empresas</button><button type="button" data-active={tab === 'branches'} onClick={() => setTab('branches')}>Sucursales</button><button type="button" data-active={tab === 'warehouses'} onClick={() => setTab('warehouses')}>Almacenes</button></nav>

    {tab === 'companies' && <CompaniesCard canManage={hasPermission('companies.manage')} activeBranches={branches} onAddBranch={() => { setTab('branches'); setCreateOpen(true) }} />}
    {tab === 'branches' && <>
      <section className="branches-stats" aria-label="Resumen de sucursales"><div className="branches-stat"><Building2 /><strong>{branches.length}</strong><span>Sucursales<small>Totales</small></span></div><div className="branches-stat"><Warehouse /><strong>{warehousesQuery.isError ? '—' : warehouses.length}</strong><span>Almacenes<small>{warehousesQuery.isError ? 'No disponibles' : 'Visibles'}</small></span></div>{(['operating', 'maintenance', 'inactive'] as const).map((key) => <button type="button" key={key} className={`branches-stat branches-stat--${key}`} onClick={() => { setStatus(status === key ? 'all' : key); setPage(1) }} aria-pressed={status === key}><i /><strong>{counts[key]}</strong><span>{labelOf[key]}<small>Sucursales</small></span></button>)}</section>
      <section className="branches-toolbar" aria-label="Filtros de sucursales"><label className="branches-search"><Search className="h-4 w-4" /><Input aria-label="Buscar sucursales" placeholder="Buscar por nombre, dirección o responsable..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label><select aria-label="Empresa" value={company?.id || ''} onChange={(event) => { setCompany(event.target.value); setPage(1) }}>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Estado de sucursal" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="all">Todos los estados</option><option value="operating">Operativas</option><option value="maintenance">En mantenimiento</option><option value="inactive">Inactivas</option></select><select aria-label="Ordenar sucursales" value={order} onChange={(event) => setOrder(event.target.value)}><option value="name">Ordenar por: Nombre</option><option value="code">Ordenar por: Código</option></select></section>
      {branchesQuery.isLoading ? <div className="branches-empty"><Loader2 className="h-5 w-5 animate-spin" /> Cargando sucursales…</div> : branchesQuery.isError ? <div className="branches-empty">No se pudieron cargar las sucursales. <Button variant="outline" onClick={() => void branchesQuery.refetch()}>Reintentar</Button></div> : !visible.length ? <div className="branches-empty">No hay sucursales que coincidan con los filtros.</div> : <section className="branches-list" aria-label="Sucursales">{visible.map((branch) => { const own = warehouses.filter((warehouse) => warehouse.branch_id === branch.id); const state = stateOf(branch); return <article key={branch.id} className="branches-row"><div className="branches-row-identity"><span className="branches-row-icon"><Building2 /></span><div><strong>{branch.name}</strong><small>{company?.name} · {branch.code}</small><span><MapPin className="h-3 w-3" />{branch.address || 'Dirección no registrada'}</span></div></div><div className="branches-row-warehouses"><strong><Package className="h-4 w-4" /> {own.length} {own.length === 1 ? 'almacén' : 'almacenes'}</strong>{own.slice(0, 2).map((warehouse) => <small key={warehouse.id}>• {warehouse.name}</small>)}</div><div className="branches-row-manager"><small>Responsable</small><strong>{branch.manager?.name || 'Sin asignar'}</strong></div><div className="branches-row-state"><span className={`branches-badge branches-badge--${state}`}><i />{labelOf[state]}</span>{branch.is_default && <small>Predeterminada</small>}</div><div className="branches-row-actions"><Button variant="outline" onClick={() => setDetail(branch)}>Ver detalles</Button>{canManage && <Button variant="outline" size="icon" title="Editar sucursal" aria-label={`Editar ${branch.name}`} onClick={() => beginEdit(branch)}><Pencil className="h-4 w-4" /></Button>}</div></article> })}</section>}
      <footer className="branches-pagination"><span>Mostrando {visible.length ? (currentPage - 1) * pageSize + 1 : 0} a {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} sucursales</span><div><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>{Array.from({ length: totalPages }, (_, index) => <button type="button" key={index} data-active={index + 1 === currentPage} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button></div></footer>
    </>}
    {tab === 'warehouses' && <WarehousesCard canManage={hasPermission('warehouses.manage')} branches={branches} />}

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="branches-dialog"><DialogHeader><DialogTitle>Nueva sucursal</DialogTitle><DialogDescription>Se creará en {company?.name}. El código corto se genera del nombre.</DialogDescription></DialogHeader><div className="branches-form"><label>Nombre *<Input value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} placeholder="Sucursal Centro" /></label><label>Dirección<Input value={createForm.address || ''} onChange={(event) => setCreateForm({ ...createForm, address: event.target.value })} /></label><label>Teléfono<Input value={createForm.phone || ''} onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value })} /></label></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button className="branches-primary" disabled={createMutation.isPending || !createForm.name.trim()} onClick={create}>Crear sucursal</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(editBranch)} onOpenChange={(open) => { if (!open) setEditBranch(null) }}><DialogContent className="branches-dialog"><DialogHeader><DialogTitle>Editar sucursal</DialogTitle><DialogDescription>{editBranch?.code} · {company?.name}</DialogDescription></DialogHeader><div className="branches-form"><label>Nombre *<Input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></label><label>Dirección<Input value={editForm.address} onChange={(event) => setEditForm({ ...editForm, address: event.target.value })} /></label><label>Teléfono<Input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} /></label><label>Responsable<select value={editForm.manager_user_id} onChange={(event) => setEditForm({ ...editForm, manager_user_id: event.target.value })}><option value="">Sin asignar</option>{managersQuery.data?.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select></label><label>Estado operativo<select value={editForm.operational_status} onChange={(event) => setEditForm({ ...editForm, operational_status: event.target.value as BranchEdit['operational_status'] })}><option value="OPERATING">Operativa</option><option value="MAINTENANCE">En mantenimiento</option></select></label><div className="branches-form-actions">{editBranch && <><Button variant="outline" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: editBranch.id, payload: { active: editBranch.active === false } })}>{editBranch.active === false ? 'Reactivar' : 'Desactivar'}</Button>{!editBranch.is_default && <Button variant="outline" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: editBranch.id, payload: { is_default: true } })}>Marcar predeterminada</Button>}</>}</div></div><DialogFooter><Button variant="outline" onClick={() => setEditBranch(null)}>Cancelar</Button><Button className="branches-primary" disabled={updateMutation.isPending || !editForm.name.trim()} onClick={save}>Guardar cambios</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null) }}><DialogContent className="branches-dialog"><DialogHeader><DialogTitle>{detail?.name}</DialogTitle><DialogDescription>Sucursal {detail?.code} de {company?.name}</DialogDescription></DialogHeader>{detail && <div className="branches-detail"><p><span>Estado</span><strong>{labelOf[stateOf(detail)]}</strong></p><p><span>Responsable</span><strong>{detail.manager?.name || 'Sin asignar'}</strong></p><p><span>Dirección</span><strong>{detail.address || 'No registrada'}</strong></p><p><span>Teléfono</span><strong>{detail.phone || 'No registrado'}</strong></p><p><span>Almacenes</span><strong>{warehouses.filter((warehouse) => warehouse.branch_id === detail.id).map((warehouse) => warehouse.name).join(', ') || 'Sin almacenes visibles'}</strong></p></div>}<DialogFooter><Button variant="outline" onClick={() => setDetail(null)}>Cerrar</Button>{canManage && detail && <Button className="branches-primary" onClick={() => { beginEdit(detail); setDetail(null) }}>Editar</Button>}</DialogFooter></DialogContent></Dialog>
  </main>
}
