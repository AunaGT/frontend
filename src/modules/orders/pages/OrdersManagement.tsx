import { useDeferredValue, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Search,
  Settings2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useToast } from '@/hooks/use-toast'
import { formatMoney } from '@/utils/formatters'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { fetchSuppliers } from '@/services/supplierService'
import { fetchOrderById, fetchOrders, num, type Order } from '@/services/orderService'
import { commercialDocSearchHint, isCommercialDocSearchReady } from '@/modules/quotes'
import { DeliveryBadge, OrderStatusBadge, PreparationBadge } from '../components/OrderStatusBadge'
import { OrderCreateDialog } from '../components/OrderCreateDialog'
import { orderPaginationItems, orderVisualState } from '../ordersViewModel'

type Filters = {
  search: string
  customerId: string
  dateFrom: string
  dateTo: string
  preparation: string
  delivery: string
}

const EMPTY_FILTERS: Filters = { search: '', customerId: 'all', dateFrom: '', dateTo: '', preparation: 'all', delivery: 'all' }

function Pagination({ current, totalPages, totalItems, pageSize, count, onChange }: {
  current: number
  totalPages: number
  totalItems: number
  pageSize: number
  count: number
  onChange: (page: number) => void
}) {
  const start = totalItems ? (current - 1) * pageSize + 1 : 0
  const end = start + count - 1
  return <footer className="flex flex-col gap-3 border-t border-border/70 px-5 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
    <span>Mostrando {start} a {end} de {totalItems} pedidos</span>
    <nav className="flex items-center gap-2" aria-label="Paginación de pedidos">
      <Button size="icon" variant="outline" className="h-10 w-10 rounded-lg" disabled={current <= 1} onClick={() => onChange(current - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
      {orderPaginationItems(current, totalPages).map((item, index) => item === 'ellipsis'
        ? <span key={`ellipsis-${index}`} className="flex h-10 w-8 items-center justify-center">…</span>
        : <Button key={item} size="icon" variant="outline" className={`h-10 w-10 rounded-lg ${item === current ? 'border-brand-orange bg-brand-orange text-white hover:bg-brand-orange-strong hover:text-white' : ''}`} aria-current={item === current ? 'page' : undefined} onClick={() => onChange(item)}>{item}</Button>)}
      <Button size="icon" variant="outline" className="h-10 w-10 rounded-lg" disabled={current >= totalPages} onClick={() => onChange(current + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></Button>
    </nav>
  </footer>
}

export default function OrdersManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const { locale, currencyCode, companyName, companyLogoUrl } = useSystemSettings()
  const canCreate = hasPermission('orders.create')
  const canSell = hasPermission('sales.create')
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const deferredSearch = useDeferredValue(filters.search.trim())
  const [sort, setSort] = useState<'created_desc' | 'created_asc' | 'total_desc' | 'total_asc'>('created_desc')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const pageSize = 10

  const customersQuery = useQuery({
    queryKey: ['order-filter-customers'],
    queryFn: () => fetchSuppliers({ party_type: 'CUSTOMER', page: 1, pageSize: 100 }),
    staleTime: 60_000,
  })
  const ordersQuery = useQuery({
    queryKey: ['orders', filters, deferredSearch, sort, page],
    queryFn: () => fetchOrders({
      page,
      pageSize,
      search: deferredSearch || undefined,
      customerContactId: filters.customerId === 'all' ? undefined : filters.customerId,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      preparationStatus: filters.preparation === 'all' ? undefined : filters.preparation,
      deliveryStatus: filters.delivery === 'all' ? undefined : filters.delivery,
      sort,
    }),
    enabled: !deferredSearch || isCommercialDocSearchReady(deferredSearch),
  })

  const data = ordersQuery.data
  const orders = data?.items ?? []
  const summary = data?.summary ?? {}
  const currentPage = data?.page ?? page
  const totalPages = data?.totalPages ?? 1
  const totalItems = data?.totalItems ?? 0
  const fmt = (value: number | string | null | undefined) => formatMoney(num(value), locale, currencyCode)
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  const hasFilters = Object.entries(draftFilters).some(([key, value]) => key === 'customerId' || key === 'preparation' || key === 'delivery' ? value !== 'all' : Boolean(value))

  const applyFilters = () => { setFilters(draftFilters); setPage(1) }
  const clearFilters = () => { setDraftFilters(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(1) }
  const downloadCsv = () => {
    const rows = [['Pedido', 'Cliente', 'Fecha', 'Total', 'Preparación', 'Entrega'], ...orders.map((order) => {
      const visual = orderVisualState(order.status)
      return [order.reference ?? order.id, order.customer || order.customerContact?.name || '', formatDate(order.created_at), String(order.total), visual.preparation, visual.delivery]
    })]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'pedidos.csv'; anchor.click(); URL.revokeObjectURL(url)
  }
  const downloadPdf = async (order: Order) => {
    try {
      setExportingId(order.id)
      const [detail, { generateOrderPDF }, logoDataUrl] = await Promise.all([
        fetchOrderById(order.id),
        import('../documents/generateOrderPDF'),
        resolvePdfLogoDataUrl(companyLogoUrl),
      ])
      generateOrderPDF(detail, { companyName, logoDataUrl, locale, currencyCode })
    } catch (error) {
      toast({ title: 'No se pudo generar el pedido', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setExportingId(null)
    }
  }

  return <div className="min-h-full bg-brand-surface/70 dark:bg-brand-navy">
    <div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-orange">Ventas</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-brand-navy dark:text-white sm:text-4xl">Pedidos</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">Gestiona y da seguimiento a todos tus pedidos.</p></div>
        {canCreate ? <Button size="lg" className="h-12 rounded-xl bg-brand-orange px-6 text-white shadow-lg shadow-orange-500/20 hover:bg-brand-orange-strong" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-5 w-5" />Nuevo pedido</Button> : null}
      </header>

      <section className="grid grid-cols-3 gap-3 min-[650px]:hidden">
        <Card className="rounded-2xl"><CardContent className="p-4"><ClockCardIcon icon={<FileText />} tone="orange" /><strong className="mt-3 block text-2xl">{(summary.DRAFT ?? 0) + (summary.EXPIRED ?? 0)}</strong><span className="text-sm text-muted-foreground">Pendientes</span></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><ClockCardIcon icon={<Settings2 />} tone="blue" /><strong className="mt-3 block text-2xl">{(summary.CONFIRMED ?? 0) + (summary.PARTIALLY_FULFILLED ?? 0)}</strong><span className="text-sm text-muted-foreground">En preparación</span></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4"><ClockCardIcon icon={<CheckCircle2 />} tone="green" /><strong className="mt-3 block text-2xl">{summary.FULFILLED ?? 0}</strong><span className="text-sm text-muted-foreground">Entregados</span></CardContent></Card>
      </section>

      <section className="flex flex-nowrap items-end gap-3 overflow-x-auto rounded-2xl border border-border/70 bg-card p-4 shadow-sm dark:bg-[#101f34]">
        <div className="min-w-[250px] flex-[2_1_360px]"><label className="mb-2 block text-xs font-semibold">Buscar</label><div className="relative"><Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" /><Input className="h-12 rounded-xl pl-10" placeholder="Número de pedido, cliente…" value={draftFilters.search} onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))} /></div></div>
        <div className="min-w-[180px] flex-1"><label className="mb-2 block text-xs font-semibold">Cliente</label><Select value={draftFilters.customerId} onValueChange={(value) => setDraftFilters((current) => ({ ...current, customerId: value }))}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los clientes</SelectItem>{(customersQuery.data?.items ?? []).map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-[145px]"><label className="mb-2 block text-xs font-semibold">Fecha desde</label><Input type="date" className="h-12 rounded-xl" value={draftFilters.dateFrom} onChange={(event) => setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></div>
        <div className="min-w-[145px]"><label className="mb-2 block text-xs font-semibold">Fecha hasta</label><Input type="date" className="h-12 rounded-xl" value={draftFilters.dateTo} onChange={(event) => setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))} /></div>
        <div className="min-w-[170px]"><label className="mb-2 block text-xs font-semibold">Estado prep.</label><Select value={draftFilters.preparation} onValueChange={(value) => setDraftFilters((current) => ({ ...current, preparation: value }))}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="pending">Pendiente</SelectItem><SelectItem value="preparing">En preparación</SelectItem><SelectItem value="ready">Listo</SelectItem><SelectItem value="delayed">Retrasado</SelectItem><SelectItem value="cancelled">Cancelado</SelectItem></SelectContent></Select></div>
        <div className="min-w-[165px]"><label className="mb-2 block text-xs font-semibold">Estado entrega</label><Select value={draftFilters.delivery} onValueChange={(value) => setDraftFilters((current) => ({ ...current, delivery: value }))}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="pending">Pendiente</SelectItem><SelectItem value="transit">En tránsito</SelectItem><SelectItem value="delivered">Entregado</SelectItem><SelectItem value="cancelled">Cancelado</SelectItem></SelectContent></Select></div>
        <Button variant="outline" className="h-12 min-w-[125px] rounded-xl border-brand-orange text-brand-orange" disabled={!hasFilters && !Object.values(filters).some(Boolean)} onClick={clearFilters}>Limpiar filtros</Button>
        <Button className="h-12 min-w-[115px] rounded-xl bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={applyFilters}><Filter className="mr-2 h-4 w-4" />Aplicar</Button>
      </section>
      {commercialDocSearchHint(draftFilters.search) ? <p className="text-xs text-muted-foreground">{commercialDocSearchHint(draftFilters.search)}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm dark:bg-[#101f34]">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl font-bold">Pedidos ({totalItems})</h2><div className="flex items-center gap-2"><span className="hidden text-sm text-muted-foreground sm:inline">Ordenar por</span><Select value={sort} onValueChange={(value) => { setSort(value as typeof sort); setPage(1) }}><SelectTrigger className="h-11 w-[220px] rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="created_desc">Fecha (más reciente)</SelectItem><SelectItem value="created_asc">Fecha (más antigua)</SelectItem><SelectItem value="total_desc">Total (mayor)</SelectItem><SelectItem value="total_asc">Total (menor)</SelectItem></SelectContent></Select><Button variant="outline" className="h-11 rounded-xl" onClick={downloadCsv} disabled={!orders.length}><Download className="mr-2 h-4 w-4" />Exportar</Button></div></div>

        {ordersQuery.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 rounded-xl" />)}</div>
          : ordersQuery.isError ? <div className="p-12 text-center"><p className="font-semibold text-destructive">No se pudieron cargar los pedidos.</p><Button className="mt-4" onClick={() => ordersQuery.refetch()}>Reintentar</Button></div>
            : !orders.length ? <div className="p-16 text-center"><PackageCheck className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 font-semibold">No encontramos pedidos</p><p className="mt-1 text-sm text-muted-foreground">Cambia los filtros o crea un pedido nuevo.</p></div>
              : <>
                <div className="hidden overflow-x-auto min-[650px]:block"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-muted/60 text-left text-xs font-semibold uppercase text-muted-foreground dark:bg-white/5"><tr><th className="px-5 py-4"># Pedido</th><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Estado de preparación</th><th className="px-5 py-4">Estado de entrega</th><th className="px-5 py-4 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-border/70">{orders.map((order) => { const visual = orderVisualState(order.status); return <tr key={order.id} className="hover:bg-muted/35"><td className="px-5 py-4 font-semibold">{order.reference ?? order.id.slice(0, 8)}</td><td className="max-w-[220px] truncate px-5 py-4">{order.customer || order.customerContact?.name || '—'}</td><td className="whitespace-nowrap px-5 py-4">{formatDate(order.created_at)}</td><td className="whitespace-nowrap px-5 py-4 font-medium">{fmt(order.total)}</td><td className="px-5 py-4"><PreparationBadge state={visual.preparation} /></td><td className="px-5 py-4"><DeliveryBadge state={visual.delivery} /></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button size="icon" variant="ghost" className="rounded-lg" aria-label={`Ver ${order.reference}`} onClick={() => navigate(`/pedidos/${order.id}`)}><Eye className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="rounded-lg" aria-label={`Descargar ${order.reference}`} disabled={exportingId === order.id} onClick={() => void downloadPdf(order)}>{exportingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="rounded-lg" aria-label={`Más acciones ${order.reference}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => navigate(`/pedidos/${order.id}`)}><Eye className="mr-2 h-4 w-4" />Ver detalle</DropdownMenuItem><DropdownMenuItem onClick={() => void downloadPdf(order)}><Download className="mr-2 h-4 w-4" />Descargar PDF</DropdownMenuItem>{canSell && ['CONFIRMED', 'PARTIALLY_FULFILLED'].includes(order.status) ? <DropdownMenuItem onClick={() => navigate(`/ventas/nueva?pedido=${encodeURIComponent(order.reference ?? order.id)}`)}><PackageCheck className="mr-2 h-4 w-4" />Abrir en POS</DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu></div></td></tr> })}</tbody></table></div>
                <div className="space-y-3 p-4 min-[650px]:hidden">{orders.map((order) => <button key={order.id} type="button" className="w-full rounded-2xl border border-border/70 bg-card p-4 text-left" onClick={() => navigate(`/pedidos/${order.id}`)}><div className="flex items-start justify-between gap-3"><div><strong className="text-lg">{order.reference ?? order.id.slice(0, 8)}</strong><p className="mt-1 text-sm text-muted-foreground">{order.customer || order.customerContact?.name || '—'}</p></div><strong className="whitespace-nowrap text-lg">{fmt(order.total)}</strong></div><div className="mt-4 flex items-end justify-between"><span className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />{formatDate(order.created_at)}</span><span className="text-right"><OrderStatusBadge status={order.status} /><span className="mt-2 flex items-center justify-end gap-1 font-semibold text-brand-orange">Ver detalle<ChevronRight className="h-4 w-4" /></span></span></div></button>)}</div>
                <Pagination current={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={data?.pageSize ?? pageSize} count={orders.length} onChange={setPage} />
              </>}
      </section>
    </div>
    <OrderCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(order) => { void queryClient.invalidateQueries({ queryKey: ['orders'] }); navigate(`/pedidos/${order.id}`) }} />
  </div>
}

function ClockCardIcon({ icon, tone }: { icon: React.ReactNode; tone: 'orange' | 'blue' | 'green' }) {
  const style = tone === 'orange' ? 'bg-orange-500/15 text-brand-orange' : tone === 'blue' ? 'bg-blue-500/15 text-blue-600' : 'bg-emerald-500/15 text-emerald-600'
  return <span className={`flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5 ${style}`}>{icon}</span>
}
