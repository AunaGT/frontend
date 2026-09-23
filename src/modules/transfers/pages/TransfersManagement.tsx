import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    AlertTriangle,
    ArrowRight,
    Building2,
    Check,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    FileText,
    Filter,
    LayoutGrid,
    Loader2,
    MoreHorizontal,
    Package,
    PackageCheck,
    Plus,
    Search,
    Table2,
    Truck,
    X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useTenant } from '@/context/useTenant'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    cancelTransfer,
    createTransfer,
    fetchTransfers,
    receiveTransfer,
    type Transfer,
    type TransferStatus,
} from '@/services/tenantService'
import { fetchProducts } from '@/services/productService'
import { fetchWarehouses } from '@/services/warehouseService'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { initialTransferView, transferPaginationItems, visibleTransferViews, type TransferView } from '../transferViewModel'

const STATUS_LABEL: Record<TransferStatus, string> = {
    EN_TRANSITO: 'En tránsito',
    RECIBIDA: 'Completada',
    CANCELADA: 'Cancelada',
}

const STATUS_STYLE: Record<TransferStatus, string> = {
    EN_TRANSITO: 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300',
    RECIBIDA: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300',
    CANCELADA: 'bg-red-500/15 text-red-700 dark:bg-red-500/25 dark:text-red-300',
}

type Draft = { product_id: string; name: string; qty: number }
type StatusFilter = 'all' | TransferStatus

const totalUnits = (transfer: Transfer) => transfer.lines.reduce((sum, line) => sum + line.qty_sent, 0)
const dateTime = (value: string) => new Intl.DateTimeFormat('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))
const transferDate = (value: string) => new Intl.DateTimeFormat('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(value))
const transferTime = (value: string) => new Intl.DateTimeFormat('es-GT', {
    hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

function StatusBadge({ status }: { status: TransferStatus }) {
    return (
        <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
            <i className="h-2.5 w-2.5 rounded-full bg-current" />{STATUS_LABEL[status]}
        </span>
    )
}

function ProductThumb({ transfer }: { transfer: Transfer }) {
    const imageUrl = transfer.lines[0]?.product?.image_url
    return (
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-orange/15 text-brand-orange">
            <Package className="h-5 w-5" />
            {imageUrl ? <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : null}
        </span>
    )
}

function TransferPagination({ current, totalPages, totalItems, pageSize, count, onChange }: {
    current: number
    totalPages: number
    totalItems: number
    pageSize: number
    count: number
    onChange: (page: number) => void
}) {
    const start = totalItems ? (current - 1) * pageSize + 1 : 0
    const end = start + count - 1
    return (
        <footer className="flex flex-col gap-3 border-t border-border/70 px-5 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Mostrando {start} a {end} de {totalItems} traslados</span>
            <nav className="flex items-center gap-2" aria-label="Paginación de traslados">
                <Button size="icon" variant="outline" className="h-10 w-10 rounded-lg" disabled={current <= 1} onClick={() => onChange(current - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
                {transferPaginationItems(current, totalPages).map((item, index) => item === 'ellipsis'
                    ? <span key={`ellipsis-${index}`} className="flex h-10 w-8 items-center justify-center">…</span>
                    : <Button key={item} size="icon" variant="outline" className={`h-10 w-10 rounded-lg ${item === current ? 'border-brand-orange bg-brand-orange text-white hover:bg-brand-orange-strong hover:text-white' : ''}`} aria-current={item === current ? 'page' : undefined} onClick={() => onChange(item)}>{item}</Button>)}
                <Button size="icon" variant="outline" className="h-10 w-10 rounded-lg" disabled={current >= totalPages} onClick={() => onChange(current + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></Button>
            </nav>
        </footer>
    )
}

function EmptyState({ filtered, onCreate }: { filtered: boolean; onCreate?: () => void }) {
    return (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center dark:bg-[#101f34]/70">
            <Truck className="mx-auto h-11 w-11 text-muted-foreground/60" />
            <h2 className="mt-4 text-lg font-semibold">{filtered ? 'No encontramos traslados' : 'Aún no hay traslados'}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{filtered ? 'Prueba cambiando o limpiando los filtros.' : 'Crea el primero para mover inventario entre sucursales.'}</p>
            {!filtered && onCreate ? <Button className="mt-5 bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={onCreate}><Plus className="mr-2 h-4 w-4" />Nuevo traslado</Button> : null}
        </div>
    )
}

export const TransfersManagement = () => {
    const { toast } = useToast()
    const { companyName, companyLogoUrl, locale } = useSystemSettings()
    const queryClient = useQueryClient()
    const { branch, branches } = useTenant()
    const { hasPermission } = useAuthPermissions()
    const canCreate = hasPermission('transfers.create')
    const canReceive = hasPermission('transfers.receive')
    const canCancel = hasPermission('transfers.cancel')

    const [status, setStatus] = useState<StatusFilter>('all')
    const [view, setView] = useState<TransferView>(() => initialTransferView(typeof window === 'undefined' ? 1024 : window.innerWidth))
    const [origin, setOrigin] = useState('all')
    const [destination, setDestination] = useState('all')
    const [search, setSearch] = useState('')
    const deferredSearch = useDeferredValue(search.trim())
    const [page, setPage] = useState(1)
    const [createOpen, setCreateOpen] = useState(false)
    const [selected, setSelected] = useState<Transfer | null>(null)
    const [receiving, setReceiving] = useState<Transfer | null>(null)
    const [cancelling, setCancelling] = useState<Transfer | null>(null)
    const [toBranchId, setToBranchId] = useState('')
    const [notes, setNotes] = useState('')
    const [draft, setDraft] = useState<Draft[]>([])
    const [productSearch, setProductSearch] = useState('')
    const [receivedQty, setReceivedQty] = useState<Record<string, string>>({})
    const [receiveLocation, setReceiveLocation] = useState('default')
    const [exportingId, setExportingId] = useState<string | null>(null)

    const transferQuery = useQuery({
        queryKey: ['transfers', status, origin, destination, deferredSearch, page, branch?.id],
        queryFn: () => fetchTransfers({
            direction: 'all',
            status: status === 'all' ? undefined : status,
            search: deferredSearch || undefined,
            fromBranchId: origin === 'all' ? undefined : origin,
            toBranchId: destination === 'all' ? undefined : destination,
            page,
            pageSize: 10,
        }),
    })
    const productsQuery = useQuery({
        queryKey: ['transfer-products', productSearch],
        queryFn: () => fetchProducts({ search: productSearch, pageSize: 20 }),
        enabled: createOpen && productSearch.trim().length > 0,
    })
    const warehousesQuery = useQuery({
        queryKey: ['warehouses', branch?.id],
        queryFn: () => fetchWarehouses(),
        enabled: receiving != null,
    })

    const receiveLocations = useMemo(
        () => (warehousesQuery.data ?? []).flatMap((warehouse) => warehouse.locations.map((location) => ({ ...location, warehouse: warehouse.name }))),
        [warehousesQuery.data],
    )
    const otherBranches = useMemo(
        () => branches.filter((item) => item.id !== branch?.id && item.active !== false),
        [branches, branch],
    )

    const invalidate = () => {
        for (const key of ['transfers', 'products', 'warehouses', 'stock-by-location', 'stock-replenishment', 'stock-moves', 'analytics']) {
            void queryClient.invalidateQueries({ queryKey: [key] })
        }
    }
    const createMutation = useMutation({
        mutationFn: createTransfer,
        onSuccess: (transfer) => {
            toast({ title: `Traslado ${transfer.reference} enviado`, description: 'El stock salió de esta sucursal.' })
            setCreateOpen(false); setDraft([]); setToBranchId(''); setNotes(''); setProductSearch(''); invalidate()
        },
        onError: (error: Error) => toast({ title: 'No se pudo enviar', description: error.message, variant: 'destructive' }),
    })
    const receiveMutation = useMutation({
        mutationFn: ({ id, lines, locationId }: { id: string; lines: { line_id: string; qty_received: number }[]; locationId?: string }) => receiveTransfer(id, lines, locationId),
        onSuccess: (transfer) => {
            toast({ title: `Traslado ${transfer.reference} recibido` })
            setReceiving(null); setSelected(null); setReceivedQty({}); setReceiveLocation('default'); invalidate()
        },
        onError: (error: Error) => toast({ title: 'No se pudo recibir', description: error.message, variant: 'destructive' }),
    })
    const cancelMutation = useMutation({
        mutationFn: cancelTransfer,
        onSuccess: (transfer) => {
            toast({ title: `Traslado ${transfer.reference} cancelado`, description: 'El stock volvió al origen.' })
            setCancelling(null); setSelected(null); invalidate()
        },
        onError: (error: Error) => toast({ title: 'No se pudo cancelar', description: error.message, variant: 'destructive' }),
    })

    const resetPage = <T,>(setter: (value: T) => void, value: T) => { setter(value); setPage(1) }
    const clearFilters = () => { setStatus('all'); setOrigin('all'); setDestination('all'); setSearch(''); setPage(1) }
    const hasFilters = status !== 'all' || origin !== 'all' || destination !== 'all' || Boolean(search)
    const visibleViews = visibleTransferViews(view)
    const openReceive = (transfer: Transfer) => { setSelected(null); setReceiving(transfer); setReceivedQty({}) }
    const addProduct = (id: string, name: string) => setDraft((rows) => rows.some((row) => row.product_id === id) ? rows : [...rows, { product_id: id, name, qty: 1 }])

    const submitCreate = () => {
        if (!toBranchId) return toast({ title: 'Elige la sucursal destino', variant: 'destructive' })
        const items = draft.filter((row) => row.qty > 0).map((row) => ({ product_id: row.product_id, qty: row.qty }))
        if (!items.length) return toast({ title: 'Agrega al menos un producto', variant: 'destructive' })
        createMutation.mutate({ to_branch_id: toBranchId, items, notes: notes.trim() || undefined })
    }
    const submitReceive = () => {
        if (!receiving) return
        const lines = receiving.lines.map((line) => ({ line_id: line.id, qty_received: receivedQty[line.id] === undefined ? line.qty_sent : Number(receivedQty[line.id]) }))
        if (lines.some((line) => !Number.isInteger(line.qty_received) || line.qty_received < 0)) {
            return toast({ title: 'Cantidades inválidas', description: 'Usa enteros mayores o iguales a 0.', variant: 'destructive' })
        }
        receiveMutation.mutate({ id: receiving.id, lines, locationId: receiveLocation === 'default' ? undefined : receiveLocation })
    }

    const downloadTransfer = async (transfer: Transfer) => {
        try {
            setExportingId(transfer.id)
            const [{ generateTransferPDF }, logoDataUrl] = await Promise.all([
                import('../documents/generateTransferPDF'),
                resolvePdfLogoDataUrl(companyLogoUrl),
            ])
            generateTransferPDF(transfer, { companyName, logoDataUrl, locale })
        } catch (error) {
            toast({ title: 'No se pudo generar el comprobante', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
        } finally {
            setExportingId(null)
        }
    }

    const transfers = transferQuery.data?.items ?? []
    const totalItems = transferQuery.data?.totalItems ?? 0
    const totalPages = transferQuery.data?.totalPages ?? 1
    const currentPage = transferQuery.data?.page ?? page
    const pageSize = transferQuery.data?.pageSize ?? 10

    return (
        <div className="min-h-full bg-brand-surface/70 dark:bg-brand-navy">
            <div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-orange">Inventario</p>
                        <h1 className="mt-1 text-3xl font-bold tracking-tight text-brand-navy dark:text-white sm:text-4xl">Traslados</h1>
                        <p className="mt-1 text-sm text-muted-foreground sm:text-base">Gestiona movimientos de productos entre sucursales y almacenes.</p>
                    </div>
                    <div className="flex items-center gap-2 self-stretch sm:self-auto">
                        <div className="flex h-12 rounded-xl border border-border/70 bg-card p-1 shadow-sm dark:bg-[#101f34]" aria-label="Tipo de vista">
                            <Button type="button" variant="ghost" className={`h-10 rounded-lg px-3 ${view === 'table' ? 'bg-brand-orange text-white hover:bg-brand-orange-strong hover:text-white' : ''}`} aria-label="Vista de tabla" aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 className="h-4 w-4" /><span className="ml-2 hidden lg:inline">Tabla</span></Button>
                            <Button type="button" variant="ghost" className={`h-10 rounded-lg px-3 ${view === 'cards' ? 'bg-brand-orange text-white hover:bg-brand-orange-strong hover:text-white' : ''}`} aria-label="Vista de cuadros" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><LayoutGrid className="h-4 w-4" /><span className="ml-2 hidden lg:inline">Cuadros</span></Button>
                        </div>
                        {canCreate && branch ? (
                            <Button size="lg" className="h-12 flex-1 rounded-xl bg-brand-orange px-6 text-white shadow-lg shadow-orange-500/20 hover:bg-brand-orange-strong sm:flex-none" onClick={() => setCreateOpen(true)}>
                                <Plus className="mr-2 h-5 w-5" />Nuevo traslado
                            </Button>
                        ) : null}
                    </div>
                </header>

                <section className="flex flex-nowrap items-center gap-3 overflow-x-auto rounded-2xl border border-border/70 bg-card p-3 shadow-sm dark:bg-[#101f34]">
                    <div className="relative min-w-[320px] flex-[2_1_480px]">
                        <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                        <Input className="h-12 rounded-xl pl-10" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Buscar por folio, producto, origen o destino…" />
                    </div>
                    <div className="min-w-[180px] flex-1"><Select value={origin} onValueChange={(value) => resetPage(setOrigin, value)}><SelectTrigger className="h-12 w-full rounded-xl"><SelectValue placeholder="Origen" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los orígenes</SelectItem>{branches.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="min-w-[180px] flex-1"><Select value={destination} onValueChange={(value) => resetPage(setDestination, value)}><SelectTrigger className="h-12 w-full rounded-xl"><SelectValue placeholder="Destino" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los destinos</SelectItem>{branches.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="min-w-[170px] flex-1"><Select value={status} onValueChange={(value) => resetPage(setStatus, value as StatusFilter)}><SelectTrigger className="h-12 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="EN_TRANSITO">En tránsito</SelectItem><SelectItem value="RECIBIDA">Recibidos</SelectItem><SelectItem value="CANCELADA">Cancelados</SelectItem></SelectContent></Select></div>
                    <Button variant="outline" className="h-12 min-w-[112px] shrink-0 rounded-xl" onClick={clearFilters} disabled={!hasFilters}><Filter className="mr-2 h-4 w-4" />Limpiar</Button>
                </section>

                {transferQuery.isError ? (
                    <Card className="rounded-2xl border-red-500/30 bg-card dark:bg-[#101f34]"><CardContent className="flex flex-col items-center gap-3 p-12 text-center"><AlertTriangle className="h-9 w-9 text-red-500" /><p className="font-semibold">No pudimos cargar los traslados</p><Button onClick={() => transferQuery.refetch()}>Reintentar</Button></CardContent></Card>
                ) : transferQuery.isLoading ? (
                    <div className="space-y-3">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24 w-full rounded-2xl" />)}</div>
                ) : !transfers.length ? (
                    <EmptyState filtered={hasFilters} onCreate={canCreate && branch ? () => setCreateOpen(true) : undefined} />
                ) : (
                    <>
                        {visibleViews.table ? <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm dark:bg-[#101f34]">
                            <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm">
                                <thead className="bg-muted/60 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/5"><tr><th className="px-5 py-4">Folio</th><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Origen</th><th className="w-8 px-1 py-4" aria-label="Dirección" /><th className="px-5 py-4">Destino</th><th className="px-5 py-4">Productos</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Acciones</th></tr></thead>
                                <tbody className="divide-y divide-border/70">
                                    {transfers.map((transfer) => {
                                        const incoming = transfer.to_branch_id === branch?.id
                                        return <tr key={transfer.id} className="transition hover:bg-muted/35">
                                            <td className="px-5 py-4"><button className="font-semibold text-brand-navy hover:text-brand-orange dark:text-white" onClick={() => setSelected(transfer)}>{transfer.reference}</button></td>
                                            <td className="whitespace-nowrap px-5 py-4"><p className="font-medium">{transferDate(transfer.sent_at)}</p><p className="mt-1 text-xs text-muted-foreground">{transferTime(transfer.sent_at)}</p></td>
                                            <td className="px-5 py-4 font-medium">{transfer.fromBranch?.name ?? '—'}</td>
                                            <td className="px-1 py-4"><ArrowRight className="h-4 w-4 text-muted-foreground" /></td>
                                            <td className="px-5 py-4 font-medium">{transfer.toBranch?.name ?? '—'}</td>
                                            <td className="px-5 py-4"><div className="flex items-center gap-3"><ProductThumb transfer={transfer} /><span><strong className="font-medium">{transfer.lines.length} productos</strong><small className="block text-muted-foreground">{totalUnits(transfer)} unidades</small></span></div></td>
                                            <td className="px-5 py-4"><StatusBadge status={transfer.status} /></td>
                                            <td className="px-5 py-4"><div className="flex justify-end gap-2">
                                                <Button size="icon" variant="outline" className="rounded-lg" aria-label={`Ver ${transfer.reference}`} onClick={() => setSelected(transfer)}><Eye className="h-4 w-4" /></Button>
                                                <Button size="icon" variant="outline" className="rounded-lg" aria-label={`Descargar comprobante ${transfer.reference}`} disabled={exportingId === transfer.id} onClick={() => void downloadTransfer(transfer)}>{exportingId === transfer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}</Button>
                                                <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="outline" className="rounded-lg" aria-label={`Más acciones para ${transfer.reference}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setSelected(transfer)}><Eye className="mr-2 h-4 w-4" />Ver detalle</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => void downloadTransfer(transfer)}><Download className="mr-2 h-4 w-4" />Descargar PDF</DropdownMenuItem>
                                                    {transfer.status === 'EN_TRANSITO' && incoming && canReceive ? <DropdownMenuItem onClick={() => openReceive(transfer)}><PackageCheck className="mr-2 h-4 w-4" />Recibir traslado</DropdownMenuItem> : null}
                                                    {transfer.status === 'EN_TRANSITO' && !incoming && canCancel ? <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setCancelling(transfer)}><X className="mr-2 h-4 w-4" />Cancelar traslado</DropdownMenuItem> : null}
                                                </DropdownMenuContent></DropdownMenu>
                                            </div></td>
                                        </tr>
                                    })}
                                </tbody>
                            </table></div>
                            <TransferPagination current={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} count={transfers.length} onChange={setPage} />
                        </div> : null}

                        {visibleViews.cards ? <div className="grid gap-4 lg:grid-cols-2">
                            {transfers.map((transfer) => (
                                <button key={transfer.id} type="button" className="w-full rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition active:scale-[0.99] dark:bg-[#101f34]" onClick={() => setSelected(transfer)}>
                                    <div className="flex items-start justify-between gap-3"><div><strong className="text-lg">{transfer.reference}</strong><p className="text-xs text-muted-foreground">{dateTime(transfer.sent_at)}</p></div><StatusBadge status={transfer.status} /></div>
                                    <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="flex min-w-0 gap-2"><Building2 className="h-5 w-5 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{transfer.fromBranch?.name}</p><p className="text-xs text-muted-foreground">Origen</p></div></div><ArrowRight className="h-5 w-5 text-muted-foreground" /><div className="flex min-w-0 gap-2"><Building2 className="h-5 w-5 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{transfer.toBranch?.name}</p><p className="text-xs text-muted-foreground">Destino</p></div></div></div>
                                    <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3"><span className="flex items-center gap-2 text-sm"><Package className="h-5 w-5 text-muted-foreground" /><span><strong>{transfer.lines.length} productos</strong><small className="block text-muted-foreground">{totalUnits(transfer)} unidades</small></span></span><ChevronRight className="h-5 w-5 text-muted-foreground" /></div>
                                </button>
                            ))}
                        </div> : null}

                        {visibleViews.cards ? <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm dark:bg-[#101f34]"><TransferPagination current={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} count={transfers.length} onChange={setPage} /></div> : null}
                    </>
                )}
            </div>

            <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
                    <DialogHeader><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange"><Truck className="h-5 w-5" /></span><div><DialogTitle>{selected?.reference}</DialogTitle><DialogDescription>{selected ? dateTime(selected.sent_at) : ''}</DialogDescription></div></div></DialogHeader>
                    {selected ? <div className="space-y-5"><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-muted/50 p-4"><div><p className="text-xs text-muted-foreground">Origen</p><p className="font-semibold">{selected.fromBranch?.name}</p></div><ArrowRight className="h-5 w-5 text-brand-orange" /><div><p className="text-xs text-muted-foreground">Destino</p><p className="font-semibold">{selected.toBranch?.name}</p></div></div><div className="flex items-center justify-between"><StatusBadge status={selected.status} /><span className="text-sm text-muted-foreground">{totalUnits(selected)} unidades</span></div><div className="overflow-hidden rounded-xl border border-border/70"><div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-muted/50 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground"><span>Producto</span><span>Enviado</span><span>Recibido</span></div>{selected.lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_auto_auto] gap-6 border-t border-border/70 px-4 py-3 text-sm"><span className="truncate">{line.product?.name ?? line.product_id}</span><strong>{line.qty_sent}</strong><span className="min-w-14 text-right">{line.qty_received ?? '—'}</span></div>)}</div>{selected.notes ? <div className="rounded-xl border border-border/70 p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Notas</p><p className="mt-1 text-sm">{selected.notes}</p></div> : null}</div> : null}
                    <DialogFooter>{selected?.status === 'EN_TRANSITO' && selected.to_branch_id === branch?.id && canReceive ? <Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={() => openReceive(selected)}><PackageCheck className="mr-2 h-4 w-4" />Recibir traslado</Button> : null}{selected?.status === 'EN_TRANSITO' && selected.from_branch_id === branch?.id && canCancel ? <Button variant="outline" className="text-red-500" onClick={() => setCancelling(selected)}><X className="mr-2 h-4 w-4" />Cancelar traslado</Button> : null}</DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
                    <DialogHeader><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange text-white"><Plus className="h-5 w-5" /></span><div><DialogTitle>Nuevo traslado</DialogTitle><DialogDescription>El stock sale de {branch?.name} al enviar y entra cuando el destino confirma la recepción.</DialogDescription></div></div></DialogHeader>
                    <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]"><div className="rounded-xl border border-border/70 p-3"><Label className="text-xs text-muted-foreground">Origen</Label><p className="mt-1 font-semibold">{branch?.name}</p></div><ArrowRight className="hidden self-center text-brand-orange sm:block" /><div><Label>Sucursal destino</Label><Select value={toBranchId} onValueChange={setToBranchId}><SelectTrigger className="mt-2 h-12 rounded-xl"><SelectValue placeholder="Elige una sucursal" /></SelectTrigger><SelectContent>{otherBranches.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div></div><div><Label htmlFor="transfer-search">Agregar productos</Label><div className="relative mt-2"><Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" /><Input id="transfer-search" className="h-12 rounded-xl pl-10" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nombre o código de barras" /></div>{productSearch ? <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-border/70">{productsQuery.isLoading ? <div className="p-4 text-sm text-muted-foreground">Buscando…</div> : (productsQuery.data?.items ?? []).map((product) => <button key={product.id} type="button" className="flex w-full items-center justify-between border-b border-border/60 px-4 py-3 text-left text-sm last:border-0 hover:bg-muted" onClick={() => addProduct(String(product.id), product.name)}><span>{product.name}</span><span className="text-muted-foreground">Stock: {product.stock ?? 0}</span></button>)}</div> : null}</div>{draft.length ? <div className="overflow-hidden rounded-xl border border-border/70"><div className="grid grid-cols-[1fr_90px_40px] bg-muted/50 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground"><span>Producto</span><span>Cantidad</span><span /></div>{draft.map((row) => <div key={row.product_id} className="grid grid-cols-[1fr_90px_40px] items-center gap-2 border-t border-border/70 px-4 py-3"><span className="truncate text-sm font-medium">{row.name}</span><Input type="number" min={1} value={row.qty} onChange={(event) => setDraft((items) => items.map((item) => item.product_id === row.product_id ? { ...item, qty: Number(event.target.value) } : item))} /><Button size="icon" variant="ghost" onClick={() => setDraft((items) => items.filter((item) => item.product_id !== row.product_id))}><X className="h-4 w-4" /></Button></div>)}</div> : null}<div><Label htmlFor="transfer-notes">Notas</Label><Input id="transfer-notes" className="mt-2 h-12 rounded-xl" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" /></div></div>
                    <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cerrar</Button><Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={submitCreate} disabled={createMutation.isPending}>{createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}Enviar traslado</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={receiving != null} onOpenChange={(open) => !open && setReceiving(null)}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
                    <DialogHeader><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600"><PackageCheck className="h-5 w-5" /></span><div><DialogTitle>Recibir {receiving?.reference}</DialogTitle><DialogDescription>Confirma las cantidades que llegaron realmente.</DialogDescription></div></div></DialogHeader>
                    <div className="space-y-4">{receiveLocations.length === 1 ? <p className="rounded-xl bg-muted/50 p-3 text-sm">Entrada: <strong>{receiveLocations[0].warehouse} · {receiveLocations[0].code}</strong></p> : null}{receiveLocations.length > 1 ? <div><Label>Ubicación de recepción</Label><Select value={receiveLocation} onValueChange={setReceiveLocation}><SelectTrigger className="mt-2 h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Ubicación predeterminada</SelectItem>{receiveLocations.map((location) => <SelectItem key={location.id} value={location.id}>{location.warehouse} · {location.code}{location.name ? ` — ${location.name}` : ''}</SelectItem>)}</SelectContent></Select></div> : null}<div className="overflow-hidden rounded-xl border border-border/70"><div className="grid grid-cols-[1fr_80px_100px] bg-muted/50 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground"><span>Producto</span><span>Enviado</span><span>Recibido</span></div>{receiving?.lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_80px_100px] items-center gap-2 border-t border-border/70 px-4 py-3"><span className="truncate text-sm">{line.product?.name ?? line.product_id}</span><strong className="text-center">{line.qty_sent}</strong><Input type="number" min={0} max={line.qty_sent} value={receivedQty[line.id] ?? String(line.qty_sent)} onChange={(event) => setReceivedQty((values) => ({ ...values, [line.id]: event.target.value }))} /></div>)}</div><p className="text-xs text-muted-foreground">Una cantidad menor registra un faltante de tránsito para conciliación.</p></div>
                    <DialogFooter><Button variant="outline" onClick={() => setReceiving(null)}>Cerrar</Button><Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={submitReceive} disabled={receiveMutation.isPending}>{receiveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Confirmar recepción</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={cancelling != null} onOpenChange={(open) => !open && setCancelling(null)}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Cancelar {cancelling?.reference}?</AlertDialogTitle><AlertDialogDescription>El stock enviado regresará a la sucursal de origen. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Conservar traslado</AlertDialogCancel><AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={cancelMutation.isPending} onClick={() => cancelling && cancelMutation.mutate(cancelling.id)}>{cancelMutation.isPending ? 'Cancelando…' : 'Sí, cancelar'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default TransfersManagement
