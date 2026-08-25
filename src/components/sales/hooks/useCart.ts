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
 * useCart - Custom hook for managing the shopping cart
 */
import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { getApiBaseUrl } from '@/services/api'
import type { Product } from '@/types/product'
import type { CartProduct, AvailabilityDialogState, AdminAuthDialogState } from '../types'

interface UseCartOptions {
    availableProducts: Product[]
    /** Precio unitario según cliente/canal (POS); si no se envía, se usa `product.price`. */
    getUnitPrice?: (product: Product) => number
    /** Cantidad vendible (stock − reservas); por defecto `product.stock`. */
    getAvailableQty?: (product: Product) => number
}

interface UseCartReturn {
    cartItems: CartProduct[]
    cartTotal: number
    adminAuthorizedProducts: Set<string>
    availabilityDialog: AvailabilityDialogState
    adminAuthDialog: AdminAuthDialogState
    additionalQty: string
    adminUsername: string
    adminPassword: string
    isAuthenticating: boolean
    // Actions
    addToCart: (product: Product) => void
    removeFromCart: (productId: string) => void
    updateQuantity: (productId: string, newQty: number) => void
    clearCart: () => void
    /** Restaura líneas desde borrador; devuelve productIds no encontrados en catálogo. */
    hydrateFromLines: (
        lines: { productId: string; qty: number }[],
        adminAuthorizedIds: string[]
    ) => { missingProductIds: string[]; qtyAdjustedIds: string[] }
    /** Recalcula precios en carrito (p. ej. tras cambiar canal o cliente). */
    repriceCartLines: () => void
    setAdditionalQty: (qty: string) => void
    setAdminUsername: (username: string) => void
    setAdminPassword: (password: string) => void
    // Dialog handlers
    handleConfirmAdditionalQty: () => void
    handleCancelAvailability: () => void
    handleAdminAuth: () => Promise<void>
    closeAdminAuthDialog: () => void
}

export const useCart = ({ availableProducts, getUnitPrice, getAvailableQty }: UseCartOptions): UseCartReturn => {
    const { toast } = useToast()

    // Cart state
    const [cartItems, setCartItems] = useState<CartProduct[]>([])
    const [adminAuthorizedProducts, setAdminAuthorizedProducts] = useState<Set<string>>(new Set())

    // Availability dialog state
    const [availabilityDialog, setAvailabilityDialog] = useState<AvailabilityDialogState>({
        open: false,
        product: null,
        requestedQty: 0,
        availableStock: 0
    })
    const [additionalQty, setAdditionalQty] = useState('')

    // Admin auth dialog state
    const [adminAuthDialog, setAdminAuthDialog] = useState<AdminAuthDialogState>({
        open: false,
        product: null,
        requestedQty: 0
    })
    const [adminUsername, setAdminUsername] = useState('')
    const [adminPassword, setAdminPassword] = useState('')
    const [isAuthenticating, setIsAuthenticating] = useState(false)

    // Computed
    const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0)

    const resolveAvailable = useCallback(
        (product: Product) => (getAvailableQty ? getAvailableQty(product) : Number(product.stock ?? 0)),
        [getAvailableQty]
    )

    // Actions
    const addToCart = useCallback((product: Product) => {
        const unit = getUnitPrice ? getUnitPrice(product) : Number(product.price ?? 0)
        const available = resolveAvailable(product)
        const existing = cartItems.find(i => i.id === product.id)
        const currentQty = existing?.qty ?? 0
        const requestedQty = currentQty + 1

        if (requestedQty <= available) {
            // La decisión de fusionar se toma con `prev`, no con el `cartItems` del
            // closure: dos llamadas en el mismo tick veían ambas "no está" y metían
            // dos renglones del mismo producto.
            setCartItems(prev => {
                const found = prev.find(i => i.id === product.id)
                if (found) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
                return [...prev, { ...product, price: unit, qty: 1 }]
            })
            return
        }

        // Insufficient stock: ask for additional quantity
        setAvailabilityDialog({ open: true, product, requestedQty, availableStock: available })
        setAdditionalQty('')
    }, [cartItems, getUnitPrice, resolveAvailable])

    const removeFromCart = useCallback((productId: string) => {
        setCartItems(prev => prev.filter(i => i.id !== productId))
        setAdminAuthorizedProducts(prev => {
            const newSet = new Set(prev)
            newSet.delete(productId)
            return newSet
        })
    }, [])

    const updateQuantity = useCallback((productId: string, newQty: number) => {
        if (newQty <= 0) return removeFromCart(productId)

        const prod = availableProducts.find(p => p.id === productId)
        if (!prod) return

        const available = resolveAvailable(prod)

        if (newQty <= available) {
            setCartItems(prev => prev.map(i => i.id === productId ? { ...i, qty: newQty } : i))
            return
        }

        // Insufficient stock
        setAvailabilityDialog({ open: true, product: prod, requestedQty: newQty, availableStock: available })
        setAdditionalQty('')
    }, [availableProducts, removeFromCart, resolveAvailable])

    const clearCart = useCallback(() => {
        setCartItems([])
        setAdminAuthorizedProducts(new Set())
    }, [])

    const hydrateFromLines = useCallback(
        (lines: { productId: string; qty: number }[], adminAuthorizedIds: string[]) => {
            const adminSet = new Set(adminAuthorizedIds)
            const missingProductIds: string[] = []
            const qtyAdjustedIds: string[] = []
            const built: CartProduct[] = []

            for (const line of lines) {
                const q = Math.max(1, Math.floor(Number(line.qty) || 1))
                const p = availableProducts.find((x) => x.id === line.productId)
                if (!p) {
                    missingProductIds.push(line.productId)
                    continue
                }
                const stock = resolveAvailable(p)
                let qty = q
                if (!adminSet.has(line.productId) && qty > stock) {
                    qty = Math.max(0, stock)
                    if (qty === 0) {
                        missingProductIds.push(line.productId)
                        continue
                    }
                    qtyAdjustedIds.push(line.productId)
                }
                const unit = getUnitPrice ? getUnitPrice(p) : Number(p.price ?? 0)
                built.push({ ...p, price: unit, qty })
            }

            setCartItems(built)
            setAdminAuthorizedProducts(adminSet)
            return { missingProductIds, qtyAdjustedIds }
        },
        [availableProducts, getUnitPrice, resolveAvailable]
    )

    // Dialog handlers
    const handleConfirmAdditionalQty = useCallback(() => {
        const additional = parseInt(additionalQty)

        if (!additional || additional <= 0 || isNaN(additional)) {
            toast({
                title: 'Cantidad inválida',
                description: 'Ingresa una cantidad válida mayor a 0.',
                variant: 'destructive'
            })
            return
        }

        const { product, availableStock } = availabilityDialog
        const totalQty = availableStock + additional

        setAvailabilityDialog({ open: false, product: null, requestedQty: 0, availableStock: 0 })
        setAdminAuthDialog({ open: true, product, requestedQty: totalQty })
    }, [additionalQty, availabilityDialog, toast])

    const handleCancelAvailability = useCallback(() => {
        setAvailabilityDialog({ open: false, product: null, requestedQty: 0, availableStock: 0 })
        setAdditionalQty('')
        toast({
            title: 'Cancelado',
            description: 'No se agregó el producto.',
            variant: 'default'
        })
    }, [toast])

    const handleAdminAuth = useCallback(async () => {
        if (!adminUsername.trim() || !adminPassword.trim()) {
            toast({
                title: 'Credenciales requeridas',
                description: 'Ingresa usuario y contraseña de administrador.',
                variant: 'destructive'
            })
            return
        }

        setIsAuthenticating(true)

        try {
            const response = await fetch(`${getApiBaseUrl()}/auth/validate-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: adminUsername, password: adminPassword })
            })

            const data = await response.json()

            if (!response.ok || !data.valid) {
                toast({
                    title: 'Credenciales inválidas',
                    description: 'Usuario o contraseña incorrectos.',
                    variant: 'destructive'
                })
                setIsAuthenticating(false)
                return
            }

            const { product, requestedQty } = adminAuthDialog

            if (product) {
                const existing = cartItems.find(i => i.id === product.id)

                if (existing) {
                    setCartItems(prev => prev.map(i =>
                        i.id === product.id ? { ...i, qty: requestedQty } : i
                    ))
                } else {
                    const unit = getUnitPrice ? getUnitPrice(product) : Number(product.price ?? 0)
                    setCartItems(prev => [...prev, { ...product, price: unit, qty: requestedQty }])
                }

                setAdminAuthorizedProducts(prev => new Set(prev).add(product.id))

                toast({
                    title: 'Producto agregado',
                    description: `Se agregó "${product.name}" con autorización de administrador.`,
                    variant: 'default'
                })
            }

            setAdminUsername('')
            setAdminPassword('')
            setAdminAuthDialog({ open: false, product: null, requestedQty: 0 })

        } catch {
            toast({
                title: 'Error',
                description: 'No se pudo validar las credenciales. Intenta nuevamente.',
                variant: 'destructive'
            })
        } finally {
            setIsAuthenticating(false)
        }
    }, [adminUsername, adminPassword, adminAuthDialog, cartItems, toast, getUnitPrice])

    const closeAdminAuthDialog = useCallback(() => {
        setAdminAuthDialog({ open: false, product: null, requestedQty: 0 })
        setAdminUsername('')
        setAdminPassword('')
    }, [])

    const repriceCartLines = useCallback(() => {
        if (!getUnitPrice) return
        setCartItems((prev) =>
            prev.map((i) => {
                const p = availableProducts.find((x) => x.id === i.id)
                if (!p) return i
                return { ...i, price: getUnitPrice(p) }
            })
        )
    }, [availableProducts, getUnitPrice])

    return {
        cartItems,
        cartTotal,
        adminAuthorizedProducts,
        availabilityDialog,
        adminAuthDialog,
        additionalQty,
        adminUsername,
        adminPassword,
        isAuthenticating,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        hydrateFromLines,
        repriceCartLines,
        setAdditionalQty,
        setAdminUsername,
        setAdminPassword,
        handleConfirmAdditionalQty,
        handleCancelAvailability,
        handleAdminAuth,
        closeAdminAuthDialog,
    }
}
