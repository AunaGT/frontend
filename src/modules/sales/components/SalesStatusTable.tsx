/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Eye, FileText, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { Sale, SaleStatus } from '@/types'
import { formatMoney, formatDateTime } from '@/utils'
import { SaleStatusKey, STATUS_LABELS } from '../types'
import { LoadingState, LoadingIndicator, TableLoadingRows } from '@/components/shared/LoadingState'
import { Pagination } from '@/components/shared/Pagination'

interface SalesStatusTableProps {
    statusKey?: SaleStatusKey
    viewMode?: 'table' | 'cards'
    sales: Sale[]
    pageSize?: number
    pageInfo: { page: number; totalPages: number | null; hasMore: boolean; totalItems?: number | null }
    isLoading: boolean
    isFetching?: boolean
    error?: string | null
    emptyMessage?: string | null
    onRetry?: () => void
    updatingSaleIds: Set<string>
    onPageChange: (page: number) => void
    canChangeStatus: boolean
    onStatusChange: (saleId: string, newStatus: SaleStatus) => void
    onViewSale: (sale: Sale) => void
    onViewInvoice: (sale: Sale) => void
    canViewDetail: boolean
    canViewInvoice: boolean
    locale?: string
    currencyCode?: string
}

const getStatusBadge = (status: SaleStatus) => <Badge
    variant={status === 'cancelled' ? 'destructive' : 'outline'}
    className={status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : undefined}
>{({ completed: 'Completado', cancelled: 'Cancelado', paid: 'Pagado', pending: 'Pendiente' })[status] ?? 'Desconocido'}</Badge>

export const SalesStatusTable = ({
    statusKey, viewMode = 'table', sales, pageSize = 10, pageInfo, isLoading, isFetching, error, emptyMessage, onRetry,
    updatingSaleIds, onPageChange, canChangeStatus, onStatusChange,
    onViewSale, onViewInvoice, canViewDetail, canViewInvoice, locale, currencyCode
}: SalesStatusTableProps) => {
    const title = statusKey ? `Ventas ${STATUS_LABELS[statusKey].toLowerCase()}` : 'Ventas'
    const initialLoading = isLoading && sales.length === 0
    const busy = isLoading || isFetching
    const total = (sale: Sale) => <div className="flex flex-col items-end tabular-nums">
        <strong className="font-semibold">{formatMoney(sale.adjustedTotal ?? sale.total, locale, currencyCode)}</strong>
        {sale.hasReturns && <span className="text-xs text-muted-foreground line-through">{formatMoney(sale.total, locale, currencyCode)}</span>}
    </div>
    const actions = (sale: Sale) => {
        const reference = sale.reference ?? sale.id
        const updating = updatingSaleIds.has(reference)
        return <div className="flex flex-wrap items-center justify-end gap-1">
            {canViewDetail && <Button type="button" variant="ghost" size="icon" aria-label={`Ver detalle de ${reference}`} title="Ver detalle" onClick={() => onViewSale(sale)}><Eye className="h-4 w-4" aria-hidden="true" /></Button>}
            {canViewInvoice && <Button type="button" variant="ghost" size="icon" aria-label={`Ver factura de ${reference}`} title="Ver factura" onClick={() => onViewInvoice(sale)}><FileText className="h-4 w-4" aria-hidden="true" /></Button>}
            {canChangeStatus && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" disabled={updating} aria-label={`Más acciones de ${reference}`} title="Más acciones"><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                <DropdownMenuItem disabled={updating} onSelect={() => onStatusChange(reference, 'completed')}>Marcar como completado</DropdownMenuItem>
                <DropdownMenuItem disabled={updating} onSelect={() => onStatusChange(reference, 'cancelled')}>Marcar como cancelado</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu>}
        </div>
    }
    const cards = <div className={viewMode === 'table' ? 'p-4 md:hidden' : 'p-4'}>
        {initialLoading ? <LoadingState variant="cards" message="Cargando ventas…" /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{sales.map(sale => <article key={sale.id} className="min-w-0 rounded-lg border border-border bg-card p-4">
            <header className="flex flex-wrap items-center justify-between gap-2"><strong className="break-all text-sm">{sale.reference ?? sale.id}</strong>{getStatusBadge(sale.status)}</header>
            <div className="mt-3"><p className="break-words font-medium">{sale.customer}</p><p className="text-xs text-muted-foreground">NIT: {sale.isFinalConsumer ? 'CF' : sale.customerNit ?? '—'}</p></div>
            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-2"><dt>Fecha</dt><dd className="text-right">{formatDateTime(sale.date, undefined, locale)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Vendedor</dt><dd className="break-words text-right">{sale.createdByName ?? '—'}</dd></div>
                <div className="flex justify-between gap-2"><dt>Pago</dt><dd>{sale.isCredit ? 'A crédito' : sale.payment}</dd></div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3"><span className="text-sm text-muted-foreground">Total neto</span>{total(sale)}</div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{sale.items} artículos</span>{sale.hasReturns && <span>Con devolución</span>}</div>
            <footer className="mt-3 border-t border-border pt-2">{actions(sale)}</footer>
        </article>)}</div>}
    </div>

    return <section className="auna-data-table-shell" aria-label={title} aria-busy={busy || undefined}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{title}{pageInfo.totalItems != null ? ` (${pageInfo.totalItems})` : ''}</h2>
            {isFetching && !initialLoading && <LoadingIndicator message="Actualizando ventas…" />}
        </header>
        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><p className="text-sm text-destructive">{error}</p>{onRetry && <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={busy}>Reintentar</Button>}</div>}
        {viewMode === 'table' && <div className="hidden overflow-x-auto md:block">
            <table className="auna-data-table min-w-[960px]">
                <thead><tr>{['ID Venta', 'Fecha/Hora', 'Cliente', 'Vendedor', 'Pago', 'Total neto', 'Estado', 'Acciones'].map(heading => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
                <tbody>{initialLoading ? <TableLoadingRows columns={8} message="Cargando ventas…" /> : sales.map(sale => <tr key={sale.id}>
                    <td><span className="font-medium">{sale.reference ?? sale.id}</span><div className="text-xs text-muted-foreground">{sale.items} artículos{sale.hasReturns && ' · Con devolución'}</div></td>
                    <td className="whitespace-nowrap">{formatDateTime(sale.date, undefined, locale)}</td>
                    <td><p className="font-medium">{sale.customer}</p><p className="text-xs text-muted-foreground">{sale.isFinalConsumer ? 'CF' : sale.customerNit ?? '—'}</p></td>
                    <td>{sale.createdByName ?? '—'}</td>
                    <td><Badge variant="outline">{sale.isCredit ? 'A crédito' : sale.payment}</Badge></td>
                    <td>{total(sale)}</td>
                    <td>{getStatusBadge(sale.status)}</td>
                    <td>{actions(sale)}</td>
                </tr>)}</tbody>
            </table>
        </div>}
        {(initialLoading || sales.length > 0) && cards}
        {!initialLoading && !error && sales.length === 0 && <div className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyMessage || `No hay ventas${statusKey ? ` ${STATUS_LABELS[statusKey].toLowerCase()}` : ''} para los filtros seleccionados.`}</div>}
        {pageInfo.totalPages != null ? <Pagination currentPage={pageInfo.page} totalPages={Math.max(1, pageInfo.totalPages)} totalItems={pageInfo.totalItems ?? undefined} pageSize={pageSize} count={sales.length} itemLabel="ventas" loading={busy} onPageChange={onPageChange} /> : <footer className="auna-data-table-pagination">
            <span className="text-sm text-muted-foreground">Página {pageInfo.page}</span>
            <nav className="flex items-center gap-2" aria-label="Paginación de ventas">
                <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(pageInfo.page - 1)} disabled={pageInfo.page <= 1 || busy} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(pageInfo.page + 1)} disabled={!pageInfo.hasMore || busy} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
            </nav>
        </footer>}
    </section>
}
