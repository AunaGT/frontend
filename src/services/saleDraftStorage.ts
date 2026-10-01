/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Borrador de nueva venta (localStorage, por usuario).
 */

export const SALE_DRAFT_VERSION = 1 as const

export interface NewSaleDraftLine {
  productId: string
  qty: number
}

export interface NewSaleDraft {
  v: typeof SALE_DRAFT_VERSION
  savedAt: string
  customer: string
  customerNit: string
  /** UUID del contacto cliente si se eligió desde el listado guardado */
  pickedCustomerId?: string
  isFinalConsumer: boolean
  /** Canal de venta para precios (lista / mayoreo según reglas). */
  salesChannel?: 'POS' | 'WHOLESALE' | 'ONLINE'
  paymentMethodId: number | null
  amountReceived: string
  creditDueDate?: string
  initialCreditPayment?: string
  initialCreditMethod?: string
  lines: NewSaleDraftLine[]
  adminAuthorizedProductIds: string[]
  promotionCodes: string[]
  productPageSize: number
}

function keyForUser(userId: string): string {
  return `deposito:new-sale-draft:v${SALE_DRAFT_VERSION}:${userId}`
}

export function saveNewSaleDraft(userId: string, draft: Omit<NewSaleDraft, "v" | "savedAt">): void {
  try {
    const payload: NewSaleDraft = {
      ...draft,
      v: SALE_DRAFT_VERSION,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(keyForUser(userId), JSON.stringify(payload))
  } catch {
    // quota / private mode
  }
}

export function loadNewSaleDraft(userId: string): NewSaleDraft | null {
  try {
    const raw = localStorage.getItem(keyForUser(userId))
    if (!raw) return null
    const data = JSON.parse(raw) as NewSaleDraft
    if (data?.v !== SALE_DRAFT_VERSION || !Array.isArray(data.lines)) return null
    return data
  } catch {
    return null
  }
}

export function clearNewSaleDraft(userId: string): void {
  try {
    localStorage.removeItem(keyForUser(userId))
  } catch {
    // no-op
  }
}

export function hasNewSaleDraft(userId: string): boolean {
  return loadNewSaleDraft(userId) != null
}
