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
import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { readListUiPersisted, writeListUiPersisted } from '@/hooks/usePersistedListUiState'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { getApiBaseUrl, getAuthToken } from '@/services/api'
import type { CashClosure, TheoreticalData, PaymentMethodBreakdown, Denomination } from '../types'

const API_URL = getApiBaseUrl()
const CLOSURE_HISTORY_KEY = 'cierre-caja/historial'
const CLOSURE_PAGE_SIZES = [5, 10, 25, 50, 100] as const

interface FetchClosuresResponse {
    closures: CashClosure[]
    currentPage: number
    totalPages: number
}

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
    isLoadingClosures: boolean
    // Data
    theoreticalData: TheoreticalData | null
    closures: CashClosure[]
    currentPage: number
    totalPages: number
    pageSize: number
    setPageSize: (size: number) => void
    // Operations
    getLastClosureDate: (scope: 'day' | 'mine') => Promise<{ suggestedStart: string; suggestedEnd: string } | null>
    calculateTheoretical: (startDate: string, endDate: string, cashierId?: string, cashRegisterSessionId?: string) => Promise<TheoreticalData | null>
    saveClosure: (payload: SaveClosurePayload) => Promise<boolean>
    fetchClosures: (page: number, isSeller: boolean, pageSizeOverride?: number, filters?: { status?: string; startDate?: string; endDate?: string }) => Promise<void>
    fetchClosureDetail: (closureId: string) => Promise<CashClosure | null>
    approveClosure: (closureId: string, supervisorName: string) => Promise<CashClosure | null>
    rejectClosure: (closureId: string, reason: string) => Promise<CashClosure | null>
}

export const useCashClosureAPI = (): UseCashClosureAPIReturn => {
    const { toast } = useToast()
    const { timezone } = useSystemSettings()

    const [isCalculating, setIsCalculating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isLoadingClosures, setIsLoadingClosures] = useState(false)
    const [theoreticalData, setTheoreticalData] = useState<TheoreticalData | null>(null)
    const [closures, setClosures] = useState<CashClosure[]>([])
    const [currentPage, setCurrentPage] = useState(() => {
        const s = readListUiPersisted(CLOSURE_HISTORY_KEY)
        return Math.max(1, Number(s.page) || 1)
    })
    const [totalPages, setTotalPages] = useState(1)
    const [pageSize, setPageSize] = useState(() => {
        const s = readListUiPersisted(CLOSURE_HISTORY_KEY)
        const n = Number(s.pageSize)
        return CLOSURE_PAGE_SIZES.includes(n as (typeof CLOSURE_PAGE_SIZES)[number]) ? n : 10
    })

    useEffect(() => {
        writeListUiPersisted(CLOSURE_HISTORY_KEY, { page: currentPage, pageSize })
    }, [currentPage, pageSize])

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
            })

            if (!validateResponse.ok) throw new Error('Error validating stocks')

            const validationData = await validateResponse.json()

            if (!validationData.valid && validationData.products.length > 0) {
                toast({
                    title: 'Stock Negativo Detectado',
                    description: `Hay ${validationData.negative_stock_count} producto(s) con stock negativo.`,
                    variant: 'destructive'
                })
                return null
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

            if (data.metrics.total_transactions === 0 && !(data.cash_session?.opening_float > 0)) {
                toast({
                    title: 'Sin ventas en el período',
                    description: 'No hay ventas en el período seleccionado. Puedes guardar el cierre con total Q 0.00 si lo deseas.',
                    variant: 'default',
                })
            } else if (data.metrics.total_transactions === 0 && data.cash_session?.opening_float > 0) {
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

    const saveClosure = useCallback(async (payload: SaveClosurePayload): Promise<boolean> => {
        setIsSaving(true)
        try {
            const closureData: Record<string, unknown> = {
                startDate: payload.startDate,
                endDate: payload.endDate,
                cashierName: payload.cashierName,
                cashierSignature: null,
                supervisorName: null,
                supervisorSignature: null,
                theoreticalTotal: payload.theoreticalData.theoretical.net_total,
                theoreticalSales: payload.theoreticalData.theoretical.total_sales,
                theoreticalReturns: payload.theoreticalData.theoretical.total_returns,
                actualTotal: payload.actualTotal,
                totalTransactions: payload.theoreticalData.metrics.total_transactions,
                totalCustomers: payload.theoreticalData.metrics.total_customers,
                averageTicket: payload.theoreticalData.metrics.average_ticket,
                notes: payload.notes.trim() || null,
                paymentBreakdowns: payload.paymentBreakdown,
                denominations: payload.denominations.filter(d => d.quantity > 0)
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

            const savedOrErr = await response.json().catch(() => ({})) as { message?: string; closure_number?: number }

            if (!response.ok) {
                const msg = savedOrErr.message || `Error al guardar (${response.status})`
                toast({ title: 'Error', description: msg, variant: 'destructive' })
                return false
            }

            toast({
                title: 'Cierre guardado',
                description: `Cierre #${savedOrErr.closure_number} guardado exitosamente`,
            })

            setTheoreticalData(null)
            return true
        } catch (error) {
            console.error('Error saving closure:', error)
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'No se pudo guardar el cierre de caja',
                variant: 'destructive'
            })
            return false
        } finally {
            setIsSaving(false)
        }
    }, [toast])

    const fetchClosures = useCallback(async (page: number, isSeller: boolean, pageSizeOverride?: number, filters?: { status?: string; startDate?: string; endDate?: string }): Promise<void> => {
        setIsLoadingClosures(true)
        const size = pageSizeOverride ?? (isSeller ? 1 : pageSize)
        if (pageSizeOverride != null) setPageSize(pageSizeOverride)
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(size) })
            if (filters?.status) params.set('status', filters.status)
            if (filters?.startDate) params.set('startDate', filters.startDate)
            if (filters?.endDate) params.set('endDate', filters.endDate)
            const response = await fetch(`${API_URL}/cash-closures?${params.toString()}`, {
                headers: getAuthHeaders()
            })

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

            const data = await response.json()

            if (data && Array.isArray(data.items)) {
                setClosures(data.items)
                setCurrentPage(data.page || 1)
                setTotalPages(data.totalPages || 1)
            } else {
                setClosures([])
                setCurrentPage(1)
                setTotalPages(1)
            }
        } catch (error) {
            console.error('Error fetching closures:', error)
            setClosures([])
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los cierres de caja',
                variant: 'destructive'
            })
        } finally {
            setIsLoadingClosures(false)
        }
    }, [toast, pageSize])

    const fetchClosureDetail = useCallback(async (closureId: string): Promise<CashClosure | null> => {
        try {
            const response = await fetch(`${API_URL}/cash-closures/${closureId}`, {
                headers: getAuthHeaders()
            })
            return await response.json()
        } catch (error) {
            console.error('Error fetching closure detail:', error)
            toast({
                title: 'Error',
                description: 'No se pudo cargar el detalle del cierre',
                variant: 'destructive'
            })
            return null
        }
    }, [toast])

    const approveClosure = useCallback(async (closureId: string, supervisorName: string): Promise<CashClosure | null> => {
        try {
            const response = await fetch(`${API_URL}/cash-closures/${closureId}/status`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: 'Aprobado', supervisor_name: supervisorName })
            })

            if (!response.ok) throw new Error('Error al aprobar el cierre')

            const updatedClosure = await response.json()
            toast({ title: 'Cierre Aprobado' })
            return updatedClosure
        } catch (error) {
            console.error('Error approving closure:', error)
            toast({ title: 'Error', description: 'No se pudo aprobar el cierre', variant: 'destructive' })
            return null
        }
    }, [toast])

    const rejectClosure = useCallback(async (closureId: string, reason: string): Promise<CashClosure | null> => {
        try {
            const response = await fetch(`${API_URL}/cash-closures/${closureId}/status`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: 'Rechazado', rejection_reason: reason })
            })

            if (!response.ok) throw new Error('Error al rechazar el cierre')

            const updatedClosure = await response.json()
            toast({ title: 'Cierre Rechazado', variant: 'destructive' })
            return updatedClosure
        } catch (error) {
            console.error('Error rejecting closure:', error)
            toast({ title: 'Error', description: 'No se pudo rechazar el cierre', variant: 'destructive' })
            return null
        }
    }, [toast])

    return {
        isCalculating,
        isSaving,
        isLoadingClosures,
        theoreticalData,
        closures,
        currentPage,
        totalPages,
        pageSize,
        setPageSize,
        getLastClosureDate,
        calculateTheoretical,
        saveClosure,
        fetchClosures,
        fetchClosureDetail,
        approveClosure,
        rejectClosure
    }
}
