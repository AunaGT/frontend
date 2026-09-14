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
 * ClosureSummaryCard - Display closure totals and difference
 */
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '../types'

interface ClosureSummaryCardProps {
    theoreticalTotal: number
    actualTotal: number
    difference: number
    differencePercentage: number
    currencyCode?: string
    locale?: string
}

export const ClosureSummaryCard = ({
    theoreticalTotal,
    actualTotal,
    difference,
    differencePercentage,
    currencyCode,
    locale
}: ClosureSummaryCardProps) => {
    return (
        <div className="border rounded-lg p-4 bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <p className="text-sm text-muted-foreground">Total Teórico</p>
                    <p className="text-2xl font-bold">{formatCurrency(theoreticalTotal, currencyCode, locale)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Total Contado</p>
                    <p className="text-2xl font-bold">{formatCurrency(actualTotal, currencyCode, locale)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Diferencia</p>
                    <div className="flex items-center gap-2">
                        <p className={`text-2xl font-bold ${difference === 0 ? 'text-green-600' : difference > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                            {difference >= 0 ? '+' : ''}{formatCurrency(difference, currencyCode, locale)}
                        </p>
                        <Badge variant={difference === 0 ? 'default' : 'secondary'}>
                            {differencePercentage.toFixed(2)}%
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    )
}
