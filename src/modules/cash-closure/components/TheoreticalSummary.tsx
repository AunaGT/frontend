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
import { Calculator } from 'lucide-react'
import type { TheoreticalData } from '../types'
import { formatCurrency } from '../types'

interface TheoreticalSummaryProps {
    data: TheoreticalData
    showAdvancedDetails?: boolean
}

export const TheoreticalSummary = ({ data, showAdvancedDetails = false }: TheoreticalSummaryProps) => {
    const { currencyCode, locale } = useSystemSettings()
    const cashSession = data.cash_session
    return (
        <div className="space-y-3">
            <h2 className="cash-closure-panel-heading"><Calculator className="h-5 w-5 text-primary" aria-hidden="true" />Resumen teórico</h2>
            <dl className="cash-closure-amount-list">
                {cashSession && cashSession.opening_float > 0 && <div><dt>Fondo inicial</dt><dd>{formatCurrency(cashSession.opening_float, currencyCode, locale)}</dd></div>}
                <div><dt>Ventas brutas</dt><dd>{formatCurrency(data.theoretical.total_sales, currencyCode, locale)}</dd></div>
                <div><dt>Devoluciones</dt><dd>-{formatCurrency(data.theoretical.total_returns, currencyCode, locale)}</dd></div>
                <div className="cash-closure-amount-total"><dt>Total esperado</dt><dd>{formatCurrency(data.theoretical.net_total, currencyCode, locale)}</dd></div>
            </dl>
            {showAdvancedDetails && <div className="border-t pt-3">
                {cashSession && <p className="mb-3 text-xs text-muted-foreground">Ventas en efectivo: {formatCurrency(cashSession.cash_sales_amount, currencyCode, locale)} · Esperado en caja: {formatCurrency(cashSession.expected_cash_in_drawer, currencyCode, locale)}</p>}
                <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-muted-foreground">Transacciones</dt><dd className="mt-1 font-semibold">{data.metrics.total_transactions}</dd></div>
                    <div><dt className="text-muted-foreground">Clientes</dt><dd className="mt-1 font-semibold">{data.metrics.total_customers}</dd></div>
                    <div className="col-span-2"><dt className="text-muted-foreground">Ticket promedio</dt><dd className="mt-1 font-semibold">{formatCurrency(data.metrics.average_ticket, currencyCode, locale)}</dd></div>
                </dl>
            </div>}
        </div>
    )
}
