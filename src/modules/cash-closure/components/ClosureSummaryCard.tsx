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
import { Coins } from 'lucide-react'
import type { PaymentMethodBreakdown } from '../types'
import { formatCurrency } from '../types'

interface ClosureSummaryCardProps {
    theoreticalTotal: number
    actualTotal: number
    difference: number
    differencePercentage: number
    currencyCode?: string
    locale?: string
    paymentBreakdown?: PaymentMethodBreakdown[]
}

export const ClosureSummaryCard = ({
    theoreticalTotal,
    actualTotal,
    difference,
    differencePercentage,
    currencyCode,
    locale,
    paymentBreakdown,
}: ClosureSummaryCardProps) => {
    return (
        <div className="space-y-3 tabular-nums">
            <h2 className="cash-closure-panel-heading"><Coins className="h-5 w-5 text-primary" aria-hidden="true" />Resumen contado</h2>
            {paymentBreakdown && <dl className="cash-closure-amount-list">
                {paymentBreakdown.map(item => <div key={item.payment_method_id}><dt>{item.payment_method_name || item.payment_method?.name || 'Método de pago'}</dt><dd>{formatCurrency(item.actual_amount, currencyCode, locale)}</dd></div>)}
            </dl>}
            <div className="space-y-3">
                <div className="flex justify-between items-baseline gap-3 text-sm">
                    <p className="text-muted-foreground">Total esperado</p>
                    <p className="font-semibold">{formatCurrency(theoreticalTotal, currencyCode, locale)}</p>
                </div>
                <div className="flex justify-between items-baseline gap-3 border-t pt-3 text-sm">
                    <p className="text-muted-foreground">Total contado</p>
                    <p className="text-lg font-semibold">{formatCurrency(actualTotal, currencyCode, locale)}</p>
                </div>
                <div className="border-t pt-3" role="status" aria-live="polite" aria-atomic="true">
                    <p className="text-sm font-medium">{Math.abs(difference) < 0.005 ? 'Cuadrado' : difference > 0 ? 'Sobrante' : 'Faltante'}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                        <p className={`text-2xl font-bold ${Math.abs(difference) < 0.005 ? 'text-emerald-700 dark:text-emerald-300' : difference > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
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
