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
 * useSalesData - Custom hook for managing sales data and filters
 */
import { useState, useMemo, useEffect } from 'react'
import { useSalesByStatus } from '@/hooks/useSales'
import { readListUiPersisted, writeListUiPersisted } from '@/hooks/usePersistedListUiState'
import { Sale, PaymentMethod, SaleStatus } from '@/types'
import type { SaleStatusKey, SaleFilters } from '../types'
import { isSalesSearchReady, salesSearchHint, SALES_MIN_TEXT_SEARCH_LEN } from '../salesSearchUtils'

interface PaginatedSales {
    items: Sale[]
    page: number
    pageSize: number
    totalPages: number | null
    totalItems: number | null
    nextPage?: number | null
    prevPage?: number | null
    hasMore?: boolean
}

const mapStatusNameToKey = (name?: string): SaleStatusKey => {
    if (!name) return 'completed'
    const n = name.toLowerCase()
    if (n.includes('complet')) return 'completed'
    if (n.includes('cancel')) return 'cancelled'
    return 'completed'
}

const SALES_LIST_KEY = 'ventas/list'

function readSalesPagesState(): Record<SaleStatusKey, number> {
    const s = readListUiPersisted(SALES_LIST_KEY)
    const sp = s.salesPages as Record<string, unknown> | undefined
    if (sp && typeof sp === 'object') {
        return {
            completed: Math.max(1, Number(sp.completed) || 1),
            cancelled: Math.max(1, Number(sp.cancelled) || 1),
        }
    }
    return { completed: 1, cancelled: 1 }
}

export const normalizeRawSale = (raw: unknown): Sale => {
    const r = raw as Record<string, unknown>
    const saleItems = Array.isArray(r.sale_items) ? r.sale_items : []
    const products = saleItems.map((si: unknown) => {
        const s = si as Record<string, unknown>
        const prod = (s.product as Record<string, unknown>) ?? {}
        const id = s.product_id ?? s.id ?? prod.id ?? ''
        const name = prod.name ?? s.name ?? s.product_name ?? 'Producto'
        const priceRaw = s.price ?? s.unit_price ?? prod.price ?? 0
        const price = parseFloat(String(priceRaw)) || 0
        const qty = (s.qty ?? s.quantity ?? s.amount ?? 1) as number
        return { id: String(id), name: String(name), price, qty }
    })

    const totalRaw = r.total ?? r.total_amount ?? '0'
    const totalNum = typeof totalRaw === 'number' ? totalRaw : parseFloat(String(totalRaw)) || 0
    const paymentObj = r.payment_method as Record<string, unknown> | undefined
    const statusObj = r.status as Record<string, unknown> | undefined

    const customerNit = ((): string | undefined => {
        if (typeof r.customer_nit === 'string') return r.customer_nit
        if (typeof (r as Record<string, unknown>).customerNit === 'string')
            return (r as Record<string, unknown>).customerNit as string
        return undefined
    })()

    const isFinalConsumer = Boolean(
        typeof r.is_final_consumer === 'boolean' ? r.is_final_consumer :
            typeof (r as Record<string, unknown>).isFinalConsumer === 'boolean'
                ? (r as Record<string, unknown>).isFinalConsumer : false
    )

    const payment = ((): PaymentMethod => {
        const val = paymentObj?.name ?? r.payment_method ?? (r as Record<string, unknown>).payment
        return String(val || '') as PaymentMethod
    })()

    const status = ((): SaleStatus => {
        const raw = statusObj?.name ?? r.status ?? (r as Record<string, unknown>).status_id
        return mapStatusNameToKey(typeof raw === 'string' ? raw : String(raw || '')) as SaleStatus
    })()

    const amountReceived = parseFloat(String(r.amount_received ?? (r as Record<string, unknown>).amountReceived ?? '0')) || 0
    const change = parseFloat(String(r.change ?? '0')) || 0

    // Process returns data
    const returnsRaw = Array.isArray(r.returns) ? r.returns : []
    const totalReturned = parseFloat(String(r.total_returned ?? '0')) || 0
    const adjustedTotal = parseFloat(String(r.adjusted_total ?? totalNum)) || totalNum
    const hasReturns = returnsRaw.length > 0 || totalReturned > 0

    const returnDetails = returnsRaw
        .filter((ret: unknown) => {
            const retObj = ret as Record<string, unknown>
            const retStatus = (retObj.status as Record<string, unknown>)?.name
            return retStatus === 'Completada'
        })
        .map((ret: unknown) => {
            const retObj = ret as Record<string, unknown>
            const retItems = Array.isArray(retObj.return_items) ? retObj.return_items : []
            const items = retItems.map((item: unknown) => {
                const itemObj = item as Record<string, unknown>
                const product = (itemObj.product as Record<string, unknown>) ?? {}
                return {
                    productName: String(product.name ?? 'Producto'),
                    qty: Number(itemObj.qty_returned ?? 0),
                    refund: parseFloat(String(itemObj.refund_amount ?? '0')) || 0
                }
            })
            const retStatus = (retObj.status as Record<string, unknown>)?.name
            return {
                date: String(retObj.return_date ?? ''),
                status: String(retStatus ?? 'Desconocido'),
                reason: retObj.reason ? String(retObj.reason) : undefined,
                totalRefund: parseFloat(String(retObj.total_refund ?? '0')) || 0,
                items
            }
        })

    // Process promotions data
    const promotionsRaw = Array.isArray(r.sale_promotions) ? r.sale_promotions : []
    const promotions = promotionsRaw.map((promo: unknown) => {
        const promoObj = promo as Record<string, unknown>
        const promotion = promoObj.promotion as Record<string, unknown> | undefined
        const promoType = promotion?.type as Record<string, unknown> | undefined
        return {
            id: Number(promoObj.id ?? 0),
            promotion_id: String(promoObj.promotion_id ?? ''),
            discount_applied: parseFloat(String(promoObj.discount_applied ?? '0')) || 0,
            code_used: promoObj.code_used ? String(promoObj.code_used) : undefined,
            promotion: promotion ? {
                id: String(promotion.id ?? ''),
                name: String(promotion.name ?? 'Promoción'),
                type: promoType ? { name: String(promoType.name ?? '') } : undefined
            } : undefined
        }
    })

    const subtotal = parseFloat(String(r.subtotal ?? totalNum)) || totalNum
    const discountTotal = parseFloat(String(r.discount_total ?? '0')) || 0

    const createdByRaw = r.createdBy as Record<string, unknown> | undefined
    const createdById = createdByRaw?.id ? String(createdByRaw.id) : undefined
    const createdByName = createdByRaw?.name ? String(createdByRaw.name) : undefined
    const createdByEmail = createdByRaw?.email ? String(createdByRaw.email) : undefined

    // Facturación electrónica (InFile/SAT) - se reenvía tal cual cuando venga del API
    const saleDtesRaw = Array.isArray(r.sale_dtes) ? r.sale_dtes : []
    const sale_dtes = saleDtesRaw.map((d: unknown) => {
        const dte = d as Record<string, unknown>
        return {
            id: dte.id != null ? String(dte.id) : undefined,
            authorization: dte.authorization != null ? String(dte.authorization) : undefined,
            series: dte.series != null ? String(dte.series) : undefined,
            number: dte.number != null ? String(dte.number) : undefined,
            emission_date: dte.emission_date != null ? String(dte.emission_date) : undefined,
            status: dte.status != null ? String(dte.status) : undefined,
            provider: dte.provider != null ? String(dte.provider) : undefined,
            xml_url: dte.xml_url != null ? String(dte.xml_url) : undefined,
            pdf_url: dte.pdf_url != null ? String(dte.pdf_url) : undefined,
        }
    })

    const reference = r.reference != null ? String(r.reference) : undefined

    return {
        id: String(r.id ?? ''),
        reference: reference || undefined,
        date: String(r.sold_at ?? r.date ?? ''),
        customer: String(r.customer ?? ''),
        customerNit,
        isFinalConsumer,
        total: totalNum,
        subtotal,
        discountTotal,
        totalReturned,
        adjustedTotal,
        hasReturns,
        returnDetails,
        promotions,
        items: (r.items as number) ?? products.length,
        payment,
        status,
        amountReceived,
        change,
        products,
        createdById,
        createdByName,
        createdByEmail,
        sale_dtes: sale_dtes.length > 0 ? sale_dtes : undefined,
    } as Sale
}

interface UseSalesDataReturn {
    // Filters
    filters: SaleFilters
    setSearchTerm: (term: string) => void
    setStatusFilter: (status: SaleStatus | 'all') => void
    setPaymentFilter: (payment: PaymentMethod | 'all') => void
    setPeriod: (period: string) => void
    // Data
    salesByStatus: Record<SaleStatusKey, Sale[]>
    pageInfoByStatus: Record<SaleStatusKey, { page: number; totalPages: number | null; hasMore: boolean }>
    isLoadingByStatus: Record<SaleStatusKey, boolean>
    // KPIs
    totalSalesToday: number
    transactionCountToday: number
    averageTicketToday: number
    preferredPaymentMethod: string
    // Pagination
    setPageFor: (key: SaleStatusKey, page: number) => void
    pageSize: number
    setPageSize: (size: number) => void
    // Actions
    refreshSales: () => void
}

export const useSalesData = (): UseSalesDataReturn => {
    // Filters state
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all')
    const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'all'>('all')
    const [period, setPeriod] = useState('today')

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400)
        return () => window.clearTimeout(timer)
    }, [searchTerm])

    const isGlobalSearch = isSalesSearchReady(debouncedSearch)
    const searchHint = salesSearchHint(searchTerm)

    const [pages, setPages] = useState<Record<SaleStatusKey, number>>(readSalesPagesState)

    const [pageSize, setPageSize] = useState(() => {
        const s = readListUiPersisted(SALES_LIST_KEY)
        const n = Number(s.salesPageSize)
        return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 10
    })

    useEffect(() => {
        writeListUiPersisted(SALES_LIST_KEY, {
            salesPages: { completed: pages.completed, cancelled: pages.cancelled },
            salesPageSize: pageSize,
        })
    }, [pages, pageSize])

    useEffect(() => {
        setPages({ completed: 1, cancelled: 1 })
    }, [debouncedSearch, period, pageSize])

    const listQueryParams = {
        period: isGlobalSearch ? undefined : period,
        search: isGlobalSearch ? debouncedSearch : undefined,
        pageSize,
    }

    // Listados por estado (búsqueda global o periodo)
    const completedQuery = useSalesByStatus('Completada', { ...listQueryParams, page: pages.completed }, {
        enabled: !searchTerm.trim() || isGlobalSearch,
    })
    const cancelledQuery = useSalesByStatus('Cancelada', { ...listQueryParams, page: pages.cancelled }, {
        enabled: !searchTerm.trim() || isGlobalSearch,
    })

    // KPIs siempre según periodo (no mezclar con resultados de búsqueda)
    const kpiCompletedQuery = useSalesByStatus('Completada', { period, page: 1, pageSize: 500 })

    const completedData = completedQuery.data as PaginatedSales | undefined
    const cancelledData = cancelledQuery.data as PaginatedSales | undefined

    const refreshSales = () => {
        completedQuery.refetch?.()
        cancelledQuery.refetch?.()
        kpiCompletedQuery.refetch?.()
    }

    // Filtros locales (pago y estado en UI); la búsqueda la resuelve el API
    const filterClient = (items: Sale[] = []) => items.filter(sale => {
        const matchesPayment = paymentFilter === 'all' || sale.payment === paymentFilter
        const matchesStatus = statusFilter === 'all' || sale.status === statusFilter
        return matchesPayment && matchesStatus
    })

    const salesByStatus: Record<SaleStatusKey, Sale[]> = useMemo(() => ({
        completed: filterClient((completedData?.items ?? []).map(normalizeRawSale)),
        cancelled: filterClient((cancelledData?.items ?? []).map(normalizeRawSale)),
    }), [completedData, cancelledData, paymentFilter, statusFilter])

    const pageInfoByStatus: Record<SaleStatusKey, { page: number; totalPages: number | null; hasMore: boolean }> = {
        completed: {
            page: completedData?.page ?? pages.completed,
            totalPages: completedData?.totalPages ?? null,
            hasMore: completedData?.hasMore ?? false,
        },
        cancelled: {
            page: cancelledData?.page ?? pages.cancelled,
            totalPages: cancelledData?.totalPages ?? null,
            hasMore: cancelledData?.hasMore ?? false,
        },
    }

    const isLoadingByStatus: Record<SaleStatusKey, boolean> = {
        completed: completedQuery.isLoading,
        cancelled: cancelledQuery.isLoading,
    }

    const setPageFor = (key: SaleStatusKey, newPage: number) =>
        setPages(prev => ({ ...prev, [key]: newPage }))

    // KPIs (ventas completadas del periodo seleccionado)
    const completedTodaySales = useMemo(
        () => (kpiCompletedQuery.data?.items ?? []).map(normalizeRawSale),
        [kpiCompletedQuery.data]
    )

    const totalSalesToday = useMemo(
        () => completedTodaySales.reduce((sum, sale) => sum + (sale.adjustedTotal || sale.total || 0), 0),
        [completedTodaySales]
    )

    const transactionCountToday =
        kpiCompletedQuery.data?.totalItems ?? completedTodaySales.length

    const averageTicketToday = transactionCountToday > 0
        ? totalSalesToday / transactionCountToday
        : 0

    const preferredPaymentMethod = useMemo(() => {
        const count: Record<string, number> = {}
        completedTodaySales.forEach(sale => {
            const method = sale.payment || 'Desconocido'
            count[method] = (count[method] || 0) + 1
        })
        return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Desconocido'
    }, [completedTodaySales])

    return {
        filters: { searchTerm, statusFilter, paymentFilter, period, isGlobalSearch, searchHint, minSearchLength: SALES_MIN_TEXT_SEARCH_LEN },
        setSearchTerm,
        setStatusFilter,
        setPaymentFilter,
        setPeriod,
        salesByStatus,
        pageInfoByStatus,
        isLoadingByStatus,
        totalSalesToday,
        transactionCountToday,
        averageTicketToday,
        preferredPaymentMethod,
        setPageFor,
        pageSize,
        setPageSize,
        refreshSales,
    }
}
