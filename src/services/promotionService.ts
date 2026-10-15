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
 * Promotion Service
 * API calls for discount/promotion codes
 */

import { apiFetch } from './api'
import type {CouponDesign} from '@/modules/promotions/coupons/couponDesign'

export interface PromotionType {
    id: number
    name: string
    description?: string
}

export interface Promotion {
    coupon_design?:CouponDesign|null
    id: string
    code: string
    name: string
    description?: string
    type: PromotionType
    discount_value?: number
    discount_percentage?: number
    buy_quantity?: number
    get_quantity?: number
    min_quantity?: number
    applies_to_all: boolean
    trigger_product_id?: string
    target_product_id?: string
    start_date: string
    end_date?: string
    max_uses?: number
    current_uses: number
    active: boolean
    /** true = toda la empresa; false = solo las sucursales de `branches` */
    applies_to_all_branches?: boolean
    branches?: { branch: { id: string; name: string; code: string } }[]
}

export interface CartItemForPromotion {
    product_id: string
    price: number
    qty: number | string
    category_id?: number
}

export interface ValidateCodeResponse {
    valid: boolean
    message?: string
    promotion?: Promotion
    discount: number
    details: {
        type: string
        percentage?: number
        itemsAffected?: string[]
        [key: string]: unknown
    }
    freeGift?: {
        product_id: string
        qty?: number
        mustAddToCart?: boolean
    }
}

export interface AppliedPromotion extends Promotion {
    discountApplied: number
    freeGift?: {
        product_id: string
        qty?: number
        mustAddToCart?: boolean
    }
}

/**
 * Validate a promotion code for a given cart
 */
export const validatePromotionCode = async (
    code: string,
    items: CartItemForPromotion[]
): Promise<ValidateCodeResponse> => {
    return apiFetch<ValidateCodeResponse>('/promotions/validate', {
        method: 'POST',
        body: JSON.stringify({ code, items })
    })
}

/**
 * Calculate discount for a promotion
 */
export const calculatePromotionDiscount = async (
    promotionId: string,
    items: CartItemForPromotion[]
): Promise<{ discount: number; details: Record<string, unknown> }> => {
    return apiFetch('/promotions/calculate', {
        method: 'POST',
        body: JSON.stringify({ promotion_id: promotionId, items })
    })
}

/**
 * Get all promotion types
 */
export const getPromotionTypes = async (): Promise<PromotionType[]> => {
    return apiFetch<PromotionType[]>('/promotions/types')
}

/**
 * Get all active promotions
 */
export const getActivePromotions = async (): Promise<Promotion[]> => {
    const response = await apiFetch<{ items: Promotion[] }>('/promotions?active=true')
    return response.items
}

/**
 * Get promotion by code
 */
export const getPromotionByCode = async (code: string): Promise<Promotion> => {
    return apiFetch<Promotion>(`/promotions/code/${code}`)
}

/**
 * Create a new promotion (admin)
 */
export const createPromotion = async (data: Partial<Promotion> & {
    product_ids?: string[]
    category_ids?: number[]
    branch_ids?: string[]
}): Promise<Promotion> => {
    return apiFetch<Promotion>('/promotions', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

/**
 * Update a promotion (admin)
 */
export const updatePromotion = async (
    id: string,
    data: Partial<Promotion> & { branch_ids?: string[] }
): Promise<Promotion> => {
    return apiFetch<Promotion>(`/promotions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

/**
 * Delete a promotion (admin)
 */
export const deletePromotion = async (id: string): Promise<void> => {
    await apiFetch(`/promotions/${id}`, { method: 'DELETE' })
}

const promotionService = {
    validatePromotionCode,
    calculatePromotionDiscount,
    getPromotionTypes,
    getActivePromotions,
    getPromotionByCode,
    createPromotion,
    updatePromotion,
    deletePromotion
}

export default promotionService
