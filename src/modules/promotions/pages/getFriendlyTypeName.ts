/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 */

export const getFriendlyTypeName = (typeName: string): string => {
  const names: Record<string, string> = {
    PERCENTAGE: 'Porcentaje',
    FIXED_AMOUNT: 'Monto Fijo',
    BUY_X_GET_Y: 'Lleva X Paga Y',
    COMBO_DISCOUNT: 'Combo',
    FREE_GIFT: 'Regalo Gratis',
    MIN_QTY_DISCOUNT: 'Cantidad Mínima'
  }
  return names[typeName] ?? typeName
}
