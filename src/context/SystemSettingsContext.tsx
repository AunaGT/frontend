/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Contexto de configuración del sistema (timezone, moneda, company_name).
 * Una sola petición GET /api/settings/public por árbol de rutas privadas.
 */

import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { getPublicSettings } from '@/services/settingsService'
import type { ExperienceProfile } from '@/config/experienceProfiles'
import { useTenant } from './useTenant'
import { useAuth } from './useAuth'

const DEFAULT_TIMEZONE = 'America/Guatemala'
const DEFAULT_COMPANY_NAME = 'Auna'
const DEFAULT_CURRENCY_CODE = 'GTQ'
const DEFAULT_CURRENCY_NAME = 'Quetzal'
const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy'
const DEFAULT_LOCALE = 'es-GT'
const DEFAULT_CASH_CLOSURE_MAX_DIFF_PCT = 5
const DEFAULT_IVA_RATE = 12

export interface SystemSettingsState {
  timezone: string
  currencyCode: string
  currencyName: string
  companyName: string
  companyLogoUrl: string
  dateFormat: string
  locale: string
  /** Diferencia máxima permitida en cierre de caja (%) para mostrar advertencia */
  cashClosureMaxDiffPct: number
  /** Régimen de IVA ante la SAT (SystemSetting vat_affiliation) */
  vatRegime: 'general' | 'pequeno'
  /** Tasa de IVA general en % (SystemSetting iva_rate) */
  ivaRate: number
  defaultExperienceProfile: ExperienceProfile
  salesAllowCredit: boolean
  salesShowFiscalFields: boolean
  salesShowChannels: boolean
  inventoryServicesEnabled: boolean
  inventoryUnitsEnabled: boolean
  loading: boolean
  error: boolean
  /** Recarga la configuración pública desde el servidor (p. ej. tras guardar en Configuración). */
  refetch: () => Promise<boolean>
}

const defaultState: Omit<SystemSettingsState, 'refetch'> = {
  timezone: DEFAULT_TIMEZONE,
  currencyCode: DEFAULT_CURRENCY_CODE,
  currencyName: DEFAULT_CURRENCY_NAME,
  companyName: DEFAULT_COMPANY_NAME,
  companyLogoUrl: '',
  dateFormat: DEFAULT_DATE_FORMAT,
  locale: DEFAULT_LOCALE,
  cashClosureMaxDiffPct: DEFAULT_CASH_CLOSURE_MAX_DIFF_PCT,
  vatRegime: 'general',
  ivaRate: DEFAULT_IVA_RATE,
  defaultExperienceProfile: 'CASHIER',
  salesAllowCredit: true,
  salesShowFiscalFields: true,
  salesShowChannels: true,
  inventoryServicesEnabled: false,
  inventoryUnitsEnabled: false,
  loading: true,
  error: false
}

export const SystemSettingsContext = createContext<SystemSettingsState | undefined>(undefined)

export function SystemSettingsProvider({ children }: { children: React.ReactNode }) {
  const { company, branch, isConsolidated } = useTenant()
  const { user, isLoading } = useAuth()
  const companyId = company?.id || '', branchId = branch?.id || (isConsolidated ? 'all' : '')
  const contextKey = JSON.stringify([user?.id, user?.permissions, isLoading, companyId, branchId])
  const [state, setState] = useState<Omit<SystemSettingsState, 'refetch'>>(defaultState)
  const generation = useRef(0)
  const liveKey = useRef(contextKey), stateKey = useRef(contextKey)
  if (liveKey.current !== contextKey) { liveKey.current = contextKey; generation.current++ }

  const load = useCallback(async (): Promise<boolean> => {
    if (liveKey.current !== contextKey || !user?.id || isLoading || !companyId || !branchId) return false
    const request = ++generation.current
    stateKey.current = contextKey
    setState({ ...defaultState })
    return getPublicSettings({ scope: { companyId, branchId } })
      .then((d) => {
        if (request !== generation.current || liveKey.current !== contextKey) return false
        const pctRaw = d?.cash_closure_max_diff_pct != null ? String(d.cash_closure_max_diff_pct).trim() : ''
        const pctNumber = Number(pctRaw)
        const pct = pctRaw === '' || !Number.isFinite(pctNumber) ? DEFAULT_CASH_CLOSURE_MAX_DIFF_PCT : Math.max(0, pctNumber)
        setState({
          timezone: (d?.timezone && String(d.timezone).trim()) || DEFAULT_TIMEZONE,
          currencyCode: (d?.currency_code && String(d.currency_code).trim()) || DEFAULT_CURRENCY_CODE,
          currencyName: (d?.currency_name && String(d.currency_name).trim()) || DEFAULT_CURRENCY_NAME,
          companyName: (d?.company_name && String(d.company_name).trim()) || DEFAULT_COMPANY_NAME,
          companyLogoUrl: (d?.company_logo_url && String(d.company_logo_url).trim()) || '',
          dateFormat: (d?.date_format && String(d.date_format).trim()) || DEFAULT_DATE_FORMAT,
          locale: (d?.locale && String(d.locale).trim()) || DEFAULT_LOCALE,
          cashClosureMaxDiffPct: pct,
          vatRegime: /peque/i.test(d?.vat_affiliation || '') ? 'pequeno' : 'general',
          ivaRate: (() => { const n = parseFloat(String(d?.iva_rate ?? '')); return Number.isFinite(n) && n >= 0 && n < 100 ? n : DEFAULT_IVA_RATE })(),
          defaultExperienceProfile: ['CASHIER', 'MANAGER', 'OWNER', 'ADVANCED'].includes(String(d?.default_experience_profile))
            ? d.default_experience_profile
            : 'CASHIER',
          salesAllowCredit: String(d?.sales_allow_credit ?? 'true').toLowerCase() === 'true',
          salesShowFiscalFields: String(d?.sales_show_fiscal_fields ?? 'true').toLowerCase() === 'true',
          salesShowChannels: String(d?.sales_show_channels ?? 'true').toLowerCase() === 'true',
          inventoryServicesEnabled: String(d?.inventory_services_enabled ?? 'false').toLowerCase() === 'true',
          inventoryUnitsEnabled: String(d?.inventory_units_enabled ?? 'false').toLowerCase() === 'true',
          loading: false,
          error: false
        })
        return true
      })
      .catch(() => {
        if (request !== generation.current || liveKey.current !== contextKey) return false
        setState((s) => ({
          ...s,
          timezone: DEFAULT_TIMEZONE,
          currencyCode: DEFAULT_CURRENCY_CODE,
          currencyName: DEFAULT_CURRENCY_NAME,
          companyName: DEFAULT_COMPANY_NAME,
          companyLogoUrl: '',
          dateFormat: DEFAULT_DATE_FORMAT,
          locale: DEFAULT_LOCALE,
          cashClosureMaxDiffPct: DEFAULT_CASH_CLOSURE_MAX_DIFF_PCT,
          vatRegime: 'general',
          ivaRate: DEFAULT_IVA_RATE,
          defaultExperienceProfile: 'CASHIER',
          salesAllowCredit: true,
          salesShowFiscalFields: true,
          salesShowChannels: true,
          inventoryServicesEnabled: false,
          inventoryUnitsEnabled: false,
          loading: false,
          error: true
        }))
        return false
      })
  }, [contextKey, companyId, branchId, user?.id, isLoading])

  useEffect(() => {
    const requests = generation
    load()
    return () => { requests.current++ }
  }, [load])

  const value: SystemSettingsState = { ...(stateKey.current === contextKey ? state : defaultState), refetch: load }

  return (
    <SystemSettingsContext.Provider value={value}>
      {children}
    </SystemSettingsContext.Provider>
  )
}
