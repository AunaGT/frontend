/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * SalesStatusTable - Table displaying sales for a specific status
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, FileText, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { Sale, SaleStatus } from '@/types'
import { formatMoney, formatDateTime } from '@/utils'
import { SaleStatusKey, STATUS_LABELS } from '../types'

interface SalesStatusTableProps {
    statusKey: SaleStatusKey
    sales: Sale[]
    pageInfo: { page: number; totalPages: number | null; hasMore: boolean }
    isLoading: boolean
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

const getStatusBadge = (status: SaleStatus) => {
    const badges: Record<string, React.ReactNode> = {
        completed: <Badge className='bg-green-500 text-white'>Completado</Badge>,
        cancelled: <Badge variant='destructive'>Cancelado</Badge>,
    }
    return badges[status] || <Badge variant='outline'>Desconocido</Badge>
}

export const SalesStatusTable = ({
    statusKey,
    sales,
    pageInfo,
    isLoading,
    updatingSaleIds,
    onPageChange,
    canChangeStatus,
    onStatusChange,
    onViewSale,
    onViewInvoice,
    canViewDetail,
    canViewInvoice,
    locale,
    currencyCode
}: SalesStatusTableProps) => {
    return (
        <Card className='animate-slide-up'>
            <CardHeader>
                <CardTitle className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                        {getStatusBadge(statusKey as SaleStatus)}
                        <span>{STATUS_LABELS[statusKey]} ({sales.length})</span>
                    </div>
                    <div className='text-sm text-muted-foreground'>
                        {isLoading
                            ? 'Cargando...'
                            : pageInfo.totalPages != null
                              ? `Página ${pageInfo.page}/${pageInfo.totalPages}`
                              : `Página ${pageInfo.page}${pageInfo.hasMore ? '+' : ''}`}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {sales.length === 0 ? (
                    <div className='text-center py-8 text-muted-foreground'>
                        No hay ventas {STATUS_LABELS[statusKey].toLowerCase()}
                    </div>
                ) : (
                    <div className='overflow-x-auto'>
                        <table className='w-full'>
                            <thead>
                                <tr className='border-b border-border'>
                                    <th className='text-left p-3 font-medium text-muted-foreground'>ID Venta</th>
                                    <th className='text-left p-3 font-medium text-muted-foreground'>Fecha/Hora</th>
                                    <th className='text-left p-3 font-medium text-muted-foreground'>Cliente</th>
                                    <th className='text-center p-3 font-medium text-muted-foreground'>Items</th>
                                    <th className='text-right p-3 font-medium text-muted-foreground'>Total</th>
                                    <th className='p-3 font-medium text-muted-foreground w-[7rem]'>
                                        <div className='flex justify-center'>Pago</div>
                                    </th>
                                    <th className='p-3 font-medium text-muted-foreground w-[8.5rem]'>
                                        <div className='flex justify-center'>Estado</div>
                                    </th>
                                    <th className='text-center p-3 font-medium text-muted-foreground'>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.map((sale, index) => (
                                    <tr
                                        key={sale.id}
                                        className='border-b border-border hover:bg-muted transition-colors animate-slide-up'
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <td className='p-3'>
                                            <div className='flex items-center gap-2'>
                                                <span className='font-medium text-primary'>{sale.reference ?? sale.id}</span>
                                                {sale.hasReturns && (
                                                    <span title='Tiene devoluciones'>
                                                        <AlertTriangle className='w-4 h-4 text-orange-500' />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className='p-3'>
                                            <div className='text-sm text-foreground'>{formatDateTime(sale.date, undefined, locale)}</div>
                                        </td>
                                        <td className='p-3'>
                                            <div className='font-medium text-foreground'>{sale.customer}</div>
                                            <div className='text-xs text-muted-foreground'>
                                                {sale.isFinalConsumer ? 'CF' : sale.customerNit}
                                            </div>
                                        </td>
                                        <td className='p-3 text-center'>
                                            <span className='text-foreground'>{sale.items}</span>
                                        </td>
                                        <td className='p-3 text-right'>
                                            <div className='flex flex-col items-end'>
                                                {sale.hasReturns ? (
                                                    <>
                                                        <span className='font-medium text-green-700'>
                                                            {formatMoney(sale.adjustedTotal || sale.total, locale, currencyCode)}
                                                        </span>
                                                        <span className='text-xs text-muted-foreground line-through'>
                                                            {formatMoney(sale.total, locale, currencyCode)}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className='font-medium text-foreground'>{formatMoney(sale.total, locale, currencyCode)}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className='p-3 w-[7rem]'>
                                            <div className='flex justify-center'>
                                                <Badge variant='outline'>{sale.payment}</Badge>
                                            </div>
                                        </td>
                                        <td className='p-3 w-[8.5rem]'>
                                            <div className='flex justify-center'>
                                                <Select
                                                    value={sale.status}
                                                    onValueChange={(v: SaleStatus) => onStatusChange(sale.reference ?? sale.id, v)}
                                                    disabled={updatingSaleIds.has(sale.reference ?? sale.id) || !canChangeStatus}
                                                >
                                                    <SelectTrigger className='w-32'>
                                                    {updatingSaleIds.has(sale.reference ?? sale.id)
                                                        ? '...'
                                                        : getStatusBadge(sale.status)}
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value='completed'>Completado</SelectItem>
                                                    <SelectItem value='cancelled'>Cancelado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            </div>
                                        </td>
                                        <td className='p-3 text-center'>
                                            <div className='flex justify-center gap-1'>
                                                {canViewDetail && (
                                                    <Button
                                                        variant='ghost'
                                                        size='sm'
                                                        onClick={() => onViewSale(sale)}
                                                        title='Ver detalle'
                                                    >
                                                        <Eye className='w-4 h-4' />
                                                    </Button>
                                                )}
                                                {canViewInvoice && (
                                                    <Button
                                                        variant='ghost'
                                                        size='sm'
                                                        onClick={() => onViewInvoice(sale)}
                                                        title='Ver factura'
                                                    >
                                                        <FileText className='w-4 h-4' />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
            {/* Pagination */}
            <div className='flex justify-end items-center gap-2 p-4'>
                <span className='text-sm text-muted-foreground mr-2'>
                    {pageInfo.totalPages != null
                        ? `Página ${pageInfo.page} de ${pageInfo.totalPages}`
                        : `Página ${pageInfo.page}`}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.max(1, pageInfo.page - 1))}
                    disabled={pageInfo.page <= 1 || isLoading}
                >
                    <ChevronLeft className='w-4 h-4' />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(pageInfo.page + 1)}
                    disabled={
                        isLoading ||
                        (pageInfo.totalPages != null
                            ? pageInfo.page >= pageInfo.totalPages
                            : !pageInfo.hasMore)
                    }
                >
                    <ChevronRight className='w-4 h-4' />
                </Button>
            </div>
        </Card>
    )
}
