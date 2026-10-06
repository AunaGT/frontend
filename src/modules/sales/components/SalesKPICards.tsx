/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */
import { MetricStrip } from '@/components/shared/MetricStrip'
import { formatMoney } from '@/utils'

interface SalesKPICardsProps {
    totalSalesToday: number
    transactionCountToday: number
    averageTicketToday: number
    preferredPaymentMethod: string
    loading?: boolean
    error?: boolean
    locale?: string
    currencyCode?: string
}

export const SalesKPICards = ({
    totalSalesToday, transactionCountToday, averageTicketToday, preferredPaymentMethod,
    loading = false, error = false, locale, currencyCode
}: SalesKPICardsProps) => <MetricStrip label="Resumen de ventas del período" loading={loading} items={[
    { label: 'Total neto', value: error ? '—' : formatMoney(totalSalesToday, locale, currencyCode) },
    { label: 'Transacciones', value: error ? '—' : transactionCountToday },
    { label: 'Ticket promedio', value: error ? '—' : formatMoney(averageTicketToday, locale, currencyCode) },
    { label: 'Pago más frecuente', value: error ? '—' : preferredPaymentMethod }
]} />
