export const EXPERIENCE_PROFILES = ['CASHIER', 'MANAGER', 'OWNER', 'ADVANCED'] as const

export type ExperienceProfile = (typeof EXPERIENCE_PROFILES)[number]

export const EXPERIENCE_PROFILE_LABELS: Record<ExperienceProfile, string> = {
  CASHIER: 'Cajero',
  MANAGER: 'Encargado',
  OWNER: 'Dueño',
  ADVANCED: 'Avanzado',
}

export const EXPERIENCE_PROFILE_DESCRIPTIONS: Record<ExperienceProfile, string> = {
  CASHIER: 'Prioriza cobros rápidos y oculta detalles hasta que se necesiten.',
  MANAGER: 'Mantiene el flujo simple y deja accesibles controles operativos.',
  OWNER: 'Muestra contexto del negocio sin saturar el punto de venta.',
  ADVANCED: 'Deja visibles cliente, datos fiscales, canales y herramientas avanzadas.',
}

export function isExperienceProfile(value: unknown): value is ExperienceProfile {
  return EXPERIENCE_PROFILES.includes(value as ExperienceProfile)
}

export function profileFromRole(roleName?: string | null): ExperienceProfile {
  const role = (roleName ?? '').toLowerCase()
  if (role.includes('admin')) return 'ADVANCED'
  if (role.includes('dueñ') || role.includes('owner') || role.includes('propiet')) return 'OWNER'
  if (role.includes('encarg') || role.includes('supervisor') || role.includes('manager')) return 'MANAGER'
  if (role.includes('caj') || role.includes('vend') || role.includes('seller')) return 'CASHIER'
  return 'CASHIER'
}
