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
 * SalesFilters - Filter bar for sales list
 */
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import { SaleStatus, PaymentMethod } from '@/types'

interface SalesFiltersProps {
    searchTerm: string
    onSearchChange: (value: string) => void
    statusFilter: SaleStatus | 'all'
    onStatusChange: (value: SaleStatus | 'all') => void
    paymentFilter: PaymentMethod | 'all'
    onPaymentChange: (value: PaymentMethod | 'all') => void
    isGlobalSearch?: boolean
    searchHint?: string | null
}

export const SalesFilters = ({
    searchTerm,
    onSearchChange,
    statusFilter,
    onStatusChange,
    paymentFilter,
    onPaymentChange,
    isGlobalSearch = false,
    searchHint = null,
}: SalesFiltersProps) => {
    return (
        <Card>
            <CardContent className='p-4 space-y-2'>
                <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4'>
                    <div className='flex-1 relative min-w-0'>
                        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                        <Input
                            placeholder='Buscar por ID, cliente o ID fiscal...'
                            value={searchTerm}
                            onChange={e => onSearchChange(e.target.value)}
                            className='pl-10'
                        />
                    </div>
                    <div className='flex flex-wrap gap-3 sm:shrink-0'>
                    <div className='w-full sm:w-48'>
                        <Select value={statusFilter} onValueChange={(v: SaleStatus | 'all') => onStatusChange(v)}>
                            <SelectTrigger><SelectValue placeholder='Estado' /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value='all'>Todos los estados</SelectItem>
                                <SelectItem value='completed'>Completado</SelectItem>
                                <SelectItem value='cancelled'>Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className='w-full sm:w-48'>
                        <Select value={paymentFilter} onValueChange={(v: PaymentMethod | 'all') => onPaymentChange(v)}>
                            <SelectTrigger><SelectValue placeholder='Método de Pago' /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value='all'>Todos los métodos</SelectItem>
                                <SelectItem value='Efectivo'>Efectivo</SelectItem>
                                <SelectItem value='Tarjeta'>Tarjeta</SelectItem>
                                <SelectItem value='Transferencia'>Transferencia</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    </div>
                </div>
                {isGlobalSearch ? (
                    <p className='text-xs text-muted-foreground'>
                        Buscando en todas las ventas del sistema (ignora el filtro de periodo).
                    </p>
                ) : searchHint ? (
                    <p className='text-xs text-amber-700 dark:text-amber-400'>{searchHint}</p>
                ) : null}
            </CardContent>
        </Card>
    )
}
