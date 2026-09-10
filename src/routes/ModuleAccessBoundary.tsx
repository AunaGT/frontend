import { Loader2, LockKeyhole } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { findModuleForPath } from '@/config/appModules'
import { useModules } from '@/context/useModules'

/** Bloquea páginas de módulos no contratados; los permisos se validan después. */
export const ModuleAccessBoundary = () => {
  const location = useLocation()
  const { isEnabled, isLoading } = useModules()
  const module = findModuleForPath(location.pathname)

  if (module && isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (module && !isEnabled(module.id)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <LockKeyhole className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Módulo no disponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {module.label} no está activo para la empresa seleccionada.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Volver a módulos</Link>
          </Button>
        </div>
      </div>
    )
  }

  return <Outlet />
}

export default ModuleAccessBoundary
