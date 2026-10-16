import { Navigate, useNavigate } from 'react-router-dom'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { BrandLoading } from '@/components/branding/BrandLoading'
import { usePageTrail } from '@/components/layout/PageNavigation'
import ConfigManagement from './ConfigManagement'
import { SettingsRelatedLinks } from '../components/SettingsRelatedLinks'
import './config.css'

/** Descubrir un catálogo no autoriza a montar el borrador de preferencias generales. */
export default function ConfigEntryPage() {
  const auth = useAuthPermissions(), navigate = useNavigate()
  usePageTrail(auth.hasPermission('settings.view', 'settings.manage') ? null : [])
  if (auth.isLoading || !auth.permissionsReady) return <BrandLoading message="Preparando Configuración…" />
  if (auth.hasPermission('settings.view', 'settings.manage')) return <ConfigManagement />
  if (!auth.hasPermission('catalogs.view', 'catalogs.manage')) return <Navigate to="/404" replace />
  return <div className="config-page"><div className="mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-8">
    <h1 className="sr-only">Configuración</h1>
    <p className="text-sm text-muted-foreground">Catálogos disponibles con tus permisos. Los ajustes generales de empresa requieren un acceso adicional.</p>
    <SettingsRelatedLinks catalogsOnly confirmLeave={to => navigate(to)} />
  </div></div>
}
