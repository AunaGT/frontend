import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Eye, Loader2, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Pagination } from '@/components/shared/Pagination'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/services/api'
import { getFriendlyTypeName } from './getFriendlyTypeName'
import { CodesDialog, type CodesDialogState, type Promotion, type PromotionType } from './PromotionsManagement'

type PromotionPage = { items: Promotion[]; page: number; pageSize: number; totalPages: number; totalItems: number }
const label = (value: string) => value === 'active' ? 'Activa' : value === 'scheduled' ? 'Programada' : value === 'ended' ? 'Finalizada' : 'Inactiva'

function statusOf(promo: Promotion) {
  const now = Date.now()
  if (!promo.active) return 'inactive'
  if (new Date(promo.start_date).getTime() > now) return 'scheduled'
  if (promo.end_date && new Date(promo.end_date).getTime() <= now) return 'ended'
  return 'active'
}

export default function PromotionsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const { locale, currencyCode, companyLogoUrl } = useSystemSettings()
  const canManage = hasPermission('promotions.manage')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [scope, setScope] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [codesDialog, setCodesDialog] = useState<CodesDialogState>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null)

  const typesQuery = useQuery({ queryKey: ['promotion-types'], queryFn: () => apiFetch<PromotionType[]>('/promotions/types') })
  const listQuery = useQuery({
    queryKey: ['promotions', page, deferredSearch, type, status, scope, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' })
      if (deferredSearch) params.set('search', deferredSearch)
      if (type !== 'all') params.set('type_id', type)
      if (status !== 'all') params.set('status', status)
      if (scope !== 'all') params.set('scope', scope)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      return apiFetch<PromotionPage>(`/promotions?${params}`)
    },
  })
  const rows = listQuery.data?.items ?? []
  const changeFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1) }
  const date = (value?: string) => value ? new Intl.DateTimeFormat(locale || 'es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value.endsWith('T00:00:00.000Z') ? `${value.slice(0, 10)}T12:00:00-06:00` : value)) : 'Sin fecha límite'
  const uses = (promo: Promotion) => promo.usage?.used ?? promo.codes?.reduce((sum, code) => sum + code.current_uses, 0) ?? 0
  const capacity = (promo: Promotion) => promo.usage?.capacity ?? null
  const showCodes = async (promo: Promotion) => {
    try {
      const detail = await apiFetch<Promotion>(`/promotions/${promo.id}`)
      setCodesDialog({ open: true, promotion: detail })
    } catch (error) {
      toast({ title: 'No se pudieron cargar los códigos', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    }
  }
  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => apiFetch(`/promotions/${id}`, { method: 'PUT', body: JSON.stringify({ active }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
    onError: (error: Error) => toast({ title: 'No se pudo cambiar el estado', description: error.message, variant: 'destructive' }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/promotions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      if (rows.length === 1 && page > 1) setPage(page - 1)
      toast({ title: 'Promoción eliminada' })
    },
    onError: (error: Error) => toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' }),
  })

  return <div className="min-h-full bg-brand-surface/70 dark:bg-brand-navy">
    <div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="auna-module-heading">
        <div><p className="auna-module-eyebrow">Ventas</p><h1>Promociones</h1><p className="auna-module-description">Gestiona y controla las promociones de tu negocio.</p></div>
        {canManage && <Button size="lg" className="h-12 rounded-xl bg-brand-orange px-6 text-white shadow-lg shadow-orange-500/20 hover:bg-brand-orange-strong" onClick={() => navigate('/promociones/nueva')}><Plus className="mr-2 h-5 w-5" />Nueva promoción</Button>}
      </header>

      <section aria-label="Filtros de promociones" className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[minmax(260px,2.2fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto]">
          <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar promociones" className="h-12 rounded-xl pl-12" placeholder="Buscar por nombre, código o descripción…" value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} /></div>
          <Select value={type} onValueChange={(value) => changeFilter(setType, value)}><SelectTrigger className="h-12 rounded-xl" aria-label="Tipo de promoción"><SelectValue placeholder="Todos los tipos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos</SelectItem>{typesQuery.data?.map((item) => <SelectItem key={item.id} value={String(item.id)}>{getFriendlyTypeName(item.name)}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={(value) => changeFilter(setStatus, value)}><SelectTrigger className="h-12 rounded-xl" aria-label="Estado de promoción"><SelectValue placeholder="Todos los estados" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="active">Activas</SelectItem><SelectItem value="scheduled">Programadas</SelectItem><SelectItem value="ended">Finalizadas</SelectItem><SelectItem value="inactive">Inactivas</SelectItem></SelectContent></Select>
          <Button variant="outline" className="h-12 rounded-xl px-5" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}><SlidersHorizontal className="mr-2 h-4 w-4" />Más filtros<ChevronDown className="ml-2 h-4 w-4" /></Button>
        </div>
        {moreOpen && <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Select value={scope} onValueChange={(value) => changeFilter(setScope, value)}><SelectTrigger aria-label="Alcance por sucursal"><SelectValue placeholder="Todas las sucursales" /></SelectTrigger><SelectContent><SelectItem value="all">Cualquier alcance</SelectItem><SelectItem value="specific">Sucursales específicas</SelectItem><SelectItem value="global">Todas las sucursales</SelectItem></SelectContent></Select>
          <label className="text-xs text-muted-foreground">Inicio desde<Input type="date" className="mt-1" value={dateFrom} onChange={(event) => changeFilter(setDateFrom, event.target.value)} /></label>
          <label className="text-xs text-muted-foreground">Inicio hasta<Input type="date" className="mt-1" value={dateTo} onChange={(event) => changeFilter(setDateTo, event.target.value)} /></label>
          <Button variant="ghost" className="self-end" onClick={() => { setSearch(''); setType('all'); setStatus('all'); setScope('all'); setDateFrom(''); setDateTo(''); setPage(1) }}>Limpiar</Button>
        </div>}
      </section>

      <section className="auna-data-table-shell" aria-label="Listado de promociones">
        {listQuery.isLoading ? <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-brand-orange" /><span className="sr-only">Cargando promociones</span></div>
          : listQuery.isError ? <div className="p-8 text-center"><p>No se pudieron cargar las promociones.</p><Button variant="outline" className="mt-3" onClick={() => listQuery.refetch()}>Reintentar</Button></div>
          : rows.length === 0 ? <div className="p-12 text-center text-muted-foreground">{listQuery.data?.totalItems === 0 && !deferredSearch && type === 'all' && status === 'all' ? 'Aún no hay promociones creadas.' : 'No hay promociones para estos filtros.'}</div>
          : <div className="overflow-x-auto"><Table className="auna-data-table min-w-[940px]"><TableHeader><TableRow><TableHead>Promoción</TableHead><TableHead>Tipo</TableHead><TableHead>Vigencia</TableHead><TableHead>Alcance</TableHead><TableHead>Estado</TableHead><TableHead>Uso</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map((promo) => {
            const state = statusOf(promo)
            const used = uses(promo)
            const limit = capacity(promo)
            const progress = limit ? Math.min(100, Math.round(used / limit * 100)) : 0
            return <TableRow key={promo.id}>
              <TableCell><div className="font-semibold">{promo.name}</div><div className="text-xs text-muted-foreground">{promo.codes?.[0]?.code ?? 'Sin código activo'}</div></TableCell>
              <TableCell><span className="inline-flex rounded-lg bg-brand-orange/10 px-3 py-2 text-xs font-medium text-brand-orange dark:bg-brand-orange/15">{getFriendlyTypeName(promo.type?.name)}</span></TableCell>
              <TableCell><div>{date(promo.start_date)}</div><div className="text-xs text-muted-foreground">{date(promo.end_date)}</div></TableCell>
              <TableCell><div>{promo.applies_to_all ? 'Todos los productos' : 'Productos o categorías seleccionados'}</div><div className="text-xs text-muted-foreground">{promo.applies_to_all_branches === false ? `${promo.branches?.length ?? 0} ${(promo.branches?.length ?? 0) === 1 ? 'sucursal' : 'sucursales'}` : 'Todas las sucursales'}</div></TableCell>
              <TableCell><span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${state === 'active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : state === 'ended' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'}`}><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-current" />{label(state)}</span></TableCell>
              <TableCell><div className="text-sm">{used.toLocaleString(locale || 'es-GT')} {limit !== null ? `/ ${limit.toLocaleString(locale || 'es-GT')}` : 'usos'}</div>{limit ? <div className="flex items-center gap-2"><div role="progressbar" aria-label={`Uso de ${promo.name}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-2 w-28 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-orange" style={{ width: `${progress}%` }} /></div><span className="text-xs text-muted-foreground">{progress}%</span></div> : <div className="text-xs text-muted-foreground">{limit === 0 ? 'Sin códigos activos' : 'Sin límite'}</div>}</TableCell>
              <TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label={`Acciones de ${promo.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => showCodes(promo)}><Eye className="mr-2 h-4 w-4" />Ver códigos y PDF</DropdownMenuItem>{canManage && <><DropdownMenuItem onSelect={() => navigate(`/promociones/${promo.id}/editar`)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem><DropdownMenuItem disabled={toggleMutation.isPending} onSelect={() => toggleMutation.mutate({ id: promo.id, active: !promo.active })}>{promo.active ? 'Desactivar' : 'Activar'}</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => setDeleteTarget(promo)}><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></TableCell>
            </TableRow>
          })}</TableBody></Table></div>}
        {!listQuery.isLoading && !listQuery.isError && <Pagination currentPage={listQuery.data?.page ?? page} totalPages={listQuery.data?.totalPages ?? 1} totalItems={listQuery.data?.totalItems ?? 0} pageSize={listQuery.data?.pageSize ?? 10} count={rows.length} itemLabel="promociones" onPageChange={setPage} loading={listQuery.isFetching} />}
      </section>
    </div>
    <CodesDialog dialog={codesDialog} setDialog={setCodesDialog} onCopyCode={(code) => { navigator.clipboard.writeText(code); toast({ title: 'Código copiado', description: code }) }} locale={locale} currencyCode={currencyCode} companyLogoUrl={companyLogoUrl} />
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}><AlertDialogContent variant="auna"><AlertDialogHeader><AlertDialogTitle>¿Eliminar promoción?</AlertDialogTitle><AlertDialogDescription>Se eliminará “{deleteTarget?.name}” y sus códigos dejarán de poder utilizarse.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" disabled={deleteMutation.isPending} onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}
