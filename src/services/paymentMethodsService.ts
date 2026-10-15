export type SettlementKind = 'CASH' | 'BANK' | 'CREDIT'
export interface PaymentMethodDto {
  id: number
  name: string
  is_credit: boolean
  settlement_kind: SettlementKind | null
  enabled: boolean
  position: number
  origin: 'BASIC' | 'LEGACY_SHARED' | 'COMPANY'
}
export type PaymentMethodScope = { companyId: string; branchId: string }
export const settlementKindLabel = (kind: SettlementKind | null, credit = false) =>
  kind === 'CASH' ? 'Efectivo' : kind === 'BANK' ? 'Medio bancario' : kind === 'CREDIT' || credit ? 'Venta a crédito' : 'Legado'
export function isCashMethod(method: { name?: string; settlement_kind?: SettlementKind | null } | null | undefined, legacy: (name: string) => boolean) {
  if (!method) return false
  return method.settlement_kind != null ? method.settlement_kind === 'CASH' : legacy(String(method.name || ''))
}
