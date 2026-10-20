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
import {normalizeUnitDecimal,exactProductValues,unitsDraft,initialUnitsConfiguration,productDecimalPayload} from '../../units/public'

interface UseProductFormReturn {
    formData: ProductFormData
    setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>
    resetForm: () => void
    validateForm: () => boolean
    populateFromProduct: (product: Product, suppliers: Array<{ id: string | number; name: string }>, categories: Array<{ id: string | number; name: string }>) => void
    generateBarcode: () => string
}

export const useProductForm = (kind: Product['kind'] = 'STANDARD'): UseProductFormReturn => {
    const { toast } = useToast()
    const [formData, setFormData] = useState<ProductFormData>({...EMPTY_PRODUCT_FORM,productKind:kind})

    const resetForm = useCallback(() => {
        setFormData({...EMPTY_PRODUCT_FORM,productKind:kind})
    }, [kind])

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

        if (!formData.price) {
            toast({
                title: 'Campo requerido',
                description: 'El precio debe ser mayor a 0',
                variant: 'destructive'
            })
            return false
        }

        if (formData.productKind === 'SERVICE' && (!formData.serviceUnitLabel.trim() || formData.serviceUnitLabel.trim().length > 50 || !/^[0-4]$/.test(formData.quantityDecimals))) {
            toast({title:'Servicio incompleto',description:'Ingresa una unidad de cobro y entre 0 y 4 decimales',variant:'destructive'})
            return false
        }
        if (formData.productKind !== 'SERVICE' && !formData.supplier) {
            toast({
                title: 'Campo requerido',
                description: 'El proveedor es obligatorio',
                variant: 'destructive'
            })
            return false
        }

        if (formData.productKind === 'KIT') {
            let valid=0;
            try{for(const component of formData.kitComponents){if(!component.component_product_id)throw Error('Selecciona cada componente');normalizeUnitDecimal(String(component.qty_per_unit),{decimals:6,allowZero:false});valid++}}catch(error){toast({title:'Revisa los componentes',description:error instanceof Error?error.message:undefined,variant:'destructive'});return false}
            if (valid === 0) {
                toast({
                    title: 'Kit incompleto',
                    description: 'Agrega al menos un componente con cantidad',
                    variant: 'destructive',
                })
                return false
            }
        }

        try {
            initialUnitsConfiguration(formData.units,formData.productKind)
            const values=productDecimalPayload(formData,{kind:formData.productKind,quantityDecimals:Number(formData.units.baseUnitId?formData.units.quantityDecimals:formData.quantityDecimals),advanced:!!formData.units.baseUnitId})
            if(values.price==='0')throw new Error('El precio debe ser mayor a 0')
        }catch(error){toast({title:'Revisa cantidades y precios',description:(error as Error).message,variant:'destructive'});return false}

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

        const exact=exactProductValues(product)
        setFormData({
            units:unitsDraft(product.unitConfiguration),
            name: product.name,
            category: categoryValue,
            brand: product.brand,
            size: product.size,
            price: exact.price,
            priceWholesale:
                exact.priceWholesale??'',
            pricePromotion:
                exact.pricePromotion??'',
            promotionValidUntil: product.promotionValidUntil
                ? String(product.promotionValidUntil).slice(0, 16)
                : '',
            cost: exact.cost,
            stock: exact.stock,
            minStock: exact.minStock,
            supplier: supplierValue,
            barcode: product.barcode,
            description: product.description || '',
            imageUrl: product.imageUrl || '',
            availableForSale: product.availableForSale !== false,
            tracksExpiry: product.tracksExpiry === true,
            productKind: product.kind ?? 'STANDARD',
            serviceUnitLabel: product.serviceUnitLabel ?? 'Sesión',
            quantityDecimals: String(product.quantityDecimals ?? 0),
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
