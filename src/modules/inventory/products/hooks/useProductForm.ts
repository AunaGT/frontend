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
 * useProductForm - Custom hook for managing product form state and validation
 */
import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { Product } from '@/types/product'
import { ProductFormData, EMPTY_PRODUCT_FORM } from '../types'

interface UseProductFormReturn {
    formData: ProductFormData
    setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>
    resetForm: () => void
    validateForm: () => boolean
    populateFromProduct: (product: Product, suppliers: Array<{ id: string | number; name: string }>, categories: Array<{ id: string | number; name: string }>) => void
    generateBarcode: () => string
}

export const useProductForm = (): UseProductFormReturn => {
    const { toast } = useToast()
    const [formData, setFormData] = useState<ProductFormData>(EMPTY_PRODUCT_FORM)

    const resetForm = useCallback(() => {
        setFormData(EMPTY_PRODUCT_FORM)
    }, [])

    const validateForm = useCallback((): boolean => {
        if (!formData.name || formData.name.trim() === '') {
            toast({
                title: 'Campo requerido',
                description: 'El nombre del producto es obligatorio',
                variant: 'destructive'
            })
            return false
        }

        if (!formData.category) {
            toast({
                title: 'Campo requerido',
                description: 'La categoría del producto es obligatoria',
                variant: 'destructive'
            })
            return false
        }

        if (!formData.price || Number(formData.price) <= 0) {
            toast({
                title: 'Campo requerido',
                description: 'El precio debe ser mayor a 0',
                variant: 'destructive'
            })
            return false
        }

        if (!formData.supplier) {
            toast({
                title: 'Campo requerido',
                description: 'El proveedor es obligatorio',
                variant: 'destructive'
            })
            return false
        }

        if (formData.productKind === 'KIT') {
            const valid = formData.kitComponents.filter(
                (c) => c.component_product_id && c.qty_per_unit > 0
            )
            if (valid.length === 0) {
                toast({
                    title: 'Kit incompleto',
                    description: 'Agrega al menos un componente con cantidad',
                    variant: 'destructive',
                })
                return false
            }
        }

        if (formData.minStock && Number(formData.minStock) < 0) {
            toast({
                title: 'Valor inválido',
                description: 'El stock mínimo no puede ser negativo',
                variant: 'destructive'
            })
            return false
        }

        if (formData.stock && Number(formData.stock) < 0) {
            toast({
                title: 'Valor inválido',
                description: 'El stock no puede ser negativo',
                variant: 'destructive'
            })
            return false
        }

        if (formData.cost && Number(formData.cost) < 0) {
            toast({
                title: 'Valor inválido',
                description: 'El costo no puede ser negativo',
                variant: 'destructive'
            })
            return false
        }

        return true
    }, [formData, toast])

    const populateFromProduct = useCallback((
        product: Product,
        suppliers: Array<{ id: string | number; name: string }>,
        categories: Array<{ id: string | number; name: string }>
    ) => {
        // Obtener supplier_id: primero intentar usar supplierId si está disponible
        let supplierValue = ''
        if (product.supplierId) {
            supplierValue = String(product.supplierId)
        } else {
            // Si no hay supplierId, buscar por nombre
            const supplierName = String(product.supplier ?? '')
            const matchSupplier = suppliers.find(s =>
                String(s.name).toLowerCase() === supplierName.toLowerCase()
            )
            if (matchSupplier) {
                supplierValue = String(matchSupplier.id)
            } else {
                // Si no se encuentra, usar el nombre como fallback (el backend lo manejará)
                supplierValue = supplierName
            }
        }

        // Obtener category_id: buscar por nombre si es necesario
        let categoryValue = String(product.category ?? '')
        const matchCategory = categories.find(c =>
            String(c.name).toLowerCase() === String(product.category ?? '').toLowerCase()
        )
        if (matchCategory) {
            categoryValue = String(matchCategory.id)
        }

        setFormData({
            name: product.name,
            category: categoryValue,
            brand: product.brand,
            size: product.size,
            price: product.price.toString(),
            priceWholesale:
                product.priceWholesale != null && product.priceWholesale > 0
                    ? String(product.priceWholesale)
                    : '',
            pricePromotion:
                product.pricePromotion != null && product.pricePromotion > 0
                    ? String(product.pricePromotion)
                    : '',
            promotionValidUntil: product.promotionValidUntil
                ? String(product.promotionValidUntil).slice(0, 16)
                : '',
            cost: product.cost.toString(),
            stock: product.stock.toString(),
            minStock: product.minStock.toString(),
            supplier: supplierValue,
            barcode: product.barcode,
            description: product.description || '',
            imageUrl: product.imageUrl || '',
            availableForSale: product.availableForSale !== false,
            tracksExpiry: product.tracksExpiry === true,
            productKind: product.kind === 'KIT' ? 'KIT' : 'STANDARD',
            kitComponents: (product.kitComponents ?? []).map((line) => ({
                component_product_id: line.component_product_id,
                qty_per_unit: line.qty_per_unit,
                component_name: line.component_product?.name,
            })),
        })
    }, [])

    const generateBarcode = useCallback((): string => {
        const code = Date.now().toString().slice(-10)
        setFormData(prev => ({ ...prev, barcode: code }))
        return code
    }, [])

    return {
        formData,
        setFormData,
        resetForm,
        validateForm,
        populateFromProduct,
        generateBarcode
    }
}
