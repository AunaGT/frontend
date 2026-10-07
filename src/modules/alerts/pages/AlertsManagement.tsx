import { LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'
import { MetricStrip } from '@/components/shared/MetricStrip'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Bell, Check, ChevronLeft, ChevronRight, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CompactFilterPanel } from '@/components/shared/CompactFilterPanel'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { apiFetch } from '@/services/api'
import { fetchProducts } from '@/services/productService'
import { createAlert, fetchAlertPriorities, fetchAlertTypes, fetchAssignableAlertUsers, reassignAlert, resolveAlert, type AlertLookup } from '../api/alertsService'
import type { Alert, AlertPriority, Status } from '@/types'
import { filterAlerts } from './alertsList.mjs'
import './alerts.css'

type AlertRow = Alert & { assignedToId?: string; typeName: string; moduleCode: string; localDate: string; timestampIso: string }
type RawAlert = {
  id?: string | number
  type?: { name?: string } | null
  priority?: { name?: string } | null
  title?: string
  message?: string
  product?: { name?: string; category?: { name?: string } | null } | null
  current_stock?: number
  min_stock?: number
  timestamp?: string
  localDate?: string
  timestampIso?: string
  status?: { name?: string } | null
  resolved?: number | boolean
  assignedTo?: { id?: string | number; name?: string } | null
  moduleCode?: string
}
type Filters = { search: string; priority: string; status: string; type: string; from: string; to: string; order: 'newest' | 'oldest' }
const EMPTY_FILTERS: Filters = { search: '', priority: 'all', status: 'all', type: 'all', from: '', to: '', order: 'newest' }
const PRIORITY_LABELS: Record<AlertPriority, string> = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' }
const STATUS_LABELS: Record<string, string> = { active: 'Abierta', pending: 'En proceso', resolved: 'Resuelta' }
const MODULE_LABELS: Record<string, string> = {
  inventory: 'Inventario',
  receivables: 'Cartera',
  merchandise: 'Mercancía',
  orders: 'Pedidos',
  quotes: 'Cotizaciones',
  'cash-closure': 'Cierre de caja',
  payroll: 'Nómina',
}

const adaptAlert = (raw: Record<string, unknown>): AlertRow => {
  const item = raw as RawAlert
  const priorityName = item.priority?.name?.toLocaleLowerCase('es') || ''
  const statusName = item.status?.name?.toLocaleLowerCase('es') || ''
  const typeName = item.type?.name || 'General'
  const priority: AlertPriority = priorityName.includes('crít') || priorityName.includes('crit') ? 'critical' : priorityName.includes('alta') ? 'high' : priorityName.includes('baja') ? 'low' : 'medium'
  const status: Status = item.resolved || statusName.includes('resuelt') ? 'resolved' : statusName.includes('pendient') ? 'pending' : 'active'
  return {
    id: String(item.id ?? ''),
    type: typeName === 'Sin Stock' ? 'stock_out' : typeName === 'Vencimiento' ? 'expiry_soon' : 'stock_low',
    typeName, moduleCode: item.moduleCode || 'inventory', priority, status,
    title: item.title || 'Alerta', message: item.message || '',
    product: item.product?.name || '', category: item.product?.category?.name || '',
    currentStock: item.current_stock ?? 0, minStock: item.min_stock ?? 0,
    timestamp: item.timestamp || '', localDate: item.localDate || '', timestampIso: item.timestampIso || '',
    assignedTo: item.assignedTo?.name || '', assignedToId: item.assignedTo?.id ? String(item.assignedTo.id) : undefined,
  }
}

export default function AlertsManagement() {
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const canManage = hasPermission('alerts.manage')
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [reassigningId, setReassigningId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [newAlertOpen, setNewAlertOpen] = useState(false)
  const [alertTypes, setAlertTypes] = useState<AlertLookup[]>([])
  const [alertPriorities, setAlertPriorities] = useState<AlertLookup[]>([])
  const [newTypeId, setNewTypeId] = useState('')
  const [newPriorityId, setNewPriorityId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<{ id: string; name: string }[]>([])
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null)
  const [creatingAlert, setCreatingAlert] = useState(false)

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await apiFetch<Array<Record<string, unknown>>>('/api/alerts?all=true')
      setAlerts((data || []).map(adaptAlert))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAlerts() }, [loadAlerts])
  useEffect(() => {
    if (!canManage) return
    void fetchAssignableAlertUsers().then(setUsers).catch(() => {})
  }, [canManage])
  useEffect(() => {
    if (!newAlertOpen) return
    void Promise.all([fetchAlertTypes(), fetchAlertPriorities()]).then(([types, priorities]) => {
      setAlertTypes(types)
      setAlertPriorities(priorities)
    }).catch(() => toast({ title: 'No se pudieron cargar los catálogos de alertas', variant: 'destructive' }))
  }, [newAlertOpen, toast])
  useEffect(() => {
    if (!newAlertOpen || productSearch.trim().length < 2) { setProductResults([]); return }
    const timer = setTimeout(() => {
      void fetchProducts({ search: productSearch, pageSize: 8 })
        .then((result) => setProductResults(result.items.map((product) => ({ id: String(product.id), name: product.name }))))
        .catch(() => setProductResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [newAlertOpen, productSearch])

  const resetNewAlert = () => {
    setNewTypeId(''); setNewPriorityId(''); setNewTitle(''); setNewMessage('')
    setProductSearch(''); setProductResults([]); setSelectedProduct(null)
  }
  const handleCreate = async () => {
    if (!canManage || !newTypeId || !newPriorityId || !newTitle.trim() || !selectedProduct) return
    setCreatingAlert(true)
    try {
      await createAlert({ type_id: Number(newTypeId), priority_id: Number(newPriorityId), title: newTitle.trim(), message: newMessage.trim() || undefined, product_id: selectedProduct.id })
      await loadAlerts()
      setNewAlertOpen(false)
      resetNewAlert()
      toast({ title: 'Alerta creada' })
    } catch (error) {
      toast({ title: 'No se pudo crear la alerta', description: error instanceof Error ? error.message : 'Intente nuevamente', variant: 'destructive' })
    } finally { setCreatingAlert(false) }
  }
  const handleResolve = async (id: string) => {
    if (!canManage) return
    setResolvingId(id)
    try {
      const updated = await resolveAlert(id) as Record<string, unknown>
      setAlerts((current) => current.map((alert) => alert.id === id ? { ...adaptAlert(updated), timestamp: alert.timestamp, localDate: alert.localDate, timestampIso: alert.timestampIso } : alert))
      toast({ title: 'Alerta resuelta' })
    } catch (error) {
      toast({ title: 'No se pudo resolver la alerta', description: error instanceof Error ? error.message : 'Intente nuevamente', variant: 'destructive' })
    } finally { setResolvingId(null) }
  }
  const handleAssign = async (id: string, userId: string) => {
    if (!canManage || !userId) return
    setReassigningId(id)
    try {
      await reassignAlert(id, userId)
      setAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, assignedTo: users.find((user) => user.id === userId)?.name || alert.assignedTo, assignedToId: userId } : alert))
      toast({ title: 'Alerta reasignada' })
    } catch (error) {
      toast({ title: 'No se pudo reasignar', description: error instanceof Error ? error.message : 'Intente nuevamente', variant: 'destructive' })
    } finally { setReassigningId(null) }
  }

  const typeOptions = useMemo(() => [...new Set(alerts.map((alert) => alert.typeName))].sort((a, b) => a.localeCompare(b, 'es')), [alerts])
  const visibleAlerts = useMemo(() => filterAlerts(alerts, filters) as AlertRow[], [alerts, filters])
  const pageCount = Math.max(1, Math.ceil(visibleAlerts.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageAlerts = visibleAlerts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const detail = alerts.find((alert) => alert.id === detailId)
  const unresolved = alerts.filter((alert) => alert.status !== 'resolved')
  const counts = {
    critical: unresolved.filter((alert) => alert.priority === 'critical').length,
    high: unresolved.filter((alert) => alert.priority === 'high').length,
    medium: unresolved.filter((alert) => alert.priority === 'medium').length,
    low: unresolved.filter((alert) => alert.priority === 'low').length,
    resolved: alerts.filter((alert) => alert.status === 'resolved').length,
  }
  const applyFilters = () => { setFilters({ ...draft }); setPage(1) }
  const clearFilters = () => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(1) }
  const activeFilters = Number(Boolean(filters.search.trim())) + Number(filters.priority !== 'all') + Number(filters.status !== 'all') + Number(filters.type !== 'all') + Number(Boolean(filters.from)) + Number(Boolean(filters.to))
  const filterPriority = (priority: string) => {
    const next = { ...EMPTY_FILTERS, priority }
    setDraft(next); setFilters(next); setPage(1)
  }

  return <main className="alerts-page">
    <h1 className="sr-only">Centro de alertas</h1>

    <MetricStrip label="Resumen de alertas" className="mb-5" items={([['critical','Críticas'],['high','Altas'],['medium','Medias'],['low','Bajas'],['resolved','Resueltas']] as const).map(([key,label]) => ({label,value:counts[key],alert:key === 'critical' && counts[key] > 0,active:key === 'resolved' ? filters.status === 'resolved' : filters.priority === key,onClick: () => key === 'resolved' ? (setDraft({...EMPTY_FILTERS,status:'resolved'}),setFilters({...EMPTY_FILTERS,status:'resolved'}),setPage(1)) : filterPriority(key)}))} />

<CompactFilterPanel actions={<>{canManage && <Button className="alerts-primary" onClick={() => setNewAlertOpen(true)}><Plus className="h-4 w-4" /> Nueva alerta</Button>}</>} title="Filtros de alertas" summary="Prioridad, estado, tipo y período" activeCount={activeFilters} onClear={clearFilters} className="mb-[22px]" contentClassName="alerts-filter-panel" onApply={applyFilters} search={<label className="alerts-filter-search"><span>Buscar</span><span className="auna-control-group alerts-search-input"><Search className="h-4 w-4" aria-hidden="true" /><Input value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') applyFilters() }} placeholder="ID, título, descripción o producto..." /></span></label>} appliedFilters={Object.entries(filters).filter(([key]) => key !== 'order').filter(([key,value]) => ['priority','status','type'].includes(key) ? value !== 'all' : Boolean(value)).map(([key,value]) => ({label: `${({search:'Búsqueda',priority:'Prioridad',status:'Estado',type:'Tipo',from:'Desde',to:'Hasta'} as Record<string,string>)[key]}: ${({critical:'Crítica',high:'Alta',medium:'Media',low:'Baja',active:'Abierta',pending:'En proceso',resolved:'Resuelta'} as Record<string,string>)[value] || value}`,onRemove: () => {setFilters(current => ({...current,[key]:EMPTY_FILTERS[key as keyof typeof EMPTY_FILTERS]}));setDraft(current => ({...current,[key]:EMPTY_FILTERS[key as keyof typeof EMPTY_FILTERS]}));setPage(1)}}))}>

      <label><span>Prioridad</span><select className="auna-control auna-control-select" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}><option value="all">Todas</option><option value="critical">Crítica</option><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></label>
      <label><span>Estado</span><select className="auna-control auna-control-select" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="all">Todos</option><option value="active">Abierta</option><option value="pending">En proceso</option><option value="resolved">Resuelta</option></select></label>
      <label><span>Tipo</span><select className="auna-control auna-control-select" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option value="all">Todos</option>{typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
      <label><span>Fecha desde</span><Input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} max={draft.to || undefined} /></label>
      <label><span>Fecha hasta</span><Input type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} min={draft.from || undefined} /></label>

    </CompactFilterPanel>

    <><section className="alerts-list-panel" aria-label="Listado de alertas">
      <div className="alerts-list-heading"><span>Mostrando {pageAlerts.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, visibleAlerts.length)} de {visibleAlerts.length} alertas{alerts.length >= 100 ? ' (entre las 100 más recientes)' : ''}</span><label>Ordenar por <select className="auna-control auna-control-select" value={draft.order} onChange={(event) => { const order = event.target.value as Filters['order']; setDraft({ ...draft, order }); setFilters({ ...filters, order }); setPage(1) }}><option value="newest">Fecha (más reciente)</option><option value="oldest">Fecha (más antigua)</option></select></label></div>
      {loading && alerts.length > 0 && <LoadingIndicator message="Actualizando alertas…" />}
      {loadError ? <div className="alerts-empty"><AlertCircle className="h-5 w-5" /> No se pudieron cargar las alertas. <Button variant="outline" onClick={() => void loadAlerts()}>Reintentar</Button></div> : !loading && !pageAlerts.length ? <div className="alerts-empty"><Bell className="h-5 w-5" /> No hay alertas que coincidan con los filtros.</div> : <div className="alerts-table-wrap"><table className="alerts-table">
        <thead><tr><th>ID</th><th>Título</th><th>Descripción</th><th>Tipo</th><th>Prioridad</th><th>Estado</th><th>Fecha</th><th>Asignado a</th><th>Acciones</th></tr></thead>
        <tbody>{loading && !alerts.length && <TableLoadingRows columns={9} message="Cargando alertas…" />}{pageAlerts.map((alert) => <tr key={alert.id}>
          <td data-label="ID" className="alerts-id" title={alert.id}>{alert.id.slice(0, 8).toUpperCase()}</td>
          <td data-label="Título"><button type="button" className="alerts-title" onClick={() => setDetailId(alert.id)}>{alert.title}</button><small className="alerts-product">{alert.product}</small></td>
          <td data-label="Descripción" className="alerts-description">{alert.message || '—'}</td>
          <td data-label="Tipo">{alert.typeName}<small className="alerts-product">{MODULE_LABELS[alert.moduleCode] || alert.moduleCode}</small></td>
          <td data-label="Prioridad"><span className={`alerts-priority alerts-priority--${alert.priority}`}>{PRIORITY_LABELS[alert.priority]}</span></td>
          <td data-label="Estado"><span className={`alerts-status alerts-status--${alert.status}`}><i />{STATUS_LABELS[alert.status] || alert.status}</span></td>
          <td data-label="Fecha" className="alerts-date">{alert.timestamp || '—'}</td>
          <td data-label="Asignado a">{canManage && users.length ? <select className="auna-control auna-control-select alerts-assignee" value={alert.assignedToId || ''} disabled={reassigningId === alert.id} onChange={(event) => void handleAssign(alert.id, event.target.value)} aria-label={`Asignar ${alert.title} a`}><option value="">Sin asignar</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select> : alert.assignedTo || 'Sin asignar'}</td>
          <td data-label="Acciones" className="alerts-actions"><Button variant="outline" size="sm" onClick={() => setDetailId(alert.id)}>Ver</Button>{canManage && alert.status !== 'resolved' && <Button variant="outline" size="sm" className="alerts-resolve" disabled={resolvingId === alert.id} onClick={() => void handleResolve(alert.id)}>{resolvingId === alert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Resolver</Button>}</td>
        </tr>)}</tbody>
      </table></div>}

    </section>
<div className="auna-pagination-outside"><footer className="alerts-table-footer"><label>Mostrar <select className="auna-control auna-control-select" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select> por página</label><div className="alerts-pagination"><button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>{Array.from({ length: pageCount }, (_, index) => <button type="button" key={index} className={currentPage === index + 1 ? 'is-current' : ''} onClick={() => setPage(index + 1)} aria-label={`Página ${index + 1}`} aria-current={currentPage === index + 1 ? 'page' : undefined}>{index + 1}</button>)}<button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button></div></footer></div></>

    <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetailId(null) }}><DialogContent variant="auna" className="alerts-dialog"><DialogHeader><DialogTitle>{detail?.title}</DialogTitle><DialogDescription>Detalle de alerta {detail?.id.slice(0, 8).toUpperCase()}</DialogDescription></DialogHeader>{detail && <div className="alerts-detail-grid"><p><span>Descripción</span>{detail.message || 'Sin descripción'}</p><p><span>Producto</span>{detail.product || '—'}</p><p><span>Tipo</span>{detail.typeName}</p><p><span>Prioridad</span>{PRIORITY_LABELS[detail.priority]}</p><p><span>Estado</span>{STATUS_LABELS[detail.status]}</p><p><span>Fecha</span>{detail.timestamp}</p><p><span>Asignado a</span>{detail.assignedTo || 'Sin asignar'}</p>{detail.type !== 'expiry_soon' && <p><span>Stock actual / mínimo</span>{detail.currentStock} / {detail.minStock}</p>}</div>}<DialogFooter><Button variant="outline" onClick={() => setDetailId(null)}>Cerrar</Button>{canManage && detail && detail.status !== 'resolved' && <Button className="alerts-primary" disabled={resolvingId === detail.id} onClick={() => void handleResolve(detail.id)}>Resolver alerta</Button>}</DialogFooter></DialogContent></Dialog>

    <Dialog open={newAlertOpen} onOpenChange={(open) => { setNewAlertOpen(open); if (!open) resetNewAlert() }}><DialogContent variant="auna" className="alerts-dialog"><DialogHeader><DialogTitle>Nueva alerta</DialogTitle><DialogDescription>Crea una alerta sobre un producto para que el equipo le dé seguimiento.</DialogDescription></DialogHeader><div className="alerts-form">
      <div><Label>Producto *</Label>{selectedProduct ? <div className="alerts-selected-product"><strong>{selectedProduct.name}</strong><Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>Cambiar</Button></div> : <><Input className="mt-1" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar por nombre o código..." />{productResults.length > 0 && <div className="alerts-product-results">{productResults.map((product) => <button type="button" key={product.id} onClick={() => { setSelectedProduct(product); setProductSearch(''); setProductResults([]) }}>{product.name}</button>)}</div>}</>}</div>
      <div className="alerts-form-grid"><div><Label>Tipo *</Label><Select value={newTypeId} onValueChange={setNewTypeId}><SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{alertTypes.map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name}{type.moduleCode ? ` · ${MODULE_LABELS[type.moduleCode] || type.moduleCode}` : ''}</SelectItem>)}</SelectContent></Select></div><div><Label>Prioridad *</Label><Select value={newPriorityId} onValueChange={setNewPriorityId}><SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{alertPriorities.map((priority) => <SelectItem key={priority.id} value={String(priority.id)}>{priority.name}</SelectItem>)}</SelectContent></Select></div></div>
      <div><Label htmlFor="alert-title">Título *</Label><Input id="alert-title" className="mt-1" maxLength={150} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} /></div><div><Label htmlFor="alert-message">Mensaje</Label><Textarea id="alert-message" className="mt-1" rows={3} value={newMessage} onChange={(event) => setNewMessage(event.target.value)} /></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setNewAlertOpen(false)} disabled={creatingAlert}>Cancelar</Button><Button className="alerts-primary" onClick={() => void handleCreate()} disabled={creatingAlert || !newTypeId || !newPriorityId || !newTitle.trim() || !selectedProduct}>{creatingAlert && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear alerta</Button></DialogFooter></DialogContent></Dialog>
  </main>
}
