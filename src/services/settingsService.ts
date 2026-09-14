/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 */

import { apiFetch, getApiBaseUrl } from './api'
import type { ExperienceProfile } from '@/config/experienceProfiles'

export interface SystemSettings {
  currency_code?: string
  currency_name?: string
  timezone?: string
  company_name?: string
  company_logo_url?: string
  date_format?: string
  locale?: string
  cash_closure_max_diff_pct?: string
  quote_validity_days?: string
  order_validity_days?: string
  quote_soft_hold_hours?: string
  cash_closure_denominations?: { denomination: number; type: string }[]
  // Datos fiscales (FEL)
  company_nit?: string
  company_address?: string
  company_municipality?: string
  company_department?: string
  company_postal_code?: string
  establishment_code?: string
  vat_affiliation?: string
  iva_rate?: string
  pequeno_rate?: string
  default_experience_profile?: ExperienceProfile
  sales_allow_credit?: string
  sales_show_fiscal_fields?: string
  sales_show_channels?: string
}

export interface DenominationItem {
  denomination: number
  type: 'Billete' | 'Moneda'
  quantity?: number
  subtotal?: number
}

export async function getSettings(): Promise<SystemSettings> {
  return apiFetch<SystemSettings>('/settings')
}

/** Timezone, moneda, company_name y opciones de formato/advertencias para cualquier usuario autenticado. */
export async function getPublicSettings(): Promise<{
  timezone: string
  currency_code: string
  currency_name: string
  company_name: string
  company_logo_url: string
  date_format: string
  locale: string
  cash_closure_max_diff_pct: string
  vat_affiliation: string
  iva_rate: string
  default_experience_profile: ExperienceProfile
  sales_allow_credit: string
  sales_show_fiscal_fields: string
  sales_show_channels: string
}> {
  return apiFetch('/settings/public')
}

/** Nombre y logo públicos (login / cotización pública). */
export async function getCompanyNamePublic(): Promise<{ company_name: string; company_logo_url?: string }> {
  const base = import.meta.env.VITE_API_URL ?? ''
  const path = base.endsWith('/') ? base + 'settings/company-name' : base + '/settings/company-name'
  const res = await fetch(path)
  if (!res.ok) return { company_name: 'Deposito' }
  const data = await res.json()
  return {
    company_name: (data?.company_name && String(data.company_name).trim()) || 'Deposito',
    company_logo_url: (data?.company_logo_url && String(data.company_logo_url).trim()) || '',
  }
}

export async function uploadCompanyLogo(file: File): Promise<{ imageUrl: string; company_logo_url: string }> {
  // La sesión son cookies httpOnly: no hay bearer que mandar. Exigir uno hacía
  // fallar toda subida con "No estás autenticado" sin llegar al servidor.
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch(`${getApiBaseUrl()}/settings/upload-logo`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Error al subir el logo')
  const imageUrl = data.imageUrl ?? data.company_logo_url
  if (!imageUrl) throw new Error('No se recibió la URL del logo')
  return { imageUrl, company_logo_url: imageUrl }
}

export async function removeCompanyLogo(): Promise<void> {
  await apiFetch('/settings/logo', { method: 'DELETE' })
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  return apiFetch<SystemSettings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify({ settings }),
  })
}

export async function getDenominations(): Promise<DenominationItem[]> {
  try {
    const data = await apiFetch<DenominationItem[]>('/settings/denominations')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
