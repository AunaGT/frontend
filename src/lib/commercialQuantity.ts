import * as quantity from './commercialQuantity.mjs'

export type CommercialQuantity = string
export type QuantityRules = { kind: 'STANDARD' | 'KIT' | 'SERVICE'; quantityDecimals: number }
// Share the exact implementation with plain-JavaScript document drafts.
export const quantityTicks: (qty: string) => bigint = quantity.quantityTicks
export const normalizeQuantityInput: (input: string, rules: QuantityRules, locale: string) => string = quantity.normalizeQuantityInput
export const formatQuantity: (qty: string, locale: string) => string = quantity.formatQuantity
export const stepQuantity: (qty: string, direction: 1 | -1) => string = quantity.stepQuantity
export const remainingQuantity: (total:string,consumed:string)=>string = quantity.remainingQuantity
export const previewLineTotal: (qty: string, unitPrice: string) => string = quantity.previewLineTotal
export const previewPartialLineTotal: (totalQty: string, lineTotal: string, qty: string, consumedQty: string) => string = quantity.previewPartialLineTotal
