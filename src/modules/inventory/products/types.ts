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
 * Types specific to the Products feature
 */
import type { Product } from '@/types/product'

export interface ProductFormData {
    name: string
    category: string
    brand: string
    size: string
    price: string
    priceWholesale: string
    pricePromotion: string
    promotionValidUntil: string
    cost: string
    stock: string
    minStock: string
    supplier: string
    barcode: string
    description: string
    imageUrl: string
    /** Si es false, no se muestra en el punto de venta. */
    availableForSale: boolean
    /** Si es true, cada ingreso de mercancía exige fecha de caducidad (lotes). */
    tracksExpiry: boolean
    /** STANDARD = producto normal; KIT = combo armado con componentes. */
    productKind: 'STANDARD' | 'KIT'
    kitComponents: import('@/types/product').ProductBomComponentDraft[]
}

export interface ProductFilters {
    searchTerm: string
    categoryFilter: string
}

export interface DialogStates {
    newProduct: boolean
    viewProduct: boolean
    editProduct: boolean
    deleteConfirm: boolean
    scanner: boolean
}

export const EMPTY_PRODUCT_FORM: ProductFormData = {
    name: '',
    category: '',
    brand: '',
    size: '',
    price: '',
    priceWholesale: '',
    pricePromotion: '',
    promotionValidUntil: '',
    cost: '',
    stock: '',
    minStock: '',
    supplier: '',
    barcode: '',
    description: '',
    imageUrl: '',
    availableForSale: true,
    tracksExpiry: false,
    productKind: 'STANDARD',
    kitComponents: [],
}

export const getProductStatusBadge = (product: Product) => {
    if (product.stock === 0 || product.status === 'out_of_stock') {
        return { variant: 'destructive' as const, label: 'Sin Stock' }
    } else if (product.stock <= product.minStock || product.status === 'low_stock') {
        return { variant: 'warning' as const, label: 'Stock Bajo', className: 'bg-liquor-amber text-liquor-bronze' }
    } else {
        return { variant: 'success' as const, label: 'Disponible', className: 'bg-liquor-gold text-liquor-bronze' }
    }
}
