/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Configuración por tipo de promoción: etiquetas, descripciones y campos requeridos.
 * Alineado con backend (promotionCalculator + promotions.controller).
 */

export const PROMOTION_TYPE_NAMES = [
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'BUY_X_GET_Y',
  'COMBO_DISCOUNT',
  'FREE_GIFT',
  'MIN_QTY_DISCOUNT'
] as const

export type PromotionTypeName = (typeof PROMOTION_TYPE_NAMES)[number]

export interface TypeConfig {
  name: PromotionTypeName
  label: string
  shortDescription: string
  /** Campos obligatorios además de name y type_id */
  requiredFields: string[]
  /** Si true, cuando applies_to_all es false se pueden elegir productos/categorías */
  supportsProductCategoryRestriction: boolean
}

export const PROMOTION_TYPE_CONFIG: Record<PromotionTypeName, TypeConfig> = {
  PERCENTAGE: {
    name: 'PERCENTAGE',
    label: 'Porcentaje',
    shortDescription: 'Descuento porcentual sobre el total o productos seleccionados',
    requiredFields: ['discount_percentage'],
    supportsProductCategoryRestriction: true
  },
  FIXED_AMOUNT: {
    name: 'FIXED_AMOUNT',
    label: 'Monto fijo',
    shortDescription: 'Descuento de monto fijo (ej: Q50 de descuento)',
    requiredFields: ['discount_value'],
    supportsProductCategoryRestriction: false
  },
  BUY_X_GET_Y: {
    name: 'BUY_X_GET_Y',
    label: 'Lleva X Paga Y',
    shortDescription: 'Compra X unidades y lleva Y gratis (ej: 2x1, 3x2)',
    requiredFields: ['buy_quantity', 'get_quantity'],
    supportsProductCategoryRestriction: true
  },
  COMBO_DISCOUNT: {
    name: 'COMBO_DISCOUNT',
    label: 'Combo',
    shortDescription: 'Compra producto A y obtén descuento en producto B',
    requiredFields: ['trigger_product_id', 'target_product_id', 'discount_percentage'],
    supportsProductCategoryRestriction: false
  },
  FREE_GIFT: {
    name: 'FREE_GIFT',
    label: 'Regalo gratis',
    shortDescription: 'Compra producto A y lleva producto B gratis',
    requiredFields: ['trigger_product_id', 'target_product_id'],
    supportsProductCategoryRestriction: false
  },
  MIN_QTY_DISCOUNT: {
    name: 'MIN_QTY_DISCOUNT',
    label: 'Cantidad mínima',
    shortDescription: 'Descuento al comprar una cantidad mínima (ej: 3+ con 10% OFF)',
    requiredFields: ['min_quantity', 'discount_percentage'],
    supportsProductCategoryRestriction: true
  }
}

export function getTypeConfig(typeName: string): TypeConfig | null {
  if (PROMOTION_TYPE_NAMES.includes(typeName as PromotionTypeName)) {
    return PROMOTION_TYPE_CONFIG[typeName as PromotionTypeName]
  }
  return null
}

/** Tipos donde tiene sentido restringir por productos/categorías (al desmarcar «Aplica a todos»). */
export function supportsProductCategoryScope(typeName: string): boolean {
  return getTypeConfig(typeName)?.supportsProductCategoryRestriction ?? false
}

export function validatePayloadForType(
  typeName: string,
  payload: Record<string, unknown>
): { valid: boolean; message?: string } {
  const config = getTypeConfig(typeName)
  if (!config) return { valid: true }

  for (const field of config.requiredFields) {
    const value = payload[field]
    if (value === undefined || value === null || value === '') {
      const messages: Record<string, string> = {
        discount_percentage: 'Ingresa el porcentaje de descuento',
        discount_value: 'Ingresa el monto de descuento (Q)',
        buy_quantity: 'Ingresa la cantidad a comprar (ej: 2 para 2x1)',
        get_quantity: 'Ingresa la cantidad que lleva gratis',
        min_quantity: 'Ingresa la cantidad mínima',
        trigger_product_id: 'Selecciona el producto activador',
        target_product_id: 'Selecciona el producto con descuento o regalo'
      }
      return { valid: false, message: messages[field] ?? `El campo ${field} es requerido` }
    }
    if (field === 'discount_percentage') {
      const n = Number(value)
      if (isNaN(n) || n < 0 || n > 100) {
        return { valid: false, message: 'El porcentaje debe estar entre 0 y 100' }
      }
    }
    if ((field === 'buy_quantity' || field === 'get_quantity' || field === 'min_quantity') && Number(value) < 0) {
      return { valid: false, message: 'La cantidad debe ser mayor o igual a 0' }
    }
    if (field === 'discount_value' && Number(value) < 0) {
      return { valid: false, message: 'El monto debe ser mayor o igual a 0' }
    }
  }
  return { valid: true }
}
