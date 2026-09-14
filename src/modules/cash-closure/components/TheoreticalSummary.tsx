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
 * TheoreticalSummary - Display theoretical closure summary
 */
import { useSystemSettings } from '@/hooks/useSystemSettings'
import type { TheoreticalData } from '../types'
import { formatCurrency } from '../types'

interface TheoreticalSummaryProps {
    data: TheoreticalData
}

export const TheoreticalSummary = ({ data }: TheoreticalSummaryProps) => {
    const { currencyCode, locale } = useSystemSettings()
    const cashSession = data.cash_session
    return (
        <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold mb-3">Resumen Teórico</h3>
            {cashSession && cashSession.opening_float > 0 && (
                <div className="mb-4 rounded-md border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/50 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">Efectivo en caja</p>
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-2 text-muted-foreground">
                        <span>
                            Fondo inicial:{' '}
                            <span className="font-medium text-foreground">
                                {formatCurrency(cashSession.opening_float, currencyCode, locale)}
                            </span>
                        </span>
                        <span>
                            + Ventas efectivo:{' '}
                            <span className="font-medium text-foreground">
                                {formatCurrency(cashSession.cash_sales_amount, currencyCode, locale)}
                            </span>
                        </span>
                        <span>
                            = Debe haber:{' '}
                            <span className="font-medium text-foreground">
                                {formatCurrency(cashSession.expected_cash_in_drawer, currencyCode, locale)}
                            </span>
                        </span>
                    </div>
                    <p className="text-xs mt-2">
                        Cuente todo el efectivo físico en la caja (monedas y billetes), incluido el fondo con el que
                        abrió el turno.
                    </p>
                </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                    <p className="text-sm text-muted-foreground">Total Teórico</p>
                    <p className="text-lg font-bold">{formatCurrency(data.theoretical.net_total, currencyCode, locale)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Ventas Brutas</p>
                    <p className="text-lg font-semibold">{formatCurrency(data.theoretical.total_sales, currencyCode, locale)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Devoluciones</p>
                    <p className="text-lg font-semibold text-red-600">-{formatCurrency(data.theoretical.total_returns, currencyCode, locale)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Transacciones</p>
                    <p className="text-lg font-semibold">{data.metrics.total_transactions}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Clientes</p>
                    <p className="text-lg font-semibold">{data.metrics.total_customers}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Ticket Promedio</p>
                    <p className="text-lg font-semibold">{formatCurrency(data.metrics.average_ticket, currencyCode, locale)}</p>
                </div>
            </div>
        </div>
    )
}
