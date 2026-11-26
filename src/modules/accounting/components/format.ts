/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import type { AccountType, JournalSourceType, JournalEntry } from '@/services/accountingService'

export const fmtQ = (n: number | string) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 2 }).format(Number(n) || 0)

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const SOURCE_LABELS: Record<JournalSourceType, string> = {
  MANUAL: 'Manual',
  SALE: 'Venta',
  RETURN: 'Devolución',
  PURCHASE: 'Compra',
  PURCHASE_PAYMENT: 'Abono',
  CLOSING: 'Cierre',
  STOCK_ADJUSTMENT: 'Ajuste de inventario',
  PAYROLL: 'Nómina',
  PAYROLL_PAYMENT: 'Pago de nómina',
  PAYROLL_ADVANCE: 'Anticipo de nómina',
  CUSTOMER_ADVANCE: 'Anticipo de cliente',
  CUSTOMER_ADVANCE_APPLIED: 'Aplicación de anticipo',
  CUSTOMER_PAYMENT_REFUND: 'Devolución de anticipo',
  CASH_CLOSURE: 'Arqueo de caja',
  CASH_CLOSURE_CORRECTION: 'Corrección de arqueo',
  CASH_SETTLEMENT: 'Liquidación bancaria',
  CASH_DISPUTE_EFFECT: 'Movimiento de disputa',
  CASH_DISPUTE_DISPOSITION: 'Resolución de disputa',
  CASH_DISPUTE_ADJUSTMENT: 'Ajuste de disputa',
}

export const canReverseJournalEntry = (entry: Pick<JournalEntry,'source_type'|'reversal_of_id'|'reversals'>) => !entry.reversal_of_id && !entry.reversals?.length && !['CLOSING','CASH_CLOSURE_CORRECTION','CASH_DISPUTE_EFFECT','CASH_DISPUTE_DISPOSITION','CASH_DISPUTE_ADJUSTMENT'].includes(entry.source_type)

export const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Activo',
  LIABILITY: 'Pasivo',
  EQUITY: 'Capital',
  INCOME: 'Ingresos',
  COST: 'Costos',
  EXPENSE: 'Gastos',
}

export const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Fecha local de hoy en formato YYYY-MM-DD (para inputs type=date). */
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Rango elegido, en texto: lo usa el diálogo de exportación de cada pestaña. */
export const rangoTexto = (from?: string, to?: string) =>
  from || to ? `Del ${from || 'inicio'} al ${to || 'hoy'}` : 'Todos los movimientos'
