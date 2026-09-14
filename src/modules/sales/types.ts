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
 * Types specific to the Sales feature
 */
import { Product } from '@/types/product'
import { SaleStatus, PaymentMethod } from '@/types'

export interface CartProduct extends Product {
    qty: number
}

export interface NegativeStockProduct {
    id: string
    name: string
    category: string
    supplier: string
    current_stock: number
    barcode: string | null
    status: string
}

export interface AvailabilityDialogState {
    open: boolean
    product: Product | null
    requestedQty: number
    availableStock: number
}

export interface AdminAuthDialogState {
    open: boolean
    product: Product | null
    requestedQty: number
}

export interface NegativeStockDialogState {
    open: boolean
    products: NegativeStockProduct[]
}

export interface SaleFilters {
    searchTerm: string
    statusFilter: SaleStatus | 'all'
    paymentFilter: PaymentMethod | 'all'
    period: string
    isGlobalSearch?: boolean
    searchHint?: string | null
    minSearchLength?: number
}

export type SaleStatusKey = 'completed' | 'cancelled'

export const STATUS_LABELS: Record<SaleStatusKey, string> = {
    completed: 'Completadas',
    cancelled: 'Canceladas'
}

export const STATUS_DB_NAMES: Record<SaleStatusKey, string> = {
    completed: 'Completada',
    cancelled: 'Cancelada'
}
