import { useAuth } from '@/context/useAuth'
import { useTenant } from '@/context/useTenant'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import {
  isExperienceProfile,
  profileFromRole,
  type ExperienceProfile,
} from '@/config/experienceProfiles'

/**
 * Resuelve únicamente densidad y revelado progresivo de la interfaz.
 * La autorización siempre se consulta por separado con hasPermission().
 */
export function useExperienceProfile(): {
  profile: ExperienceProfile
  isCompact: boolean
  showAdvancedByDefault: boolean
} {
  const { user } = useAuth()
  const { company } = useTenant()
  const { defaultExperienceProfile } = useSystemSettings()
  const explicit = company?.experience_profile
  const profile = isExperienceProfile(explicit)
    ? explicit
    : isExperienceProfile(defaultExperienceProfile)
      ? defaultExperienceProfile
      : profileFromRole(user?.role?.name)

  return {
    profile,
    isCompact: profile === 'CASHIER',
    showAdvancedByDefault: profile === 'ADVANCED',
  }
}
