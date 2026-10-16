/** Contrato público compartido por Devoluciones y su editor de Configuración. */
export type ReturnResolution = 'REFUND_ORIGINAL' | 'REFUND_CASH' | 'REFUND_TRANSFER' | 'CUSTOMER_CREDIT' | 'EXCHANGE'
export interface ReturnPolicy {
  windowDays: number
  allowAuthorizedExceptions: boolean
  exchangePricing: 'CURRENT_PRICE' | 'ORIGINAL_SALE_PRICE'
  enabledResolutions: ReturnResolution[]
}
export const RETURN_RESOLUTION_LABELS: Record<ReturnResolution, string> = {
  REFUND_ORIGINAL: 'Reembolso al medio original', REFUND_CASH: 'Reembolso en efectivo',
  REFUND_TRANSFER: 'Reembolso por transferencia', CUSTOMER_CREDIT: 'Saldo a favor del cliente', EXCHANGE: 'Cambio de producto',
}
export const DEFAULT_RETURN_POLICY: ReturnPolicy = {
  windowDays: 30, allowAuthorizedExceptions: true, exchangePricing: 'CURRENT_PRICE',
  enabledResolutions: ['REFUND_ORIGINAL', 'REFUND_CASH', 'REFUND_TRANSFER', 'CUSTOMER_CREDIT', 'EXCHANGE'],
}
