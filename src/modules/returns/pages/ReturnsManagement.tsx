import { useDeferredValue, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Loader2, MoreHorizontal, Plus, Search, ShieldCheck, WalletCards, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Pagination } from '@/components/shared/Pagination'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePersistedListUiState, useResetPageOnFilterChange } from '@/hooks/usePersistedListUiState'
import { formatDateTime, formatMoney } from '@/utils'
import { useReturns, useUpdateReturnStatus } from '../hooks/useReturns'
import type { Return } from '../api/returnService'

type Decision = { record: Return; status: 'Rechazada' }

const statusTone: Record<string, string> = {
  Pendiente: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  Aprobada: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  Completada: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  Rechazada: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${statusTone[value] ?? 'bg-muted text-muted-foreground'}`}><span className="h-2.5 w-2.5 rounded-full bg-current" />{value}</span>
}

export default function ReturnsManagement() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { locale, currencyCode } = useSystemSettings()
  const { hasPermission } = useAuthPermissions()
  const canManage = hasPermission('returns.manage')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [reason, setReason] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [decision, setDecision] = useState<Decision | null>(null)
  const { page, setPage } = usePersistedListUiState('devoluciones/lista', { defaultPage: 1, defaultPageSize: 10 })
  useResetPageOnFilterChange(setPage, [deferredSearch, status, type, reason, dateFrom, dateTo])
  const query = useReturns({
    page,
    pageSize: 10,
    search: deferredSearch || undefined,
    status: status === 'all' ? undefined : status,
    type: type === 'all' ? undefined : type,
    reason: reason || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })
  const mutation = useUpdateReturnStatus()
  const rows = query.data?.items ?? []
  const money = (value: number) => formatMoney(Number(value), locale, currencyCode)
  const clear = () => { setSearch(''); setStatus('all'); setType('all'); setReason(''); setDateFrom(''); setDateTo(''); setPage(1) }
  const confirmDecision = async () => {
    if (!decision) return
    try {
      await mutation.mutateAsync({ id: decision.record.id, payload: { status_name: decision.status } })
      toast({ title: 'Solicitud rechazada', description: 'La decisión no movió inventario ni dinero.' })
      setDecision(null)
    } catch (error) {
      toast({ title: 'No se pudo actualizar', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    }
  }

  return <div className="min-h-[calc(100dvh-56px)] bg-brand-surface/70 dark:bg-brand-navy">
    <div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="auna-module-heading">
        <div><p className="auna-module-eyebrow">Ventas</p><h1>Devoluciones</h1><p className="auna-module-description">Gestiona solicitudes de devolución, consulta su estado y da seguimiento.</p></div>
        {canManage && <Button size="lg" className="h-12 rounded-xl bg-brand-orange px-6 text-white shadow-lg shadow-orange-500/20 hover:bg-brand-orange-strong" onClick={() => navigate('/returns/new')}><Plus className="mr-2 h-5 w-5" />Nueva devolución</Button>}
      </header>

      <section aria-label="Filtros de devoluciones" className="grid items-end gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(260px,2fr)_repeat(3,minmax(140px,1fr))_145px_145px_auto] dark:bg-[#101f34]">
        <label className="text-xs font-semibold">Buscar<div className="relative mt-2"><Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" /><Input className="h-12 rounded-xl pl-10" placeholder="Venta, cliente o producto…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></label>
        <label className="text-xs font-semibold">Estado<Select value={status} onValueChange={setStatus}><SelectTrigger className="mt-2 h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Aprobada">Aprobada</SelectItem><SelectItem value="Completada">Completada</SelectItem><SelectItem value="Rechazada">Rechazada</SelectItem></SelectContent></Select></label>
        <label className="text-xs font-semibold">Tipo<Select value={type} onValueChange={setType}><SelectTrigger className="mt-2 h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="REFUND">Devolución</SelectItem><SelectItem value="EXCHANGE">Cambio</SelectItem></SelectContent></Select></label>
        <label className="text-xs font-semibold">Motivo<Input className="mt-2 h-12 rounded-xl" placeholder="Cualquier motivo" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <label className="text-xs font-semibold">Desde<Input type="date" className="mt-2 h-12 rounded-xl" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label className="text-xs font-semibold">Hasta<Input type="date" className="mt-2 h-12 rounded-xl" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <Button variant="outline" className="h-12 min-w-[105px] rounded-xl border-brand-orange text-brand-orange" onClick={clear}>Limpiar</Button>
      </section>

      <section className="auna-data-table-shell" aria-label="Listado de devoluciones">
        {query.isLoading ? <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-brand-orange" /><span className="sr-only">Cargando devoluciones</span></div>
          : query.isError ? <div className="p-12 text-center"><p className="font-semibold text-destructive">No se pudieron cargar las devoluciones.</p><Button variant="outline" className="mt-4" onClick={() => query.refetch()}>Reintentar</Button></div>
            : rows.length === 0 ? <div className="p-16 text-center text-muted-foreground">No hay devoluciones para estos filtros.</div>
              : <>
                <div className="hidden overflow-x-auto md:block"><Table className="auna-data-table min-w-[1050px]"><TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Venta</TableHead><TableHead>Cliente</TableHead><TableHead>Motivo</TableHead><TableHead>Monto estimado</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map((record) => <TableRow key={record.id}><TableCell className="font-semibold">{record.id.slice(0, 8).toUpperCase()}</TableCell><TableCell><span className="font-semibold text-brand-orange">{record.sale?.reference ?? record.sale_id.slice(0, 8)}</span></TableCell><TableCell>{record.sale?.customerContact?.name || record.sale?.customer || 'Consumidor final'}</TableCell><TableCell className="max-w-[220px] truncate">{record.reason || 'Sin motivo'}</TableCell><TableCell className="whitespace-nowrap font-medium">{money(record.total_refund)}</TableCell><TableCell><StatusBadge value={record.status.name} /></TableCell><TableCell className="whitespace-nowrap">{formatDateTime(record.return_date)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label={`Ver devolución ${record.id}`} onClick={() => navigate(`/devoluciones/${record.id}`)}><Eye className="h-4 w-4" /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Acciones de devolución ${record.id}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => navigate(`/devoluciones/${record.id}`)}><Eye className="mr-2 h-4 w-4" />Ver detalle</DropdownMenuItem>{canManage && record.status.name === 'Pendiente' && <><DropdownMenuItem onSelect={() => navigate(`/devoluciones/${record.id}`)}><ShieldCheck className="mr-2 h-4 w-4" />Revisar y aprobar</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => setDecision({ record, status: 'Rechazada' })}><XCircle className="mr-2 h-4 w-4" />Rechazar</DropdownMenuItem></>}{canManage && record.status.name === 'Aprobada' && <DropdownMenuItem onSelect={() => navigate(`/devoluciones/${record.id}`)}><WalletCards className="mr-2 h-4 w-4" />Recibir y liquidar</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div></TableCell></TableRow>)}</TableBody></Table></div>
                <div className="space-y-3 p-4 md:hidden">{rows.map((record) => <button key={record.id} type="button" className="w-full rounded-2xl border border-border/70 bg-card p-4 text-left" onClick={() => navigate(`/devoluciones/${record.id}`)}><div className="flex items-start justify-between gap-3"><div><strong>{record.sale?.reference ?? record.sale_id.slice(0, 8)}</strong><p className="mt-1 text-sm text-muted-foreground">{record.sale?.customerContact?.name || record.sale?.customer || 'Consumidor final'}</p></div><StatusBadge value={record.status.name} /></div><div className="mt-4 flex items-end justify-between"><span className="text-sm text-muted-foreground">{formatDateTime(record.return_date)}</span><strong>{money(record.total_refund)}</strong></div></button>)}</div>
              </>}
        {!query.isLoading && !query.isError && <Pagination currentPage={query.data?.page ?? page} totalPages={query.data?.totalPages ?? 1} totalItems={query.data?.totalItems ?? 0} pageSize={query.data?.pageSize ?? 10} count={rows.length} itemLabel="devoluciones" onPageChange={setPage} loading={query.isFetching} />}
      </section>
    </div>

    <AlertDialog open={Boolean(decision)} onOpenChange={(open) => { if (!open) setDecision(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Rechazar solicitud?</AlertDialogTitle><AlertDialogDescription>La solicitud quedará cerrada. Esta acción no mueve inventario ni dinero.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={mutation.isPending} className="bg-destructive text-destructive-foreground" onClick={() => void confirmDecision()}>{mutation.isPending ? 'Guardando…' : 'Confirmar rechazo'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}
