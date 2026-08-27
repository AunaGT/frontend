/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Hook que expone la configuración del sistema (timezone, moneda, etc.)
 * desde el contexto. Dentro de SystemSettingsProvider hace una sola petición
 * compartida; fuera del provider devuelve valores por defecto.
 */

import { useContext } from 'react'
import { SystemSettingsContext } from '@/context/SystemSettingsContext'

const DEFAULT_TIMEZONE = 'America/Guatemala'
const DEFAULT_COMPANY_NAME = 'Auna'
const DEFAULT_CURRENCY_CODE = 'GTQ'
const DEFAULT_CURRENCY_NAME = 'Quetzal'
const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy'
const DEFAULT_LOCALE = 'es-GT'
const DEFAULT_CASH_CLOSURE_MAX_DIFF_PCT = 5

/** Map symbol-like or legacy codes to ISO 4217 for Intl.NumberFormat. */
const CURRENCY_CODE_ALIASES: Record<string, string> = {
  'Q': 'GTQ',
  'US$': 'USD',
  'MX$': 'MXN',
}

function toValidCurrencyCode(code: string | undefined): string {
  if (!code?.trim()) return DEFAULT_CURRENCY_CODE
  const upper = code.trim().toUpperCase()
  if (CURRENCY_CODE_ALIASES[code.trim()]) return CURRENCY_CODE_ALIASES[code.trim()]
  if (CURRENCY_CODE_ALIASES[upper]) return CURRENCY_CODE_ALIASES[upper]
  return code.trim().length === 3 ? code.trim() : DEFAULT_CURRENCY_CODE
}

export interface UseSystemSettingsReturn {
  timezone: string
  currencyCode: string
  currencyName: string
  companyName: string
  companyLogoUrl: string
  dateFormat: string
  locale: string
  /** Diferencia máxima (%) en cierre de caja para mostrar advertencia */
  cashClosureMaxDiffPct: number
  /** Régimen de IVA ante la SAT */
  vatRegime: 'general' | 'pequeno'
  /** Tasa de IVA general en % */
  ivaRate: number
  loading: boolean
  /** Recarga la configuración pública (útil tras guardar en Configuración). */
  refetch: () => void
}

/** Usa el contexto de SystemSettingsProvider; si no hay provider, devuelve valores por defecto. */
export function useSystemSettings(): UseSystemSettingsReturn {
  const ctx = useContext(SystemSettingsContext)
  if (ctx === undefined) {
    return {
      timezone: DEFAULT_TIMEZONE,
      currencyCode: DEFAULT_CURRENCY_CODE,
      currencyName: DEFAULT_CURRENCY_NAME,
      companyName: DEFAULT_COMPANY_NAME,
      companyLogoUrl: '',
      dateFormat: DEFAULT_DATE_FORMAT,
      locale: DEFAULT_LOCALE,
      cashClosureMaxDiffPct: DEFAULT_CASH_CLOSURE_MAX_DIFF_PCT,
      vatRegime: 'general',
      ivaRate: 12,
      loading: false,
      refetch: () => {}
    }
  }
  return {
    timezone: ctx.timezone,
    currencyCode: toValidCurrencyCode(ctx.currencyCode),
    currencyName: ctx.currencyName,
    companyName: ctx.companyName,
    companyLogoUrl: ctx.companyLogoUrl,
    dateFormat: ctx.dateFormat,
    locale: ctx.locale,
    cashClosureMaxDiffPct: ctx.cashClosureMaxDiffPct,
    vatRegime: ctx.vatRegime,
    ivaRate: ctx.ivaRate,
    loading: ctx.loading,
    refetch: ctx.refetch
  }
}
