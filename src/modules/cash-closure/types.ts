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
 * Types specific to the Cash Closure feature
 */

export interface PaymentMethodBreakdown {
    id?: number
    cash_closure_id?: string
    payment_method_id: number
    payment_method?: {
        id: number
        name: string
    }
    payment_method_name?: string
    theoretical_amount: number | string
    theoretical_count: number
    actual_amount: number | string
    actual_count: number | null
    difference: number | string
    notes: string | null
}

export interface Denomination {
    id?: number
    cash_closure_id?: string
    denomination: number | string
    type: 'Billete' | 'Moneda'
    quantity: number
    subtotal: number | string
}

export interface TheoreticalData {
    period: {
        start: string
        end: string
    }
    theoretical: {
        total_sales: number
        total_returns: number
        net_total: number
    }
    /** Presente en «mi cierre» cuando el turno tiene fondo inicial en caja */
    cash_session?: {
        opening_float: number
        cash_sales_amount: number
        expected_cash_in_drawer: number
    } | null
    metrics: {
        total_transactions: number
        total_customers: number
        average_ticket: number
    }
    payment_breakdown: PaymentMethodBreakdown[]
}

export interface CashClosure {
    id: string
    closure_number: number
    date: string
    start_date: string
    end_date: string
    /** Fondo inicial del turno al arquear (efectivo que ya estaba en caja) */
    opening_float?: number | string | null
    cash_register_session?: {
        id: string
        opening_float: number | string
        opened_at: string
        closed_at: string | null
        cashRegister?: { id: string; name: string; code: string } | null
    } | null
    cashier_name: string
    cashier_signature: string | null
    supervisor_name: string | null
    supervisor_signature: string | null
    supervisor_validated_at: string | null
    theoretical_total: number | string
    theoretical_sales: number | string
    theoretical_returns: number | string
    actual_total: number | string
    difference: number | string
    difference_percentage: number | string
    total_transactions: number
    total_customers: number
    average_ticket: number | string
    notes: string | null
    /** Estados unificados: Pendiente / Aprobado / Rechazado. Validado/Cerrado solo legacy. */
    status: 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Validado' | 'Cerrado'
    created_at: string
    updated_at: string
    payment_breakdowns: PaymentMethodBreakdown[]
    denominations: Denomination[]
}

export const GUATEMALAN_DENOMINATIONS: Denomination[] = [
    // Billetes
    { denomination: 200, type: 'Billete', quantity: 0, subtotal: 0 },
    { denomination: 100, type: 'Billete', quantity: 0, subtotal: 0 },
    { denomination: 50, type: 'Billete', quantity: 0, subtotal: 0 },
    { denomination: 20, type: 'Billete', quantity: 0, subtotal: 0 },
    { denomination: 10, type: 'Billete', quantity: 0, subtotal: 0 },
    { denomination: 5, type: 'Billete', quantity: 0, subtotal: 0 },
    { denomination: 1, type: 'Billete', quantity: 0, subtotal: 0 },
    // Monedas
    { denomination: 0.50, type: 'Moneda', quantity: 0, subtotal: 0 },
    { denomination: 0.25, type: 'Moneda', quantity: 0, subtotal: 0 },
    { denomination: 0.10, type: 'Moneda', quantity: 0, subtotal: 0 },
    { denomination: 0.05, type: 'Moneda', quantity: 0, subtotal: 0 },
]

/** ¿Método de pago en efectivo? */
export function isCashPaymentMethodName(name?: string | null): boolean {
    const n = String(name || '').toLowerCase()
    return n.includes('efectivo') || n.includes('cash')
}

/** Nombre de la caja donde se hizo el turno, o '—' si no está ligado a una sesión */
export function closureRegisterName(closure: CashClosure): string {
    return closure.cash_register_session?.cashRegister?.name || '—'
}

/** Fondo inicial del cierre (columna o sesión ligada) */
export function closureOpeningFloat(closure: CashClosure): number {
    if (closure.opening_float != null && toNumber(closure.opening_float) > 0) {
        return toNumber(closure.opening_float)
    }
    const fromSession = closure.cash_register_session?.opening_float
    if (fromSession != null && toNumber(fromSession) > 0) {
        return toNumber(fromSession)
    }
    return 0
}

/** Convert string/number to number */
export const toNumber = (value: number | string): number => {
    return typeof value === 'string' ? parseFloat(value) : value
}

/** Format currency; uses locale/currency from config when provided. */
export const formatCurrency = (amount: number | string, currencyCode?: string, locale?: string) => {
    const numAmount = toNumber(amount)
    const loc = (locale && String(locale).trim()) || 'es-GT'
    if (currencyCode && String(currencyCode).trim()) {
        return new Intl.NumberFormat(loc, { style: 'currency', currency: currencyCode.trim() }).format(numAmount)
    }
    return `Q ${numAmount.toFixed(2)}`
}

/** Format date/time for Guatemala */
export const formatDateTime = (dateString: string) => {
    const cleanDate = dateString.replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '')
    const parts = cleanDate.replace('T', ' ').split(' ')
    const datePart = parts[0].split('-')
    const timePart = parts[1]?.split(':') || ['00', '00', '00']

    const year = datePart[0]
    const month = datePart[1]
    const day = datePart[2]
    const hour = timePart[0]
    const minute = timePart[1]

    const hourNum = parseInt(hour)
    const period = hourNum >= 12 ? 'p. m.' : 'a. m.'
    const hour12 = hourNum % 12 || 12

    return `${day}/${month}/${year}, ${String(hour12).padStart(2, '0')}:${minute} ${period}`
}
