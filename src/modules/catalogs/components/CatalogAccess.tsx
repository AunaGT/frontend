import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { BrandLoading } from '@/components/branding/BrandLoading'
import { useModules } from '@/context/useModules'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import type { CatalogKind } from '../pages/CatalogPanelPage'

/** Configuración es un prefijo protegido: no debe eludir la disponibilidad de Catálogos. */
export function CatalogAccess({ kind, importing = false, children }: { kind: CatalogKind; importing?: boolean; children: ReactNode }) {
  const modules = useModules()
  const auth = useAuthPermissions()
  if (modules.isLoading || auth.isLoading || !auth.permissionsReady) return <BrandLoading message="Preparando catálogo…" />
  if (modules.isError || !modules.enabledModuleCodes || !modules.isEnabled('catalogs') || (kind === 'categories' && !modules.isEnabled('inventory'))) {
    return <div role="status" className="mx-auto max-w-xl p-8 text-sm text-muted-foreground">Catálogo no disponible para la empresa seleccionada. Revisa los módulos activos.</div>
  }
  const permissions = importing ? ['catalogs.manage'] : kind === 'cash-registers' ? ['catalogs.view', 'catalogs.manage', 'settings.manage'] : ['catalogs.view', 'catalogs.manage']
  if (!auth.hasPermission(...permissions)) return <Navigate to="/404" replace />
  return <>{children}</>
}
