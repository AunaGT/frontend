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
import { useSales } from '@/hooks/useSales'
import { usePersistedListUiState } from '@/hooks/usePersistedListUiState'
import { Sale, PaymentMethod, SaleStatus } from '@/types'
import { STATUS_DB_NAMES, type SaleStatusKey } from '../types'
import { isSalesSearchReady, salesSearchHint, SALES_MIN_TEXT_SEARCH_LEN } from '../salesSearchUtils'

const mapStatusNameToKey = (name?: string): SaleStatusKey => {
    if (!name) return 'completed'
    const n = name.toLowerCase()
    if (n.includes('complet')) return 'completed'
    if (n.includes('cancel')) return 'cancelled'
    return 'completed'
}

const SALES_LIST_KEY = 'ventas/list'

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
    const adjusted = Number(r.adjusted_total ?? totalNum)
    const adjustedTotal = Number.isFinite(adjusted) ? adjusted : totalNum
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
        isCredit: paymentObj?.is_credit === true,
        dueDate: r.due_date ? String(r.due_date) : undefined,
        creditPaid: Array.isArray(r.paymentEntries) ? r.paymentEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0) : 0,
        creditBalance: Math.max(0, adjustedTotal - (Array.isArray(r.paymentEntries) ? r.paymentEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0) : 0)),
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

export const useSalesData = () => {
    const [searchTerm, updateSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, updateStatusFilter] = useState<SaleStatusKey | 'all'>('all')
    const [paymentFilter, updatePaymentFilter] = useState('all')
    const [period, updatePeriod] = useState('today')
    const { page, setPage, pageSize, setPageSize: updatePageSize, viewMode, setViewMode } = usePersistedListUiState(SALES_LIST_KEY, { defaultPageSize: 10, defaultView: 'table' })

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400)
        return () => window.clearTimeout(timer)
    }, [searchTerm])

    const isGlobalSearch = isSalesSearchReady(searchTerm)
    const searchHint = salesSearchHint(searchTerm)
    const searchPending = !searchHint && Boolean(searchTerm.trim()) && searchTerm.trim() !== debouncedSearch
    const listEnabled = !searchTerm.trim() || (isGlobalSearch && !searchPending)

    const listQuery = useSales({
        status: statusFilter === 'all' ? undefined : STATUS_DB_NAMES[statusFilter],
        payment: paymentFilter === 'all' ? undefined : paymentFilter,
        period: isGlobalSearch ? undefined : period,
        search: isGlobalSearch ? debouncedSearch : undefined,
        pageSize,
        page,
    }, {
        enabled: listEnabled,
    })
    // El resumen corresponde al período completo, no a la página ni a la búsqueda global.
    const summaryQuery = useSales({ status: 'Completada', period, page: 1, pageSize: 1, includeSummary: true })
    const summary = summaryQuery.data?.summary

    const refreshSales = () => {
        if (listEnabled) listQuery.refetch()
        summaryQuery.refetch()
    }
    const sales = useMemo(() => (listQuery.data?.items ?? []).map(normalizeRawSale), [listQuery.data])

    return {
        filters: { searchTerm, statusFilter, paymentFilter, period, isGlobalSearch, searchHint, minSearchLength: SALES_MIN_TEXT_SEARCH_LEN },
        setSearchTerm: (value: string) => { updateSearchTerm(value); setPage(1) },
        setStatusFilter: (value: SaleStatusKey | 'all') => { updateStatusFilter(value); setPage(1) },
        setPaymentFilter: (value: string) => { updatePaymentFilter(value); setPage(1) },
        setPeriod: (value: string) => { updatePeriod(value); setPage(1) },
        sales: searchHint || searchPending ? [] : sales,
        pageInfo: { page: listQuery.data?.page ?? page, totalPages: listEnabled ? listQuery.data?.totalPages ?? null : null, totalItems: listEnabled ? listQuery.data?.totalItems ?? null : null, hasMore: listEnabled && (listQuery.data?.hasMore ?? false) },
        isLoading: searchPending || listQuery.isLoading,
        isFetching: listQuery.isFetching,
        error: listQuery.isError ? listQuery.error?.message || 'No se pudieron cargar las ventas.' : null,
        summaryLoading: summaryQuery.isLoading,
        summaryError: summaryQuery.isError || (!summaryQuery.isLoading && !summary),
        totalSalesToday: summary?.totalSales ?? 0,
        transactionCountToday: summary?.transactionCount ?? 0,
        averageTicketToday: summary?.averageTicket ?? 0,
        preferredPaymentMethod: summary?.preferredPaymentMethod ?? '—',
        setPage,
        pageSize,
        setPageSize: (value: number) => { updatePageSize(value); setPage(1) },
        viewMode,
        setViewMode,
        refreshSales,
    }
}
