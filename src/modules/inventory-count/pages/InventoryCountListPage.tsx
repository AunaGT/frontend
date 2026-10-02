import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Eye, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pagination } from '@/components/shared/Pagination'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { listInventorySessions, statusLabel, type InventoryCountSessionStatus } from '../api/inventoryCountService'
import { CountStatusBadge } from '../components/CountStatusBadge'
import '../inventoryCount.css'

const statuses: InventoryCountSessionStatus[] = ['DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'PENDING_SECOND_APPROVAL', 'APPROVED', 'CANCELLED']
export default function InventoryCountListPage() {
  const { hasPermission } = useAuthPermissions()
  const { locale } = useSystemSettings()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 10
  useEffect(() => {
    const timer = window.setTimeout(() => { setQ(search.trim()); setPage(1) }, 300)
    return () => window.clearTimeout(timer)
  }, [search])
  const query = useQuery({
    queryKey: ['inventory-sessions', status, q, page],
    queryFn: () => listInventorySessions({ status: status === 'all' ? undefined : status, q: q || undefined, limit: pageSize, offset: (page - 1) * pageSize }),
  })
  const sessions = query.data?.data ?? []
  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))
  useEffect(() => { if (query.data && page > pages) setPage(pages) }, [query.data, page, pages])
  return <div className="inventory-count-page"><div className="inventory-count-content">
    <header className="auna-module-heading">
      <div><p className="auna-module-eyebrow">Inventario</p><h1>Sesiones de conteo</h1><p className="auna-module-description">Gestiona el conteo físico y revisa las diferencias antes de ajustar tus existencias.</p></div>
      {hasPermission('inventory_count.create') && <Button asChild className="h-12 rounded-xl bg-brand-orange px-6 text-white shadow-lg shadow-orange-500/20 hover:bg-brand-orange-strong"><Link to="/inventario/inventariado/nuevo"><Plus className="mr-2 h-4 w-4" />Crear sesión</Link></Button>}
    </header>
    <section className="rounded-2xl border bg-card p-4 flex flex-col md:flex-row gap-3" aria-label="Filtros de conteo">
      <div className="relative flex-1"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar sesiones" placeholder="Buscar por nombre, sucursal, almacén o responsable…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <Select value={status} onValueChange={value => { setStatus(value); setPage(1) }}><SelectTrigger aria-label="Estado" className="md:w-60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem>{statuses.map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" onClick={() => { setSearch(''); setQ(''); setStatus('all'); setPage(1) }}>Limpiar</Button>
    </section>
    <section className="auna-data-table-shell" aria-label="Sesiones de inventariado" aria-busy={query.isFetching}>
      {query.isLoading ? <div role="status" className="p-5 space-y-4"><span className="sr-only">Cargando sesiones…</span>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : query.isError ? <div role="alert" className="p-8 text-center"><p>No se pudieron cargar las sesiones.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Reintentar</Button></div> : <>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Sesión</TableHead><TableHead>Sucursal / almacén</TableHead><TableHead>Responsable</TableHead><TableHead>Progreso</TableHead><TableHead>Estado</TableHead><TableHead>Fecha de creación</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>
          {sessions.map(s => <TableRow key={s.id}>
            <TableCell><Link className="font-semibold hover:text-primary" to={`/inventario/inventariado/${s.id}`}>{s.name?.trim() || `Conteo ${s.id.slice(0, 8).toUpperCase()}`}</Link><p className="text-xs text-muted-foreground mt-1">{s.id.slice(0, 8).toUpperCase()}</p></TableCell>
            <TableCell>{s.branch?.name || 'Sucursal actual'}<p className="text-xs text-muted-foreground mt-1">{s.warehouse?.name || 'Todos los almacenes'}</p></TableCell>
            <TableCell>{s.createdBy.name}</TableCell>
            <TableCell className="min-w-40"><div className="flex justify-between text-xs mb-2"><span>{s.progress?.countedLines ?? 0} / {s.progress?.totalLines ?? 0}</span><span>{s.progress?.pct ?? 0}%</span></div><div role="progressbar" aria-label={`Progreso de ${s.name || 'conteo'}`} aria-valuenow={s.progress?.pct ?? 0} aria-valuemin={0} aria-valuemax={100} className="h-2 rounded-full bg-muted overflow-hidden"><div className={s.status === 'APPROVED' ? 'h-full bg-emerald-500' : 'h-full bg-primary'} style={{ width: `${s.progress?.pct ?? 0}%` }} /></div></TableCell>
            <TableCell><CountStatusBadge status={s.status} /></TableCell>
            <TableCell className="whitespace-nowrap">{new Date(s.created_at).toLocaleDateString(locale)}<p className="text-xs text-muted-foreground mt-1">{new Date(s.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</p></TableCell>
            <TableCell className="text-right"><Button asChild variant="outline" size="icon"><Link aria-label={`Ver conteo ${s.name || s.id.slice(0, 8)}`} to={`/inventario/inventariado/${s.id}`}><Eye className="h-4 w-4" /></Link></Button></TableCell>
          </TableRow>)}
          {!sessions.length && <TableRow><TableCell colSpan={7} className="h-40 text-center text-muted-foreground">No hay sesiones para estos filtros.</TableCell></TableRow>}
        </TableBody></Table></div>
        <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} totalItems={total} pageSize={pageSize} count={sessions.length} itemLabel="sesiones" loading={query.isFetching} />
      </>}
    </section>
  </div></div>
}
