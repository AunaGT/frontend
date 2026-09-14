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
 * SalesKPICards - KPI summary cards for sales
 */
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, ShoppingCart, Receipt, User } from 'lucide-react'
import { formatMoney } from '@/utils'

interface SalesKPICardsProps {
    totalSalesToday: number
    transactionCountToday: number
    averageTicketToday: number
    preferredPaymentMethod: string
    locale?: string
    currencyCode?: string
}

export const SalesKPICards = ({
    totalSalesToday,
    transactionCountToday,
    averageTicketToday,
    preferredPaymentMethod,
    locale,
    currencyCode
}: SalesKPICardsProps) => {
    return (
        <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
            <Card>
                <CardContent className='p-6'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <p className='text-sm text-muted-foreground'>Ventas Hoy</p>
                            <p className='text-2xl font-bold text-foreground'>{formatMoney(totalSalesToday, locale, currencyCode)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className='p-6'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <p className='text-sm text-muted-foreground'>Transacciones</p>
                            <p className='text-2xl font-bold text-foreground'>{transactionCountToday}</p>
                        </div>
                        <ShoppingCart className='w-8 h-8 text-primary' />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className='p-6'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <p className='text-sm text-muted-foreground'>Ticket Promedio</p>
                            <p className='text-2xl font-bold text-foreground'>{formatMoney(averageTicketToday, locale, currencyCode)}</p>
                        </div>
                        <Receipt className='w-8 h-8 text-accent' />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent className='p-6'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <p className='text-sm text-muted-foreground'>Pago Preferido</p>
                            <p className='text-2xl font-bold text-foreground'>{preferredPaymentMethod}</p>
                        </div>
                        <User className='w-8 h-8 text-liquor-burgundy' />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
