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
 * useCashClosureAPI - Hook for cash closure API operations
 */
import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { getApiBaseUrl, getAuthToken } from '@/services/api'
import type { CashClosure, TheoreticalData, PaymentMethodBreakdown, Denomination } from '../types'

const API_URL = getApiBaseUrl()
interface SaveClosurePayload {
    startDate: string
    endDate: string
    cashierName: string
    /** ID del usuario cajero (trazabilidad) */
    cashierId?: string
    /** Sesión de caja ya cerrada en POS (pendiente de arqueo); al guardar solo se enlaza al cierre */
    cashRegisterSessionId?: string
    theoreticalData: TheoreticalData
    actualTotal: number
    notes: string
    paymentBreakdown: PaymentMethodBreakdown[]
    denominations: Denomination[]
}

/** Formato ISO a YYYY-MM-DDTHH:mm:ss en la zona configurada para inputs datetime-local */
function toLocalISO(iso: string, timeZone: string): string {
    const d = new Date(iso)
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(d)
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

/** Fin del día de hoy en la zona configurada como YYYY-MM-DDTHH:mm:ss */
function endOfTodayLocal(timeZone: string): string {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(now)
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}T23:59:59`
}

interface LastClosureDateResponse {
    last_end_date: string | null
    last_closure_number: number
    suggested_start: string
}

interface UseCashClosureAPIReturn {
    // Loading states
    isCalculating: boolean
    isSaving: boolean
    // Data
    theoreticalData: TheoreticalData | null
    // Operations
    getLastClosureDate: (scope: 'day' | 'mine') => Promise<{ suggestedStart: string; suggestedEnd: string } | null>
    calculateTheoretical: (startDate: string, endDate: string, cashierId?: string, cashRegisterSessionId?: string) => Promise<TheoreticalData | null>
    saveClosure: (payload: SaveClosurePayload) => Promise<string | null>
    approveClosure: (closureId: string, expectedUpdatedAt: string) => Promise<CashClosure | null>
    rejectClosure: (closureId: string, reason: string, expectedUpdatedAt: string) => Promise<CashClosure | null>
}

export const useCashClosureAPI = (): UseCashClosureAPIReturn => {
    const { toast } = useToast()
    const { timezone } = useSystemSettings()

    const [isCalculating, setIsCalculating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [theoreticalData, setTheoreticalData] = useState<TheoreticalData | null>(null)
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken() ?? ''}`
    })

    const getLastClosureDate = useCallback(async (scope: 'day' | 'mine'): Promise<{ suggestedStart: string; suggestedEnd: string } | null> => {
        try {
            const params = new URLSearchParams({ scope })
            const response = await fetch(`${API_URL}/cash-closures/last-closure-date?${params.toString()}`, { headers: getAuthHeaders() })
            if (!response.ok) return null
            const data: LastClosureDateResponse = await response.json()
            const suggestedStart = data.suggested_start ? toLocalISO(data.suggested_start, timezone) : ''
            const suggestedEnd = endOfTodayLocal(timezone)
            return { suggestedStart, suggestedEnd }
        } catch (error) {
            console.error('Error fetching last closure date:', error)
            return null
        }
    }, [timezone])

    const calculateTheoretical = useCallback(async (startDate: string, endDate: string, cashierId?: string, cashRegisterSessionId?: string): Promise<TheoreticalData | null> => {
        setIsCalculating(true)
        try {
            // Validate stocks first
            const validateResponse = await fetch(`${API_URL}/cash-closures/validate-stocks`, {
                headers: getAuthHeaders()
            }).catch(() => null)

            const validationData = validateResponse?.ok ? await validateResponse.json().catch(() => null) : null

            if (validationData && !validationData.valid && validationData.products.length > 0) {
                toast({
                    title: 'Inventario por revisar',
                    description: `Hay ${validationData.negative_stock_count} producto(s) con stock negativo. Puedes continuar con el arqueo; revisa el inventario por separado.`,
                })
            }

            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate
            })
            if (cashierId) params.set('cashier_id', cashierId)
            if (cashRegisterSessionId) params.set('cash_register_session_id', cashRegisterSessionId)
            const response = await fetch(
                `${API_URL}/cash-closures/calculate-theoretical?${params.toString()}`,
                { headers: getAuthHeaders() }
            )

            if (!response.ok) {
                let msg = 'No se pudo calcular el cierre teórico'
                try {
                    const err = await response.json() as { message?: string }
                    if (err?.message) msg = err.message
                } catch {
                    /* ignore */
                }
                toast({
                    title: 'Error',
                    description: msg,
                    variant: 'destructive'
                })
                return null
            }

            const data: TheoreticalData = await response.json()
            setTheoreticalData(data)

            if (data.metrics.total_transactions === 0 && !(data.cash_session?.opening_float > 0) && data.theoretical.net_total === 0) {
                toast({
                    title: 'Sin ventas en el período',
                    description: 'No hay ventas en el período seleccionado. Puedes guardar el cierre con total Q 0.00 si lo deseas.',
                    variant: 'default',
                })
            } else if (data.metrics.total_transactions === 0 && data.cash_session?.opening_float > 0 && !data.theoretical.total_collections && !data.theoretical.total_returns && !data.theoretical.total_supplier_payments) {
                toast({
                    title: 'Cálculo completado',
                    description: `Sin ventas en el turno. Debe haber ${data.cash_session.expected_cash_in_drawer.toFixed(2)} en efectivo (fondo inicial).`,
                })
            } else {
                toast({
                    title: 'Cálculo completado',
                    description: `Total teórico: Q ${data.theoretical.net_total.toFixed(2)} (${data.metrics.total_transactions} transacciones)`,
                })
            }

            return data
        } catch (error) {
            console.error('Error calculating theoretical:', error)
            toast({
                title: 'Error',
                description: 'No se pudo calcular el cierre teórico',
                variant: 'destructive'
            })
            return null
        } finally {
            setIsCalculating(false)
        }
    }, [toast])

    const saveClosure = useCallback(async (payload: SaveClosurePayload): Promise<string | null> => {
        setIsSaving(true)
        try {
            const closureData: Record<string, unknown> = {
                startDate: payload.startDate,
                endDate: payload.endDate,
                cashierName: payload.cashierName,
                calculationKey: payload.theoreticalData.calculation_key,
                actualTotal: Number(payload.actualTotal.toFixed(2)),
                notes: payload.notes.trim() || null,
                paymentBreakdowns: payload.paymentBreakdown.map(row => ({ ...(row.breakdown_key ? { breakdown_key: row.breakdown_key } : {}), payment_method_id: row.payment_method_id, actual_amount: Number(Number(row.actual_amount).toFixed(2)), actual_count: row.actual_count, notes: row.notes })),
                denominations: payload.denominations.filter(d => d.quantity > 0).map(d => ({ denomination: d.denomination, type: d.type, quantity: d.quantity }))
            }
            if (payload.cashierId) closureData.cashierId = payload.cashierId
            if (payload.cashRegisterSessionId) {
                closureData.cash_register_session_id = payload.cashRegisterSessionId
            }

            const response = await fetch(`${API_URL}/cash-closures`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(closureData)
            })

            const savedOrErr = await response.json().catch(() => ({})) as { id?: string; message?: string; closure_number?: number }

            if (!response.ok) {
                const msg = savedOrErr.message || `Error al guardar (${response.status})`
                toast({ title: 'Error', description: msg, variant: 'destructive' })
                return null
            }

            toast({
                title: 'Cierre guardado',
                description: `Cierre #${savedOrErr.closure_number} guardado exitosamente`,
            })

            setTheoreticalData(null)
            return savedOrErr.id || null
        } catch (error) {
            console.error('Error saving closure:', error)
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'No se pudo guardar el cierre de caja',
                variant: 'destructive'
            })
            return null
        } finally {
            setIsSaving(false)
        }
    }, [toast])

    const approveClosure = useCallback(async (closureId: string, expectedUpdatedAt: string): Promise<CashClosure | null> => {
        try {
            const response = await fetch(`${API_URL}/cash-closures/${closureId}/status`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: 'Aprobado', expectedUpdatedAt })
            })

            if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || 'Error al aprobar el cierre') }

            const updatedClosure = await response.json()
            toast({ title: 'Cierre Aprobado' })
            return updatedClosure
        } catch (error) {
            console.error('Error approving closure:', error)
            toast({ title: 'No se pudo aprobar', description: error instanceof Error ? error.message : 'Recarga el arqueo e inténtalo nuevamente.', variant: 'destructive' })
            return null
        }
    }, [toast])

    const rejectClosure = useCallback(async (closureId: string, reason: string, expectedUpdatedAt: string): Promise<CashClosure | null> => {
        try {
            const response = await fetch(`${API_URL}/cash-closures/${closureId}/status`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: 'Rechazado', rejection_reason: reason, expectedUpdatedAt })
            })

            if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || 'Error al rechazar el cierre') }

            const updatedClosure = await response.json()
            toast({ title: 'Cierre Rechazado', variant: 'destructive' })
            return updatedClosure
        } catch (error) {
            console.error('Error rejecting closure:', error)
            toast({ title: 'No se pudo rechazar', description: error instanceof Error ? error.message : 'Recarga el arqueo e inténtalo nuevamente.', variant: 'destructive' })
            return null
        }
    }, [toast])

    return {
        isCalculating,
        isSaving,
        theoreticalData,
        getLastClosureDate,
        calculateTheoretical,
        saveClosure,
        approveClosure,
        rejectClosure
    }
}
