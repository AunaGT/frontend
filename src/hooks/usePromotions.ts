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
 * usePromotions Hook
 * Manages promotion codes state for sales
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { formatMoney } from '@/utils'
import {
    validatePromotionCode,
    AppliedPromotion,
    CartItemForPromotion,
    Promotion
} from '@/services/promotionService'

/** Alineado con backend: MAX_PROMOTION_CODES_PER_SALE. Sin variable = sin límite en UI. */
function maxPromoCodesPerSale(): number {
    const v = import.meta.env.VITE_MAX_PROMOTION_CODES_PER_SALE
    if (v === undefined || v === '' || v === null) return Number.POSITIVE_INFINITY
    const n = parseInt(String(v), 10)
    return Number.isFinite(n) && n >= 1 ? n : Number.POSITIVE_INFINITY
}

interface UsePromotionsProps {
    contextKey?: string
    cartItems: CartItemForPromotion[]
    cartTotal: number
    locale?: string
    currencyCode?: string
}

interface UsePromotionsReturn {
    // State
    appliedPromotions: AppliedPromotion[]
    totalDiscount: number
    finalTotal: number
    promotionCodes: string[]
    isValidating: boolean

    // Actions
    applyCode: (code: string) => Promise<boolean>
    removePromotion: (promotionId: string) => void
    clearPromotions: () => void
}

export function usePromotions({
    cartItems,
    cartTotal,
    contextKey = '',
    locale = 'es-GT',
    currencyCode = 'GTQ'
}: UsePromotionsProps): UsePromotionsReturn {
    const { toast } = useToast()
    const context = JSON.stringify([contextKey, cartItems, cartTotal])
    const currentContext = useRef(context)
    currentContext.current = context
    const [applied, setApplied] = useState<{context:string; promotions:AppliedPromotion[]}>({context, promotions:[]})
    const appliedPromotions = useMemo(() => applied.context === context ? applied.promotions : [], [applied,context])
    const [isValidating, setIsValidating] = useState(false)
    useEffect(() => {
        if (applied.context === context) return
        setApplied({context,promotions:[]})
        if (applied.promotions.length) toast({title:'Promociones actualizadas',description:'El carrito o su contexto cambió. Vuelve a aplicar los códigos para validar el descuento.'})
    }, [applied,context,toast])

    // Calculate totals
    const totalDiscount = useMemo(() => {
        return appliedPromotions.reduce((sum, promo) => sum + promo.discountApplied, 0)
    }, [appliedPromotions])

    const finalTotal = useMemo(() => {
        return Math.max(0, cartTotal - totalDiscount)
    }, [cartTotal, totalDiscount])

    const promotionCodes = useMemo(() => {
        return appliedPromotions.map(p => p.code)
    }, [appliedPromotions])

    // Apply a promotion code
    const applyCode = useCallback(async (code: string): Promise<boolean> => {
        if (!code.trim()) {
            toast({
                title: 'Error',
                description: 'Ingresa un código de promoción',
                variant: 'destructive'
            })
            return false
        }

        // Check if already applied
        const normalizedCode = code.toUpperCase().trim()
        if (appliedPromotions.some(p => p.code === normalizedCode)) {
            toast({
                title: 'Código ya aplicado',
                description: 'Esta promoción ya está aplicada a la venta',
                variant: 'destructive'
            })
            return false
        }

        const maxCodes = maxPromoCodesPerSale()
        if (appliedPromotions.length >= maxCodes) {
            toast({
                title: 'Límite de códigos',
                description:
                    maxCodes === 1
                        ? 'Solo puede aplicar un código de promoción por venta.'
                        : `Puede aplicar como máximo ${maxCodes} códigos de promoción por venta.`,
                variant: 'destructive'
            })
            return false
        }

        setIsValidating(true)

        try {
            const items = cartItems.map(item => ({
                product_id: item.product_id,
                price: item.price,
                qty: item.qty,
                category_id: item.category_id
            }))

            const result = await validatePromotionCode(normalizedCode, items)
            if (currentContext.current !== context) return false

            if (!result.valid) {
                toast({
                    title: 'Código no válido',
                    description: result.message || 'El código de promoción no es válido',
                    variant: 'destructive'
                })
                return false
            }

            if (result.discount === 0 && !result.freeGift?.mustAddToCart) {
                toast({
                    title: 'Sin descuento aplicable',
                    description: 'El código es válido pero no aplica descuento a los productos en el carrito',
                    variant: 'destructive'
                })
                return false
            }

            // Add to applied promotions
            const appliedPromo: AppliedPromotion = {
                ...result.promotion as Promotion,
                discountApplied: result.discount,
                freeGift: result.freeGift
                    ? {
                        product_id: result.freeGift.product_id,
                        qty: result.freeGift.qty ?? 1,
                        mustAddToCart: result.freeGift.mustAddToCart
                    }
                    : undefined
            }

            setApplied(prev => ({context, promotions:[...(prev.context===context ? prev.promotions : []), appliedPromo]}))

            const discountFmt =
                result.discount > 0
                    ? `-${formatMoney(result.discount, locale, currencyCode)}`
                    : null
            toast({
                title: '¡Promoción aplicada!',
                description: discountFmt
                    ? `${result.promotion?.name}: ${discountFmt}`
                    : result.freeGift?.mustAddToCart
                      ? `${result.promotion?.name}: agregue el producto regalo al carrito para aplicar el beneficio al registrar la venta.`
                      : (result.promotion?.name ?? 'Promoción aplicada')
            })

            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al validar código'
            toast({
                title: 'Error',
                description: message,
                variant: 'destructive'
            })
            return false
        } finally {
            setIsValidating(false)
        }
    }, [cartItems, appliedPromotions, toast, locale, currencyCode,context])

    // Remove a promotion
    const removePromotion = useCallback((promotionId: string) => {
        setApplied(prev => ({context,promotions:prev.context===context ? prev.promotions.filter(p => p.id !== promotionId) : []}))
        toast({
            title: 'Promoción removida',
            description: 'Se eliminó la promoción de la venta'
        })
    }, [toast,context])

    // Clear all promotions
    const clearPromotions = useCallback(() => {
        setApplied({context,promotions:[]})
    }, [context])

    return {
        appliedPromotions,
        totalDiscount,
        finalTotal,
        promotionCodes,
        isValidating,
        applyCode,
        removePromotion,
        clearPromotions
    }
}
