/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Borrador de nueva venta (localStorage, por usuario).
 */

export const SALE_DRAFT_VERSION = 2 as const

export interface NewSaleDraftLine {
  productId: string
  qty: string | number
  unitSelection?: import('@/modules/inventory/units/public').UnitSelection
  lineKey?: string
}

export interface NewSaleDraft {
  draftId?: string
  v: 1 | typeof SALE_DRAFT_VERSION
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

type DraftScope={companyId:string;branchId:string}
function keyForUser(userId: string, scope?:DraftScope): string {
  const companyId=scope?.companyId??localStorage.getItem('tenant:companyId')
  const branchId=scope?.branchId??localStorage.getItem('tenant:branchId')
  if(!companyId||!branchId||branchId==='all')throw Error('Selecciona empresa y sucursal para guardar el borrador')
  return `deposito:new-sale-draft:v2:${JSON.stringify([companyId,branchId,userId])}`
}

export function saveNewSaleDraft(userId: string, draft: Omit<NewSaleDraft, "v" | "savedAt">,scope?:DraftScope): void {
  try {
    const payload: NewSaleDraft = {
      ...draft,
      draftId:crypto.randomUUID(),
      v: SALE_DRAFT_VERSION,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(keyForUser(userId,scope), JSON.stringify(payload))
  } catch {
    // quota / private mode
  }
}

export function loadNewSaleDraft(userId: string,scope?:DraftScope): NewSaleDraft | null {
  try {
    const raw = localStorage.getItem(keyForUser(userId,scope))
    if (!raw) return null
    const data = JSON.parse(raw) as NewSaleDraft
    if (![1,SALE_DRAFT_VERSION].includes(data?.v) || !Array.isArray(data.lines)) return null
    if(localStorage.getItem(`${keyForUser(userId,scope)}:consumed`)===(data.draftId??data.savedAt))return null
    return data
  } catch {
    return null
  }
}

export function clearNewSaleDraft(userId: string,scope?:DraftScope): void {
  try {
    localStorage.removeItem(keyForUser(userId,scope))
  } catch {
    // no-op
  }
}

export function hasNewSaleDraft(userId: string,scope?:DraftScope): boolean {
  return loadNewSaleDraft(userId,scope) != null
}

export function consumeNewSaleDraft(userId:string,scope:DraftScope,draftId:string):boolean{
  const draft=loadNewSaleDraft(userId,scope)
  if(!draft||(draft.draftId??draft.savedAt)!==draftId)return false
  // Mark this generation consumed; never delete a newer draft saved by another tab.
  localStorage.setItem(`${keyForUser(userId,scope)}:consumed`,draftId)
  return true
}
