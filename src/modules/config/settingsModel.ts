import type { SystemSettings } from '@/services/settingsService'
import { DEFAULT_RETURN_POLICY } from '@/modules/returns/policy'
import { returnPolicyPayload, validateReturnPolicyDraft, type ReturnPolicyFieldPath } from './returnPolicyModel'
import {DEFAULT_EXPIRY_ALERT_POLICY,expiryPolicyPayload,validateExpiryPolicyDraft,type ExpiryPolicyFieldPath} from './expiryPolicyModel'

export const SECTION_KEYS = {
  empresa: ['company_name'],
  regional: ['currency_code', 'currency_name', 'timezone', 'date_format', 'locale'],
  fiscal: ['fel_enabled', 'company_nit', 'company_address', 'company_municipality', 'company_department', 'company_postal_code', 'establishment_code', 'vat_affiliation'],
  inventario: ['inventory_services_enabled','inventory_units_enabled','inventory.expiry_alert_policy'],
  ventas: ['default_experience_profile', 'sales_allow_credit', 'sales_show_fiscal_fields', 'sales_show_channels'],
  cotizaciones: ['quote_validity_days', 'quote_soft_hold_hours'],
  pedidos: ['order_validity_days'],
  devoluciones: ['returns.policy'],
  caja: ['cash_closure_max_diff_pct', 'cash_closure_denominations'],
} as const satisfies Record<string, readonly (keyof SystemSettings)[]>
export type EditableSection = keyof typeof SECTION_KEYS
export type SettingsSection = EditableSection | 'rrhh' | 'nomina' | 'modulos' | 'accesos' | 'historial' | 'hardware'
export type SectionValues = Partial<SystemSettings>
export type FieldErrors = Partial<Record<keyof SystemSettings | ReturnPolicyFieldPath | ExpiryPolicyFieldPath, string>>
export const SETTINGS_SECTIONS: readonly { id: SettingsSection; group: string; label: string; keywords: readonly string[] }[] = [
  { id: 'empresa', group: 'Empresa', label: 'Identidad', keywords: ['nombre', 'logo', 'empresa'] },
  { id: 'regional', group: 'Empresa', label: 'Región y formatos', keywords: ['moneda', 'zona horaria', 'idioma', 'fecha'] },
  { id: 'fiscal', group: 'Facturación', label: 'Datos fiscales', keywords: ['NIT', 'FEL', 'facturas', 'impuestos', 'dirección'] },
  { id: 'inventario', group: 'Operación', label: 'Inventario', keywords: ['bienes', 'servicios', 'impresión', 'etiquetas', 'códigos de barras','vencimientos','lotes','anticipación','prioridad'] },
  { id: 'ventas', group: 'Operación', label: 'Ventas y POS', keywords: ['experiencia', 'crédito', 'canales', 'caja', 'fiscal'] },
  { id: 'cotizaciones', group: 'Operación', label: 'Cotizaciones', keywords: ['vigencia', 'reserva temporal', 'horas'] },
  { id: 'pedidos', group: 'Operación', label: 'Pedidos', keywords: ['vigencia', 'reserva', 'días'] },
  { id: 'devoluciones', group: 'Operación', label: 'Devoluciones', keywords: ['plazo', 'excepciones', 'reembolsos', 'resoluciones', 'cambios'] },
  { id: 'caja', group: 'Operación', label: 'Caja y cierres', keywords: ['billetes', 'monedas', 'denominaciones', 'tolerancia', 'diferencia'] },
  { id: 'hardware', group: 'Operación', label: 'Hardware y puntos de cobro', keywords: ['lector', 'impresora', 'hardware', 'puesto', 'gaveta', 'equipo', 'ticket', 'USB'] },
  { id: 'rrhh', group: 'Operación', label: 'Recursos humanos', keywords: ['expedientes', 'documentos', 'empleados', 'requisitos'] },
  { id:'nomina',group:'Operación',label:'Nómina',keywords:['tasas','IGSS','ISR','provisiones','bonificación','vigencias'] },
  { id: 'modulos', group: 'Administración', label: 'Módulos', keywords: ['activación', 'dependencias', 'disponibilidad'] },
  { id: 'accesos', group: 'Administración', label: 'Accesos relacionados', keywords: ['pagos', 'cobros', 'cajas', 'condiciones', 'agenda', 'contabilidad', 'roles', 'permisos', 'catálogos'] },
  { id: 'historial', group: 'Administración', label: 'Historial de ajustes', keywords: ['auditoría', 'cambios', 'quién', 'revisiones'] },
]

const defaults: SystemSettings = {
  'inventory.expiry_alert_policy':DEFAULT_EXPIRY_ALERT_POLICY,
  'returns.policy': DEFAULT_RETURN_POLICY,
  company_name: '', currency_code: 'GTQ', currency_name: 'Quetzal', timezone: 'America/Guatemala', date_format: 'dd/MM/yyyy', locale: 'es-GT',
  cash_closure_max_diff_pct: '5', cash_closure_denominations: [], quote_validity_days: '30', order_validity_days: '7', quote_soft_hold_hours: '48',
  inventory_services_enabled: 'false', inventory_units_enabled:'false', default_experience_profile: 'CASHIER', sales_allow_credit: 'true', sales_show_fiscal_fields: 'true', sales_show_channels: 'true',
  fel_enabled: 'false', company_nit: '', company_address: '', company_municipality: '', company_department: '', company_postal_code: '', establishment_code: '', vat_affiliation: '',
}
const days = new Set(['quote_validity_days', 'order_validity_days', 'quote_soft_hold_hours'])
const booleans = new Set(['inventory_services_enabled', 'inventory_units_enabled', 'sales_allow_credit', 'sales_show_fiscal_fields', 'sales_show_channels', 'fel_enabled'])
const positiveInteger = (v: unknown) => ['number', 'string'].includes(typeof v) && Number.isSafeInteger(Number(v)) && Number(v) >= 1
function normalized(key: string, value: unknown): unknown {
  if(key==='inventory.expiry_alert_policy')return expiryPolicyPayload(value)
  if (key === 'returns.policy') return returnPolicyPayload(value)
  if (days.has(key) && positiveInteger(value)) return String(Number(value))
  if (booleans.has(key) && ['true', 'false'].includes(String(value).toLowerCase())) return String(value).toLowerCase()
  if (key === 'cash_closure_denominations' && Array.isArray(value)) return value.filter(d => Number(d?.denomination) !== 0).map(d => ({ denomination: Number(d?.denomination), type: d?.type }))
  return value
}
export function sectionValues(id: EditableSection, settings: SystemSettings): SectionValues {
  return Object.fromEntries(SECTION_KEYS[id].map(key => [key, structuredClone(settings[key] === undefined ? defaults[key] : settings[key])]))
}
export function sectionPayload(id: EditableSection, draft: SectionValues): SectionValues {
  return Object.fromEntries(SECTION_KEYS[id].filter(key => draft[key] !== undefined).map(key => [key, normalized(key, draft[key])]))
}
export function sameSection(id: EditableSection, a: SectionValues, b: SectionValues): boolean {
  return JSON.stringify(sectionPayload(id, sectionValues(id, a))) === JSON.stringify(sectionPayload(id, sectionValues(id, b)))
}
export function validateSection(id: EditableSection, draft: SectionValues): FieldErrors {
  if (id === 'devoluciones') return validateReturnPolicyDraft(draft['returns.policy'])
  const errors: FieldErrors = {}
  for (const key of SECTION_KEYS[id]) {
    if (days.has(key) && !positiveInteger(draft[key])) errors[key] = 'Ingresa un número entero de al menos 1.'
    if (booleans.has(key) && !['true', 'false'].includes(String(draft[key]).toLowerCase())) errors[key] = 'Selecciona una opción válida.'
  }
  if (id === 'regional') {
    if (!['GTQ', 'MXN', 'USD'].includes(draft.currency_code || '')) errors.currency_code = 'Selecciona una moneda de la lista para actualizar esta sección.'
    if (!['America/Guatemala', 'America/El_Salvador', 'UTC'].includes(draft.timezone || '')) errors.timezone = 'Selecciona una zona horaria de la lista.'
    if (!['es-GT', 'es-MX', 'en-US'].includes(draft.locale || '')) errors.locale = 'Selecciona un idioma y formato regional de la lista.'
    if (!['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'].includes(draft.date_format || '')) errors.date_format = 'Selecciona un formato de fecha de la lista.'
  }
  if (id === 'ventas' && !['CASHIER', 'MANAGER', 'OWNER', 'ADVANCED'].includes(String(draft.default_experience_profile))) errors.default_experience_profile = 'Selecciona un perfil de la lista.'
  if (id === 'fiscal' && !['', 'general', 'pequeno_contribuyente', 'no_obligado', 'exento', 'otro'].includes(draft.vat_affiliation || '')) errors.vat_affiliation = 'Selecciona una afiliación de la lista.'
  if (id === 'caja') {
    const pct = draft.cash_closure_max_diff_pct
    if (typeof pct !== 'string' || !pct.trim() || !Number.isFinite(Number(pct)) || Number(pct) < 0) errors.cash_closure_max_diff_pct = 'Ingresa un porcentaje mayor o igual a 0.'
    const list = sectionPayload(id, draft).cash_closure_denominations
    if (!Array.isArray(list) || list.some(d => !Number.isFinite(d.denomination) || d.denomination <= 0 || !['Billete', 'Moneda'].includes(d.type))) errors.cash_closure_denominations = 'Cada denominación debe ser mayor a 0 y de tipo Billete o Moneda.'
  }
  return {...errors,...(id==='inventario'?validateExpiryPolicyDraft(draft['inventory.expiry_alert_policy']):{})}
}
const searchable = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
export function findSettingsSections(term: string): typeof SETTINGS_SECTIONS {
  const query = searchable(term)
  return query ? SETTINGS_SECTIONS.filter(section => searchable([section.group, section.label, ...section.keywords].join(' ')).includes(query)) : SETTINGS_SECTIONS
}
